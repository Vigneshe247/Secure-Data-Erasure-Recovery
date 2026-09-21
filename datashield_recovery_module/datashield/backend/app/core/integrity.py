import hashlib
import os


def calculate_sha256(file_path):
    """
    Calculate SHA-256 hash of a file.
    """

    sha256 = hashlib.sha256()

    with open(file_path, "rb") as f:
        while True:
            data = f.read(8192)

            if not data:
                break

            sha256.update(data)

    return sha256.hexdigest().upper()


def verify_file_integrity(original_file, recovered_file):
    """
    Compare SHA-256 hashes of original and recovered files.
    """

    print()
    print("========================================")
    print("SHA-256 INTEGRITY VERIFICATION")
    print("========================================")

    if not os.path.exists(original_file):
        print(f"[ERROR] Original file not found: {original_file}")
        return False

    if not os.path.exists(recovered_file):
        print(f"[ERROR] Recovered file not found: {recovered_file}")
        return False

    original_hash = calculate_sha256(original_file)
    recovered_hash = calculate_sha256(recovered_file)

    print(f"Original File : {original_file}")
    print(f"Recovered File: {recovered_file}")
    print()
    print(f"Original SHA-256 : {original_hash}")
    print(f"Recovered SHA-256: {recovered_hash}")
    print()

    if original_hash == recovered_hash:
        print("INTEGRITY RESULT : MATCH")
        return True

    print("INTEGRITY RESULT : MISMATCH")
    return False


if __name__ == "__main__":
    print("Integrity module loaded successfully.")