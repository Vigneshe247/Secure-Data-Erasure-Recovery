"""
DataShield - tests for the POST-ERASURE RECOVERY module.

Run:   python -m unittest test_erasure_recovery -v

Idea under test:  after an erasure, the recovery system is pointed at the image.
  * data still there  -> it is recovered (and SHA-256 checked)  -> erasure FAILED
  * data really gone  -> nothing comes back                     -> erasure VERIFIED
"""

import os
import shutil
import tempfile
import unittest
from unittest import mock

from backend.app.core import erasure_recovery as E
from backend.app.core import sanitizer as S
from backend.app.core.evidence_chain import EvidenceLedger

import datashield

MB = 1024 * 1024
TEXT = b"".join(
    b"CONFIDENTIAL record %02d | SSN 123-45-6789 | Password: hunter2-%d\n" % (i, i * 7)
    for i in range(4)
)


def write(path, data):
    with open(path, "wb") as f:
        f.write(data)


def put(path, offset, data):
    with open(path, "r+b") as f:
        f.seek(offset)
        f.write(data)


def make_image(path, size=4 * MB):
    with open(path, "wb") as f:
        f.truncate(size)


class RecoveryModuleTests(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.img = os.path.join(self.tmp, "disk.img")
        self.ledger = os.path.join(self.tmp, "ledger.jsonl")
        self.out = os.path.join(self.tmp, "recovered")
        self.ref = os.path.join(self.tmp, "secret.txt")
        make_image(self.img)
        write(self.ref, TEXT)
        self.quiet = lambda *a, **k: None

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def attempt(self, references=None, **kw):
        references = references if references is not None else {"secret.txt": self.ref}
        return E.attempt_recovery(self.img, references, self.out, ledger_path=self.ledger,
                                  attempts=E.erasure_attempts(self.ledger), log=self.quiet, **kw)

    # ------------------------------------------------------------------
    def test_intact_data_is_fully_recovered_and_hash_matches(self):
        put(self.img, 2 * MB + 777, TEXT)                  # unaligned, not in any offset map

        res = self.attempt()
        row = res["files"][0]

        self.assertEqual(res["verdict"], "ERASURE FAILED")
        self.assertEqual(row["status"], E.RECOVERED)
        self.assertEqual(row["integrity"], "MATCH")
        self.assertEqual(row["offset"], 2 * MB + 777)
        with open(row["output"], "rb") as f:
            self.assertEqual(f.read(), TEXT)

    # ------------------------------------------------------------------
    def test_proper_erasure_recovers_nothing(self):
        put(self.img, MB, TEXT)
        r = S.sanitize_targets(self.img, [self.ref], ledger_path=self.ledger, log=self.quiet)
        self.assertEqual(r["status"], "PASSED")

        res = self.attempt()

        self.assertEqual(res["verdict"], "ERASURE VERIFIED")
        self.assertEqual(res["files"][0]["status"], E.CLEAN)
        self.assertIsNone(res["files"][0]["output"])
        self.assertFalse(os.path.exists(self.out))          # nothing was written

    # ------------------------------------------------------------------
    def test_header_only_wipe_is_recovered_partially(self):
        put(self.img, MB, TEXT)
        w = E.simulate_improper_erasure(self.img, self.ref, "header", self.ledger)
        self.assertEqual(w["bytes_zeroed"], 16)

        res = self.attempt()
        row = res["files"][0]

        self.assertEqual(res["verdict"], "ERASURE FAILED")
        self.assertEqual(row["status"], E.PARTIAL)
        self.assertEqual(row["integrity"], "MISMATCH")
        self.assertEqual(row["recovered_bytes"], len(TEXT) - 16)
        with open(row["output"], "rb") as f:                # the medium's truth, not the reference
            got = f.read()
        self.assertEqual(got[:3], E.UTF8_BOM)               # Notepad reads it as UTF-8
        self.assertEqual(got[3:19], b"?" * 16)             # wiped bytes shown as "?" (readable text)
        self.assertEqual(got[19:], TEXT[16:])

    # ------------------------------------------------------------------
    def test_partial_wipe_is_recovered_partially(self):
        put(self.img, MB + 4096 + 100, TEXT)
        E.simulate_improper_erasure(self.img, self.ref, "partial", self.ledger)

        row = self.attempt()["files"][0]

        self.assertEqual(row["status"], E.PARTIAL)
        self.assertEqual(row["recovered_bytes"], len(TEXT) - len(TEXT) // 3)

    # ------------------------------------------------------------------
    def test_fragmented_copy_is_reassembled(self):
        data = os.urandom(6 * S.SECTOR)
        write(self.ref, data)
        places = [3 * MB, MB, 2 * MB + 5120, 512, 3 * MB + 40960, 2 * MB]   # scattered, out of order
        for i, off in enumerate(places):
            put(self.img, off, data[i * S.SECTOR:(i + 1) * S.SECTOR])

        row = self.attempt()["files"][0]

        self.assertEqual(row["status"], E.RECOVERED)
        self.assertEqual(row["method"], "REASSEMBLED FROM SECTORS")
        self.assertEqual(row["integrity"], "MATCH")

    # ------------------------------------------------------------------
    def test_live_file_content_is_not_reported(self):
        shared = os.urandom(S.SECTOR)
        a = os.path.join(self.tmp, "a.bin")
        b = os.path.join(self.tmp, "b.bin")
        write(a, shared + os.urandom(S.SECTOR))
        write(b, shared + os.urandom(S.SECTOR))
        put(self.img, MB, open(b, "rb").read())             # only the LIVE file b is on the disk

        with_live = self.attempt({"a.bin": a}, exclude_files={"a.bin": [b]})
        without = self.attempt({"a.bin": a}, record=False)

        self.assertEqual(with_live["files"][0]["status"], E.CLEAN)
        self.assertEqual(without["files"][0]["status"], E.PARTIAL)   # shows why the exclusion matters

    # ------------------------------------------------------------------
    def test_ledger_mode_verifies_after_erase_and_shred(self):
        put(self.img, MB, TEXT)
        S.sanitize_targets(self.img, [self.ref], ledger_path=self.ledger, log=self.quiet)
        S.shred_host_file(self.ref)                          # reference is gone

        res = self.attempt({"secret.txt": None})

        self.assertEqual(res["verdict"], "ERASURE VERIFIED")
        self.assertIn("re-read from the medium", res["files"][0]["detail"])

    def test_ledger_mode_recovers_data_that_reappears(self):
        put(self.img, MB, TEXT)
        S.sanitize_targets(self.img, [self.ref], ledger_path=self.ledger, log=self.quiet)
        S.shred_host_file(self.ref)
        put(self.img, MB, TEXT)                              # data comes back into the erased extent

        row = self.attempt({"secret.txt": None})["files"][0]

        self.assertEqual(row["status"], E.RECOVERED)
        self.assertEqual(row["method"], "MATCHED LEDGER SHA-256")
        self.assertEqual(row["sha256_recovered"], row["sha256_original"])

    def test_ledger_mode_carves_residue(self):
        put(self.img, MB, TEXT)
        S.sanitize_targets(self.img, [self.ref], ledger_path=self.ledger, log=self.quiet)
        S.shred_host_file(self.ref)
        put(self.img, MB + 10, b"leftover-bytes")            # only a fragment returns

        row = self.attempt({"secret.txt": None})["files"][0]

        self.assertEqual(row["status"], E.PARTIAL)
        self.assertEqual(row["method"], "RESIDUE IN ERASED EXTENTS")
        self.assertTrue(row["output"].endswith(".residue"))
        self.assertEqual(row["recovered_bytes"], len(b"leftover-bytes"))

    def test_improper_erase_without_reference_is_not_claimed_clean(self):
        put(self.img, MB, TEXT)
        E.simulate_improper_erasure(self.img, self.ref, "header", self.ledger)

        res = self.attempt({"secret.txt": None})             # reference gone: cannot prove anything

        self.assertEqual(res["files"][0]["status"], E.UNPROVEN)
        self.assertEqual(res["verdict"], "INCONCLUSIVE")

    # ------------------------------------------------------------------
    def test_attempt_is_written_to_a_valid_ledger(self):
        put(self.img, MB, TEXT)
        E.simulate_improper_erasure(self.img, self.ref, "header", self.ledger)

        res = self.attempt()

        events = [__import__("json").loads(l)["event"] for l in open(self.ledger)]
        self.assertEqual(events, ["IMPROPER_ERASE_SIMULATED", "RECOVERY_ATTEMPT"])
        self.assertTrue(res["ledger_check"]["valid"])
        self.assertEqual(EvidenceLedger(self.ledger).verify()["records"], 2)

    def test_attempts_are_read_back_from_the_ledger(self):
        put(self.img, MB, TEXT)
        E.simulate_improper_erasure(self.img, self.ref, "header", self.ledger)
        self.assertEqual(E.erasure_attempts(self.ledger)["secret.txt"]["kind"], "IMPROPER_ERASE")

        S.sanitize_targets(self.img, [self.ref], ledger_path=self.ledger, log=self.quiet)
        self.assertEqual(E.erasure_attempts(self.ledger)["secret.txt"]["kind"], "SECURE_ERASE")

    def test_simulation_reports_nothing_found_on_a_clean_image(self):
        w = E.simulate_improper_erasure(self.img, self.ref, "header", self.ledger)
        self.assertEqual(w["status"], "NOTHING_FOUND")

    def test_simulation_rejects_unknown_mode(self):
        with self.assertRaises(ValueError):
            E.simulate_improper_erasure(self.img, self.ref, "nonsense", self.ledger)


class IntegrationTests(unittest.TestCase):
    """The recovery module inside datashield.secure_erase_file()."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.target_dir = os.path.join(self.tmp, "target")
        os.makedirs(self.target_dir)
        self.img = os.path.join(self.tmp, "disk.img")
        make_image(self.img)
        self.ref = os.path.join(self.target_dir, "secret.txt")
        write(self.ref, TEXT)
        put(self.img, MB, TEXT)

        patches = {
            "BASE_DIR": self.tmp,
            "ERASURE_IMAGE": self.img,
            "ERASURE_TARGET_DIR": self.target_dir,
            "ERASURE_RECOVERED_DIR": os.path.join(self.tmp, "recovered"),
            "LEDGER_PATH": os.path.join(self.tmp, "ledger.jsonl"),
            "ERASURE_LOCATIONS": {"secret.txt": MB},
        }
        self.patchers = [mock.patch.object(datashield, k, v) for k, v in patches.items()]
        for p in self.patchers:
            p.start()
        self.quiet = lambda *a, **k: None

    def tearDown(self):
        for p in self.patchers:
            p.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_improper_erase_then_recover_then_proper_erase(self):
        datashield.simulate_improper_erasure("secret.txt", "header")

        res = datashield.recover_after_erasure(log=self.quiet)
        self.assertEqual(res["verdict"], "ERASURE FAILED")
        recovered = os.path.join(datashield.ERASURE_RECOVERED_DIR, "recovered_secret.txt")
        self.assertTrue(os.path.exists(recovered))

        out = datashield.secure_erase_file("secret.txt", log=self.quiet)

        self.assertEqual(out["status"], "PASSED")
        self.assertEqual(out["recovery_attempt"]["verdict"], "ERASURE VERIFIED")
        self.assertTrue(out["host_file_deleted"])
        self.assertTrue(out["recovered_copy_shredded"])      # no plain copy left behind
        self.assertFalse(os.path.exists(recovered))
        self.assertFalse(os.path.exists(self.ref))
        self.assertTrue(os.path.exists(out["certificate"]))
        self.assertIn("Recovery attempt", open(out["certificate"]).read())
        self.assertTrue(out["ledger_check"]["valid"])

        after = datashield.recover_after_erasure(log=self.quiet)
        self.assertEqual(after["verdict"], "ERASURE VERIFIED")

    def test_recovery_overrides_a_pass_it_disagrees_with(self):
        recovered_stub = {
            "verdict": "ERASURE FAILED", "tested": 1, "recovered_files": 1, "complete_files": 1,
            "files": [{"file": "secret.txt", "status": E.RECOVERED, "state": E.STATE_TEXT[E.RECOVERED],
                       "detail": "stub", "output": None}],
        }
        with mock.patch.object(E, "attempt_recovery", return_value=recovered_stub):
            out = datashield.secure_erase_file("secret.txt", log=self.quiet)

        self.assertEqual(out["status"], "FAILED")
        self.assertFalse(out["host_file_deleted"])            # source kept
        self.assertTrue(os.path.exists(self.ref))
        self.assertIsNone(out["certificate"])                 # no certificate for a failed erasure

    def test_records_only_cover_files_that_were_erased(self):
        self.assertEqual(datashield.erasure_attempt_records(), {})
        datashield.simulate_improper_erasure("secret.txt", "partial")
        self.assertEqual(list(datashield.erasure_attempt_records()), ["secret.txt"])

    def test_simulation_refuses_unauthorized_file(self):
        with self.assertRaises(ValueError):
            datashield.simulate_improper_erasure("passwd", "header")


class GenericFillerResidueTests(unittest.TestCase):
    """audio.mp3 in the demo disk = 9-byte header + 512 x 0xAA filler.  The filler
    has no unique fingerprint, so a header wipe used to report 'no trace'."""

    HEADER = bytes.fromhex("494433030000000000")

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.img = os.path.join(self.tmp, "disk.img")
        self.ledger = os.path.join(self.tmp, "ledger.jsonl")
        self.out = os.path.join(self.tmp, "recovered")
        self.ref = os.path.join(self.tmp, "audio.mp3")
        self.data = self.HEADER + b"\xAA" * 512
        make_image(self.img)
        write(self.ref, self.data)
        put(self.img, 3 * MB, self.data)
        # another live file with the same filler elsewhere on the disk
        put(self.img, 1 * MB, b"\x89PNG\r\n\x1a\n" + b"\xAA" * 512)
        self.quiet = lambda *a, **k: None

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _recover(self, **kw):
        return E.attempt_recovery(self.img, {"audio.mp3": self.ref}, self.out,
                                  ledger_path=self.ledger,
                                  attempts=E.erasure_attempts(self.ledger),
                                  log=self.quiet, **kw)

    def test_header_wipe_is_partially_recovered(self):
        for mode in ("header", "partial"):
            with self.subTest(mode=mode):
                E.simulate_improper_erasure(self.img, self.ref, mode, self.ledger)
                row = self._recover()["files"][0]
                self.assertEqual(row["status"], E.PARTIAL)
                self.assertGreater(row["recovered_bytes"], 0)
                self.assertEqual(row["offset"], 3 * MB)
                self.assertTrue(os.path.exists(row["output"]))
                # reset the file for the next mode
                put(self.img, 3 * MB, self.data)

    def test_layout_offset_alone_is_enough(self):
        put(self.img, 3 * MB, b"\x00" * 16)          # header wiped, no ledger record
        res = self._recover(known_offsets={"audio.mp3": 3 * MB})
        self.assertEqual(res["files"][0]["status"], E.PARTIAL)
        self.assertEqual(res["verdict"], "ERASURE FAILED")

    def test_properly_erased_file_is_not_recovered(self):
        put(self.img, 3 * MB, b"\x00" * len(self.data))
        res = self._recover(known_offsets={"audio.mp3": 3 * MB})
        self.assertEqual(res["files"][0]["status"], E.CLEAN)
        self.assertEqual(res["verdict"], "ERASURE VERIFIED")

    def test_other_files_filler_is_not_mistaken_for_the_file(self):
        put(self.img, 3 * MB, b"\x00" * len(self.data))   # audio.mp3 gone, PNG filler remains at 1 MB
        res = self._recover(known_offsets={"audio.mp3": 3 * MB})
        self.assertEqual(res["files"][0]["recovered_bytes"], 0)


class ReadableTextRecoveryTests(unittest.TestCase):
    """A partly wiped text file must be recovered as readable text (not zero-led
    bytes that Notepad shows as random Chinese characters)."""

    def test_wiped_start_is_shown_as_question_marks(self):
        tmp = tempfile.mkdtemp()
        try:
            img, ledger = os.path.join(tmp, "d.img"), os.path.join(tmp, "l.jsonl")
            ref = os.path.join(tmp, "secret.txt")
            make_image(img)
            write(ref, TEXT)
            put(img, 2 * MB, TEXT)
            E.simulate_improper_erasure(img, ref, "header", ledger)
            res = E.attempt_recovery(img, {"secret.txt": ref}, os.path.join(tmp, "out"),
                                     ledger_path=ledger, attempts=E.erasure_attempts(ledger),
                                     log=lambda *a, **k: None)
            row = res["files"][0]
            self.assertEqual(row["status"], E.PARTIAL)
            with open(row["output"], "rb") as fh:
                got = fh.read()
            self.assertNotIn(b"\x00", got)
            self.assertEqual(got, E.UTF8_BOM + b"?" * 16 + TEXT[16:])
            got.decode("utf-8-sig")                   # plain readable text
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()