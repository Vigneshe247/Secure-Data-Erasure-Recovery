"""
DataShield sanitization engine  -  closed-loop, content-aware, verified.

Fixes the weaknesses of the original "zero N bytes at a hard-coded offset":

  1. LOCATE by content, not by a hard-coded offset. Every copy of the
     protected file is found anywhere in the image (exact match, distinctive
     byte windows, and 512-byte sector fingerprints, so partly-damaged or
     fragmented copies are found too).
  2. ERASE THE WHOLE EXTENT, not just "size of the source file". If the copy
     on the medium is bigger than the file we were told about, the extent is
     extended over the contiguous non-zero data that follows it.
  3. VERIFY THE WHOLE IMAGE. A fresh read-back (page cache dropped, fsync'd)
     re-scans the entire image for the protected content, and checks that
     every erased extent really reads back as the expected fill.
  4. CLOSED LOOP. PASS -> certificate. FAIL -> escalate (random+zero over
     everything found, then optional full-image wipe). Never claims success
     it has not measured.
  5. TAMPER-EVIDENT LEDGER. Every step is appended to a hash chain.
  6. HOST COPY. The plain source file is overwritten and fsync'd before it is
     unlinked (a plain unlink leaves the bytes on the host disk).

SCOPE / HONEST LIMITS
  * This engine writes to DISK-IMAGE FILES only. For a real block device it
    refuses and prints the correct hardware command instead (blkdiscard /
    nvme sanitize / hdparm --security-erase / ATA sanitize), because an
    overwrite through the OS cannot reach remapped / wear-levelled flash.
  * Overwriting an image file *inside* a host file system (SSD, btrfs/ZFS/
    APFS copy-on-write, journals, snapshots, backups) may leave older copies
    of the blocks in the HOST layer. Sanitize the whole device for that.
"""

import hashlib
import mmap
import os
import stat
import time
from pathlib import Path

try:
    from .evidence_chain import EvidenceLedger
except ImportError:  # run as a plain script
    from evidence_chain import EvidenceLedger

SECTOR = 512
CHUNK = 1024 * 1024
MIN_DISTINCT_BYTES = 8          # sectors with fewer distinct byte values are too generic to fingerprint
WINDOW = 48                     # length of distinctive byte windows
N_WINDOWS = 8
MAX_EXACT_BYTES = 64 * 1024 * 1024
ZERO_SECTOR = b"\x00" * SECTOR

# A sector that STARTS with one of these is treated as the start of a
# different file, so extent-extension stops there instead of eating it.
_MAGICS = (
    b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"%PDF-", b"GIF87a", b"GIF89a",
    b"ID3", b"RIFF", b"PK\x03\x04",
)


def _fp(block):
    return hashlib.blake2b(block, digest_size=16).digest()


def _starts_new_file(sector):
    return sector.startswith(_MAGICS) or sector[4:8] == b"ftyp"


# ============================================================
# TARGET PROFILER  (HDD / SSD / NVMe / USB / image)
# ============================================================

