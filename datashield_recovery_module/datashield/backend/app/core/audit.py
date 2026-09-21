import json
import uuid
from datetime import datetime
from pathlib import Path


def create_audit_record(
    target,
    method,
    files_before,
    files_after,
    verification
):
    """
    Create an audit record for a sanitization operation.
    """

    audit_id = "DS-" + uuid.uuid4().hex[:8].upper()

    timestamp = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    record = {
        "audit_id": audit_id,
        "timestamp": timestamp,
        "operation": "SANITIZATION",
        "target": str(target),
        "method": method,
        "files_before": files_before,
        "files_after": files_after,
        "verification": verification
    }

    return record


def save_audit(record, output_file="audit_log.json"):
    """
    Save audit information to JSON.
    """

    output_path = Path(output_file)

    existing_records = []

    if output_path.exists():

        try:

            with open(
                output_path,
                "r",
                encoding="utf-8"
            ) as f:

                existing_records = json.load(f)

                if not isinstance(existing_records, list):
                    existing_records = []

        except json.JSONDecodeError:

            existing_records = []

    existing_records.append(record)

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            existing_records,
            f,
            indent=4
        )

    return record


if __name__ == "__main__":

    record = create_audit_record(
        target="test_data/demo_disk.img",
        method="CONTROLLED_IMAGE_OVERWRITE",
        files_before=3,
        files_after=0,
        verification="PASSED"
    )

    save_audit(record)

    print()
    print("Audit record created:")
    print(json.dumps(record, indent=4))