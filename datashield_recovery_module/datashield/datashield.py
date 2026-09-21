import os
import sys
import hashlib

# ============================================================
# DATASHIELD
# Secure Data Erasure + Authorized File Recovery
#
# CONTROLLED DISK-IMAGE DEMONSTRATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

LEDGER_PATH = os.path.join(BASE_DIR, "evidence_ledger.jsonl")
CERTIFICATE_PATH = os.path.join(BASE_DIR, "sanitization_certificate.txt")


def _engine():
    from backend.app.core import sanitizer
    return sanitizer


def _recovery_engine():
    from backend.app.core import erasure_recovery
    return erasure_recovery


# ============================================================
# RECOVERY ENVIRONMENT
# ============================================================

RECOVERY_ORIGINAL_DIR = os.path.join(
    BASE_DIR,
    "test_data",
    "recovery",
    "original"
)

RECOVERY_DIR = os.path.join(
    BASE_DIR,
    "test_data",
    "recovery",
    "recovered"
)

RECOVERY_IMAGE = os.path.join(
    BASE_DIR,
    "test_data",
    "recovery",
    "recovery_disk.img"
)


# ============================================================
# ERASURE ENVIRONMENT
# ============================================================

ERASURE_TARGET_DIR = os.path.join(
    BASE_DIR,
    "test_data",
    "erasure",
    "target"
)

ERASURE_IMAGE = os.path.join(
    BASE_DIR,
    "test_data",
    "erasure",
    "erasure_disk.img"
)

# where the POST-ERASURE RECOVERY module writes what it manages to recover
ERASURE_RECOVERED_DIR = os.path.join(
    BASE_DIR,
    "test_data",
    "erasure",
    "recovered"
)


# ============================================================
# FILE LOCATIONS
# ============================================================

RECOVERY_LOCATIONS = {
    "employee.txt": 5 * 1024 * 1024,
    "evidence.png": 20 * 1024 * 1024,
    "password_demo.txt": 35 * 1024 * 1024,
    "project.txt": 50 * 1024 * 1024,
    "secret.txt": 65 * 1024 * 1024,
    "test.txt": 80 * 1024 * 1024,
    "clip.mp4": 95 * 1024 * 1024,
    "audio.mp3": 115 * 1024 * 1024
}


ERASURE_LOCATIONS = {
    "employee.txt": 10 * 1024 * 1024,
    "evidence.png": 20 * 1024 * 1024,
    "password_demo.txt": 30 * 1024 * 1024,
    "secret.txt": 50 * 1024 * 1024,
    "clip.mp4": 60 * 1024 * 1024,
    "audio.mp3": 65 * 1024 * 1024
}


# ============================================================
# FILE SIGNATURES (MULTIMEDIA + DOCUMENT SUPPORT)
# ============================================================
# Signatures are looked up by FILE EXTENSION rather than by exact
# filename, so any multimedia file placed in the target/original
# folders is automatically recognized - not just "evidence.png".

SIGNATURES_BY_EXTENSION = {
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xFF\xD8\xFF",
    ".jpeg": b"\xFF\xD8\xFF",
    ".gif": b"GIF89a",
    ".pdf": b"%PDF-",
    ".mp3": b"ID3",
    ".mp4": bytes.fromhex("0000001C6674797069736F6D"),  # ....ftypisom
    ".wav": b"RIFF"
}


def get_signature(filename):
    """
    Return the expected file signature (magic bytes) for a
    filename, based on its extension. Returns None for plain
    text / unrecognized files, which are checked differently
    (non-zero byte check instead of a fixed signature).
    """

    extension = os.path.splitext(filename)[1].lower()

    return SIGNATURES_BY_EXTENSION.get(extension)


def signature_matches(filename, raw):
    """
    Return True if `raw` (bytes read from the disk at the file's
    offset) starts like the expected file type.

    MP4 is special: a real MP4 begins with a 4-byte box SIZE that is
    different for every video (0x18, 0x1C, 0x20 ...) followed by the
    text "ftyp". So only the "ftyp" marker at bytes 4-8 is checked,
    otherwise real videos are wrongly reported as not recoverable.
    """

    extension = os.path.splitext(filename)[1].lower()

    if extension == ".mp4":
        return len(raw) >= 8 and raw[4:8] == b"ftyp"

    signature = SIGNATURES_BY_EXTENSION.get(extension)

    if signature is None:
        return False

    return raw.startswith(signature)


# ============================================================
# SHA-256
# ============================================================

def calculate_sha256(path):

    sha256 = hashlib.sha256()

    with open(path, "rb") as f:

        while True:

            data = f.read(8192)

            if not data:
                break

            sha256.update(data)

    return sha256.hexdigest().upper()