def profile_target(path):
    """
    Identify what kind of storage this is and which sanitization method is
    appropriate. Only DISK_IMAGE targets are executed by this engine.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Target not found: {p}")

    st = p.stat()
    info = {"path": str(p), "size_bytes": st.st_size, "sector_size": SECTOR}

    if stat.S_ISBLK(st.st_mode):
        name = p.name
        base = name.rstrip("0123456789")
        if name.startswith("nvme"):
            base = name.split("p")[0] if "p" in name[4:] else name
        rot = None
        try:
            rot = Path(f"/sys/block/{base}/queue/rotational").read_text().strip()
        except OSError:
            pass
        if name.startswith("nvme"):
            info.update(kind="NVME_SSD", method="NVME_SANITIZE",
                        command=f"nvme sanitize {p} --sanact=2   (or: nvme format {p} --ses=1)")
        elif rot == "0":
            info.update(kind="SSD_OR_USB_FLASH", method="ATA_SANITIZE_OR_BLKDISCARD",
                        command=f"hdparm --sanitize-block-erase {p}   (or ATA Secure Erase / blkdiscard -s {p})")
        elif rot == "1":
            info.update(kind="HDD", method="OVERWRITE_OR_ATA_SECURE_ERASE",
                        command=f"hdparm --security-erase <pwd> {p}   (or full overwrite: shred -n1 -z {p})")
        else:
            info.update(kind="BLOCK_DEVICE_UNKNOWN", method="MANUAL_REVIEW",
                        command="identify device type first (lsblk -d -o NAME,ROTA,TRAN,MODEL)")
        info["executable_by_engine"] = False
        info["note"] = ("Raw devices are NOT written by this engine: an OS-level overwrite cannot "
                        "reach remapped/wear-levelled flash. Run the hardware command, then use "
                        "verify_uniform() on a read-only dump.")
        return info

    info.update(kind="DISK_IMAGE", method="CONTROLLED_OVERWRITE_WITH_VERIFICATION",
                executable_by_engine=True)
    return info


# ============================================================
# SOURCE PROFILES (what we are looking for)
# ============================================================

class Profile:
    """Fingerprints of one protected file."""

    def __init__(self, path, name=None):
        self.path = str(path)
        self.name = name or os.path.basename(self.path)
        with open(path, "rb") as f:
            self.data = f.read()
        self.size = len(self.data)
        self.sha256 = hashlib.sha256(self.data).hexdigest().upper()
        self.sectors = {}        # fp -> first block index
        self.windows = []        # distinctive byte windows
        self._build()

    def _build(self):
        d = self.data
        for i in range(0, self.size, SECTOR):
            blk = d[i:i + SECTOR]
            if len(blk) < SECTOR:
                blk = blk + b"\x00" * (SECTOR - len(blk))
            if blk == ZERO_SECTOR or len(set(blk)) < MIN_DISTINCT_BYTES:
                continue
            self.sectors.setdefault(_fp(blk), i // SECTOR)
        if self.size > WINDOW:
            step = max(1, (self.size - WINDOW) // (N_WINDOWS - 1)) if N_WINDOWS > 1 else 1
            seen = set()
            for k in range(N_WINDOWS):
                off = min(k * step, self.size - WINDOW)
                w = d[off:off + WINDOW]
                if w not in seen and len(set(w)) >= 4:
                    seen.add(w)
                    self.windows.append(w)

    def drop_shared_with(self, others):
        """Remove fingerprints that also occur in other (live) files, so we never
        report / erase content that legitimately belongs to something else."""
        for o in others:
            for fp in list(self.sectors):
                if fp in o.sectors:
                    del self.sectors[fp]
            self.windows = [w for w in self.windows if w not in o.data]


# ============================================================
# IMAGE ACCESS + SECTOR INDEX
# ============================================================

_INDEX_CACHE = {}


def _drop_os_cache(path):
    """Ask the OS to forget cached pages so the next read hits the medium."""
    try:
        fd = os.open(path, os.O_RDONLY)
        try:
            os.posix_fadvise(fd, 0, 0, os.POSIX_FADV_DONTNEED)
        finally:
            os.close(fd)
    except (AttributeError, OSError):
        pass


def _key(path):
    st = os.stat(path)
    return (str(path), st.st_size, st.st_mtime_ns)


def sector_index(path):
    """fp -> [offsets] for every non-zero 512-byte sector in the image (cached)."""
    k = _key(path)
    if k in _INDEX_CACHE:
        return _INDEX_CACHE[k]
    for old in [c for c in _INDEX_CACHE if c[0] == k[0]]:
        del _INDEX_CACHE[old]
    idx = {}
    size = k[1]
    if size:
        with open(path, "rb") as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            for off in range(0, size, SECTOR):
                blk = mm[off:off + SECTOR]
                if len(blk) < SECTOR:
                    blk = blk + b"\x00" * (SECTOR - len(blk))
                if blk == ZERO_SECTOR:
                    continue
                lst = idx.setdefault(_fp(blk), [])
                if len(lst) < 1000:
                    lst.append(off)
    _INDEX_CACHE[k] = idx
    return idx


def _find_all(mm, needle, cap=1000):
    hits, pos = [], 0
    while len(hits) < cap:
        pos = mm.find(needle, pos)
        if pos == -1:
            break
        hits.append(pos)
        pos += 1
    return hits


# ============================================================
# LOCATE / RESIDUAL SCAN
# ============================================================

def find_residual(image, profiles, exclude=()):
    """
    Scan the WHOLE image for any recoverable trace of each protected file.
    Independent of the eraser: it only reads the image.

    Returns {name: {exact, windows, sectors_matched, sectors_total,
                    sector_offsets, match_ratio, residual}}
    """
    exclude = list(exclude)
    for p in profiles:
        p.drop_shared_with(exclude)

    idx = sector_index(image)
    out = {}
    size = os.path.getsize(image)
    if size == 0:
        return {p.name: dict(exact=[], windows=[], sectors_matched=0,
                             sectors_total=len(p.sectors), sector_offsets=[],
                             match_ratio=0.0, residual=False) for p in profiles}

    with open(image, "rb") as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        for p in profiles:
            exact = []
            if 0 < p.size <= MAX_EXACT_BYTES:
                exact = _find_all(mm, p.data)
            win_hits = []
            for w in p.windows:
                win_hits += _find_all(mm, w)
            sec_offsets = []
            for fp in p.sectors:
                sec_offsets += idx.get(fp, [])
            matched = sum(1 for fp in p.sectors if fp in idx)
            total = len(p.sectors)
            ratio = 1.0 if exact else (matched / total if total else (1.0 if win_hits else 0.0))
            out[p.name] = {
                "exact": exact,
                "windows": sorted(set(win_hits)),
                "sectors_matched": matched,
                "sectors_total": total,
                "sector_offsets": sorted(set(sec_offsets)),
                "match_ratio": round(ratio, 3),
                "residual": bool(exact or win_hits or matched),
            }
    return out


def residual_count(report):
    return sum(1 for r in report.values() if r["residual"])


# ============================================================
# EXTENT PLANNING
# ============================================================

def protected_sectors(image, exclude_profiles):
    """Sector-start offsets that belong to LIVE files (never erased / extended into)."""
    prot = set()
    if not exclude_profiles or os.path.getsize(image) == 0:
        return prot
    idx = sector_index(image)
    with open(image, "rb") as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        for p in exclude_profiles:
            if 0 < p.size <= MAX_EXACT_BYTES:
                for off in _find_all(mm, p.data):
                    a = off - off % SECTOR
                    prot.update(range(a, off + p.size, SECTOR))
            for fp in p.sectors:
                prot.update(idx.get(fp, []))
    return prot


def plan_extents(image, profiles, report, extend=True, max_extend=64 * 1024 * 1024,
                 protect=frozenset()):
    """
    Turn scan hits into byte extents [start, end) to overwrite.

    Every hit is widened to whole sectors, then - if extend=True - grown in
    BOTH directions over contiguous non-zero sectors (this catches a grown /
    stale copy whose tail is not in the source file, and a damaged first
    sector that no longer matches any fingerprint). Growth stops at a zero
    sector, at the start of another file (magic bytes), at a sector that
    belongs to a live file (`protect`), or at max_extend.
    """
    size = os.path.getsize(image)
    raw = []
    by_name = {p.name: p for p in profiles}
    for name, r in report.items():
        p = by_name[name]
        for off in r["exact"]:
            raw.append((off, off + p.size, name, "exact"))
        for off in r["windows"]:
            raw.append((off, off + WINDOW, name, "window"))
        for off in r["sector_offsets"]:
            raw.append((off, min(off + SECTOR, size), name, "sector"))

    raw.sort()
    merged = []
    for s, e, n, k in raw:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
            merged[-1][2].add(n)
            merged[-1][3].add(k)
        else:
            merged.append([s, e, {n}, {k}])

    extents = []
    if not merged:
        return extents

    with open(image, "rb") as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        for s, e, names, kinds in merged:
            ext_start = s - s % SECTOR
            ext_end = min(((e + SECTOR - 1) // SECTOR) * SECTOR, size)
            if extend:
                # ---- forward
                pos, limit = ext_end, min(size, e + max_extend)
                while pos < limit:
                    sec = mm[pos:pos + SECTOR]
                    if sec == ZERO_SECTOR[:len(sec)] or pos in protect or _starts_new_file(sec):
                        break
                    pos = min(pos + SECTOR, size)
                    ext_end = pos
                # ---- backward
                pos, floor = ext_start - SECTOR, max(0, s - max_extend)
                while pos >= floor:
                    sec = mm[pos:pos + SECTOR]
                    if sec == ZERO_SECTOR[:len(sec)] or pos in protect:
                        break
                    ext_start = pos
                    if _starts_new_file(sec):      # include the file's first sector, then stop
                        break
                    pos -= SECTOR
            extents.append({"start": ext_start, "end": ext_end, "hit_start": s, "hit_end": e,
                            "files": sorted(names), "found_by": sorted(kinds),
                            "extended_bytes": (s - ext_start) + (ext_end - e)})
    return extents


# ============================================================
# OVERWRITE + READ-BACK
# ============================================================

def _overwrite(image, extents, mode="zero"):
    """Overwrite extents in place, fsync, drop cache."""
    with open(image, "r+b") as f:
        for ex in extents:
            f.seek(ex["start"])
            remaining = ex["end"] - ex["start"]
            while remaining > 0:
                n = min(CHUNK, remaining)
                f.write(os.urandom(n) if mode == "random" else b"\x00" * n)
                remaining -= n
        f.flush()
        os.fsync(f.fileno())
    _drop_os_cache(image)
    _INDEX_CACHE.clear()


def _extents_read_zero(image, extents):
    """Fresh read-back: do all extents now read back as zeros?"""
    _drop_os_cache(image)
    bad = []
    with open(image, "rb") as f:
        for ex in extents:
            f.seek(ex["start"])
            remaining = ex["end"] - ex["start"]
            ok = True
            while remaining > 0:
                blk = f.read(min(CHUNK, remaining))
                if not blk:
                    break
                if blk.count(0) != len(blk):
                    ok = False
                    break
                remaining -= len(blk)
            if not ok:
                bad.append(ex)
    return bad


def verify_uniform(image, fill=0, max_regions=20):
    """Whole-image check: every byte equals `fill`. Reads the medium fresh."""
    _drop_os_cache(image)
    size = os.path.getsize(image)
    nonzero, regions, pos = 0, [], 0
    pattern_chunk = bytes([fill]) * CHUNK
    with open(image, "rb") as f:
        while pos < size:
            blk = f.read(min(CHUNK, size - pos))
            if not blk:
                break
            if blk != pattern_chunk[:len(blk)]:
                for i in range(0, len(blk), SECTOR):
                    s = blk[i:i + SECTOR]
                    if s != pattern_chunk[:len(s)]:
                        nonzero += sum(1 for b in s if b != fill)
                        if len(regions) < max_regions:
                            off = pos + i
                            if regions and regions[-1][1] == off:
                                regions[-1][1] = off + len(s)
                            else:
                                regions.append([off, off + len(s)])
            pos += len(blk)
    return {"uniform": nonzero == 0, "nonuniform_bytes": nonzero,
            "regions": [tuple(r) for r in regions], "size": size}


def shred_host_file(path, passes=1):
    """
    Overwrite the plain source file (random then zeros), fsync, rename, unlink.
    A bare os.remove() only drops the directory entry - the bytes stay on the host disk.
    LIMIT: journaling / copy-on-write file systems and SSD wear-levelling can
    still keep old blocks; for those, sanitize the whole device.
    """
    p = Path(path)
    size = p.stat().st_size
    with open(p, "r+b") as f:
        for _ in range(passes):
            f.seek(0)
            left = size
            while left > 0:
                n = min(CHUNK, left)
                f.write(os.urandom(n))
                left -= n
            f.flush()
            os.fsync(f.fileno())
        f.seek(0)
        left = size
        while left > 0:
            n = min(CHUNK, left)
            f.write(b"\x00" * n)
            left -= n
        f.flush()
        os.fsync(f.fileno())
    tmp = p.with_name(os.urandom(8).hex() + ".del")
    os.rename(p, tmp)
    os.remove(tmp)
    return not p.exists()


# ============================================================
# CLOSED-LOOP SANITIZATION
# ============================================================

def analyze_targets(image, target_files, exclude_files=(), extend=True):
    """Pre-erasure forensic scan + plan. Writes nothing."""
    profiles = [Profile(p) for p in target_files]
    excl = [Profile(p) for p in exclude_files]
    report = find_residual(image, profiles, excl)
    extents = plan_extents(image, profiles, report, extend=extend,
                           protect=protected_sectors(image, excl))
    return {"profiles": profiles, "exclude": excl, "report": report, "extents": extents,
            "profile": profile_target(image)}


def sanitize_targets(image, target_files, exclude_files=(),
                     ledger_path="evidence_ledger.jsonl",
                     allow_full_wipe=False, extend=True, max_rounds=3,
                     hash_image=True, log=print):
    """
    scan -> plan -> erase -> independent verify -> (escalate) -> result.
    Returns a dict; result["status"] is "PASSED" or "FAILED" and reflects
    what was actually measured after the last write.
    """
    image = str(image)
    ledger = EvidenceLedger(ledger_path)
    prof = profile_target(image)
    if not prof.get("executable_by_engine"):
        ledger.append("REFUSED", {"target": image, "reason": prof.get("note"), "profile": prof})
        return {"status": "REFUSED", "profile": prof, "reason": prof.get("note"),
                "ledger_head": ledger.head()}

    size = os.path.getsize(image)
    sha_before = _sha256(image) if hash_image and size <= 2 * 1024**3 else None
    profiles = [Profile(p) for p in target_files]
    excl = [Profile(p) for p in exclude_files]

    ledger.append("SESSION_START", {
        "target": image, "profile": prof, "image_sha256_before": sha_before,
        "protected": [{"name": p.name, "size": p.size, "sha256": p.sha256} for p in profiles],
    })

    protect = protected_sectors(image, excl)
    before = find_residual(image, profiles, excl)
    ledger.append("PRE_SCAN", {n: {k: (len(v) if isinstance(v, list) else v)
                                   for k, v in r.items() if k != "sector_offsets"}
                               for n, r in before.items()})
    result = {"profile": prof, "before": before, "rounds": [], "protected": [p.name for p in profiles]}

    report = before
    status = "PASSED" if residual_count(before) == 0 else None
    if status == "PASSED":
        log("[i] No trace of the protected content was found on the image.")
        result["note"] = "nothing found to erase"

    round_no = 0
    while status is None and round_no < max_rounds:
        round_no += 1
        wipe_all = False
        if round_no == 1:
            mode = "zero"
        elif round_no == 2:
            mode = "random+zero"
        else:
            if not allow_full_wipe:
                break
            mode, wipe_all = "FULL_IMAGE_ZERO", True

        if wipe_all:
            extents = [{"start": 0, "end": size, "files": ["*"], "found_by": ["full-wipe"],
                        "hit_end": size, "extended_bytes": 0}]
        else:
            extents = plan_extents(image, profiles, report, extend=extend, protect=protect)

        ledger.append("ERASE_ROUND", {"round": round_no, "method": mode,
                                      "extents": extents,
                                      "bytes": sum(e["end"] - e["start"] for e in extents)})
        log(f"[*] Round {round_no}: {mode}  -  {len(extents)} extent(s), "
            f"{sum(e['end'] - e['start'] for e in extents):,} bytes")

        if mode == "random+zero":
            _overwrite(image, extents, "random")
        _overwrite(image, extents, "zero")

        bad_extents = _extents_read_zero(image, extents)
        report = find_residual(image, profiles, excl)
        left = residual_count(report)
        uniform = verify_uniform(image)["uniform"] if wipe_all else None
        ok = (left == 0) and (not bad_extents) and (uniform in (None, True))

        ledger.append("VERIFY_ROUND", {"round": round_no, "files_still_recoverable": left,
                                        "extents_not_zero": len(bad_extents), "full_image_uniform": uniform,
                                        "result": "PASSED" if ok else "FAILED"})
        result["rounds"].append({"round": round_no, "method": mode, "extents": extents,
                                 "residual_files": left, "extents_not_zero": len(bad_extents),
                                 "ok": ok})
        if ok:
            status = "PASSED"
        else:
            log(f"[!] Verification FAILED after round {round_no}: "
                f"{left} file(s) still recoverable, {len(bad_extents)} extent(s) not zero. Escalating...")
            ledger.append("ESCALATE", {"from_round": round_no})

    if status is None:
        status = "FAILED"

    sha_after = _sha256(image) if hash_image and size <= 2 * 1024**3 else None
    result.update(status=status, after=report, image_sha256_before=sha_before,
                  image_sha256_after=sha_after)
    ledger.append("RESULT", {"status": status, "rounds": round_no,
                             "residual_files": residual_count(report),
                             "image_sha256_after": sha_after})
    result["ledger_head"] = ledger.head()
    result["ledger_check"] = ledger.verify()
    return result


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(CHUNK)
            if not b:
                break
            h.update(b)
    return h.hexdigest().upper()


def _recovery_lines(result):
    """Certificate line for the post-erasure recovery attempt (if one was run)."""
    ra = result.get("recovery_attempt")
    if not ra:
        return []
    return [f"Recovery attempt     : {ra['verdict']} ({ra['tested']} file(s) tested, "
            f"{ra['recovered_files']} recovered)"]


def write_certificate(result, path="sanitization_certificate.txt"):
    """Human-readable certificate. Only issued for a PASSED result."""
    if result.get("status") != "PASSED":
        raise ValueError("A certificate is only issued when verification PASSED.")
    lines = [
        "=" * 60,
        "        DATASHIELD SANITIZATION CERTIFICATE",
        "=" * 60,
        f"Issued       : {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"Target       : {result['profile']['path']}",
        f"Storage kind : {result['profile']['kind']}",
        f"Protected    : {', '.join(result['protected'])}",
        f"Rounds used  : {len(result['rounds'])}",
        f"Image SHA-256 before : {result.get('image_sha256_before')}",
        f"Image SHA-256 after  : {result.get('image_sha256_after')}",
        f"Ledger records valid : {result['ledger_check']['valid']} "
        f"({result['ledger_check']['records']} records)",
        f"Ledger head hash     : {result['ledger_head']}",
        *_recovery_lines(result),
        "",
        "Verification : whole-image content scan + extent read-back = CLEAN",
        "Scope note   : applies to this image file only; host-filesystem/SSD",
        "               remnants require whole-device sanitization.",
        "=" * 60,
    ]
    Path(path).write_text("\n".join(lines), encoding="utf-8")
    return path


# ============================================================
# LEDGER-BASED PROOF (works after the source file is gone)
# ============================================================

def erased_records(ledger_path):
    """
    Read the evidence ledger and return, per protected file name, the most
    recent sanitization session: {"status", "extents", "seq", "when", "image"}.
    """
    import json
    out = {}
    path = Path(ledger_path)
    if not path.exists():
        return out
    cur = None
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            ev, data = rec["event"], rec["data"]
            if ev == "SESSION_START":
                cur = {"names": [p["name"] for p in data.get("protected", [])],
                       "extents": [], "image": data.get("target"), "seq": rec["seq"]}
            elif ev == "ERASE_ROUND" and cur is not None:
                cur["extents"] += [e for e in data.get("extents", []) if e.get("files") != ["*"]]
            elif ev == "RESULT" and cur is not None:
                for n in cur["names"]:
                    out[n] = {"status": data.get("status"), "extents": list(cur["extents"]),
                              "seq": rec["seq"], "when": rec["timestamp"], "image": cur["image"]}
                cur = None
    return out


def extents_zero_now(image, extents):
    """True if every recorded extent still reads back as zero (fresh read)."""
    return len(_extents_read_zero(image, extents)) == 0
