import os

IMAGE = "test_data/demo_disk.img"

FILE_LOCATIONS = {
    "photo.jpg": 5 * 1024 * 1024,
    "evidence.png": 30 * 1024 * 1024,
    "document.pdf": 50 * 1024 * 1024
}


def show_bytes(filename, offset, amount=32):

    print()
    print("-" * 60)
    print(f"{filename}")
    print(f"Offset : {offset}")
    print("-" * 60)

    with open(IMAGE, "rb") as f:
        f.seek(offset)
        data = f.read(amount)

    print(" ".join(f"{byte:02X}" for byte in data))


if not os.path.exists(IMAGE):
    print("[ERROR] Disk image not found.")
    exit(1)


print()
print("=" * 60)
print("DATASHIELD - RAW STORAGE BYTE PROOF")
print("=" * 60)

print()
print("Reading actual bytes from the test disk image...")

for filename, offset in FILE_LOCATIONS.items():
    show_bytes(filename, offset)

print()
print("=" * 60)