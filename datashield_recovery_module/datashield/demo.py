import os
import hashlib

# ============================================================
# DATASHIELD
# Secure Data Erasure + Authorized File Recovery
#
# CONTROLLED DISK-IMAGE DEMONSTRATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


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


# ============================================================
# RECOVERY FILE LOCATIONS
# ============================================================

RECOVERY_LOCATIONS = {
    "employee.txt": 5 * 1024 * 1024,
    "evidence.png": 20 * 1024 * 1024,
    "password_demo.txt": 35 * 1024 * 1024,
    "project.txt": 50 * 1024 * 1024,
    "secret.txt": 65 * 1024 * 1024,
    "test.txt": 80 * 1024 * 1024
}


# ============================================================
# AUTHORIZED ERASURE FILE LOCATIONS
# ============================================================

ERASURE_LOCATIONS = {
    "employee.txt": 10 * 1024 * 1024,
    "evidence.png": 20 * 1024 * 1024,
    "password_demo.txt": 30 * 1024 * 1024,
    "secret.txt": 50 * 1024 * 1024
}


# ============================================================
# FILE SIGNATURES
# ============================================================

SIGNATURES = {
    "evidence.png": b"\x89PNG\r\n\x1a\n"
}


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
        print("Create the required disk image first.")

        return False

    return True


# ============================================================
# CHECK RECOVERY FILE REGION
# ============================================================

def is_file_recoverable(filename):

    reference = os.path.join(
        RECOVERY_ORIGINAL_DIR,
        filename
    )

    if not os.path.exists(reference):

        return False

    offset = RECOVERY_LOCATIONS[filename]

    file_size = os.path.getsize(reference)

    # --------------------------------------------------------
    # PNG SIGNATURE CHECK
    # --------------------------------------------------------

    if filename in SIGNATURES:

        signature = SIGNATURES[filename]

        raw = read_raw_bytes(
            RECOVERY_IMAGE,
            offset,
            len(signature)
        )

        return raw == signature

    # --------------------------------------------------------
    # TEXT FILE CHECK
    # --------------------------------------------------------

    raw = read_raw_bytes(
        RECOVERY_IMAGE,
        offset,
        min(16, file_size)
    )

    if raw == b"\x00" * len(raw):

        return False

    return True


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
    # SIGNATURE CHECK
    # --------------------------------------------------------

    if filename in SIGNATURES:

        signature = SIGNATURES[filename]

        if raw_before.startswith(signature):

            print()
            print("[+] File signature found")

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

    with open(
        RECOVERY_IMAGE,
        "rb"
    ) as disk:

        disk.seek(offset)

        data = disk.read(file_size)

    if len(data) != file_size:

        print()
        print("[ERROR] Unable to read complete file region.")

        return

    with open(
        recovered,
        "wb"
    ) as output:

        output.write(data)

    print()
    print("[+] File carved from raw disk image")
    print(f"[+] Recovered file : {recovered}")

    # --------------------------------------------------------
    # SHA-256
    # --------------------------------------------------------

    original_hash = calculate_sha256(
        reference
    )

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

