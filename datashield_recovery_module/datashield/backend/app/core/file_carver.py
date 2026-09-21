import os
import sys


# ==================================================================
# FORMAT HELPERS
# ==================================================================
# Formats without a footer (MP4, MP3, WAV) describe their own length
# inside the file. Each helper below works out the exact end of the
# file, so we never copy extra bytes from the disk.
#
# Every end-finder returns:  (end_offset or None, note, warning)
#   end_offset = exact end, or None to use the "max_size" fallback
#   note       = short text shown in the report
#   warning    = text shown as [!] if something looks wrong, else None


# ------------------------------------------------------------------
# MP4
# ------------------------------------------------------------------
# An MP4 is a chain of "boxes". Every box starts with:
#     4 bytes  = box size (big-endian, includes these 8 header bytes)
#     4 bytes  = box type (ASCII, e.g. "ftyp", "moov", "mdat")
#
# The first box is "ftyp", so the text "ftyp" appears at offset 4 of
# the file - AFTER the 4-byte size field. The carver must therefore
# start 4 bytes BEFORE the "ftyp" text or the size field is lost and
# players cannot open the file.

MP4_TOP_LEVEL_BOXES = {
    b"ftyp", b"moov", b"mdat", b"free", b"skip", b"wide", b"uuid",
    b"moof", b"mfra", b"sidx", b"ssix", b"styp", b"meta", b"pdin",
    b"prft", b"emsg", b"pnot",
}


def is_valid_mp4_start(data, start):
    """Check that a real ftyp box header begins at `start`."""

    if start < 0 or start + 12 > len(data):
        return False

    size = int.from_bytes(data[start:start + 4], "big")

    # A genuine ftyp box is small (brand + compatible brands).
    return data[start + 4:start + 8] == b"ftyp" and 8 <= size <= 256


def find_mp4_end(data, start):
    """Walk the MP4 box chain and return the exact end of the file."""

    pos = start
    total = len(data)
    boxes = []

    while pos + 8 <= total:

        size = int.from_bytes(data[pos:pos + 4], "big")
        box_type = data[pos + 4:pos + 8]

        # Next bytes are not an MP4 box -> the file ended before here
        if box_type not in MP4_TOP_LEVEL_BOXES:
            break

        header_size = 8

        if size == 1:
            # 64-bit size stored right after the type (large videos)
            if pos + 16 > total:
                break
            size = int.from_bytes(data[pos + 8:pos + 16], "big")
            header_size = 16

        elif size == 0:
            # "Box runs to end of file" - meaningless on a raw disk
            # image, so stop here instead of swallowing the whole disk.
            break

        # Box is impossible or runs past the end of the disk image
        if size < header_size or pos + size > total:
            break

        boxes.append(box_type.decode("ascii"))
        pos += size

    warning = None

    if "moov" not in boxes or "mdat" not in boxes:
        warning = (
            f"boxes found: {boxes} - missing 'moov' and/or 'mdat', so "
            f"there is no playable audio/video (placeholder, fragment "
            f"or overwritten data)."
        )

    return pos, " > ".join(boxes), warning


# ------------------------------------------------------------------
# WAV
# ------------------------------------------------------------------
# Layout:  "RIFF" + 4-byte little-endian size + "WAVE" + ...
# Total file length = 8 + size.  ("RIFF" is also used by AVI and WebP,
# so we insist on "WAVE" to avoid carving the wrong thing.)

def is_valid_wav_start(data, start):

    return data[start + 8:start + 12] == b"WAVE"


def find_wav_end(data, start):

    size = int.from_bytes(data[start + 4:start + 8], "little")

    if size < 4:
        return None, None, (
            "WAV header has no valid length - using fallback size."
        )

    end = start + 8 + size

    if end > len(data):
        return len(data), f"declared {size + 8:,} bytes", (
            "WAV is cut off by the end of the disk image."
        )

    return end, f"declared {size + 8:,} bytes", None


# ------------------------------------------------------------------
# MP3
# ------------------------------------------------------------------
# Layout:  ID3v2 tag (10-byte header + tag body) followed by a chain
# of audio frames. Each frame header gives its own length, so we add
# them up until the chain stops. An optional 128-byte "TAG" (ID3v1)
# block may sit at the very end.

MP3_BITRATES = {
    # MPEG-1 Layer III
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    # MPEG-2 / 2.5 Layer III
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}

MP3_SAMPLE_RATES = {
    3: [44100, 48000, 32000],   # MPEG-1
    2: [22050, 24000, 16000],   # MPEG-2
    0: [11025, 12000, 8000],    # MPEG-2.5
}


