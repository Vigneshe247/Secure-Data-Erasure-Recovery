import os
import hashlib

# ============================================================
# DATASHIELD - SECURE DATA ERASURE
# Controlled Disk-Image Demonstration
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TARGET_DIR = os.path.join(
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
# AUTHORIZED ERASURE FILES
# ============================================================

ERASURE_LOCATIONS = {
    "employee.txt": 10 * 1024 * 1024,
    "evidence.png": 20 * 1024 * 1024,
    "password_demo.txt": 30 * 1024 * 1024,
    "secret.txt": 50 * 1024 * 1024
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
# CHECK IMAGE
# ============================================================

def check_image():

    if not os.path.exists(ERASURE_IMAGE):

        print()
        print("[ERROR] Erasure disk image not found.")
        print()
        print(ERASURE_IMAGE)

        return False

    return True


# ============================================================
# FIND AUTHORIZED FILES
# ============================================================

def find_files():

    files = []

    for filename, offset in ERASURE_LOCATIONS.items():

        target = os.path.join(
            TARGET_DIR,
            filename
        )

        if not os.path.exists(target):
            continue

        size = os.path.getsize(target)

        if size == 0:
            continue

        raw = read_raw_bytes(
            ERASURE_IMAGE,
            offset,
            min(16, size)
        )

        if raw != b"\x00" * len(raw):

            files.append(filename)

    return files


# ============================================================
# DISPLAY AUTHORIZED FILES
# ============================================================

def show_authorized_files(files):

    print()
    print("=" * 70)
    print("                 AUTHORIZED ERASURE FILES")
    print("=" * 70)

    print()

    for number, filename in enumerate(files, 1):

        target = os.path.join(
            TARGET_DIR,
            filename
        )

        size = os.path.getsize(target)

        offset = ERASURE_LOCATIONS[filename]

        print(
            f"{number}. "
            f"{filename:20} "
            f"Size: {size:,} bytes "
            f"Offset: {offset:,}"
        )


# ============================================================
# SECURE ERASE
# ============================================================

def secure_erase():
    """
    Deprecated duplicate of datashield.secure_delete().

    The original body here zeroed `len(source file)` bytes at a hard-coded
    offset and deleted the source with a plain os.remove(). It now delegates
    to the content-aware, verified, closed-loop engine.
    """
    import datashield
    datashield.secure_delete()


# ============================================================
# PROGRAM START
# ============================================================

if __name__ == "__main__":

    secure_erase()