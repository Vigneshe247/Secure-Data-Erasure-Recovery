from pathlib import Path

IMAGE = Path("test_data/demo_disk.img")
SOURCE = Path("test_data/original")

BLOCK_SIZE = 4096

files = list(SOURCE.glob("*.txt"))

with open(IMAGE, "r+b") as disk:

    offset = 0

    for file in files:
        data = file.read_bytes()

        disk.seek(offset)
        disk.write(data)

        print(f"Stored: {file.name}")
        print(f"Offset: {offset}")
        print(f"Size: {len(data)} bytes")

        offset += ((len(data) + BLOCK_SIZE - 1) // BLOCK_SIZE) * BLOCK_SIZE

print("\nTest data successfully written to demo_disk.img")