import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TEST_DATA = os.path.join(BASE_DIR, "test_data")

RECOVERY_ORIGINAL = os.path.join(
    TEST_DATA, "recovery", "original"
)

RECOVERY_IMAGE = os.path.join(
    TEST_DATA, "recovery", "recovery_disk.img"
)

ERASURE_TARGET = os.path.join(
    TEST_DATA, "erasure", "target"
)

ERASURE_IMAGE = os.path.join(
    TEST_DATA, "erasure", "erasure_disk.img"
)

# Base disk size; both builders grow this automatically if a
# larger multimedia file needs more room (see disk_size_for()).
DISK_SIZE = 130 * 1024 * 1024


# Fixed locations inside the disk image
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
# MULTIMEDIA / TEXT PLACEHOLDER GENERATION
# ============================================================
# If a file listed above doesn't exist yet in the source folder,
# generate a placeholder for it instead of skipping it. Multimedia
# extensions get a minimal valid file-signature header; anything
# else gets a short text placeholder.

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


def ensure_source_file(directory, filename):
    """
    Make sure `filename` exists in `directory`, generating a
    placeholder (multimedia or text) if it's missing.
    """

    os.makedirs(directory, exist_ok=True)

    path = os.path.join(directory, filename)

    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path

    extension = os.path.splitext(filename)[1].lower()

    if extension in MULTIMEDIA_SIGNATURES:

        with open(path, "wb") as f:
            f.write(MULTIMEDIA_SIGNATURES[extension] + bytes([0xAA]) * 512)

        print(f"[GENERATED] {filename} (placeholder {extension} file)")

    else:

        with open(path, "w") as f:
            f.write(
                f"DATASHIELD TEST FILE\n"
                f"Authorized test-disk demonstration\n"
                f"File: {filename}\n"
                f"CONFIDENTIAL DEMO DATA\n"
            )

        print(f"[GENERATED] {filename}")

    return path


def disk_size_for(locations, source_dir):
    """
    Disk must be big enough to hold every listed file at its
    offset. Real multimedia files can be much larger than the
    placeholders, so size the disk off what's actually there.
    """

    largest_needed = 0

    for filename, offset in locations.items():

        path = ensure_source_file(source_dir, filename)

        largest_needed = max(
            largest_needed,
            offset + os.path.getsize(path)
        )

    return max(DISK_SIZE, largest_needed + (5 * 1024 * 1024))


def create_empty_disk(image_path, size):
    os.makedirs(os.path.dirname(image_path), exist_ok=True)

    with open(image_path, "wb") as f:
        f.seek(size - 1)
        f.write(b"\0")


def write_file_to_disk(image_path, source_file, offset):
    with open(source_file, "rb") as src:
        data = src.read()

    with open(image_path, "r+b") as disk:
        disk.seek(offset)
        disk.write(data)

    return len(data)


def build_recovery_disk():
    print()
    print("========================================")
    print("CREATING RECOVERY TEST DISK")
    print("========================================")

    size = disk_size_for(RECOVERY_LOCATIONS, RECOVERY_ORIGINAL)

    create_empty_disk(RECOVERY_IMAGE, size)

    total = 0

    for filename, offset in RECOVERY_LOCATIONS.items():

        source = ensure_source_file(
            RECOVERY_ORIGINAL,
            filename
        )

        embedded = write_file_to_disk(
            RECOVERY_IMAGE,
            source,
            offset
        )

        total += embedded

        print(
            f"[EMBEDDED] {filename:<20} "
            f"Offset: {offset:<10} "
            f"Size: {embedded} bytes"
        )

    print()
    print(f"Recovery disk : {RECOVERY_IMAGE}")
    print(f"Disk size     : {size // (1024 * 1024)} MB")
    print(f"Embedded data : {total} bytes")
    print("STATUS        : READY")


def build_erasure_disk():
    print()
    print("========================================")
    print("CREATING ERASURE TEST DISK")
    print("========================================")

    size = disk_size_for(ERASURE_LOCATIONS, ERASURE_TARGET)

    create_empty_disk(ERASURE_IMAGE, size)

    total = 0

    for filename, offset in ERASURE_LOCATIONS.items():

        source = ensure_source_file(
            ERASURE_TARGET,
            filename
        )

        embedded = write_file_to_disk(
            ERASURE_IMAGE,
            source,
            offset
        )

        total += embedded

        print(
            f"[EMBEDDED] {filename:<20} "
            f"Offset: {offset:<10} "
            f"Size: {embedded} bytes"
        )

    print()
    print(f"Erasure disk  : {ERASURE_IMAGE}")
    print(f"Disk size     : {size // (1024 * 1024)} MB")
    print(f"Embedded data : {total} bytes")
    print("STATUS        : READY")


def main():

    print()
    print("========================================")
    print("DATASHIELD TEST DISK BUILDER")
    print("========================================")

    build_recovery_disk()
    build_erasure_disk()

    print()
    print("========================================")
    print("ALL TEST DISKS CREATED")
    print("========================================")


if __name__ == "__main__":
    main()