# ============================================================
# READ RAW BYTES
# ============================================================

def read_raw_bytes(image, offset, amount=16):

    with open(image, "rb") as f:

        f.seek(offset)

        return f.read(amount)


# ============================================================
# CHECK DISK IMAGE
# ============================================================

def check_image(image):

    if not os.path.exists(image):

        print()
        print("[ERROR] Disk image not found:")
        print(image)

        print()
        print("Run:")
        print("python create_test_disk.py")

        return False

    return True


# ============================================================
# CHECK RECOVERY FILE REGION
# ============================================================

def is_file_recoverable(filename):
    """
    True if ANY trace of the reference file can still be recovered from the
    recovery image: exact copy, distinctive byte windows, or 512-byte sector
    fingerprints, anywhere on the image (not only at the mapped offset, and
    not only the header - a header-only wipe no longer counts as erased).
    """

    reference = os.path.join(
        RECOVERY_ORIGINAL_DIR,
        filename
    )

    if not os.path.exists(reference) or os.path.getsize(reference) == 0:
        return False

    if not os.path.exists(RECOVERY_IMAGE):
        return False

    S = _engine()

    others = [
        S.Profile(os.path.join(RECOVERY_ORIGINAL_DIR, other))
        for other in RECOVERY_LOCATIONS
        if other != filename
        and os.path.exists(os.path.join(RECOVERY_ORIGINAL_DIR, other))
        and os.path.getsize(os.path.join(RECOVERY_ORIGINAL_DIR, other)) > 0
    ]

    report = S.find_residual(
        RECOVERY_IMAGE,
        [S.Profile(reference, name=filename)],
        others
    )

    if report[filename]["residual"]:
        return True

    # legacy header check (kept as an additional signal)
    offset = RECOVERY_LOCATIONS[filename]
    signature = get_signature(filename)

    if signature is not None:
        raw = read_raw_bytes(RECOVERY_IMAGE, offset, len(signature))
        return signature_matches(filename, raw)

    return False


# ============================================================
# FIND RECOVERABLE FILES
# ============================================================

def find_recoverable_files():

    files = []

    for filename in RECOVERY_LOCATIONS:

        if is_file_recoverable(filename):

            files.append(filename)

    return files


# ============================================================
# SHOW RECOVERY FILES
# ============================================================

def show_files():

    print()
    print("=" * 70)
    print("FILES IN CONTROLLED RECOVERY DISK IMAGE")
    print("=" * 70)

    available = []

    for filename, offset in RECOVERY_LOCATIONS.items():

        reference = os.path.join(
            RECOVERY_ORIGINAL_DIR,
            filename
        )

        if not os.path.exists(reference):

            print(
                f"- {filename:20} "
                f"[REFERENCE FILE MISSING]"
            )

            continue

        file_size = os.path.getsize(reference)

        if is_file_recoverable(filename):

            available.append(filename)

            print(
                f"{len(available)}. "
                f"{filename:20} "
                f"({file_size} bytes) "
                f"[RECOVERABLE]"
            )

        else:

            print(
                f"- {filename:20} "
                f"[ERASED / NOT RECOVERABLE]"
            )

    if not available:

        print()
        print("No recoverable files found.")

    return available


# ============================================================
# 1. RECOVER FILE
# ============================================================

