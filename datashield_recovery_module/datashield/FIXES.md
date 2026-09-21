# DataShield - erasure fixes

Audit finding: the original erasure only worked on the demo image *because the demo image was built to match
its hard-coded assumptions*. On anything real it left recoverable data and reported success.

| # | Original weakness | Fix | Where |
|---|-------------------|-----|-------|
| 1 | Zeroed `len(source file)` bytes at a hard-coded offset | Locate every copy by **content** (exact match, byte windows, 512-byte sector fingerprints), any offset/alignment | `sanitizer.find_residual` |
| 2 | Grown/stale copy: tail left behind, "REGION CHECK: PASSED" | Extent is **extended both directions** over contiguous non-zero sectors; stops at zero sector / other file's magic / live-file sector | `sanitizer.plan_extents` |
| 3 | Verifier looked for magic bytes only -> plaintext = "PASSED" | Whole-image uniform check (`verify_disk`) + content scan (`find_residual`) | `verifier.py`, `sanitizer.py` |
| 4 | Header-only wipe reported as "erased" | Body detected by sector fingerprints; damaged header sector erased by backward extension | `sanitizer.py`, `is_file_recoverable` |
| 5 | Plain `os.remove()` of the source file | `shred_host_file`: overwrite (random+zero), fsync, rename, unlink - only *after* the image is proven clean | `sanitizer.shred_host_file` |
| 6 | `flush()` only; verified through OS cache | `fsync` + `posix_fadvise(DONTNEED)` + fresh read-back | `sanitizer._overwrite` |
| 7 | Success claimed regardless; no escalation | Closed loop: zero -> random+zero -> optional full-image wipe; `FAILED` is reported, source file kept, no certificate | `sanitizer.sanitize_targets` |
| 8 | Plain JSON audit log | Hash-chained evidence ledger; tamper/deletion detected | `evidence_chain.py` |
| 9 | No storage awareness | `profile_target`: image vs HDD/SSD/NVMe device; raw devices are **refused** with the correct hardware command | `sanitizer.profile_target` |
| 10 | Proof screens read 16 bytes at fixed offsets | Whole-image scan + ledger extents re-read from the medium | `datashield.erasure_status_rows` |
| 11 | Streamlit UI and `se.py` had their own copies of the flawed code | Both now call the same engine | `uni.py`, `se.py` |

Run the regression tests (each reproduces a failure of the old code):

    python -m unittest test_sanitizer -v

## Honest limits (say these to the judges before they ask)
* The engine writes **disk-image files only**. Real drives must be sanitized with the device's own command
  (`nvme sanitize`, ATA Sanitize / Secure Erase, `blkdiscard`), then verified read-only.
* Overwriting an image *inside* a host file system on SSD / btrfs / ZFS / APFS can leave older blocks in the host
  layer (wear-levelling, copy-on-write, journals, snapshots). Whole-device sanitization is the only fix.
* Content search finds copies of files DataShield is told about. Unknown plaintext elsewhere on a disk is only
  caught by a full-image wipe + `verify_disk` (every byte zero).
* The hash chain proves the log was not edited *afterwards* only if the head hash is stored somewhere the
  attacker cannot rewrite (it is printed on the certificate).
