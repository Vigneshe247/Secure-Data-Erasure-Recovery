"""
DataShield regression tests.  Run:   python -m unittest test_sanitizer -v

Each test reproduces a real-world failure of the ORIGINAL erasure code and
proves the fixed engine handles it.
"""

import json
import os
import shutil
import tempfile
import unittest

from backend.app.core import sanitizer as S
from backend.app.core.evidence_chain import EvidenceLedger
from backend.app.core.verifier import verify_disk

MB = 1024 * 1024


def make_image(path, size=4 * MB):
    with open(path, "wb") as f:
        f.truncate(size)


def put(path, offset, data):
    with open(path, "r+b") as f:
        f.seek(offset)
        f.write(data)


def write(path, data):
    with open(path, "wb") as f:
        f.write(data)


class SanitizerTests(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.img = os.path.join(self.tmp, "disk.img")
        self.ledger = os.path.join(self.tmp, "ledger.jsonl")
        make_image(self.img)
        self.quiet = lambda *a, **k: None

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_erase(self, targets, others=(), **kw):
        return S.sanitize_targets(self.img, targets, others,
                                  ledger_path=self.ledger, log=self.quiet, **kw)

    def raw(self):
        with open(self.img, "rb") as f:
            return f.read()

    # ---------------------------------------------------------------
    def test_basic_erase_and_certificate(self):
        secret = os.path.join(self.tmp, "secret.txt")
        data = b"Password: hunter2 / SSN 123-45-6789\n" * 3
        write(secret, data)
        put(self.img, MB, data)

        r = self.run_erase([secret])

        self.assertEqual(r["status"], "PASSED")
        self.assertEqual(self.raw().count(data), 0)
        cert = S.write_certificate(r, os.path.join(self.tmp, "cert.txt"))
        self.assertTrue(os.path.exists(cert))

    # ---------------------------------------------------------------
    def test_grown_file_stale_size(self):
        """ORIGINAL BUG: only zeroed len(source) bytes; the rest stayed."""
        secret = os.path.join(self.tmp, "secret.txt")
        head = b"SSN: 123-45-6789 | Password: hunter2\n"
        write(secret, head)                               # the tool only knows this
        put(self.img, MB, head + b"Salary: 90000 | Password: hunter2\n" * 3000)

        r = self.run_erase([secret])

        self.assertEqual(r["status"], "PASSED")
        self.assertEqual(self.raw().count(b"Password: hunter2"), 0)
        self.assertGreater(r["rounds"][0]["extents"][0]["extended_bytes"], 90000)

    # ---------------------------------------------------------------
    def test_copy_at_unmapped_unaligned_offset(self):
        """ORIGINAL BUG: hard-coded offset map; a copy anywhere else was missed."""
        f = os.path.join(self.tmp, "launch.txt")
        data = b"CONFIDENTIAL launch codes 0000-1111 and more text to be distinctive\n"
        write(f, data)
        put(self.img, 3 * MB + 777, data)                 # not sector aligned, not mapped

        r = self.run_erase([f])

        self.assertEqual(r["status"], "PASSED")
        self.assertFalse(b"launch codes" in self.raw())

    # ---------------------------------------------------------------
    def test_multiple_copies_all_found(self):
        f = os.path.join(self.tmp, "doc.txt")
        data = os.urandom(3000)
        write(f, data)
        for off in (MB, 2 * MB + 4096, 3 * MB + 100):
            put(self.img, off, data)

        r = self.run_erase([f])

        self.assertEqual(r["status"], "PASSED")
        self.assertEqual(self.raw().count(data), 0)

    # ---------------------------------------------------------------
    def test_header_only_wipe_is_still_detected(self):
        """ORIGINAL BUG: header zeroed => reported 'erased', body still carvable."""
        png = b"\x89PNG\r\n\x1a\n" + os.urandom(200_000)
        f = os.path.join(self.tmp, "a.png")
        write(f, png)
        put(self.img, MB, png)
        put(self.img, MB, b"\x00" * 16)                    # attacker/sloppy tool wipes header only

        before = S.find_residual(self.img, [S.Profile(f)])
        self.assertTrue(before["a.png"]["residual"])       # body is detected

        r = self.run_erase([f])
        self.assertEqual(r["status"], "PASSED")
        self.assertFalse(png[64:512] in self.raw())

    # ---------------------------------------------------------------
    def test_small_text_with_first_bytes_wiped(self):
        f = os.path.join(self.tmp, "note.txt")
        data = b"DATASHIELD TEST FILE\nAuthorized erasure demonstration\nFile: note.txt\nCONFIDENTIAL DEMO DATA\n"
        write(f, data)
        put(self.img, MB, data)
        put(self.img, MB, b"\x00" * 16)

        self.assertTrue(S.find_residual(self.img, [S.Profile(f)])["note.txt"]["residual"])
        self.assertEqual(self.run_erase([f])["status"], "PASSED")
        self.assertFalse(b"CONFIDENTIAL DEMO DATA" in self.raw())

    # ---------------------------------------------------------------
    def test_other_live_files_are_not_destroyed(self):
        a = os.path.join(self.tmp, "a.txt")
        b = os.path.join(self.tmp, "b.txt")
        da, db = os.urandom(2000), os.urandom(2000)
        write(a, da)
        write(b, db)
        put(self.img, MB, da)
        put(self.img, 2 * MB, db)

        r = self.run_erase([a], others=[b])

        self.assertEqual(r["status"], "PASSED")
        self.assertEqual(self.raw().count(db), 1)          # untouched
        self.assertEqual(self.raw().count(da), 0)

    # ---------------------------------------------------------------
    def test_escalation_when_first_round_fails(self):
        """Closed loop: a flaky first pass must be caught and escalated."""
        f = os.path.join(self.tmp, "x.bin")
        data = os.urandom(5000)
        write(f, data)
        put(self.img, MB, data)

        real = S._overwrite
        calls = {"n": 0}

        def flaky(image, extents, mode="zero"):
            calls["n"] += 1
            if calls["n"] == 1:
                return                                     # round 1 silently writes nothing
            return real(image, extents, mode)

        S._overwrite = flaky
        try:
            r = self.run_erase([f])
        finally:
            S._overwrite = real

        self.assertEqual(r["status"], "PASSED")
        self.assertEqual(len(r["rounds"]), 2)
        self.assertFalse(r["rounds"][0]["ok"])
        self.assertEqual(r["rounds"][1]["method"], "random+zero")

    def test_failure_is_reported_never_faked(self):
        f = os.path.join(self.tmp, "x.bin")
        data = os.urandom(5000)
        write(f, data)
        put(self.img, MB, data)

        real = S._overwrite
        S._overwrite = lambda *a, **k: None                # medium that never changes
        try:
            r = self.run_erase([f])
        finally:
            S._overwrite = real

        self.assertEqual(r["status"], "FAILED")
        with self.assertRaises(ValueError):
            S.write_certificate(r, os.path.join(self.tmp, "cert.txt"))

    def test_full_wipe_escalation(self):
        f = os.path.join(self.tmp, "x.bin")
        data = os.urandom(5000)
        write(f, data)
        put(self.img, MB, data)
        put(self.img, 3 * MB, b"unrelated plaintext " * 50)

        real = S._overwrite
        state = {"n": 0}

        def only_full_wipe_works(image, extents, mode="zero"):
            state["n"] += 1
            if extents and extents[0].get("files") == ["*"]:
                return real(image, extents, mode)

        S._overwrite = only_full_wipe_works
        try:
            r = self.run_erase([f], allow_full_wipe=True)
        finally:
            S._overwrite = real

        self.assertEqual(r["status"], "PASSED")
        self.assertTrue(S.verify_uniform(self.img)["uniform"])

    # ---------------------------------------------------------------
    def test_verifier_no_longer_passes_plaintext(self):
        """ORIGINAL BUG: verifier only looked for magic bytes -> PASSED with plaintext present."""
        put(self.img, 3 * MB + 777, b"CONFIDENTIAL: launch codes 0000-1111\n")
        result = verify_disk(self.img)
        self.assertEqual(result["verification"], "FAILED")
        self.assertGreater(result["nonuniform_bytes"], 0)

    def test_verifier_passes_clean_image(self):
        self.assertEqual(verify_disk(self.img)["verification"], "PASSED")

    def test_full_image_sanitize_image(self):
        from backend.app.core.eraser import sanitize_image
        put(self.img, MB, b"secret" * 1000)
        out = sanitize_image(self.img)
        self.assertEqual(out["status"], "COMPLETED")
        self.assertEqual(verify_disk(self.img)["verification"], "PASSED")

    # ---------------------------------------------------------------
    def test_ledger_detects_tampering(self):
        f = os.path.join(self.tmp, "x.txt")
        data = os.urandom(1500)
        write(f, data)
        put(self.img, MB, data)
        r = self.run_erase([f])
        self.assertTrue(r["ledger_check"]["valid"])

        # attacker edits one record (e.g. hides that data was recoverable)
        lines = open(self.ledger).read().splitlines()
        rec = json.loads(lines[1])
        rec["data"] = {"tampered": True}
        lines[1] = json.dumps(rec, sort_keys=True)
        open(self.ledger, "w").write("\n".join(lines) + "\n")

        check = EvidenceLedger(self.ledger).verify()
        self.assertFalse(check["valid"])
        self.assertEqual(check["first_bad_seq"], 2)

    def test_ledger_detects_deleted_record(self):
        led = EvidenceLedger(self.ledger)
        for i in range(5):
            led.append("E", {"i": i})
        lines = open(self.ledger).read().splitlines()
        del lines[2]
        open(self.ledger, "w").write("\n".join(lines) + "\n")
        self.assertFalse(EvidenceLedger(self.ledger).verify()["valid"])

    # ---------------------------------------------------------------
    def test_host_file_is_shredded(self):
        f = os.path.join(self.tmp, "host.txt")
        write(f, b"host copy" * 100)
        self.assertTrue(S.shred_host_file(f))
        self.assertFalse(os.path.exists(f))
        self.assertEqual([n for n in os.listdir(self.tmp) if n.endswith(".del")], [])

    def test_profile_image(self):
        self.assertEqual(S.profile_target(self.img)["kind"], "DISK_IMAGE")

    def test_refuses_real_block_device(self):
        # /dev/null-like character devices are not block devices; use a fake profile
        real = S.profile_target
        S.profile_target = lambda p: {"kind": "NVME_SSD", "executable_by_engine": False,
                                      "note": "use hardware sanitize", "path": p}
        try:
            r = S.sanitize_targets(self.img, [], (), ledger_path=self.ledger, log=self.quiet)
        finally:
            S.profile_target = real
        self.assertEqual(r["status"], "REFUSED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
