"""
Blockchain-Style Audit Ledger Service
======================================
Tamper-evident SHA-256 hash chain for enterprise audit events.

Design:
  - AuditLog  = application/security event record (existing system)
  - AuditBlock = tamper-evident chain representation (this service)
  - One AuditBlock may reference one AuditLog via audit_log_id

Concurrency safety:
  - Sequential block index with DB-level uniqueness constraint
  - Canonical JSON serialization (sorted keys)
  - UTC timestamps only
  - Atomic block creation within caller's transaction
"""

import hashlib
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, OperationalError

from backend.app.models.enterprise_models import AuditBlock
from backend.app.models.models import User


GENESIS_HASH = "0" * 64  # Genesis block previous_hash


class BlockchainAuditService:

    @classmethod
    async def _get_next_index_and_prev_hash(cls, db: AsyncSession):
        """
        Atomically determine the next block index and previous hash.
        Uses SELECT ... ORDER BY index DESC LIMIT 1 for the latest block.
        """
        result = await db.execute(
            select(AuditBlock).order_by(AuditBlock.index.desc()).limit(1)
        )
        last_block = result.scalars().first()

        if last_block is None:
            return 0, GENESIS_HASH
        else:
            return last_block.index + 1, last_block.hash

    @classmethod
    async def add_block(
        cls,
        db: AsyncSession,
        event_type: str,
        actor: Optional[User] = None,
        actor_id: Optional[str] = None,
        actor_role: Optional[str] = None,
        target_file_id: Optional[str] = None,
        target_user_id: Optional[str] = None,
        source_ip: str = "127.0.0.1",
        details: Optional[Dict[str, Any]] = None,
        audit_log_id: Optional[str] = None,
    ) -> AuditBlock:
        """
        Append a new block to the blockchain audit ledger.
        Hash = SHA-256(index + timestamp + event + actor + target + previous_hash)

        This method should be called within the caller's transaction context.
        The caller is responsible for committing.
        """
        max_retries = 20
        import random
        for attempt in range(max_retries):
            try:
                # Use a nested transaction (savepoint) so we can catch and retry 
                # without invalidating the caller's entire transaction.
                async with db.begin_nested():
                    new_index, previous_hash = await cls._get_next_index_and_prev_hash(db)

                    now = datetime.now(timezone.utc)
                    # Canonical timestamp: ISO 8601 UTC with consistent format
                    timestamp_str = now.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")

                    _actor_id = actor_id or (actor.id if actor else "SYSTEM")
                    _actor_role = actor_role or (actor.role if actor else "system")
                    target = target_file_id or target_user_id or "N/A"
                    # Canonical JSON: sorted keys, no whitespace variance
                    details_str = json.dumps(details or {}, sort_keys=True, separators=(",", ":"))

                    block_hash = AuditBlock.compute_hash(
                        index=new_index,
                        timestamp_str=timestamp_str,
                        event_type=event_type,
                        actor_id=_actor_id,
                        target=target,
                        previous_hash=previous_hash,
                    )

                    block = AuditBlock(
                        index=new_index,
                        timestamp=now,
                        event_type=event_type,
                        actor_id=_actor_id,
                        actor_role=_actor_role,
                        target_file_id=target_file_id,
                        target_user_id=target_user_id,
                        source_ip=source_ip,
                        action_details=details_str,
                        audit_log_id=audit_log_id,
                        previous_hash=previous_hash,
                        hash=block_hash,
                    )

                    db.add(block)
                    # Flush to detect uniqueness violations immediately
                    await db.flush()
                return block
            except (IntegrityError, OperationalError):
                if attempt == max_retries - 1:
                    raise
                # Exponential backoff on collision with jitter
                await asyncio.sleep(random.uniform(0.1, 0.5) * (attempt + 1))

    @classmethod
    def add_block_sync(
        cls,
        session: Session,
        event_type: str,
        actor_id: str = "SYSTEM",
        actor_role: str = "system",
        target_file_id: Optional[str] = None,
        target_user_id: Optional[str] = None,
        source_ip: str = "127.0.0.1",
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditBlock:
        """Synchronous version for use in seed scripts."""

        import time
        max_retries = 20
        import random
        for attempt in range(max_retries):
            try:
                with session.begin_nested():
                    last_block = session.query(AuditBlock).order_by(AuditBlock.index.desc()).first()
                    if last_block is None:
                        new_index = 0
                        previous_hash = GENESIS_HASH
                    else:
                        new_index = last_block.index + 1
                        previous_hash = last_block.hash

                    now = datetime.now(timezone.utc)
                    timestamp_str = now.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")
                    target = target_file_id or target_user_id or "N/A"
                    details_str = json.dumps(details or {}, sort_keys=True, separators=(",", ":"))

                    block_hash = AuditBlock.compute_hash(
                        index=new_index,
                        timestamp_str=timestamp_str,
                        event_type=event_type,
                        actor_id=actor_id,
                        target=target,
                        previous_hash=previous_hash,
                    )

                    block = AuditBlock(
                        index=new_index,
                        timestamp=now,
                        event_type=event_type,
                        actor_id=actor_id,
                        actor_role=actor_role,
                        target_file_id=target_file_id,
                        target_user_id=target_user_id,
                        source_ip=source_ip,
                        action_details=details_str,
                        previous_hash=previous_hash,
                        hash=block_hash,
                    )
                    session.add(block)
                    session.flush()  # Detect uniqueness violations
                
                session.refresh(block)
                return block
            except (IntegrityError, OperationalError):
                if attempt == max_retries - 1:
                    raise
                time.sleep(random.uniform(0.1, 0.5) * (attempt + 1))

    @classmethod
    async def verify_chain(cls, db: AsyncSession) -> Dict[str, Any]:
        """
        Verify the entire blockchain audit chain integrity.
        Returns {"valid": bool, "blocks_checked": int, "error": str | None}
        """
        result = await db.execute(
            select(AuditBlock).order_by(AuditBlock.index.asc())
        )
        blocks = result.scalars().all()

        if not blocks:
            return {"valid": True, "blocks_checked": 0, "error": None}

        for i, block in enumerate(blocks):
            # Verify sequential index
            expected_index = i  # Blocks should be 0, 1, 2, ...
            if block.index != expected_index:
                return {
                    "valid": False,
                    "blocks_checked": i + 1,
                    "error": f"Block index gap: expected {expected_index}, got {block.index}",
                }

            # Verify previous_hash linkage
            if i == 0:
                expected_prev = GENESIS_HASH
            else:
                expected_prev = blocks[i - 1].hash

            if block.previous_hash != expected_prev:
                return {
                    "valid": False,
                    "blocks_checked": i + 1,
                    "error": f"Block {block.index}: previous_hash mismatch (chain broken). Expected {expected_prev[:16]}..., got {block.previous_hash[:16]}...",
                }

            # Recompute and verify hash
            target = block.target_file_id or block.target_user_id or "N/A"
            ts_str = block.timestamp.strftime("%Y-%m-%dT%H:%M:%S.%f+00:00") if block.timestamp else ""
            expected_hash = AuditBlock.compute_hash(
                index=block.index,
                timestamp_str=ts_str,
                event_type=block.event_type,
                actor_id=block.actor_id or "SYSTEM",
                target=target,
                previous_hash=block.previous_hash,
            )

            if block.hash != expected_hash:
                return {
                    "valid": False,
                    "blocks_checked": i + 1,
                    "error": f"Block {block.index}: hash mismatch (tamper detected). Expected {expected_hash[:16]}..., got {block.hash[:16]}...",
                }

        return {"valid": True, "blocks_checked": len(blocks), "error": None}

    @classmethod
    async def get_chain_of_custody(cls, db: AsyncSession, file_id: str) -> List[AuditBlock]:
        """
        Get ordered lifecycle audit blocks for a specific file.
        """
        result = await db.execute(
            select(AuditBlock)
            .where(AuditBlock.target_file_id == file_id)
            .order_by(AuditBlock.index.asc())
        )
        return result.scalars().all()

    @classmethod
    async def get_blocks(cls, db: AsyncSession, limit: int = 100) -> List[AuditBlock]:
        """Get the most recent audit blocks."""
        result = await db.execute(
            select(AuditBlock).order_by(AuditBlock.index.desc()).limit(limit)
        )
        return result.scalars().all()
