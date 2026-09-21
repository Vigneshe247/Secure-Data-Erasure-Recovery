import re
from pathlib import Path


# File signatures
SIGNATURES = {
    "JPG": [
        b"\xFF\xD8\xFF"
    ],
    "PNG": [
        b"\x89PNG\r\n\x1a\n"
    ],
    "PDF": [
        b"%PDF-"
    ],
    "GIF": [
        b"GIF89a",
        b"GIF87a"
    ],
    "MP3": [
        b"ID3"
    ],
    "MP4": [
        b"ftyp"
    ],
    "WAV": [
        b"RIFF"
    ]
}


def scan_raw_image(image_path):
    """
    Independently scan a disk image for known file signatures.

    This does NOT use the eraser or recovery results.
    It directly examines the raw image.
    """

    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(
            f"Disk image not found: {image_path}"
        )

    results = {
        file_type: []
        for file_type in SIGNATURES
    }

    import mmap

    if image_path.stat().st_size == 0:
        return results

    with open(image_path, "rb") as f, \
            mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as data:

      for file_type, signatures in SIGNATURES.items():

        for signature in signatures:

            start = 0

            while True:

                position = data.find(signature, start)

                if position == -1:
                    break

                results[file_type].append(position)

                start = position + 1

    return results


def verify_disk(image_path, expected_fill=0):
    """
    Independent forensic verification of a FULLY SANITIZED image.

    PASSED requires BOTH:
      1. no known file signatures anywhere, AND
      2. every byte of the image equals the expected fill (default 0x00).

    Previously only (1) was checked, so plaintext / documents with no
    magic bytes (txt, csv, source code, keys...) still gave "PASSED".
    For a *targeted* erase (only some files) use
    sanitizer.find_residual() with the protected files instead.
    """

    try:
        from .sanitizer import verify_uniform
    except ImportError:
        from sanitizer import verify_uniform

    scan_results = scan_raw_image(image_path)

    counts = {
        file_type: len(positions)
        for file_type, positions in scan_results.items()
    }

    recoverable_files = sum(counts.values())

    uniform = verify_uniform(image_path, expected_fill)

    verification_passed = (
        recoverable_files == 0 and uniform["uniform"]
    )

    result = dict(counts)

    result["recoverable_files"] = recoverable_files
    result["nonuniform_bytes"] = uniform["nonuniform_bytes"]
    result["nonuniform_regions"] = uniform["regions"]
    result["verification"] = (
        "PASSED"
        if verification_passed
        else "FAILED"
    )
    result["details"] = scan_results

    return result


def print_verification(result, title="DATASHIELD FORENSIC SCAN"):

    print()
    print("=" * 40)
    print(title)
    print("=" * 40)

    for file_type in SIGNATURES:

        print(
            f"{file_type} files found"
            f"{' ' * max(0, 7 - len(file_type))}: "
            f"{result[file_type]}"
        )

    print(
        f"Recoverable files     : "
        f"{result['recoverable_files']}"
    )

    print(
        f"Non-zero bytes        : "
        f"{result.get('nonuniform_bytes', 0):,}"
    )

    for start, end in result.get("nonuniform_regions", [])[:5]:
        print(f"  non-zero region     : {start:,} - {end:,}")

    if result["verification"] == "PASSED":
        print()
        print("VERIFICATION          : PASSED")
    else:
        print()
        print("VERIFICATION          : FAILED")


if __name__ == "__main__":

    image = Path("test_data/demo_disk.img")

    result = verify_disk(image)

    print_verification(result)