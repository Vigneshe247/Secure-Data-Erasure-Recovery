import os
from pathlib import Path


def sanitize_image(image_path, mode="zero"):
    """
    Full-image sanitization of a DEMO disk image (not a physical drive).

    mode = "zero"         one pass of 0x00
           "random+zero"  one pass of random data, then a pass of 0x00

    Unlike the original, this:
      * fsyncs, so the data is pushed out of the OS cache to the medium;
      * re-reads the whole image afterwards (cache dropped) and only reports
        COMPLETED if every byte really is zero;
      * returns the measured result instead of a hard-coded "COMPLETED".
    """

    try:
        from .sanitizer import verify_uniform, _drop_os_cache, _INDEX_CACHE, CHUNK
    except ImportError:
        from sanitizer import verify_uniform, _drop_os_cache, _INDEX_CACHE, CHUNK

    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(
            f"Disk image not found: {image_path}"
        )

    file_size = image_path.stat().st_size

    print()
    print("=" * 40)
    print("DATASHIELD SANITIZATION")
    print("=" * 40)

    print(f"Target                : {image_path}")
    print(f"Operation             : FULL IMAGE OVERWRITE ({mode.upper()})")

    passes = ["random", "zero"] if mode == "random+zero" else ["zero"]

    with open(image_path, "r+b") as f:

        for fill in passes:

            f.seek(0)
            remaining = file_size

            while remaining > 0:

                current_size = min(CHUNK, remaining)

                f.write(
                    os.urandom(current_size)
                    if fill == "random"
                    else b"\x00" * current_size
                )

                remaining -= current_size

            f.flush()
            os.fsync(f.fileno())

    _drop_os_cache(str(image_path))
    _INDEX_CACHE.clear()

    check = verify_uniform(str(image_path))

    status = "COMPLETED" if check["uniform"] else "FAILED"

    print(f"Read-back check       : "
          f"{'ALL BYTES ZERO' if check['uniform'] else str(check['nonuniform_bytes']) + ' NON-ZERO BYTES'}")
    print(f"Status                : {status}")

    return {
        "target": str(image_path),
        "operation": "FULL_IMAGE_OVERWRITE_" + mode.upper().replace("+", "_"),
        "status": status,
        "nonuniform_bytes": check["nonuniform_bytes"]
    }


if __name__ == "__main__":

    sanitize_image(
        "test_data/demo_disk.img"
    )