def mp3_frame_length(data, pos):
    """Length of the Layer III frame at `pos`, or 0 if not a frame."""

    if pos + 4 > len(data):
        return 0

    b1, b2, b3 = data[pos], data[pos + 1], data[pos + 2]

    if b1 != 0xFF or (b2 & 0xE0) != 0xE0:
        return 0

    version = (b2 >> 3) & 0x03          # 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    layer = (b2 >> 1) & 0x03            # 1 = Layer III

    if version == 1 or layer != 1:
        return 0

    bitrate_index = (b3 >> 4) & 0x0F
    rate_index = (b3 >> 2) & 0x03
    padding = (b3 >> 1) & 0x01

    if bitrate_index in (0, 15) or rate_index == 3:
        return 0

    bitrate = MP3_BITRATES[3 if version == 3 else 2][bitrate_index] * 1000
    sample_rate = MP3_SAMPLE_RATES[version][rate_index]

    if version == 3:
        return 144 * bitrate // sample_rate + padding

    return 72 * bitrate // sample_rate + padding


def is_valid_mp3_start(data, start):
    """
    Check that a genuine ID3v2 header begins at `start`. Random data
    that merely contains the letters "ID3" fails this test.
    """

    header = data[start:start + 10]

    if len(header) < 10:
        return False

    # ID3v2 versions 2.2 / 2.3 / 2.4; revision byte is never 0xFF
    if header[3] not in (2, 3, 4) or header[4] == 0xFF:
        return False

    # The 4 size bytes are "syncsafe": the top bit is always 0
    return all(b < 0x80 for b in header[6:10])


def find_mp3_end(data, start):

    total = len(data)

    # ---- ID3v2 header: "ID3", version(2), flags(1), size(4) ----
    size_bytes = data[start + 6:start + 10]

    if len(size_bytes) < 4 or any(b & 0x80 for b in size_bytes):
        return None, None, (
            "MP3 tag length is invalid - using fallback size."
        )

    tag_size = (
        (size_bytes[0] << 21) | (size_bytes[1] << 14) |
        (size_bytes[2] << 7) | size_bytes[3]
    )

    flags = data[start + 5]
    pos = start + 10 + tag_size

    if flags & 0x10:            # footer present
        pos += 10

    # ---- audio frames ----
    frames = 0

    while pos < total:

        length = mp3_frame_length(data, pos)

        if length == 0 or pos + length > total:
            break

        pos += length
        frames += 1

    if frames == 0:
        return None, None, (
            "no MP3 audio frames found after the tag - using "
            "fallback size."
        )

    # ---- optional ID3v1 trailer ----
    if data[pos:pos + 3] == b"TAG" and pos + 128 <= total:
        pos += 128

    return pos, f"{frames:,} audio frames", None


# ==================================================================
# FILE SIGNATURES
# ==================================================================
# "end" is None for formats with no footer marker. For those we use
# an "end_finder" (exact length from the file itself). If the finder
# cannot decide, "max_size" is used as a last-resort carve length - a
# standard technique in carving tools (foremost/scalpel).
#
# Optional keys:
#   "start_adjust" - bytes to move the start relative to the signature
#   "validate"     - function(data, start) -> bool, rejects false hits
#   "end_finder"   - function(data, start) -> (end, note, warning)

SIGNATURES = {
    "jpg": {
        "start": b"\xFF\xD8\xFF",
        "end": b"\xFF\xD9",
        "extension": ".jpg",
        "max_size": None
    },

    "png": {
        "start": b"\x89PNG\r\n\x1a\n",
        "end": b"\x49\x45\x4E\x44\xAE\x42\x60\x82",
        "extension": ".png",
        "max_size": None
    },

    "pdf": {
        "start": b"%PDF-",
        "end": b"%%EOF",
        "extension": ".pdf",
        "max_size": None
    },

    "gif": {
        "start": b"GIF89a",
        "end": b"\x3B",
        "extension": ".gif",
        "max_size": None
    },

    "wav": {
        "start": b"RIFF",
        "validate": is_valid_wav_start,
        "end": None,
        "end_finder": find_wav_end,
        "extension": ".wav",
        "max_size": 20 * 1024 * 1024
    },

    "mp3": {
        "start": b"ID3",
        "validate": is_valid_mp3_start,
        "end": None,
        "end_finder": find_mp3_end,
        "extension": ".mp3",
        "max_size": 20 * 1024 * 1024
    },

    "mp4": {
        "start": b"ftyp",
        "start_adjust": -4,          # include the 4-byte box size
        "validate": is_valid_mp4_start,
        "end": None,
        "end_finder": find_mp4_end,
        "extension": ".mp4",
        "max_size": 50 * 1024 * 1024
    }
}