def recover_file():

    if not check_image(RECOVERY_IMAGE):
        return

    files = find_recoverable_files()

    print()
    print("=" * 70)
    print("                         RECOVERY MODE")
    print("=" * 70)

    if not files:

        print()
        print("[!] No recoverable files found in disk image.")

        return

    print()
    print("RECOVERABLE FILES")
    print("-" * 70)

    for number, filename in enumerate(files, 1):

        reference = os.path.join(
            RECOVERY_ORIGINAL_DIR,
            filename
        )

        size = os.path.getsize(reference)

        offset = RECOVERY_LOCATIONS[filename]

        print(
            f"{number}. "
            f"{filename:20} "
            f"Size: {size:6} bytes "
            f"Offset: {offset:,}"
        )

    print()

    choice = input(
        "Enter file number to recover: "
    ).strip()

    if not choice.isdigit():

        print("[ERROR] Invalid selection.")

        return

    index = int(choice) - 1

    if index < 0 or index >= len(files):

        print("[ERROR] Invalid file number.")

        return

    filename = files[index]

    offset = RECOVERY_LOCATIONS[filename]

    reference = os.path.join(
        RECOVERY_ORIGINAL_DIR,
        filename
    )

    file_size = os.path.getsize(reference)

    os.makedirs(
        RECOVERY_DIR,
        exist_ok=True
    )

    recovered = os.path.join(
        RECOVERY_DIR,
        "recovered_" + filename
    )

    print()
    print("-" * 70)
    print(f"Selected file : {filename}")
    print(f"Disk offset   : {offset:,} bytes")
    print(f"File size     : {file_size} bytes")
    print("-" * 70)

    # --------------------------------------------------------
    # RAW BYTES
    # --------------------------------------------------------

    raw_before = read_raw_bytes(
        RECOVERY_IMAGE,
        offset,
        min(16, file_size)
    )

    print()
    print("RAW BYTES FOUND IN DISK IMAGE")

    print(
        " ".join(
            f"{b:02X}"
            for b in raw_before
        )
    )

    # --------------------------------------------------------
    # SIGNATURE CHECK (MULTIMEDIA-AWARE)
    # --------------------------------------------------------

    signature = get_signature(filename)

    if signature is not None:

        if signature_matches(filename, raw_before):

            print()
            print(f"[+] File signature found ({os.path.splitext(filename)[1].upper()})")

        else:

            print()
            print("[ERROR] File signature not found.")

            return

    else:

        print()
        print("[+] Data region found")

    # --------------------------------------------------------
    # CARVE FILE
    # --------------------------------------------------------

    print()
    print("Scanning raw disk image...")

    with open(RECOVERY_IMAGE, "rb") as disk:

        disk.seek(offset)

        data = disk.read(file_size)

    if len(data) != file_size:

        print()
        print("[ERROR] Unable to read complete file region.")

        return

    with open(recovered, "wb") as output:

        output.write(data)

    print()
    print("[+] File carved from raw disk image")
    print(f"[+] Recovered file : {recovered}")

    # --------------------------------------------------------
    # SHA-256
    # --------------------------------------------------------

    original_hash = calculate_sha256(reference)

    recovered_hash = calculate_sha256(
        recovered
    )

    print()
    print("=" * 70)
    print("SHA-256 INTEGRITY VERIFICATION")
    print("=" * 70)

    print()
    print(f"Original File  : {reference}")
    print(f"Recovered File : {recovered}")

    print()
    print(f"Original SHA-256  : {original_hash}")
    print(f"Recovered SHA-256 : {recovered_hash}")

    print()

    if original_hash == recovered_hash:

        print("INTEGRITY : MATCH")
        print("STATUS    : RECOVERY VERIFIED")

    else:

        print("INTEGRITY : MISMATCH")
        print("STATUS    : RECOVERY FAILED")


# ============================================================
# 2. SECURE DELETE
# ============================================================

def _live_targets_except(filename):
    return [
        os.path.join(ERASURE_TARGET_DIR, other)
        for other in ERASURE_LOCATIONS
        if other != filename
        and os.path.exists(os.path.join(ERASURE_TARGET_DIR, other))
        and os.path.getsize(os.path.join(ERASURE_TARGET_DIR, other)) > 0
    ]


def erasure_status_rows():
    """
    Whole-image status of every authorized erasure file.

      target still present -> scan the ENTIRE image for its content
      target already erased -> check the evidence ledger, and re-read every
                               erased extent from the medium right now
    Returns a list of dicts: filename, offset, state, sanitized(bool|None), detail
    """

    S = _engine()
    ledger = S.erased_records(LEDGER_PATH)
    rows = []

    if not os.path.exists(ERASURE_IMAGE):
        return [
            dict(filename=name, offset=off, state="DISK IMAGE MISSING",
                 sanitized=None, detail="run create_erasure_disk.py first")
            for name, off in ERASURE_LOCATIONS.items()
        ]

    for filename, offset in ERASURE_LOCATIONS.items():

        target = os.path.join(ERASURE_TARGET_DIR, filename)

        if os.path.exists(target) and os.path.getsize(target) > 0:

            rep = S.find_residual(
                ERASURE_IMAGE,
                [S.Profile(target)],
                [S.Profile(p) for p in _live_targets_except(filename)]
            )[filename]

            if rep["residual"]:
                rows.append(dict(
                    filename=filename, offset=offset,
                    state="DATA PRESENT", sanitized=False,
                    detail=(f"{len(rep['exact'])} exact copy(ies), "
                            f"{rep['sectors_matched']}/{rep['sectors_total']} sectors, "
                            f"match {rep['match_ratio']:.0%}")))
            else:
                rows.append(dict(
                    filename=filename, offset=offset,
                    state="NO TRACE ON IMAGE", sanitized=True,
                    detail="whole-image scan found no copy"))
            continue

        rec = ledger.get(filename)

        if rec is None:
            rows.append(dict(
                filename=filename, offset=offset,
                state="TARGET DELETED / NO ERASURE RECORD", sanitized=None,
                detail="deleted outside DataShield - cannot prove image is clean"))
        elif rec["status"] != "PASSED":
            rows.append(dict(
                filename=filename, offset=offset,
                state="ERASURE FAILED", sanitized=False,
                detail=f"ledger #{rec['seq']} recorded FAILED"))
        elif not S.extents_zero_now(ERASURE_IMAGE, rec["extents"]):
            rows.append(dict(
                filename=filename, offset=offset,
                state="ERASED EXTENT NO LONGER ZERO", sanitized=False,
                detail=f"ledger #{rec['seq']}: extent changed after erasure"))
        else:
            rows.append(dict(
                filename=filename, offset=offset,
                state="ERASED / VERIFIED", sanitized=True,
                detail=f"ledger #{rec['seq']} at {rec['when']}, "
                       f"{len(rec['extents'])} extent(s) re-read as zero"))

    return rows


