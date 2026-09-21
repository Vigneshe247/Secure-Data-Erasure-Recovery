# DataShield - Post-Erasure Recovery Module

**Experiment:** Verify a secure erasure by trying to recover the erased data
**Project:** DataShield - Secure Data Erasure + Authorized File Recovery
**Language / tools:** Python 3, Streamlit (UI), `unittest`

---

## 1. Aim

To add a module to DataShield so that, after data is erased with the Secure Data
Erasure system, the Recovery system is run against the erased disk image:

* if the data was **not properly erased**, the recovery system **recovers it**
  (and proves what came back with SHA-256);
* if it **was properly erased**, nothing comes back and the erasure is **verified**.

## 2. Problem statement

Before this change the two halves of DataShield never met. The erasure engine
checked itself, and the recovery system only worked on a separate recovery disk
with fixed file offsets. Nothing pointed the recovery system at an *erased* disk,
so there was no independent proof that erasure had really worked.

## 3. Approach

```
   Secure Erasure  ──►  Post-Erasure Recovery (NEW)  ──►  verdict
                              │
              nothing recovered ──► ERASURE VERIFIED  ──► host copy shredded, certificate issued
              data recovered    ──► ERASURE FAILED    ──► source kept, no certificate,
                                                          recovered file + SHA-256 reported
```

The module recovers by **content** (not by fixed offsets), using the same file
fingerprints the eraser uses, so it works wherever the data sits on the image.

## 4. Algorithm

For every file that has an erasure record in the evidence ledger:

1. **Whole-image scan** for the file: exact copy, distinctive byte windows and
   512-byte sector fingerprints. Content that also belongs to a *live* file is ignored.
2. **Vote for the start position.** Every hit says "the file would start at
   offset X". The start positions that reproduce the most bytes are scored.
3. **Rebuild the file from the medium** at the best start position, then patch in
   any sector that lives somewhere else (fragmented or moved copies).
4. **Verify** - compare SHA-256 of the recovered file with the original:
   `MATCH` = fully recovered, `MISMATCH` = partial.
5. **If the original file was already shredded** (a passed erasure) - re-read every
   extent the ledger says was erased. If an extent is no longer zero, carve the
   residue and check it against the SHA-256 the ledger stored at erasure time.
6. **Verdict** and a `RECOVERY_ATTEMPT` record in the tamper-evident ledger.

| Per-file result | Meaning |
|---|---|
| `RECOVERED - ERASURE FAILED` | whole file came back, hash matches |
| `PARTIALLY RECOVERED - ERASURE INCOMPLETE` | part of the file is still on the disk |
| `NOT RECOVERABLE - ERASURE VERIFIED` | nothing came back |
| `CANNOT BE PROVEN` | no reference file and no erased extents in the ledger |

## 5. Files changed

| File | Change | Why |
|---|---|---|
| `backend/app/core/erasure_recovery.py` | **NEW** (~500 lines) | The module: recovery engine, ledger reader, improper-erasure demo helper |
| `datashield.py` | +404 / -6 | New menu options 6 and 7, `secure_erase_file()` now runs the recovery attempt, Full Demo step 5 |
| `uni.py` | +209 / -4 | New **♻️ Post-Erasure Recovery** screen; recovery result shown on the erase screen; bug fix (section 10) |
| `backend/app/core/sanitizer.py` | +10 | Certificate now records the recovery-attempt result |
| `test_erasure_recovery.py` | **NEW** (18 tests) | Regression tests for the module and its integration |

No new CSS classes were added to the UI; the new screen reuses the existing
`operation-card`, `section-title`, `section-description` and `authorized` classes.

## 6. Program - key parts explained

### 6.1 Finding where the file sits on the disk

```python
votes = Counter()
for off in rep["exact"]:                 # exact copy found at `off`
    votes[off] += 1000
for w in prof.windows:                   # a distinctive window of the file found at h
    p = prof.data.find(w)                #   ...which sits at position p inside the file
    for h in S._find_all(mm, w):
        votes[h - p] += 1                #   so the file would start at h - p
```

Every clue found on the disk points to a possible *start position* of the file.
Exact copies count most. The best-scoring start positions are then tried, and the
one that reproduces the most of the original file wins. This is why a file with a
wiped header can still be located.

### 6.2 Rebuilding from what is really on the medium

```python
buf = bytearray(best.ljust(size, b"\x00"))       # bytes read from the disk image
for i, fp in enumerate(fps):                     # sectors still wrong? look elsewhere
    ...
    buf[lo:hi] = mm[offs[0]:offs[0] + (hi - lo)] # patch from another place on the disk
```

The recovered file is built from bytes **read from the disk image**, never copied
from the reference file. The reference is only used to *find* and *score* the data.
So a wiped header shows up as zeros in the recovered file, and the SHA-256 correctly
reports `MISMATCH`.

### 6.3 The gate inside the secure-erase flow

```python
attempt = E.attempt_recovery(ERASURE_IMAGE, {filename: target}, ERASURE_RECOVERED_DIR, ...)
if result["status"] == "PASSED" and attempt["recovered_files"]:
    result["status"] = "FAILED"          # recovery disagrees with the eraser -> do not trust PASSED
```

After the eraser finishes, the recovery system is run before the source file is
shredded. If it can still get data back, the erasure is reported as `FAILED`, the
source file is kept and no certificate is issued.

