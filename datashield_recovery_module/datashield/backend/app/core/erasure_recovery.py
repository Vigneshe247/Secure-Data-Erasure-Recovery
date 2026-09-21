"""
DataShield - POST-ERASURE RECOVERY module
=========================================

IDEA
----
A secure erasure is only trustworthy if nobody can get the data back.  So after
an erasure DataShield now plays the attacker: it runs the RECOVERY side of the
system against the erased disk image.

    erase  ->  try to recover  ->  nothing comes back = erasure VERIFIED
                               ->  data comes back    = erasure FAILED
                                   (the data is recovered, checked with SHA-256
                                    and reported, so it can be erased again)

HOW THE RECOVERY WORKS (content based - no fixed offsets)
---------------------------------------------------------
For every file that has an erasure record:

  A. REFERENCE FILE STILL EXISTS  (erasure failed / was improper, so the source
     was kept):
       1. scan the WHOLE image for the file (exact copy, distinctive byte windows,
          512-byte sector fingerprints - the same fingerprints the eraser uses);
       2. work out where the file starts on the medium (its "alignment") from
          every hit and keep the alignment that reproduces the most bytes;
       3. rebuild the file from the bytes that are really on the medium, and patch
          any sector that lives somewhere else (fragmented / moved copies);
       4. compare SHA-256 of the recovered file with the original.
     Result: RECOVERED (hash matches), PARTIAL (some bytes came back) or CLEAN.

  B. REFERENCE FILE ALREADY SHREDDED  (erasure passed):
       every extent the ledger says was erased is re-read from the medium.  If an
       extent is no longer zero, the residue is carved out and (where possible)
       checked against the SHA-256 that the ledger stored when the file was erased.

Every attempt is appended to the tamper-evident evidence ledger (RECOVERY_ATTEMPT).

SCOPE / HONEST LIMITS
---------------------
  * Works on disk-image files (same limit as the erasure engine).
  * It can only look for content it has a fingerprint of.  Data DataShield was
    never told about is caught only by a full-image wipe + verify_disk().
  * Files made of one repeated byte (e.g. 0xAA filler) have no distinctive sectors,
    so only an exact copy or the header window can be recognised.
"""

import hashlib
import mmap
import os
import time
from collections import Counter, defaultdict
from pathlib import Path

try:
    from . import sanitizer as S
    from .evidence_chain import EvidenceLedger
except ImportError:  # run as a plain script / core dir on sys.path
    import sanitizer as S
    from evidence_chain import EvidenceLedger

SECTOR = S.SECTOR
MAX_ALIGNMENTS = 25                     # candidate start positions that are scored
MAX_RESIDUE_BYTES = 16 * 1024 * 1024    # cap for residue carved from ledger extents

# per-file status codes
RECOVERED = "RECOVERED"     # whole file came back, SHA-256 matches
PARTIAL = "PARTIAL"         # part of the file came back
CLEAN = "CLEAN"             # nothing could be recovered
UNPROVEN = "UNPROVEN"       # cannot be tested (no reference file and no usable ledger record)

STATE_TEXT = {
    RECOVERED: "RECOVERED - ERASURE FAILED",
    PARTIAL: "PARTIALLY RECOVERED - ERASURE INCOMPLETE",
    CLEAN: "NOT RECOVERABLE - ERASURE VERIFIED",
    UNPROVEN: "CANNOT BE PROVEN - NO REFERENCE FILE / LEDGER EXTENTS",
}

# ways an erasure can be improper (used only to DEMONSTRATE the module)
IMPROPER_MODES = {
    "header": "only the first 16 bytes were wiped (header-only wipe)",
    "partial": "only the first third of the file was wiped (interrupted erase)",
}


# ============================================================
# SMALL HELPERS
# ============================================================

def _sha256(data):
    return hashlib.sha256(data).hexdigest().upper()


def _hex(data):
    return " ".join(f"{b:02X}" for b in data)


def _padded(block):
    return block if len(block) == SECTOR else block + b"\x00" * (SECTOR - len(block))


def _block_fingerprints(profile):
    """One entry per 512-byte block of the reference: its fingerprint, or None
    when the block is too generic / zero / shared with a live file."""
    out = []
    for i in range(0, profile.size, SECTOR):
        fp = S._fp(_padded(profile.data[i:i + SECTOR]))
        out.append(fp if fp in profile.sectors else None)
    return out