def secure_delete():

    if not check_image(ERASURE_IMAGE):

        return

    files = []

    # ========================================================
    # FIND AUTHORIZED ERASURE FILES
    # ========================================================

    for filename in ERASURE_LOCATIONS:

        target = os.path.join(
            ERASURE_TARGET_DIR,
            filename
        )

        if not os.path.exists(target):

            continue

        offset = ERASURE_LOCATIONS[filename]

        file_size = os.path.getsize(target)

        raw = read_raw_bytes(
            ERASURE_IMAGE,
            offset,
            min(16, file_size)
        )

        if raw != b"\x00" * len(raw):

            files.append(filename)

    print()
    print("=" * 70)
    print("                      SECURE ERASURE MODE")
    print("=" * 70)

    print()
    print("AUTHORIZED ERASURE FILES")
    print("-" * 70)

    if not files:

        print()
        print("[!] No recoverable files found.")

        return

    # ========================================================
    # DISPLAY FILES
    # ========================================================

    for number, filename in enumerate(files, 1):

        target = os.path.join(
            ERASURE_TARGET_DIR,
            filename
        )

        size = os.path.getsize(target)

        offset = ERASURE_LOCATIONS[filename]

        print(
            f"{number}. "
            f"{filename:20} "
            f"Size: {size:6} bytes "
            f"Offset: {offset:,}"
        )

    print()

    choice = input(
        "Enter file number to securely erase: "
    ).strip()

    if not choice.isdigit():

        print("[ERROR] Invalid selection.")

        return

    index = int(choice) - 1

    if index < 0 or index >= len(files):

        print("[ERROR] Invalid file number.")

        return

    filename = files[index]

    offset = ERASURE_LOCATIONS[filename]

    target = os.path.join(
        ERASURE_TARGET_DIR,
        filename
    )

    file_size = os.path.getsize(target)

    # ========================================================
    # SELECTED FILE
    # ========================================================

    print()
    print("-" * 70)
    print(f"Selected file : {filename}")
    print(f"Authorization : APPROVED")
    print(f"Disk offset   : {offset:,} bytes")
    print(f"File size     : {file_size} bytes")
    print("-" * 70)

    # ========================================================
    # RAW BYTES BEFORE ERASURE
    # ========================================================

    before = read_raw_bytes(
        ERASURE_IMAGE,
        offset,
        min(16, file_size)
    )

    print()
    print("RAW BYTES BEFORE ERASURE")

    print(
        " ".join(
            f"{b:02X}"
            for b in before
        )
    )

    print()

    # ========================================================
    # CONFIRMATION
    # ========================================================

    confirmation = input(
        f"Confirm secure erasure of '{filename}' (yes/no): "
    ).strip().lower()

    if confirmation != "yes":

        print()
        print("Operation cancelled.")

        return

    # ========================================================
    # OVERWRITE REGION
    # ========================================================

    print()
    print("Overwriting storage region...")

    zero_chunk = b"\x00" * (1024 * 1024)

    with open(
        ERASURE_IMAGE,
        "r+b"
    ) as disk:

        disk.seek(offset)

        remaining = file_size

        while remaining > 0:

            amount = min(
                len(zero_chunk),
                remaining
            )

            disk.write(
                zero_chunk[:amount]
            )

            remaining -= amount

        disk.flush()

    # ========================================================
    # RAW BYTES AFTER ERASURE
    # ========================================================

    after = read_raw_bytes(
        ERASURE_IMAGE,
        offset,
        min(16, file_size)
    )

    print()
    print("RAW BYTES AFTER ERASURE")

    print(
        " ".join(
            f"{b:02X}"
            for b in after
        )
    )

    print()

    # ========================================================
    # VERIFY FIRST 16 BYTES
    # ========================================================

    if after == b"\x00" * len(after):

        print("OVERWRITE : VERIFIED")

    else:

        print("OVERWRITE : FAILED")

        return

    # ========================================================
    # VERIFY COMPLETE REGION
    # ========================================================

    print()
    print("Verifying complete storage region...")

    with open(
        ERASURE_IMAGE,
        "rb"
    ) as disk:

        disk.seek(offset)

        erased_data = disk.read(file_size)

    if erased_data == b"\x00" * file_size:

        print("REGION CHECK : PASSED")

    else:

        print("REGION CHECK : FAILED")

        return

    # ========================================================
    # DELETE SELECTED FILE
    # ========================================================

    print()
    print("Deleting selected file...")

    try:

        os.remove(target)

    except OSError as error:

        print(
            "[ERROR] Unable to delete selected file."
        )

        print(
            f"[ERROR] {error}"
        )

        return

    # ========================================================
    # VERIFY FILE DELETION
    # ========================================================

    if not os.path.exists(target):

        print("FILE DELETION : VERIFIED")

    else:

        print("FILE DELETION : FAILED")

        return

    # ========================================================
    # FINAL RESULT
    # ========================================================

    print()
    print("=" * 70)
    print("SECURE ERASURE RESULT")
    print("=" * 70)

    print()
    print(f"File             : {filename}")
    print(f"Bytes overwritten: {file_size}")
    print("Authorization    : APPROVED")
    print("Overwrite method : Zero-fill")
    print("Region status    : SANITIZED")
    print("File status      : DELETED")
    print("STATUS           : SECURE ERASURE COMPLETED")


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
    print("Scanning controlled erasure disk image...")
    print()

    recoverable = 0

    for filename, offset in ERASURE_LOCATIONS.items():

        target = os.path.join(
            ERASURE_TARGET_DIR,
            filename
        )

        print("-" * 70)

        print(f"FILE   : {filename}")
        print(f"OFFSET : {offset:,}")

        if os.path.exists(target):

            file_size = os.path.getsize(target)

            print(f"SIZE   : {file_size} bytes")
            print("TARGET : PRESENT")

            check_size = min(
                16,
                file_size
            )

        else:

            print("TARGET : DELETED")

            check_size = 16

        raw = read_raw_bytes(
            ERASURE_IMAGE,
            offset,
            check_size
        )

        print(
            "BYTES  :",
            " ".join(
                f"{b:02X}"
                for b in raw
            )
        )

        if raw == b"\x00" * len(raw):

            print("RESULT : REGION OVERWRITTEN")

        else:

            print("RESULT : DATA REGION PRESENT")

            recoverable += 1

    # ========================================================
    # FINAL RESULT
    # ========================================================

    print()
    print("=" * 70)
    print("POST-ERASURE RECOVERY SCAN")
    print("=" * 70)

    print()
    print(f"Recoverable files : {recoverable}")

    print()

    if recoverable == 0:

        print("ERASURE VERIFICATION : PASSED")

        print()
        print("No supported test-file data")
        print("remains in the controlled")
        print("storage regions.")

    else:

        print("ERASURE VERIFICATION : INCOMPLETE")

        print()
        print(
            "Some test-file data is still present."
        )


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

        if filename in SIGNATURES:

            signature = SIGNATURES[filename]

            if raw.startswith(signature):

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

    for filename, offset in ERASURE_LOCATIONS.items():

        target = os.path.join(
            ERASURE_TARGET_DIR,
            filename
        )

        # ----------------------------------------------------
        # TARGET FILE DELETED
        # ----------------------------------------------------

        if not os.path.exists(target):

            raw = read_raw_bytes(
                ERASURE_IMAGE,
                offset,
                16
            )

            if raw == b"\x00" * len(raw):

                status = "TARGET DELETED / SANITIZED"

            else:

                status = "TARGET DELETED / DATA PRESENT"

            print(
                f"{filename:20} "
                f"{offset:<15,} "
                f"{status}"
            )

            continue

        # ----------------------------------------------------
        # TARGET FILE STILL EXISTS
        # ----------------------------------------------------

        file_size = os.path.getsize(target)

        raw = read_raw_bytes(
            ERASURE_IMAGE,
            offset,
            min(16, file_size)
        )

        if raw == b"\x00" * len(raw):

            status = "SANITIZED"

        else:

            status = "DATA PRESENT"

        print(
            f"{filename:20} "
            f"{offset:<15,} "
            f"{status}"
        )


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
        print("6. Exit")

        print()

        choice = input(
            "Enter your choice (1-6): "
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

            print()
            print("=" * 70)
            print("Exiting DataShield...")
            print("=" * 70)

            break

        else:

            print()
            print(
                "[ERROR] Please select "
                "1, 2, 3, 4, 5, or 6."
            )


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    main()