def secure_erase_file(filename, log=print, allow_full_wipe=False):
    """
    Closed-loop erase of one authorized file (no prompts - safe for the UI).
    scan -> plan -> erase -> whole-image verify -> escalate
         -> RECOVERY ATTEMPT -> shred host copy -> certificate.

    The RECOVERY ATTEMPT is the new module: after the eraser has finished, the
    recovery system is pointed at the erased image. If it can still get data
    back, the erasure is reported as FAILED, the source file is kept and no
    certificate is issued.

    Returns the engine result dict (+ host_file_deleted, recovery_attempt,
    recovered_copy_shredded).
    """

    S = _engine()
    E = _recovery_engine()

    from backend.app.core.evidence_chain import EvidenceLedger

    target = os.path.join(ERASURE_TARGET_DIR, filename)

    result = S.sanitize_targets(
        ERASURE_IMAGE,
        [target],
        exclude_files=_live_targets_except(filename),
        ledger_path=LEDGER_PATH,
        allow_full_wipe=allow_full_wipe,
        log=log
    )

    result["host_file_deleted"] = False
    result["certificate"] = None
    result["recovery_attempt"] = None
    result["recovered_copy_shredded"] = False

    ledger = EvidenceLedger(LEDGER_PATH)

    if result["status"] in ("PASSED", "FAILED"):

        # NEW - try to RECOVER the file from the erased image.
        attempt = E.attempt_recovery(
            ERASURE_IMAGE,
            {filename: target},
            ERASURE_RECOVERED_DIR,
            ledger_path=LEDGER_PATH,
            exclude_files={filename: _live_targets_except(filename)},
            attempts=E.erasure_attempts(LEDGER_PATH),
            log=log,
            known_offsets={filename: ERASURE_LOCATIONS[filename]}
        )

        result["recovery_attempt"] = attempt

        if result["status"] == "PASSED" and attempt["recovered_files"]:

            # the recovery system disagrees with the eraser -> do not trust PASSED
            result["status"] = "FAILED"

            log("[!] Recovery attempt got data back although verification "
                "passed - erasure treated as FAILED.")

    if result["status"] == "PASSED":

        # only shred the plain source once the image is PROVEN clean
        result["host_file_deleted"] = S.shred_host_file(target)

        ledger.append("HOST_FILE_SHREDDED", {
            "file": filename,
            "deleted": result["host_file_deleted"]
        })

        # a file recovered earlier by the recovery module is another plain copy
        # of the same data - it must go too, otherwise the erasure is pointless
        leftovers = [
            os.path.join(ERASURE_RECOVERED_DIR, "recovered_" + filename),
            os.path.join(ERASURE_RECOVERED_DIR, "recovered_" + filename + ".residue")
        ]

        for leftover in leftovers:

            if os.path.exists(leftover):

                shredded = S.shred_host_file(leftover)

                result["recovered_copy_shredded"] = shredded

                ledger.append("RECOVERED_COPY_SHREDDED", {
                    "file": filename,
                    "deleted": shredded
                })

    if result["status"] in ("PASSED", "FAILED"):

        result["ledger_head"] = ledger.head()
        result["ledger_check"] = ledger.verify()

    if result["status"] == "PASSED":

        result["certificate"] = S.write_certificate(
            result,
            os.path.join(BASE_DIR, f"sanitization_certificate_{filename}.txt")
        )

    return result