def _matched_bytes(reference, candidate):
    """How many bytes of `candidate` equal the reference at the same position.
    Zero bytes of the reference are not counted (a wiped byte is also zero)."""
    total = 0
    for i in range(0, len(reference), SECTOR):
        r = reference[i:i + SECTOR]
        c = candidate[i:i + SECTOR]
        if r == c:
            total += len(r) - r.count(0)
        else:
            total += sum(1 for a, b in zip(r, c) if a == b and a != 0)
    return total


def _is_text(data):
    """True when the reference is plain readable text (UTF-8, no control bytes)."""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return bool(text) and all(c.isprintable() or c in "\r\n\t" for c in text)


WIPED_MARK = b"?"      # shown in recovered TEXT files where the wipe left zero bytes
UTF8_BOM = b"\xef\xbb\xbf"   # tells Notepad "this is UTF-8" so it never guesses UTF-16 (Chinese-looking text)


def _result(name, status, **extra):
    row = {
        "file": name, "status": status, "state": STATE_TEXT[status],
        "size": 0, "recovered_bytes": 0, "recovered_pct": 0.0,
        "sha256_original": None, "sha256_recovered": None, "integrity": None,
        "offset": None, "copies": 0, "method": None, "raw_bytes": None,
        "output": None, "detail": "", "erasure_record": None,
    }
    row.update(extra)
    return row


# ============================================================
# WHAT WAS ERASED?  (read from the evidence ledger)
# ============================================================

