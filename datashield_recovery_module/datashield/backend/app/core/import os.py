import os

IMAGE = "test_data/demo_disk.img"

def show_bytes(label, offset=1024 * 1024, amount=64):

    print()
    print("=" * 60)
    print(label)
    print("=" * 60)

    with open(IMAGE, "rb") as f:

        f.seek(offset)
        data = f.read(amount)

    print(f"Offset : {offset}")
    print(f"Bytes  : {amount}")
    print()

    print(" ".join(f"{byte:02X}" for byte in data))


if __name__ == "__main__":

    if not os.path.exists(IMAGE):
        print("[ERROR] Disk image not found.")
        exit(1)

    show_bytes(
        "RAW STORAGE BYTES"
    )