def secure_delete():

    if not check_image(ERASURE_IMAGE):
        return

    S = _engine()

    print()
    print("=" * 70)
    print("                      SECURE ERASURE MODE")
    print("=" * 70)

    profile = S.profile_target(ERASURE_IMAGE)

    print()
    print(f"Storage kind : {profile['kind']}")
    print(f"Method       : {profile['method']}")

    rows = [r for r in erasure_status_rows() if r["state"] == "DATA PRESENT"]

    if not rows:

        print()
        print("[!] No recoverable files found.")

        return

    print()
    print("RECOVERABLE FILES  (whole-image scan, not a fixed offset)")
    print("-" * 70)

    for number, row in enumerate(rows, 1):

        size = os.path.getsize(
            os.path.join(ERASURE_TARGET_DIR, row["filename"])
        )

        print(
            f"{number}. {row['filename']:20} "
            f"Size: {size:6} bytes  {row['detail']}"
        )

    print()

    choice = input(
        "Enter file number to securely erase: "
    ).strip()

    if not choice.isdigit():

        print("[ERROR] Invalid selection.")

        return

    index = int(choice) - 1

    if index < 0 or index >= len(rows):

        print("[ERROR] Invalid file number.")

        return

    filename = rows[index]["filename"]

    target = os.path.join(ERASURE_TARGET_DIR, filename)

    file_size = os.path.getsize(target)

    # ========================================================
    # PRE-ERASURE ANALYSIS (nothing is written yet)
    # ========================================================

    plan = S.analyze_targets(
        ERASURE_IMAGE,
        [target],
        _live_targets_except(filename)
    )

    print()
    print("-" * 70)
    print(f"Selected file : {filename}")
    print(f"File size     : {file_size} bytes")
    print(f"Extents found : {len(plan['extents'])}")
    print("-" * 70)

    with open(ERASURE_IMAGE, "rb") as disk:

        for extent in plan["extents"]:

            length = extent["end"] - extent["start"]

            disk.seek(extent.get("hit_start", extent["start"]))

            head = disk.read(16)

            print(
                f"  offset {extent['start']:>12,}  length {length:>10,} bytes"
                f"  found by {','.join(extent['found_by'])}"
            )

            if extent["extended_bytes"]:
                print(
                    f"    (+{extent['extended_bytes']:,} bytes beyond the matched "
                    f"content: sector padding and/or a grown/stale copy)"
                )

            print(
                "    RAW BYTES BEFORE ERASURE: "
                + " ".join(f"{b:02X}" for b in head)
            )

    print()

    confirmation = input(
        f"Confirm secure erasure of '{filename}' (yes/no): "
    ).strip().lower()

    if confirmation != "yes":

        print()
        print("Operation cancelled.")

        return

    print()

    result = secure_erase_file(filename)

    # ========================================================
    # RESULT
    # ========================================================

    print()
    print("=" * 70)
    print("SECURE ERASURE RESULT")
    print("=" * 70)

    print()
    print(f"File             : {filename}")

    for rnd in result.get("rounds", []):

        print(
            f"Round {rnd['round']}          : {rnd['method']:<12} "
            f"still recoverable={rnd['residual_files']}  "
            f"extents not zero={rnd['extents_not_zero']}  "
            f"{'OK' if rnd['ok'] else 'FAILED'}"
        )

    print("Verification     : whole-image content scan + extent read-back")

    attempt = result.get("recovery_attempt")

    if attempt and attempt["files"]:

        row = attempt["files"][0]

        print(f"Recovery attempt : {row['state']}")
        print(f"                   {row['detail']}")

        if row["output"]:
            print(f"Recovered file   : {row['output']}")

    if result["status"] == "PASSED":

        print(f"Host copy        : "
              f"{'SHREDDED + DELETED' if result['host_file_deleted'] else 'NOT DELETED'}")

        if result.get("recovered_copy_shredded"):
            print("Recovered copy   : SHREDDED (earlier recovery output removed)")
        print(f"Evidence ledger  : "
              f"{'VALID' if result['ledger_check']['valid'] else 'BROKEN'} "
              f"({result['ledger_check']['records']} records)")
        print(f"Ledger head hash : {result['ledger_head']}")
        print(f"Certificate      : {result['certificate']}")
        print()
        print("STATUS           : SECURE ERASURE COMPLETED")

    else:

        print()
        print("STATUS           : SANITIZATION FAILED")
        print("Residual recoverable data remains. The source file was NOT")
        print("deleted. Re-run with a full-image wipe, or sanitize the")
        print("whole device (secure_erase_file(name, allow_full_wipe=True)).")


# ============================================================
# 3. ERASURE PROOF
# ============================================================