### 6.4 Cleaning up recovered copies

```python
for leftover in [recovered_<file>, recovered_<file>.residue]:
    if os.path.exists(leftover):
        S.shred_host_file(leftover)
```

A file recovered earlier is another plain-text copy of the same data. When the
erasure later succeeds it is shredded too; otherwise the erasure would leave a
readable copy behind.

## 7. Procedure

```
python create_erasure_disk.py          # build the erasure disk
python datashield.py                   # command line menu
streamlit run uni.py                   # web UI  ->  "♻️ Post-Erasure Recovery"
python -m unittest test_sanitizer test_erasure_recovery -v
```

Menu: `6` Post-Erasure Recovery, `7` Simulate Improper Erasure (demo - it wipes only
part of a file so the module has something to find). Demo order: **7 → 6 → 2 → 6**.

## 8. Sample output (real run, trimmed)

**Step 1 - option 7: improper erasure of `secret.txt` (header only)**
```
File           : secret.txt
Improper wipe  : only the first 16 bytes were wiped (header-only wipe)
Bytes wiped    : 16
```

**Step 2 - option 6: the recovery system tries to recover it**
```
FILE            : secret.txt
RESULT          : PARTIALLY RECOVERED - ERASURE INCOMPLETE
DETAIL          : 78 of 94 bytes still on the medium (83.0%)
Disk offset     : 52,428,800 bytes
RAW BYTES FOUND IN DISK IMAGE
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
Recovered file  : test_data/erasure/recovered/recovered_secret.txt
Original SHA-256  : 33F23390DF5332E59BE5EDF62F100F867F8FAB10E763E7083418F5CB2E7D6C9F
Recovered SHA-256 : 584D5990F1E7DABC41EA7A8BC171C972C4B57D48B09146AB7D3547BC6CF476B7
INTEGRITY : MISMATCH

POST-ERASURE RECOVERY : DATA RECOVERED
ERASURE FAILED - the data was not properly erased.
```

**Step 3 - option 2: proper secure erasure**
```
Round 1          : zero         still recoverable=0  extents not zero=0  OK
Recovery attempt : NOT RECOVERABLE - ERASURE VERIFIED
Host copy        : SHREDDED + DELETED
Recovered copy   : SHREDDED (earlier recovery output removed)
Evidence ledger  : VALID (10 records)
STATUS           : SECURE ERASURE COMPLETED
```

**Step 4 - option 6 again**
```
RESULT          : NOT RECOVERABLE - ERASURE VERIFIED
DETAIL          : reference file shredded; 1 erased extent(s) re-read from the medium - all zero
POST-ERASURE RECOVERY : NOTHING RECOVERED
ERASURE VERIFIED
```

## 9. Testing

`python -m unittest test_sanitizer test_erasure_recovery` -> **36 tests, all pass**
(18 existing + 18 new). The new tests cover: intact data fully recovered with a
matching hash; proper erasure recovers nothing; header-only and partial wipes;
fragmented copy reassembled; live-file content not reported; the ledger path
(verified after shred, data that reappears, residue); improper erasure without a
reference is never called "clean"; ledger stays valid; recovered copies shredded
after a successful erase; and recovery overriding a `PASSED` it disagrees with.

To make sure the tests are not vacuous, three deliberate breaks were made in the
code (skip shredding the recovered copy, never override a pass, always claim
extents are zero); each was caught by the matching test.

The Streamlit screen was also run headlessly (simulate -> recover -> results shown).

## 10. Additional fix found while testing

`uni.py` Storage Status used `datashield.SIGNATURES`, which no longer exists
(it was renamed `SIGNATURES_BY_EXTENSION` in the erasure fixes). Clicking
**Refresh Storage Status** crashed with `module 'datashield' has no attribute
'SIGNATURES'`. It now uses `get_signature()` / `signature_matches()`.

## 11. Result

After a secure erasure, DataShield now runs its recovery system against the erased
disk image. Data that was not properly erased is recovered and hash-checked and the
erasure is reported as failed; data that was properly erased gives
"NOT RECOVERABLE - ERASURE VERIFIED". Every attempt is recorded in the
tamper-evident evidence ledger.

## 12. Limitations (state these honestly)

* **Recognition limit.** The module can only find content it has fingerprints of.
  A tiny file (smaller than one sector) that is more than about half wiped leaves
  no 48-byte window intact, so *neither the eraser nor the recovery module can
  recognise the remainder*. Only a full-image wipe + `verify_disk()` proves such
  a disk clean. (Found in testing: wiping the first half of a 96-byte file.)
* Files that are one repeated byte (like the `0xAA` filler in the placeholder
  `.png/.mp3/.mp4` demo files) have no distinctive sectors - only an exact copy or
  the header can be recognised, so a header-wiped placeholder reports "not recoverable".
* Disk-image files only (same as the erasure engine); real drives need the device's
  own sanitize command.
* For a file whose original was already shredded, the check is limited to the
  extents recorded in the ledger. An *improper* erasure records no extents on
  purpose (it is not a proof of erasure), so without the original file it is
  reported as `CANNOT BE PROVEN`, never as clean.
* "Simulate Improper Erasure" is a **demonstration helper**; it only edits the demo
  disk image and logs an `IMPROPER_ERASE_SIMULATED` event.
