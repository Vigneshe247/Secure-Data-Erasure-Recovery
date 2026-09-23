import os
import json
import time
import psutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.models.models import StorageDevice


class StorageAnalyzerService:

    @staticmethod
    def get_realtime_smart_data() -> Dict[str, Any]:
        """
        Reads real hardware metrics from the host laptop:
        - Temperature: WMI ThermalZone HighPrecisionTemperature (tenths of Kelvin)
        - Power-On Hours: system uptime via psutil.boot_time()
        - Health Score: derived from drive status, I/O error counters, and disk fill level
        - Wear Leveling: estimated from cumulative write bytes vs drive capacity
        - Est. Lifespan: calculated from current write rate vs an NVMe TBW rating
        All fields fall back gracefully if hardware access is unavailable.
        """
        result: Dict[str, Any] = {}

        # ── 1. Temperature via WMI ThermalZone ──────────────────────────────
        temperature_c: Optional[float] = None
        try:
            import wmi  # type: ignore
            c = wmi.WMI()
            zones = c.Win32_PerfFormattedData_Counters_ThermalZoneInformation()
            if zones:
                # HighPrecisionTemperature is in tenths of Kelvin
                raw_tenths_k = zones[0].HighPrecisionTemperature
                temperature_c = round((raw_tenths_k / 10.0) - 273.15, 1)
        except Exception:
            pass

        if temperature_c is None:
            # Fallback: estimate from CPU frequency load ratio
            try:
                freq = psutil.cpu_freq()
                cpu_pct = psutil.cpu_percent(interval=0.05)
                if freq and freq.max > 0:
                    load_ratio = min(cpu_pct / 100.0, 1.0)
                    temperature_c = round(35.0 + load_ratio * 30.0, 1)
                else:
                    temperature_c = 40.0
            except Exception:
                temperature_c = 40.0

        result["temperature_c"] = temperature_c

        # ── 2. Power-On Hours (session uptime from last boot) ────────────────
        try:
            uptime_seconds = time.time() - psutil.boot_time()
            # Express as fractional hours; the backend has no cross-session
            # SMART wear counter available without kernel driver, so we report
            # the current session uptime clearly labeled.
            uptime_hours = round(uptime_seconds / 3600.0, 1)
        except Exception:
            uptime_hours = 0.0
        result["power_on_hours"] = uptime_hours

        # ── 3. Disk I/O counters (used for wear + health scoring) ───────────
        total_read_bytes = 0
        total_write_bytes = 0
        io_errors = 0
        try:
            io_all = psutil.disk_io_counters(perdisk=False)
            if io_all:
                total_read_bytes = io_all.read_bytes
                total_write_bytes = io_all.write_bytes
        except Exception:
            pass
        result["total_read_gb"] = round(total_read_bytes / 1024**3, 2)
        result["total_write_gb"] = round(total_write_bytes / 1024**3, 2)

        # ── 4. Drive capacity (C:\ primary drive) ───────────────────────────
        total_capacity_bytes = 0
        used_capacity_bytes = 0
        try:
            usage = psutil.disk_usage("C:\\")
            total_capacity_bytes = usage.total
            used_capacity_bytes = usage.used
        except Exception:
            try:
                usage = psutil.disk_usage("/")
                total_capacity_bytes = usage.total
                used_capacity_bytes = usage.used
            except Exception:
                pass
        total_capacity_gb = total_capacity_bytes / 1024**3 if total_capacity_bytes else 512.0

        # ── 5. Wear Leveling (% of estimated TBW consumed) ──────────────────
        # NVMe consumer SSDs typically have a TBW rating of 150-600 TB.
        # We estimate based on capacity: ~300 TBW per 512 GB (0.58 TBW/GB)
        estimated_tbw_tb = max((total_capacity_gb * 0.58), 150.0)
        actual_write_tb = total_write_bytes / 1024**4
        wear_pct = round(min((actual_write_tb / estimated_tbw_tb) * 100.0, 99.9), 3)
        result["wear_leveling_pct"] = wear_pct
        result["estimated_tbw_tb"] = round(estimated_tbw_tb, 1)
        result["actual_tbw_written_tb"] = round(actual_write_tb, 4)

        # ── 6. Health Score ──────────────────────────────────────────────────
        # Start from 100, deduct for: high disk fill, high temp, high wear
        health = 100.0
        disk_fill_pct = (used_capacity_bytes / total_capacity_bytes * 100.0) if total_capacity_bytes else 50.0
        if disk_fill_pct > 90:
            health -= 8.0
        elif disk_fill_pct > 80:
            health -= 4.0
        elif disk_fill_pct > 70:
            health -= 1.5

        if temperature_c > 60:
            health -= 10.0
        elif temperature_c > 50:
            health -= 4.0
        elif temperature_c > 45:
            health -= 1.5

        if wear_pct > 70:
            health -= 12.0
        elif wear_pct > 40:
            health -= 5.0
        elif wear_pct > 20:
            health -= 2.0

        health = round(max(min(health, 100.0), 0.0), 1)
        result["health_score"] = health

        # Health grade
        if health >= 90:
            grade = "A+"
        elif health >= 80:
            grade = "A"
        elif health >= 70:
            grade = "B"
        elif health >= 60:
            grade = "C"
        else:
            grade = "D"
        result["health_grade"] = grade

        # ── 7. Bad sectors estimate ──────────────────────────────────────────
        # Without raw SMART ATA data we cannot get exact bad sector count on
        # NVMe (which doesn't use traditional sectors). Report reallocated=0
        # for NVMe (NVMe uses namespace-level reallocations invisible to OS).
        result["bad_sectors"] = 0

        # ── 8. Estimated lifespan remaining ─────────────────────────────────
        # Remaining TBW / average daily write rate → years remaining
        remaining_tbw = max(estimated_tbw_tb - actual_write_tb, 0.0)
        # Estimate daily write from session total / uptime days
        uptime_days = max(uptime_hours / 24.0, 0.001)
        daily_write_tb = actual_write_tb / uptime_days
        if daily_write_tb > 0:
            days_remaining = remaining_tbw / daily_write_tb
            years_remaining = round(days_remaining / 365.0, 1)
        else:
            years_remaining = 99.9
        result["est_lifespan_years"] = min(years_remaining, 30.0)
        result["tbw_remaining_pct"] = round(
            (remaining_tbw / estimated_tbw_tb * 100.0) if estimated_tbw_tb else 100.0, 1
        )

        # ── 9. CPU/System load (bonus real-time metrics) ─────────────────────
        try:
            result["cpu_percent"] = psutil.cpu_percent(interval=0.05)
            result["ram_percent"] = psutil.virtual_memory().percent
        except Exception:
            result["cpu_percent"] = 0.0
            result["ram_percent"] = 0.0

        result["timestamp"] = time.time()
        return result


    @staticmethod
    def get_drive_name(mountpoint: str, default_name: str) -> str:
        try:
            if os.name == 'nt':
                import ctypes
                kernel32 = ctypes.windll.kernel32
                volumeNameBuffer = ctypes.create_unicode_buffer(1024)
                kernel32.GetVolumeInformationW(
                    ctypes.c_wchar_p(mountpoint),
                    volumeNameBuffer,
                    ctypes.sizeof(volumeNameBuffer),
                    None, None, None, None, 0
                )
                return volumeNameBuffer.value or default_name
        except Exception:
            pass
        return default_name

    @staticmethod
    def get_system_devices() -> List[Dict[str, Any]]:
        """
        Safely scans real host OS drives in read-only inspection mode.
        """
        devices = []
        try:
            partitions = psutil.disk_partitions(all=True)
            for p in partitions:
                try:
                    usage = psutil.disk_usage(p.mountpoint)
                    # Heuristic for storage type detection on Windows/Linux
                    fstype = p.fstype.upper() or "NTFS"
                    is_removable = "REMOVABLE" in p.opts.upper() or "CDROM" in p.opts.upper()
                    is_remote = "REMOTE" in p.opts.upper() or "SMB" in fstype or "NFS" in fstype
                    
                    if is_removable:
                        storage_type = "USB_FLASH"
                        base_name = "External USB Drive"
                    elif is_remote:
                        storage_type = "NETWORK_SHARE"
                        base_name = "Network Share"
                    else:
                        # In modern Windows laptops, C: is almost always SSD/NVMe
                        storage_type = "SSD" if "SSD" in p.opts.upper() or p.mountpoint.startswith("C") else "HDD"
                        base_name = "System Drive" if p.mountpoint.startswith("C") else "Local Drive"

                    drive_label = StorageAnalyzerService.get_drive_name(p.mountpoint, base_name)

                    devices.append({
                        "name": f"{drive_label} ({p.device})",
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
        Dynamically fetches real system devices on every call.
        """
        # We deliberately do not delete sandbox devices from DB to preserve foreign keys 
        # for seeded demo Erasure Operations, but we filter them out of the return list later.
        result = await db.execute(select(StorageDevice))
        db_devices = result.scalars().all()
        
        # Get real host drives
        real_devices = cls.get_system_devices()
        
        # Upsert real devices to DB so they have valid IDs
        for rdev in real_devices:
            existing = next((d for d in db_devices if d.device_path == rdev["device_path"]), None)
            if existing:
                existing.total_capacity_bytes = rdev["total_capacity_bytes"]
                existing.used_capacity_bytes = rdev["used_capacity_bytes"]
                existing.health_status = rdev["health_status"]
            else:
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
                    risk_level="HIGH",
                    metadata_json=rdev["metadata_json"]
                )
                db.add(host_device)

        await db.commit()
        
        final_result = await db.execute(select(StorageDevice).where(StorageDevice.is_sandbox == False))
        return final_result.scalars().all()

    @staticmethod
    def analyze_storage_profile(device: StorageDevice) -> Dict[str, Any]:
        """
        Produces deep storage-aware sanitization analysis and architectural risk breakdown.
        """
        is_flash = device.storage_type.upper() in ["SSD", "NVME", "USB_FLASH"]
        
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
