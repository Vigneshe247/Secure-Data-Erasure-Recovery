"""
DataShield tamper-evident evidence ledger.

Every event is written as one JSON line. Each record stores the SHA-256 of
the previous record, so editing, deleting or re-ordering any record breaks
every hash that follows it:

    H1 = SHA256(record1 + GENESIS)
    H2 = SHA256(record2 + H1)
    H3 = SHA256(record3 + H2) ...

Limits (be honest about them): a hash chain proves the log was not edited
*after the fact* only if the newest hash (the "head") is kept somewhere the
attacker cannot rewrite (printed on the certificate, e-mailed, notarised).
Someone who can rewrite the whole file AND recompute every hash can still
forge it - so store the head separately.
"""

import hashlib
import json
import os
import time
from pathlib import Path

GENESIS = "0" * 64
DEFAULT_LEDGER = "evidence_ledger.jsonl"


def _canonical(record):
    return json.dumps(record, sort_keys=True, separators=(",", ":")).encode()


def _hash(record_without_hash, prev_hash):
    return hashlib.sha256(_canonical(record_without_hash) + prev_hash.encode()).hexdigest()


class EvidenceLedger:

    def __init__(self, path=DEFAULT_LEDGER):
        self.path = Path(path)

    def _last(self):
        if not self.path.exists():
            return 0, GENESIS
        seq, prev = 0, GENESIS
        with open(self.path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                seq, prev = rec["seq"], rec["hash"]
        return seq, prev

    def append(self, event, data=None):
        seq, prev = self._last()
        record = {
            "seq": seq + 1,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "event": event,
            "data": data or {},
            "prev_hash": prev,
        }
        record["hash"] = _hash(record, prev)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, sort_keys=True) + "\n")
            f.flush()
            os.fsync(f.fileno())
        return record

    def head(self):
        return self._last()[1]

    def verify(self):
        """Return dict: valid, records, first_bad_seq, reason, head."""
        if not self.path.exists():
            return {"valid": True, "records": 0, "first_bad_seq": None,
                    "reason": "ledger empty", "head": GENESIS}
        prev, count = GENESIS, 0
        with open(self.path, "r", encoding="utf-8") as f:
            for n, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    return {"valid": False, "records": count, "first_bad_seq": n,
                            "reason": "unreadable record", "head": prev}
                count += 1
                body = {k: v for k, v in rec.items() if k != "hash"}
                if rec.get("seq") != count:
                    return {"valid": False, "records": count, "first_bad_seq": count,
                            "reason": "sequence gap / removed or re-ordered record", "head": prev}
                if rec.get("prev_hash") != prev:
                    return {"valid": False, "records": count, "first_bad_seq": count,
                            "reason": "previous-hash link broken", "head": prev}
                if _hash(body, prev) != rec.get("hash"):
                    return {"valid": False, "records": count, "first_bad_seq": count,
                            "reason": "record content was modified", "head": prev}
                prev = rec["hash"]
        return {"valid": True, "records": count, "first_bad_seq": None,
                "reason": "chain intact", "head": prev}


if __name__ == "__main__":
    print(json.dumps(EvidenceLedger().verify(), indent=2))
