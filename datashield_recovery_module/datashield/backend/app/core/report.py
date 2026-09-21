from datetime import datetime
from pathlib import Path


def generate_report(
    target,
    before,
    after,
    audit_id,
    output_file="sanitization_report.txt"
):

    timestamp = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    verification = after.get(
        "verification",
        "PASSED" if after["recoverable_files"] == 0 else "FAILED"
    )

    skip_keys = {"recoverable_files", "verification", "details"}

    file_types = [
        key for key in before.keys()
        if key not in skip_keys
    ]

    before_lines = "\n".join(
        f"Recoverable {file_type}: {before[file_type]}"
        for file_type in file_types
    )

    after_lines = "\n".join(
        f"Recoverable {file_type}: {after[file_type]}"
        for file_type in file_types
    )

    report = f"""
========================================
             DATASHIELD
       SECURE DATA ERASURE REPORT
========================================

Audit ID:
{audit_id}

Timestamp:
{timestamp}

Target:
{target}

Operation:
Controlled Image Sanitization

----------------------------------------
PRE-ERASURE FORENSIC SCAN
----------------------------------------

{before_lines}

Total Recoverable:
{before["recoverable_files"]}

----------------------------------------
POST-ERASURE FORENSIC SCAN
----------------------------------------

{after_lines}

Total Recoverable:
{after["recoverable_files"]}

----------------------------------------
VERIFICATION
----------------------------------------

{verification}

========================================
        DATASHIELD VERIFICATION
========================================
"""

    output_path = Path(output_file)

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as f:

        f.write(report.strip())

    return report


if __name__ == "__main__":

    before = {
        "JPG": 1,
        "PNG": 1,
        "PDF": 1,
        "recoverable_files": 3
    }

    after = {
        "JPG": 0,
        "PNG": 0,
        "PDF": 0,
        "recoverable_files": 0
    }

    report = generate_report(
        target="test_data/demo_disk.img",
        before=before,
        after=after,
        audit_id="DS-DEMO1234"
    )

    print(report)