def carve_file(disk_image, output_directory):
    """
    Carve JPG, PNG, PDF, GIF, WAV, MP3 and MP4 files directly from
    a raw disk image.

    Returns information about recovered files.
    """

    os.makedirs(output_directory, exist_ok=True)

    recovered = []

    with open(disk_image, "rb") as disk:

        data = disk.read()

    print(f"[+] Disk image: {disk_image}")
    print(f"[+] Image size: {len(data):,} bytes")
    print("[+] Scanning for file signatures...\n")

    for file_type, signature in SIGNATURES.items():

        start_signature = signature["start"]
        end_signature = signature["end"]
        extension = signature["extension"]
        max_size = signature.get("max_size")
        start_adjust = signature.get("start_adjust", 0)
        validate = signature.get("validate")
        end_finder = signature.get("end_finder")

        search_position = 0
        file_number = 1

        while True:

            # Search for the signature text
            hit_offset = data.find(start_signature, search_position)

            if hit_offset == -1:
                break

            # Some formats (MP4) begin BEFORE their signature text
            start_offset = hit_offset + start_adjust

            if start_offset < 0 or (
                validate is not None and not validate(data, start_offset)
            ):
                # Not a real file start - keep looking
                search_position = hit_offset + len(start_signature)
                continue

            end_offset = None
            note = None

            # --------------------------------------------------
            # EXACT LENGTH FROM THE FILE ITSELF (MP4 / WAV / MP3)
            # --------------------------------------------------

            if end_finder is not None:

                end_offset, note, warning = end_finder(data, start_offset)

                if warning:
                    print(
                        f"[!] {file_type.upper()} at offset "
                        f"{start_offset}: {warning}"
                    )

            if end_offset is None:

                if end_signature is None:

                    # --------------------------------------------------
                    # LAST RESORT: fixed maximum carve length
                    # --------------------------------------------------

                    end_offset = min(
                        start_offset + max_size,
                        len(data)
                    )

                    print(
                        f"[i] {file_type.upper()} length unknown - "
                        f"carving up to {max_size:,} bytes."
                    )

                else:

                    # Search for the end of the file
                    end_offset = data.find(
                        end_signature,
                        start_offset + len(start_signature)
                    )

                    if end_offset == -1:
                        print(
                            f"[!] Found {file_type.upper()} signature "
                            f"at offset {start_offset}, but no ending "
                            f"signature."
                        )

                        search_position = (
                            start_offset + len(start_signature)
                        )
                        continue

                    # Include the ending signature in recovered data
                    end_offset += len(end_signature)

            recovered_data = data[start_offset:end_offset]

            output_filename = (
                f"recovered_{file_type}_{file_number}{extension}"
            )

            output_path = os.path.join(
                output_directory,
                output_filename
            )

            with open(output_path, "wb") as output_file:
                output_file.write(recovered_data)

            print(
                f"[+] Recovered {file_type.upper()}: "
                f"{output_filename}"
            )

            print(
                f"    Start offset : {start_offset}"
            )

            print(
                f"    End offset   : {end_offset}"
            )

            print(
                f"    Size         : {len(recovered_data):,} bytes"
            )

            if note:
                print(
                    f"    Structure    : {note}"
                )

            print(
                f"    Saved to     : {output_path}\n"
            )

            recovered.append({
                "type": file_type,
                "filename": output_filename,
                "start_offset": start_offset,
                "end_offset": end_offset,
                "size": len(recovered_data),
                "path": output_path
            })

            file_number += 1

            # Continue searching after this recovered file
            search_position = end_offset

    print("=" * 60)
    print(f"[+] Recovery complete")
    print(f"[+] Total files recovered: {len(recovered)}")
    print("=" * 60)

    return recovered


if __name__ == "__main__":

    # Usage:  python file_carver.py [disk_image] [output_directory]
    # Defaults keep the original behaviour.
    disk_image = (
        sys.argv[1] if len(sys.argv) > 1
        else os.path.join("test_data", "demo_disk.img")
    )

    output_directory = (
        sys.argv[2] if len(sys.argv) > 2
        else os.path.join("test_data", "recovered")
    )

    if not os.path.exists(disk_image):

        print("[ERROR] Disk image not found:")
        print(disk_image)

        raise SystemExit(1)

    carve_file(
        disk_image,
        output_directory
    )