def erasure_proof():

    if not check_image(ERASURE_IMAGE):
        return

    print()
    print("=" * 70)
    print("                         ERASURE PROOF")
    print("=" * 70)

    print()
    print("Whole-image scan + evidence-ledger check...")
    print()

    rows = erasure_status_rows()

    recoverable = 0
    unproven = 0

    for row in rows:

        print("-" * 70)
        print(f"FILE   : {row['filename']}")
        print(f"STATE  : {row['state']}")
        print(f"DETAIL : {row['detail']}")

        if row["sanitized"] is False:
            recoverable += 1
        elif row["sanitized"] is None:
            unproven += 1

    S = _engine()
    from backend.app.core.evidence_chain import EvidenceLedger

    chain = EvidenceLedger(LEDGER_PATH).verify()

    print()
    print("=" * 70)
    print("POST-ERASURE RECOVERY SCAN")
    print("=" * 70)
    print()
    print(f"Recoverable files : {recoverable}")
    print(f"Unproven files    : {unproven}")
    print(f"Evidence ledger   : "
          f"{'VALID' if chain['valid'] else 'BROKEN - ' + chain['reason']} "
          f"({chain['records']} records)")
    print()

    if recoverable == 0 and unproven == 0 and chain["valid"]:
        print("ERASURE VERIFICATION : PASSED")
    elif recoverable:
        print("ERASURE VERIFICATION : FAILED")
        print()
        print("Recoverable data is still present.")
    else:
        print("ERASURE VERIFICATION : INCONCLUSIVE")
        print()
        print("Some files cannot be proven clean (no ledger record, or")
        print("the evidence ledger failed its integrity check).")


# ============================================================
# 4. STORAGE STATUS
# ============================================================

def storage_status():

    print()
    print("=" * 70)
    print("                         STORAGE STATUS")
    print("=" * 70)

    # ========================================================
    # RECOVERY DISK
    # ========================================================

    print()
    print("RECOVERY DISK")
    print("-" * 70)

    if not check_image(RECOVERY_IMAGE):
        return

    print(
        f"Disk image : {RECOVERY_IMAGE}"
    )

    print(
        f"Size       : "
        f"{os.path.getsize(RECOVERY_IMAGE):,} bytes"
    )

    print()

    print(
        f"{'FILE':20} "
        f"{'OFFSET':15} "
        f"{'STATUS'}"
    )

    print("-" * 70)

    for filename, offset in RECOVERY_LOCATIONS.items():

        reference = os.path.join(
            RECOVERY_ORIGINAL_DIR,
            filename
        )

        if not os.path.exists(reference):

            print(
                f"{filename:20} "
                f"{offset:<15,} "
                f"REFERENCE MISSING"
            )

            continue

        file_size = os.path.getsize(reference)

        raw = read_raw_bytes(
            RECOVERY_IMAGE,
            offset,
            min(16, file_size)
        )

        signature = get_signature(filename)

        if signature is not None:

            if signature_matches(filename, raw):

                status = "RECOVERABLE"

            elif raw == b"\x00" * len(raw):

                status = "OVERWRITTEN"

            else:

                status = "UNKNOWN"

        else:

            if raw == b"\x00" * len(raw):

                status = "OVERWRITTEN"

            else:

                status = "RECOVERABLE"

        print(
            f"{filename:20} "
            f"{offset:<15,} "
            f"{status}"
        )

    # ========================================================
    # ERASURE DISK
    # ========================================================

    print()
    print("ERASURE DISK")
    print("-" * 70)

    if not check_image(ERASURE_IMAGE):
        return

    print(
        f"Disk image : {ERASURE_IMAGE}"
    )

    print(
        f"Size       : "
        f"{os.path.getsize(ERASURE_IMAGE):,} bytes"
    )

    print()

    print(
        f"{'FILE':20} "
        f"{'OFFSET':15} "
        f"{'STATUS'}"
    )

    print("-" * 70)

    for row in erasure_status_rows():

        print(
            f"{row['filename']:20} "
            f"{row['offset']:<15,} "
            f"{row['state']}"
        )


# ============================================================
# 6. POST-ERASURE RECOVERY  (NEW MODULE)
# ============================================================
# After a secure erasure the RECOVERY side of DataShield is pointed at the
# erased disk image.  If any data can be recovered, the erasure was not
# proper: the data is recovered, SHA-256 checked and reported.

def erasure_attempt_records():
    """{file name: latest erasure record} for authorized files that were erased."""

    E = _recovery_engine()

    attempts = E.erasure_attempts(LEDGER_PATH)

    return {
        name: attempts[name]
        for name in ERASURE_LOCATIONS
        if name in attempts
    }


