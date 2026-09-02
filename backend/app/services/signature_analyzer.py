from typing import Dict, Any, List, Optional


class FileSignature:
    def __init__(
        self,
        extension: str,
        name: str,
        headers: List[bytes],
        footers: List[bytes],
        mime_type: str,
        max_search_bytes: int = 50 * 1024 * 1024
    ):
        self.extension = extension.upper()
        self.name = name
        self.headers = headers
        self.footers = footers
        self.mime_type = mime_type
        self.max_search_bytes = max_search_bytes


# Supported deterministic file format signature registry
SIGNATURE_REGISTRY: Dict[str, FileSignature] = {
    "JPG": FileSignature(
        extension="JPG",
        name="JPEG Digital Image",
        headers=[
            b"\xFF\xD8\xFF\xE0",
            b"\xFF\xD8\xFF\xE1",
            b"\xFF\xD8\xFF\xEE",
            b"\xFF\xD8\xFF\xDB",
        ],
        footers=[b"\xFF\xD9"],
        mime_type="image/jpeg",
        max_search_bytes=20 * 1024 * 1024
    ),
    "PNG": FileSignature(
        extension="PNG",
        name="Portable Network Graphics",
        headers=[b"\x89PNG\r\n\x1a\n"],  # \x89\x50\x4E\x47\x0D\x0A\x1A\x0A
        footers=[b"IEND\xaeB`\x82"],      # \x49\x45\x4E\x44\xAE\x42\x60\x82
        mime_type="image/png",
        max_search_bytes=25 * 1024 * 1024
    ),
    "PDF": FileSignature(
        extension="PDF",
        name="Adobe Portable Document Format",
        headers=[b"%PDF-"],
        footers=[b"%%EOF", b"%%EOF\r", b"%%EOF\n", b"%%EOF\r\n"],
        mime_type="application/pdf",
        max_search_bytes=40 * 1024 * 1024
    ),
    "ZIP": FileSignature(
        extension="ZIP",
        name="ZIP Compressed Archive",
        headers=[b"PK\x03\x04"],  # \x50\x4B\x03\x04
        footers=[b"PK\x05\x06"],  # End of Central Directory record \x50\x4B\x05\x06
        mime_type="application/zip",
        max_search_bytes=50 * 1024 * 1024
    ),
    "DOCX": FileSignature(
        extension="DOCX",
        name="Microsoft Word Document (OpenXML)",
        headers=[b"PK\x03\x04\x14\x00\x06\x00", b"PK\x03\x04"],
        footers=[b"PK\x05\x06"],
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        max_search_bytes=30 * 1024 * 1024
    ),
    "MP4": FileSignature(
        extension="MP4",
        name="MPEG-4 Video",
        headers=[b"ftypmp42", b"ftypisom", b"ftypMSNV", b"ftypqt  "],
        footers=[],
        mime_type="video/mp4",
        max_search_bytes=100 * 1024 * 1024
    ),
}


def identify_signature_at_offset(data: bytes, offset: int) -> Optional[tuple[str, int]]:
    """
    Checks if a known file header starts at the given byte offset.
    Returns (extension, header_length) if matched.
    """
    chunk = data[offset: offset + 32]
    if len(chunk) < 4:
        return None

    for ext, sig in SIGNATURE_REGISTRY.items():
        if ext == "MP4":
            # For MP4, 'ftyp' typically appears at offset + 4
            if len(chunk) >= 12 and chunk[4:8] == b"ftyp":
                return ("MP4", 8)
        else:
            for header in sig.headers:
                if chunk.startswith(header):
                    return (ext, len(header))
    return None
