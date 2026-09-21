import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TARGET_DIR = os.path.join(
    BASE_DIR,
    "test_data",
    "erasure",
    "target"
)

IMAGE_PATH = os.path.join(
    BASE_DIR,
    "test_data",
    "erasure",
    "erasure_disk.img"
)

# ============================================================
# FILE LOCATIONS
# ============================================================

FILES = {
    "employee.txt": 10 * 1024 * 1024,
    "evidence.png": 20 * 1024 * 1024,
    "password_demo.txt": 30 * 1024 * 1024,
    "secret.txt": 50 * 1024 * 1024,
    "clip.mp4": 60 * 1024 * 1024,
    "audio.mp3": 65 * 1024 * 1024
}


# ============================================================
# MULTIMEDIA / TEXT PLACEHOLDER GENERATION
# ============================================================
# Any file listed in FILES that doesn't already exist gets a
# placeholder generated for it. Multimedia extensions get a
# minimal valid file-signature header; anything else gets a
# short text placeholder.

MULTIMEDIA_SIGNATURES = {
    ".png": bytes.fromhex("89504E470D0A1A0A"),
    ".jpg": bytes.fromhex("FFD8FFE000104A4649460001"),
    ".jpeg": bytes.fromhex("FFD8FFE000104A4649460001"),
    ".gif": b"GIF89a",
    ".mp3": bytes.fromhex("494433030000000000"),
    ".mp4": bytes.fromhex("0000001C6674797069736F6D"),
    ".wav": b"RIFF" + bytes.fromhex("00000000") + b"WAVE",
    ".pdf": b"%PDF-1.4",
}


# ============================================================
# CREATE DIRECTORIES
# ============================================================

os.makedirs(TARGET_DIR, exist_ok=True)

os.makedirs(
    os.path.dirname(IMAGE_PATH),
    exist_ok=True
)


# ============================================================
# CREATE TEST FILES IF MISSING
# ============================================================

for filename in FILES:

    path = os.path.join(
        TARGET_DIR,
        filename
    )

    if os.path.exists(path) and os.path.getsize(path) > 0:
        print(f"[EXISTS] {filename}")
        continue

    extension = os.path.splitext(filename)[1].lower()

    # --------------------------------------------------------
    # Create multimedia placeholder (png, jpg, gif, mp3, mp4, etc.)
    # --------------------------------------------------------

    if extension in MULTIMEDIA_SIGNATURES:

        header = MULTIMEDIA_SIGNATURES[extension]

        padding = bytes([0xAA]) * 512

        with open(path, "wb") as f:
            f.write(header + padding)

        print(f"[CREATED] {filename} (placeholder {extension} file)")

    # --------------------------------------------------------
    # Create TXT
    # --------------------------------------------------------

    else:

        with open(path, "w") as f:

            f.write(
                f"DATASHIELD TEST FILE\n"
                f"Authorized erasure demonstration\n"
                f"File: {filename}\n"
                f"CONFIDENTIAL DEMO DATA\n"
            )

        print(f"[CREATED] {filename}")


# ============================================================
# CREATE DISK IMAGE
# ============================================================

print()
print("=" * 70)
print("CREATING DATASHIELD ERASURE DISK IMAGE")
print("=" * 70)

# Disk must be big enough to hold every file at its offset - real
# multimedia files you drop in can be much larger than the text
# placeholders, so size the disk off whatever's actually on disk
# instead of a fixed 70 MB.

largest_needed = max(
    offset + os.path.getsize(os.path.join(TARGET_DIR, filename))
    for filename, offset in FILES.items()
)

DISK_SIZE = max(70 * 1024 * 1024, largest_needed + (5 * 1024 * 1024))

with open(IMAGE_PATH, "wb") as disk:

    disk.seek(DISK_SIZE - 1)

    disk.write(b"\x00")


# ============================================================
# WRITE FILES INTO DISK IMAGE
# ============================================================

with open(IMAGE_PATH, "r+b") as disk:

    for filename, offset in FILES.items():

        path = os.path.join(
            TARGET_DIR,
            filename
        )

        with open(path, "rb") as source:

            data = source.read()

        disk.seek(offset)

        disk.write(data)

        print()
        print(f"[+] Written : {filename}")
        print(f"    Offset  : {offset:,} bytes")
        print(f"    Size    : {len(data):,} bytes")


# ============================================================
# RESULT
# ============================================================

print()
print("=" * 70)
print("ERASURE DISK CREATED")
print("=" * 70)

print()
print(f"Image : {IMAGE_PATH}")
print(f"Size  : {os.path.getsize(IMAGE_PATH):,} bytes")

print()
print("Authorized files:")

for filename, offset in FILES.items():

    print(
        f" - {filename:20} "
        f"@ {offset:,} bytes"
    )

print()
print("READY FOR DATASHIELD SECURE ERASURE")