def recover_after_erasure(filenames=None, log=print):
    """
    Try to recover erased files from the erasure disk (no prompts - safe for
    the UI).  Tests the given files, or every file that has an erasure record.
    Returns the recovery-engine result dict (see erasure_recovery.py).
    """

    E = _recovery_engine()

    attempts = E.erasure_attempts(LEDGER_PATH)

    if filenames:
        names = [n for n in filenames if n in ERASURE_LOCATIONS]
    else:
        names = [n for n in ERASURE_LOCATIONS if n in attempts]

    references = {}

    for name in names:

        path = os.path.join(ERASURE_TARGET_DIR, name)

        exists = os.path.exists(path) and os.path.getsize(path) > 0

        references[name] = path if exists else None

    return E.attempt_recovery(
        ERASURE_IMAGE,
        references,
        ERASURE_RECOVERED_DIR,
        ledger_path=LEDGER_PATH,
        exclude_files={name: _live_targets_except(name) for name in names},
        attempts=attempts,
        log=log,
        known_offsets={name: ERASURE_LOCATIONS[name] for name in names}
    )


def simulate_improper_erasure(filename, mode="header"):
    """
    DEMONSTRATION ONLY - imitates an erasure that does not finish the job so the
    recovery module has something to find.  mode: "header" or "partial".
    """

    E = _recovery_engine()

    if filename not in ERASURE_LOCATIONS:
        raise ValueError(f"'{filename}' is not an authorized erasure file.")

    target = os.path.join(ERASURE_TARGET_DIR, filename)

    if not os.path.exists(target):
        raise FileNotFoundError(f"Target file '{filename}' does not exist.")

    return E.simulate_improper_erasure(
        ERASURE_IMAGE,
        target,
        mode,
        LEDGER_PATH
    )


def print_recovery_result(result):
    """Print a recovery-engine result in the same style as Recovery Mode."""

    E = _recovery_engine()

    for row in result["files"]:

        print()
        print("-" * 70)
        print(f"FILE            : {row['file']}")
        print(f"ERASURE RECORD  : {row['erasure_record']}")
        print(f"RESULT          : {row['state']}")
        print(f"DETAIL          : {row['detail']}")

        if row["status"] in (E.RECOVERED, E.PARTIAL):

            print(f"METHOD          : {row['method']}")
            print(f"Disk offset     : {row['offset']:,} bytes")
            print(
                f"Recovered bytes : {row['recovered_bytes']:,}"
                f" of {row['size']:,}  ({row['recovered_pct']}%)"
            )

            print()
            print("RAW BYTES FOUND IN DISK IMAGE")
            print(row["raw_bytes"])

            print()
            print(f"Recovered file  : {row['output']}")
            print(f"Original SHA-256  : {row['sha256_original']}")
            print(f"Recovered SHA-256 : {row['sha256_recovered']}")
            print(f"INTEGRITY : {row['integrity']}")

    print()
    print("=" * 70)
    print("POST-ERASURE RECOVERY SUMMARY")
    print("=" * 70)
    print()
    print(f"Files tested      : {result['tested']}")
    print(f"Files recovered   : {result['recovered_files']}"
          f"  (complete: {result['complete_files']})")

    chain = result.get("ledger_check")

    if chain:
        print(f"Evidence ledger   : "
              f"{'VALID' if chain['valid'] else 'BROKEN - ' + chain['reason']} "
              f"({chain['records']} records)")

    print()

    if result["verdict"] == "ERASURE VERIFIED":

        print("POST-ERASURE RECOVERY : NOTHING RECOVERED")
        print("ERASURE VERIFIED")

    elif result["verdict"] == "ERASURE FAILED":

        print("POST-ERASURE RECOVERY : DATA RECOVERED")
        print("ERASURE FAILED - the data was not properly erased.")
        print()
        print("Run option 2 (Securely Delete File) to erase the remaining data.")

    else:

        print(f"POST-ERASURE RECOVERY : {result['verdict']}")
        print("Some files cannot be proven clean (no reference file and no")
        print("erased extents recorded in the evidence ledger).")


def post_erasure_recovery(run_all=False):

    if not check_image(ERASURE_IMAGE):
        return

    E = _recovery_engine()

    print()
    print("=" * 70)
    print("                    POST-ERASURE RECOVERY")
    print("=" * 70)

    records = erasure_attempt_records()

    if not records:

        print()
        print("[!] No erasure has been performed yet.")
        print("    Run option 2 (Securely Delete File) first,")
        print("    or option 7 to simulate an improper erasure.")

        return

    names = list(records)

    print()
    print("FILES WITH AN ERASURE RECORD")
    print("-" * 70)

    for number, name in enumerate(names, 1):

        print(f"{number}. {name:20} {E.describe_attempt(records[name])}")

    if run_all:

        selected = names

    else:

        print()

        choice = input(
            "Enter file number (or A for all files): "
        ).strip().lower()

        if choice == "a":

            selected = names

        elif choice.isdigit() and 1 <= int(choice) <= len(names):

            selected = [names[int(choice) - 1]]

        else:

            print("[ERROR] Invalid selection.")

            return

    print()
    print("Scanning the whole disk image and trying to recover the data...")

    result = recover_after_erasure(
        selected,
        log=lambda *a, **k: None
    )

    print_recovery_result(result)