def erasure_attempts(ledger_path):
    """
    Read the evidence ledger and return, per file name, the most recent erasure
    attempt:  {"kind", "status", "seq", "when", "image", "size", "sha256", "extents"}

      kind = "SECURE_ERASE"        a DataShield secure erasure (status PASSED / FAILED)
             "IMPROPER_ERASE"      a simulated improper erasure (demo, status INCOMPLETE)
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
                cur = {"protected": {p["name"]: p for p in data.get("protected", [])},
                       "extents": [], "image": data.get("target"), "seq": rec["seq"]}

            elif ev == "ERASE_ROUND" and cur is not None:
                cur["extents"] += [e for e in data.get("extents", []) if e.get("files") != ["*"]]

            elif ev == "RESULT" and cur is not None:
                for name, p in cur["protected"].items():
                    out[name] = {"kind": "SECURE_ERASE", "status": data.get("status"),
                                 "extents": list(cur["extents"]), "seq": rec["seq"],
                                 "when": rec["timestamp"], "image": cur["image"],
                                 "size": p.get("size"), "sha256": p.get("sha256")}
                cur = None

            elif ev == "IMPROPER_ERASE_SIMULATED":
                size = data.get("size") or 0
                # where the file LIVED on the image (start of every wiped region = file start)
                where = [int(r[0]) for r in data.get("regions", [])]
                out[data["file"]] = {"kind": "IMPROPER_ERASE", "status": "INCOMPLETE",
                                     "extents": [],   # deliberately none: it is NOT a proof of erasure
                                     "file_offsets": where,
                                     "seq": rec["seq"], "when": rec["timestamp"],
                                     "image": data.get("image"), "size": data.get("size"),
                                     "sha256": data.get("sha256"), "mode": data.get("mode")}
    return out


def describe_attempt(attempt):
    """One-line text for menus / UI."""
    if attempt is None:
        return "no erasure record"
    kind = "secure erasure" if attempt["kind"] == "SECURE_ERASE" else "improper erasure (demo)"
    return f"{kind} - {attempt['status']} (ledger #{attempt['seq']}, {attempt['when']})"


# ============================================================
# A. RECOVERY WITH THE REFERENCE FILE
# ============================================================

def _recover_from_reference(image, mm, idx, name, ref_path, exclude, out_dir, attempt,
                            known_offsets=()):
    prof = S.Profile(ref_path, name=name)
    size = prof.size

    # whole-image scan (also removes fingerprints shared with live files)
    rep = S.find_residual(image, [prof], exclude)[name]
    fps = _block_fingerprints(prof)

    # ---- every hit "votes" for the position where the file would start ----
    votes = Counter()
    for off in rep["exact"]:
        votes[off] += 1000
    for w in prof.windows:
        p = prof.data.find(w)
        for h in S._find_all(mm, w):
            votes[h - p] += 1
    blocks_of = defaultdict(list)
    for i, fp in enumerate(fps):
        if fp is not None:
            blocks_of[fp].append(i)
    for fp, blocks in blocks_of.items():
        for off in idx.get(fp, ()):
            for i in blocks:
                votes[off - i * SECTOR] += 1

    # ---- ANCHORS: places where the file is KNOWN to have lived --------------------
    # Content fingerprints cannot see a file (or the rest of a file) that is only
    # generic filler - e.g. 0xAA padding - so once its header is wiped nothing
    # "votes" for it.  The erasure record / disk layout tells us where it lived,
    # so that spot is always checked byte-for-byte against the reference file.
    anchors = list(known_offsets or ())
    if attempt:
        anchors += list(attempt.get("file_offsets") or ())
    anchors = list(dict.fromkeys(a for a in anchors if a is not None))

    # ---- keep the start position that reproduces the most of the file ----
    image_size = len(mm)
    best_d, best_score, best = None, -1, b""
    candidates = anchors + [d for d, _ in votes.most_common(MAX_ALIGNMENTS) if d not in anchors]
    for d in candidates:
        if d < 0 or d >= image_size:
            continue
        cand = bytes(mm[d:d + size])
        score = _matched_bytes(prof.data, cand)
        if score > best_score:
            best_d, best_score, best = d, score, cand

    # ---- rebuild from the medium, then patch sectors found elsewhere ----
    buf = bytearray(best.ljust(size, b"\x00"))
    patched = 0
    for i, fp in enumerate(fps):
        if fp is None:
            continue
        lo, hi = i * SECTOR, min(i * SECTOR + SECTOR, size)
        if S._fp(_padded(bytes(buf[lo:hi]))) == fp:
            continue                                   # already correct
        offs = idx.get(fp)
        if offs:
            buf[lo:hi] = mm[offs[0]:offs[0] + (hi - lo)]
            patched += 1
    data = bytes(buf)

    matched = _matched_bytes(prof.data, data)
    complete = data == prof.data
    nonzero_total = max(1, size - prof.data.count(0))
    pct = 100.0 if complete else round(100.0 * matched / nonzero_total, 1)

    if complete:
        status = RECOVERED
    elif matched > 0:
        status = PARTIAL
    else:
        status = CLEAN

    if complete and rep["exact"]:
        method = "EXACT COPY"
        detail = f"{len(rep['exact'])} exact cop{'y' if len(rep['exact']) == 1 else 'ies'} found on the image"
    elif complete:
        method = "REASSEMBLED FROM SECTORS"
        detail = f"file rebuilt from the medium ({patched} sector(s) gathered from other places)"
    elif matched > 0:
        method = "PARTIAL COPY"
        detail = f"{matched:,} of {nonzero_total:,} bytes still on the medium ({pct}%)"
        if best_d in anchors and not votes.get(best_d):
            detail += " - found at the file's recorded location (generic filler, no unique fingerprint)"
    else:
        method = None
        detail = "whole-image scan found no trace of the file"

    # A partly wiped TEXT file starts with zero bytes, and Notepad then guesses
    # UTF-16 and shows the whole file as random Chinese-looking characters.  Even
    # plain "??" pairs can fool that guess.  So for text files the wiped bytes are
    # written as "?" AND the file starts with a UTF-8 marker (BOM, 3 bytes), which
    # makes Notepad read it as normal text.  Binary files (mp3, png...) stay
    # byte-exact.
    out_data = data
    if matched > 0 and not complete and _is_text(prof.data):
        out_data = UTF8_BOM + data.replace(b"\x00", WIPED_MARK)

    output = None
    if matched > 0:
        os.makedirs(out_dir, exist_ok=True)
        output = os.path.join(out_dir, "recovered_" + name)
        with open(output, "wb") as fh:
            fh.write(out_data)

    raw = None
    if matched > 0:
        raw = _hex(mm[best_d:best_d + 16]) if best_d is not None else _hex(data[:16])

    return _result(
        name, status, size=size, recovered_bytes=size if complete else matched,
        recovered_pct=pct, sha256_original=prof.sha256,
        sha256_recovered=_sha256(out_data) if matched > 0 else None,
        integrity=("MATCH" if complete else "MISMATCH") if matched > 0 else None,
        offset=best_d if matched > 0 else None, copies=len(rep["exact"]),
        method=method, raw_bytes=raw, output=output, detail=detail,
        erasure_record=describe_attempt(attempt))


# ============================================================
# B. RECOVERY FROM THE LEDGER (reference file already shredded)
# ============================================================

def _recover_from_ledger(image, mm, name, attempt, out_dir):
    if attempt is None:
        return _result(name, UNPROVEN, detail="no erasure record in the ledger and no reference file",
                       erasure_record=describe_attempt(None))

    extents = attempt.get("extents") or []
    if not extents:
        return _result(name, UNPROVEN, size=attempt.get("size") or 0,
                       sha256_original=attempt.get("sha256"),
                       detail="reference file gone and the ledger holds no erased extents to re-read",
                       erasure_record=describe_attempt(attempt))

    bad = S._extents_read_zero(image, extents)
    size = attempt.get("size") or 0

    if not bad:
        return _result(name, CLEAN, size=size, sha256_original=attempt.get("sha256"),
                       detail=f"reference file shredded; {len(extents)} erased extent(s) re-read from "
                              f"the medium - all zero",
                       erasure_record=describe_attempt(attempt))

    # ---- residue came back: carve it out ----
    os.makedirs(out_dir, exist_ok=True)

    # 1) can the ORIGINAL file be rebuilt?  (checked against the SHA-256 stored at erasure time)
    expected = attempt.get("sha256")
    if expected and size:
        for ex in bad:
            start = ex.get("hit_start", ex["start"])
            cand = bytes(mm[start:start + size])
            if len(cand) == size and _sha256(cand) == expected:
                output = os.path.join(out_dir, "recovered_" + name)
                with open(output, "wb") as fh:
                    fh.write(cand)
                return _result(name, RECOVERED, size=size, recovered_bytes=size, recovered_pct=100.0,
                               sha256_original=expected, sha256_recovered=_sha256(cand),
                               integrity="MATCH", offset=start, copies=1,
                               method="MATCHED LEDGER SHA-256", raw_bytes=_hex(cand[:16]),
                               output=output,
                               detail="data reappeared in an erased extent and matches the SHA-256 "
                                      "the ledger stored at erasure time",
                               erasure_record=describe_attempt(attempt))

    # 2) otherwise keep the raw residue
    residue, nonzero = bytearray(), 0
    for ex in bad:
        chunk = bytes(mm[ex["start"]:min(ex["end"], ex["start"] + MAX_RESIDUE_BYTES)])
        nonzero += len(chunk) - chunk.count(0)
        if len(residue) < MAX_RESIDUE_BYTES:
            residue += chunk[:MAX_RESIDUE_BYTES - len(residue)]
    output = os.path.join(out_dir, "recovered_" + name + ".residue")
    with open(output, "wb") as fh:
        fh.write(residue)
    first = bad[0]
    return _result(name, PARTIAL, size=size, recovered_bytes=nonzero,
                   sha256_original=expected, sha256_recovered=_sha256(bytes(residue)),
                   integrity="MISMATCH", offset=first["start"], method="RESIDUE IN ERASED EXTENTS",
                   raw_bytes=_hex(mm[first["start"]:first["start"] + 16]), output=output,
                   detail=f"{len(bad)} of {len(extents)} erased extent(s) are no longer zero "
                          f"({nonzero:,} non-zero bytes carved)",
                   erasure_record=describe_attempt(attempt))


# ============================================================
# MAIN ENTRY POINT
# ============================================================

def attempt_recovery(image, references, out_dir, ledger_path=None, exclude_files=None,
                     attempts=None, log=print, record=True, known_offsets=None):
    """
    Try to RECOVER erased files from `image`.  Read-only on the image.

      references   {file name: path of the reference file, or None if it is gone}
      out_dir      where recovered files are written (recovered_<name>)
      exclude_files  list (all files) or {name: [paths]} of LIVE files whose
                   content must not be reported as residue
      attempts     result of erasure_attempts() (needed for files without a reference)
      known_offsets  {name: offset or [offsets]} where each file is known to have lived
                   (disk layout); checked directly so residue made of generic filler
                   is still found

    Returns a dict with per-file results and an overall verdict:
      "ERASURE VERIFIED"   nothing could be recovered
      "ERASURE FAILED"     something was recovered
      "INCONCLUSIVE"       some files could not be tested and none was recovered
      "NO ERASURE RECORDS" nothing to test
    """
    image = str(image)
    attempts = attempts or {}
    prof = S.profile_target(image)
    if not prof.get("executable_by_engine"):
        return {"verdict": "REFUSED", "reason": prof.get("note"), "files": [], "tested": 0,
                "recovered_files": 0, "complete_files": 0, "image": image, "profile": prof}

    size = os.path.getsize(image)
    S._drop_os_cache(image)                      # read the medium, not the OS cache
    files = []

    if size == 0:
        files = [_result(n, CLEAN, detail="disk image is empty", erasure_record=describe_attempt(attempts.get(n)))
                 for n in references]
    else:
        idx = S.sector_index(image)
        with open(image, "rb") as fh, mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            for name, ref in references.items():
                log(f"[*] Recovery attempt: {name}")
                if isinstance(exclude_files, dict):
                    excl_paths = exclude_files.get(name, [])
                else:
                    excl_paths = exclude_files or []
                excl = [S.Profile(p) for p in excl_paths if os.path.exists(p) and os.path.getsize(p) > 0]

                if ref and os.path.exists(ref) and os.path.getsize(ref) > 0:
                    hint = (known_offsets or {}).get(name, ())
                    if isinstance(hint, int):
                        hint = (hint,)
                    row = _recover_from_reference(image, mm, idx, name, ref, excl, out_dir,
                                                  attempts.get(name), known_offsets=hint)
                else:
                    row = _recover_from_ledger(image, mm, name, attempts.get(name), out_dir)
                files.append(row)

    recovered = [f for f in files if f["status"] in (RECOVERED, PARTIAL)]
    unproven = [f for f in files if f["status"] == UNPROVEN]
    if not files:
        verdict = "NO ERASURE RECORDS"
    elif recovered:
        verdict = "ERASURE FAILED"
    elif unproven:
        verdict = "INCONCLUSIVE"
    else:
        verdict = "ERASURE VERIFIED"

    result = {
        "image": image, "profile": prof, "files": files, "verdict": verdict,
        "tested": len(files), "recovered_files": len(recovered),
        "complete_files": sum(1 for f in files if f["status"] == RECOVERED),
        "when": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    if ledger_path and record and files:
        ledger = EvidenceLedger(ledger_path)
        ledger.append("RECOVERY_ATTEMPT", {
            "image": image, "verdict": verdict,
            "files": [{k: f[k] for k in ("file", "status", "size", "recovered_bytes",
                                         "sha256_original", "sha256_recovered", "integrity", "offset")}
                      for f in files],
        })
        result["ledger_head"] = ledger.head()
        result["ledger_check"] = ledger.verify()

    return result


# ============================================================
# DEMO HELPER - simulate an IMPROPER erasure
# ============================================================

def simulate_improper_erasure(image, reference_path, mode="header", ledger_path=None):
    """
    DEMONSTRATION ONLY.  Imitates an erasure tool that does not finish the job so
    that the recovery module has something to find:

        "header"  wipes only the first 16 bytes of the file on the image
        "partial" wipes only the first third of the file on the image

    The reference file is NOT touched and the event is written to the ledger
    (IMPROPER_ERASE_SIMULATED) so the attempt shows up in the recovery module.
    """
    if mode not in IMPROPER_MODES:
        raise ValueError(f"mode must be one of {sorted(IMPROPER_MODES)}")

    image = str(image)
    prof = S.profile_target(image)
    if not prof.get("executable_by_engine"):
        raise ValueError("Only disk-image files can be modified: " + str(prof.get("note")))

    name = os.path.basename(reference_path)
    ref = S.Profile(reference_path, name=name)
    hits = S.find_residual(image, [ref])[name]["exact"]
    if not hits:
        return {"status": "NOTHING_FOUND", "file": name, "mode": mode, "regions": [],
                "bytes_zeroed": 0,
                "detail": "no intact copy of the file is on the image (already erased or damaged)"}

    n = min(16, ref.size) if mode == "header" else max(1, ref.size // 3)
    regions = [(off, off + n) for off in hits]

    with open(image, "r+b") as f:
        for start, end in regions:
            f.seek(start)
            f.write(b"\x00" * (end - start))
        f.flush()
        os.fsync(f.fileno())
    S._drop_os_cache(image)
    S._INDEX_CACHE.clear()

    if ledger_path:
        EvidenceLedger(ledger_path).append("IMPROPER_ERASE_SIMULATED", {
            "file": name, "mode": mode, "image": image, "size": ref.size, "sha256": ref.sha256,
            "regions": [list(r) for r in regions],
        })

    return {"status": "APPLIED", "file": name, "mode": mode, "regions": regions,
            "bytes_zeroed": n * len(regions), "detail": IMPROPER_MODES[mode]}
