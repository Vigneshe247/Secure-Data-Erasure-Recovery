import asyncio
import json
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/ws", tags=["Realtime Telemetry"])


@router.websocket("/erasure/{operation_id}")
async def erasure_progress_ws(websocket: WebSocket, operation_id: str):
    await websocket.accept()
    total_blocks = 64
    try:
        # Simulate real-time hardware sector wiping stream
        for step in range(1, 101):
            await asyncio.sleep(0.05)
            active_block = int((step / 100) * total_blocks)
            
            # Generate sector status matrix
            sectors = []
            for b in range(total_blocks):
                if b < active_block:
                    status = "SANITIZED"
                elif b == active_block:
                    status = "WIPING"
                else:
                    status = "PENDING"
                sectors.append({"block_idx": b, "status": status})

            payload = {
                "operation_id": operation_id,
                "progress_pct": step,
                "active_block": active_block,
                "total_blocks": total_blocks,
                "current_pattern": "0x00 ZERO FILL" if step < 80 else "VERIFYING READ-BACK",
                "bytes_processed": step * 524288,
                "sectors": sectors
            }
            await websocket.send_text(json.dumps(payload))
            if step == 100:
                await websocket.send_text(json.dumps({
                    "operation_id": operation_id,
                    "progress_pct": 100,
                    "status": "COMPLETED",
                    "event": "SANITIZATION_CYCLE_FINISHED"
                }))
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@router.websocket("/recovery/{case_id}")
async def recovery_progress_ws(websocket: WebSocket, case_id: str):
    await websocket.accept()
    total_sectors = 128
    try:
        # Simulate real-time sector carving search
        for step in range(1, 101):
            await asyncio.sleep(0.04)
            current_sector = int((step / 100) * total_sectors)
            found_signature = None
            if step in [15, 35, 55, 75, 90]:
                sigs = ["JPG (FF D8 FF)", "PNG (89 50 4E 47)", "PDF (%PDF-)", "ZIP (PK 03 04)", "DOCX (PK 03 04)"]
                found_signature = sigs[min(len(sigs) - 1, step // 20)]

            payload = {
                "case_id": case_id,
                "progress_pct": step,
                "current_sector": current_sector,
                "total_sectors": total_sectors,
                "current_offset_hex": f"0x{current_sector * 512:08X}",
                "found_signature": found_signature,
                "active_buffer_preview": "FF D8 FF E0 00 10 4A 46 49 46 00 01 01 01" if found_signature else "00 00 00 00 00 00 00 00 00 00 00 00"
            }
            await websocket.send_text(json.dumps(payload))
            if step == 100:
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