def improper_erasure_demo():
    """Menu option: simulate an erasure that does not finish the job (demo)."""

    if not check_image(ERASURE_IMAGE):
        return

    E = _recovery_engine()

    print()
    print("=" * 70)
    print("            SIMULATE IMPROPER ERASURE  (DEMONSTRATION)")
    print("=" * 70)
    print()
    print("Imitates an erasure tool that does not finish the job, so that")
    print("option 6 (Post-Erasure Recovery) has something to recover.")

    rows = [r for r in erasure_status_rows() if r["state"] == "DATA PRESENT"]

    if not rows:

        print()
        print("[!] No intact files on the erasure disk.")

        return

    print()

    for number, row in enumerate(rows, 1):

        print(f"{number}. {row['filename']}")

    print()

    choice = input("Enter file number: ").strip()

    if not choice.isdigit() or not 1 <= int(choice) <= len(rows):

        print("[ERROR] Invalid selection.")

        return

    filename = rows[int(choice) - 1]["filename"]

    print()

    modes = list(E.IMPROPER_MODES)

    for number, mode in enumerate(modes, 1):

        print(f"{number}. {mode:8} - {E.IMPROPER_MODES[mode]}")

    print()

    choice = input("Enter erasure type: ").strip()

    if not choice.isdigit() or not 1 <= int(choice) <= len(modes):

        print("[ERROR] Invalid selection.")

        return

    outcome = simulate_improper_erasure(filename, modes[int(choice) - 1])

    print()
    print(f"File           : {filename}")
    print(f"Improper wipe  : {outcome['detail']}")
    print(f"Bytes wiped    : {outcome['bytes_zeroed']}")
    print()
    print("Now run option 6 (Post-Erasure Recovery) to see what comes back.")


# ============================================================
# 5. FULL SYSTEM DEMONSTRATION
# ============================================================

def full_demo():

    print()
    print("=" * 70)
    print("                  DATASHIELD FULL DEMO")
    print("=" * 70)

    print()
    print("STEP 1 : STORAGE STATUS")

    storage_status()

    print()
    print("=" * 70)
    print("STEP 2 : RECOVERY")
    print("=" * 70)

    recover_file()

    print()
    print("=" * 70)
    print("STEP 3 : SECURE ERASURE")
    print("=" * 70)

    secure_delete()

    print()
    print("=" * 70)
    print("STEP 4 : ERASURE PROOF")
    print("=" * 70)

    erasure_proof()

    print()
    print("=" * 70)
    print("STEP 5 : POST-ERASURE RECOVERY")
    print("=" * 70)

    post_erasure_recovery(run_all=True)

    print()
    print("=" * 70)
    print("FULL DEMO COMPLETE")
    print("=" * 70)


# ============================================================
# MAIN MENU
# ============================================================

def main():

    while True:

        print()
        print()
        print("=" * 70)
        print("                         DATASHIELD")
        print("=" * 70)
        print("              SECURE DATA ERASURE + RECOVERY")
        print()
        print("                  CONTROLLED DISK IMAGE")
        print("=" * 70)

        print()
        print("1. Recover File")
        print("2. Securely Delete File")
        print("3. Erasure Proof")
        print("4. Storage Status")
        print("5. Full Demonstration")
        print("6. Post-Erasure Recovery")
        print("7. Simulate Improper Erasure (demo)")
        print("8. Exit")

        print()

        choice = input(
            "Enter your choice (1-8): "
        ).strip()

        if choice == "1":

            recover_file()

        elif choice == "2":

            secure_delete()

        elif choice == "3":

            erasure_proof()

        elif choice == "4":

            storage_status()

        elif choice == "5":

            full_demo()

        elif choice == "6":

            post_erasure_recovery()

        elif choice == "7":

            improper_erasure_demo()

        elif choice == "8":

            print()
            print("=" * 70)
            print("Exiting DataShield...")
            print("=" * 70)

            break

        else:

            print()
            print(
                "[ERROR] Please select "
                "1, 2, 3, 4, 5, 6, 7, or 8."
            )


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    main()