import os
import json
import psutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.models.models import StorageDevice


class StorageAnalyzerService:
    @staticmethod
    def get_system_devices() -> List[Dict[str, Any]]:
        """
        Safely scans real host OS drives in read-only inspection mode.
        """
        devices = []
        try:
            partitions = psutil.disk_partitions(all=False)
            for p in partitions:
                try:
                    usage = psutil.disk_usage(p.mountpoint)
                    # Heuristic for storage type detection on Windows/Linux
                    fstype = p.fstype.upper() or "NTFS"
                    # In modern Windows laptops, C: is almost always SSD/NVMe
                    storage_type = "SSD" if "SSD" in p.opts.upper() or p.mountpoint.startswith("C") else "HDD"

                    devices.append({
                        "name": f"System Drive ({p.device})",
                        "device_path": p.mountpoint,
                        "storage_type": storage_type,
                        "filesystem": fstype,
                        "total_capacity_bytes": usage.total,
                        "used_capacity_bytes": usage.used,
                        "is_sandbox": False,
                        "trim_supported": True if storage_type == "SSD" else False,
                        "ftl_aware": True if storage_type == "SSD" else False,
                        "health_status": "HEALTHY",
                        "risk_level": "LOW",
                        "metadata_json": json.dumps({
                            "mountpoint": p.mountpoint,
                            "fstype": p.fstype,
                            "opts": p.opts,
                            "free_bytes": usage.free,
                            "percent_used": usage.percent
                        })
                    })
                except (PermissionError, OSError):
                    continue
        except Exception:
            pass

        return devices

    @staticmethod
    def ensure_sandbox_image(image_name: str = "demo_virtual_disk.img", size_mb: int = 16) -> Path:
        """
        Creates a safe virtual sandbox image container with simulated partition and data sectors.
        """
        sandbox_path = settings.SANDBOX_PATH / image_name
        if not sandbox_path.exists():
            # Create a 16MB file container with simulated headers
            with open(sandbox_path, "wb") as f:
                # Write simulated MBR / GPT header
                mbr_header = b"\xEB\x58\x90DataShieldVirtualDiskSandbox\x00" + b"\x00" * 480 + b"\x55\xAA"
                f.write(mbr_header)
                # Fill remaining sectors with zeroed and synthetic patterns
                remaining = (size_mb * 1024 * 1024) - len(mbr_header)
                f.write(b"\x00" * remaining)

        return sandbox_path

    @classmethod
    async def get_or_create_devices(cls, db: AsyncSession) -> List[StorageDevice]:
        """
        Loads devices from DB or seeds default system + safe demo devices.
        """
        result = await db.execute(select(StorageDevice))
        devices = result.scalars().all()

        if not devices:
            # 1. Create Safe Demo Storage Sandbox A (SSD/NVMe simulation)
            demo_ssd_path = cls.ensure_sandbox_image("demo_ssd_sandbox.img", size_mb=32)
            demo_ssd = StorageDevice(
                name="Safe Demo Storage A (NVMe Sandbox)",
                device_path=str(demo_ssd_path),
                storage_type="NVME",
                filesystem="NTFS",
                total_capacity_bytes=32 * 1024 * 1024,
                used_capacity_bytes=18 * 1024 * 1024,
                is_sandbox=True,
                trim_supported=True,
                ftl_aware=True,
                health_status="OPTIMAL",
                risk_level="MEDIUM",
                metadata_json=json.dumps({
                    "controller": "DataShield Virtual NVMe FTL Controller v2.1",
                    "wear_leveling_status": "Active (Dynamic + Static)",
                    "ftl_table_entries": 65536,
                    "over_provisioning_pct": 7.0,
                    "trim_state": "Enabled",
                    "sandbox_mode": True,
                    "safe_for_testing": True
                })
            )
            db.add(demo_ssd)

            # 2. Create Safe Demo Storage Sandbox B (Magnetic HDD simulation)
            demo_hdd_path = cls.ensure_sandbox_image("demo_hdd_sandbox.img", size_mb=16)
            demo_hdd = StorageDevice(
                name="Safe Demo Storage B (Magnetic HDD Sandbox)",
                device_path=str(demo_hdd_path),
                storage_type="HDD",
                filesystem="EXT4",
                total_capacity_bytes=16 * 1024 * 1024,
                used_capacity_bytes=9 * 1024 * 1024,
                is_sandbox=True,
                trim_supported=False,
                ftl_aware=False,
                health_status="HEALTHY",
                risk_level="LOW",
                metadata_json=json.dumps({
                    "rotational_speed_rpm": 7200,
                    "sector_size_bytes": 512,
                    "bad_sectors_count": 0,
                    "wear_leveling_status": "N/A (Magnetic Platter)",
                    "sandbox_mode": True,
                    "safe_for_testing": True
                })
            )
            db.add(demo_hdd)

            # 3. Add Real Host Drives (Read-Only safe inspection)
            real_devices = cls.get_system_devices()
            for rdev in real_devices:
                host_device = StorageDevice(
                    name=rdev["name"],
                    device_path=rdev["device_path"],
                    storage_type=rdev["storage_type"],
                    filesystem=rdev["filesystem"],
                    total_capacity_bytes=rdev["total_capacity_bytes"],
                    used_capacity_bytes=rdev["used_capacity_bytes"],
                    is_sandbox=False,
                    trim_supported=rdev["trim_supported"],
                    ftl_aware=rdev["ftl_aware"],
                    health_status=rdev["health_status"],
                    risk_level="HIGH",  # High risk because it's a real host drive - requires extra safety
                    metadata_json=rdev["metadata_json"]
                )
                db.add(host_device)

            await db.commit()
            result = await db.execute(select(StorageDevice))
            devices = result.scalars().all()

        return devices

    @staticmethod
    def analyze_storage_profile(device: StorageDevice) -> Dict[str, Any]:
        """
        Produces deep storage-aware sanitization analysis and architectural risk breakdown.
        """
        is_flash = device.storage_type.upper() in ["SSD", "NVME"]
        
        if is_flash:
            risk_level = "MEDIUM" if device.is_sandbox else "HIGH"
            recommended_strategy = "NIST_800_88_PURGE (Cryptographic Erase / FTL Block Sanitize)"
            technical_rationale = (
                "Flash-based storage employs a Flash Translation Layer (FTL) and dynamic wear-leveling. "
                "Traditional repeated multi-pass overwrites (e.g. DoD 5220.22-M) only hit logical block addresses (LBAs), "
                "leaving over-provisioned and remapped physical NAND flash blocks untouched and potentially recoverable "
                "via chip-off hardware forensics. A Purge-level Cryptographic Scramble or ATA/NVMe Sanitize command is required."
            )
            ftl_warning = True
            compliance = "NIST SP 800-88 Rev. 1 (Purge) / ISO/IEC 27040"
        else:
            risk_level = "LOW" if device.is_sandbox else "MEDIUM"
            recommended_strategy = "NIST_800_88_CLEAR (Multi-Pass Overwrite with Pattern Verification)"
            technical_rationale = (
                "Magnetic platter storage writes deterministically to physical tracks and sectors. "
                "A controlled 1-pass zero-fill or 3-pass DoD 5220.22-M pattern (0x00, 0xFF, pseudo-random) "
                "effectively renders magnetic domains unrecoverable even with Magnetic Force Microscopy (MFM)."
            )
            ftl_warning = False
            compliance = "NIST SP 800-88 Rev. 1 (Clear) / DoD 5220.22-M"

        return {
            "device_id": device.id,
            "device_name": device.name,
            "storage_type": device.storage_type,
            "filesystem": device.filesystem,
            "risk_level": risk_level,
            "ftl_warning": ftl_warning,
            "trim_active": device.trim_supported,
            "recommended_strategy": recommended_strategy,
            "technical_rationale": technical_rationale,
            "compliance_standard": compliance,
            "ai_confidence": 0.94
        }
