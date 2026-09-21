from backend.app.core.verifier import (
    verify_disk,
    print_verification
)

from backend.app.core.eraser import (
    sanitize_image
)

from backend.app.core.audit import (
    create_audit_record,
    save_audit
)

from backend.app.core.report import (
    generate_report
)


IMAGE = "test_data/demo_disk.img"


def main():

    # ==========================================
    # 1. BEFORE SANITIZATION
    # ==========================================

    print()
    print("#" * 50)
    print("        DATASHIELD SECURE ERASE DEMO")
    print("#" * 50)

    before = verify_disk(IMAGE)

    print_verification(
        before,
        "DATASHIELD FORENSIC SCAN - BEFORE"
    )

    # ==========================================
    # 2. SANITIZATION
    # ==========================================

    sanitize_image(IMAGE)

    # ==========================================
    # 3. INDEPENDENT POST-SCAN
    # ==========================================

    after = verify_disk(IMAGE)

    print_verification(
        after,
        "DATASHIELD POST-SANITIZATION SCAN"
    )

    # ==========================================
    # 4. DETERMINE RESULT
    # ==========================================

    verification = after["verification"]   # strict: no signatures AND every byte zero

    # ==========================================
    # 5. AUDIT
    # ==========================================

    audit = create_audit_record(
        target=IMAGE,
        method="CONTROLLED_IMAGE_OVERWRITE",
        files_before=before["recoverable_files"],
        files_after=after["recoverable_files"],
        verification=verification
    )

    save_audit(audit)

    # ==========================================
    # 6. REPORT
    # ==========================================

    generate_report(
        target=IMAGE,
        before=before,
        after=after,
        audit_id=audit["audit_id"]
    )

    # ==========================================
    # 7. FINAL RESULT
    # ==========================================

    print()
    print("=" * 50)

    if verification == "PASSED":

        print("        VERIFICATION : PASSED")
        print("        DATA SANITIZED SUCCESSFULLY")

    else:

        print("        VERIFICATION : FAILED")
        print("        RECOVERABLE DATA DETECTED")

    print("=" * 50)

    print()
    print("Audit ID :", audit["audit_id"])
    print("Report   : sanitization_report.txt")
    print("Audit    : audit_log.json")


if __name__ == "__main__":
    main()