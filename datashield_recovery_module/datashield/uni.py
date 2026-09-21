import streamlit as st
import sys
import os
import io
from contextlib import redirect_stdout

# ============================================================
# DATASHIELD UI
# Professional Dashboard
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(
    0,
    os.path.join(BASE_DIR, "backend", "app", "core")
)

import datashield


# ============================================================
# PAGE CONFIGURATION
# ============================================================

st.set_page_config(
    page_title="DataShield",
    page_icon="🛡️",
    layout="wide"
)


# ============================================================
# CUSTOM CSS
# ============================================================

st.markdown(
    """
    <style>

    .main {
        background-color: #f5f7fb;
    }

    .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
        max-width: 1400px;
    }

    .header {
        background: linear-gradient(
            135deg,
            #0f172a,
            #1e293b
        );
        padding: 30px;
        border-radius: 18px;
        margin-bottom: 25px;
    }

    .header-title {
        color: white;
        font-size: 38px;
        font-weight: 700;
        margin-bottom: 5px;
    }

    .header-subtitle {
        color: #cbd5e1;
        font-size: 17px;
    }

    .status-card {
        background: white;
        padding: 22px;
        border-radius: 15px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 3px 12px rgba(0,0,0,0.05);
    }

    .status-title {
        font-size: 15px;
        color: #64748b;
        margin-bottom: 8px;
    }

    .status-value {
        font-size: 25px;
        font-weight: 700;
    }

    .operation-card {
        background: white;
        padding: 28px;
        border-radius: 18px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 3px 15px rgba(0,0,0,0.05);
        margin-top: 20px;
    }

    .section-title {
        font-size: 27px;
        font-weight: 700;
        color: #0f172a;
    }

    .section-description {
        color: #64748b;
        font-size: 15px;
        margin-bottom: 20px;
    }

    .authorized {
        background: #f8fafc;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        margin-top: 10px;
        margin-bottom: 15px;
    }

    .result-box {
        background: #0f172a;
        color: #e2e8f0;
        padding: 20px;
        border-radius: 12px;
        font-family: monospace;
        white-space: pre-wrap;
        margin-top: 20px;
    }

    </style>
    """,
    unsafe_allow_html=True
)


# ============================================================
# HEADER
# ============================================================

st.markdown(
    """
    <div class="header">
        <div class="header-title">
            🛡️ DataShield
        </div>
        <div class="header-subtitle">
            Secure Data Erasure + Authorized File Recovery
            <br>
            Controlled Disk-Image Forensic Demonstration
        </div>
    </div>
    """,
    unsafe_allow_html=True
)


# ============================================================
# STORAGE STATUS
# ============================================================

recovery_ready = os.path.exists(datashield.RECOVERY_IMAGE)
erasure_ready = os.path.exists(datashield.ERASURE_IMAGE)

recovery_files = datashield.find_recoverable_files()

try:
    erasure_files = [
        row["filename"]
        for row in datashield.erasure_status_rows()
        if row["state"] == "DATA PRESENT"
    ] if erasure_ready else []
except Exception:
    erasure_files = []


col1, col2, col3, col4 = st.columns(4)


with col1:

    st.markdown(
        f"""
        <div class="status-card">
            <div class="status-title">
                Recovery Disk
            </div>
            <div class="status-value">
                {"🟢 READY" if recovery_ready else "🔴 OFFLINE"}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )


with col2:

    st.markdown(
        f"""
        <div class="status-card">
            <div class="status-title">
                Erasure Disk
            </div>
            <div class="status-value">
                {"🟢 READY" if erasure_ready else "🔴 OFFLINE"}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )


with col3:

    st.markdown(
        f"""
        <div class="status-card">
            <div class="status-title">
                Recoverable Files
            </div>
            <div class="status-value">
                {len(recovery_files)}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )


with col4:

    st.markdown(
        f"""
        <div class="status-card">
            <div class="status-title">
                Erasure Targets
            </div>
            <div class="status-value">
                {len(erasure_files)}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )


# ============================================================
# OPERATION SELECTION
# ============================================================

st.markdown("<br>", unsafe_allow_html=True)

st.markdown(
    "## Select DataShield Operation"
)

operation = st.radio(
    "",
    [
        "🔍 Recover File",
        "🧹 Securely Delete File",
        "🧾 Erasure Proof",
        "♻️ Post-Erasure Recovery",
        "💾 Storage Status"
    ],
    horizontal=True
)


# ============================================================
# RECOVER FILE
# ============================================================

if operation == "🔍 Recover File":

    st.markdown(
        """
        <div class="operation-card">

        <div class="section-title">
            🔍 Authorized File Recovery
        </div>

        <div class="section-description">
            Recover an authorized file from the controlled
            disk image and verify its SHA-256 integrity.
        </div>

        </div>
        """,
        unsafe_allow_html=True
    )

    st.info(
        "Enter the exact filename you want to recover."
    )

    recover_filename = st.text_input(
        "File name",
        placeholder="Example: evidence.png",
        key="recover_filename"
    )

    st.markdown(
        """
        <div class="authorized">
        <b>Authorized recovery files</b><br><br>
        employee.txt &nbsp; | &nbsp;
        evidence.png &nbsp; | &nbsp;
        password_demo.txt &nbsp; | &nbsp;
        project.txt &nbsp; | &nbsp;
        secret.txt &nbsp; | &nbsp;
        test.txt &nbsp; | &nbsp;
        clip.mp4 &nbsp; | &nbsp;
        audio.mp3
        </div>
        """,
        unsafe_allow_html=True
    )

    if st.button(
        "🔍 Start Recovery",
        type="primary",
        use_container_width=False
    ):

        filename = recover_filename.strip()

        if not filename:

            st.warning(
                "Please enter a file name."
            )

        elif filename not in datashield.RECOVERY_LOCATIONS:

            st.error(
                f"'{filename}' is not an authorized recovery file."
            )

        elif not datashield.is_file_recoverable(filename):

            st.error(
                f"'{filename}' is currently not recoverable."
            )

        else:

            output = io.StringIO()

            try:

                original_input = __builtins__.input

                __builtins__.input = (
                    lambda prompt="": "1"
                )

                with redirect_stdout(output):

                    # Directly perform the selected recovery
                    offset = datashield.RECOVERY_LOCATIONS[filename]

                    reference = os.path.join(
                        datashield.RECOVERY_ORIGINAL_DIR,
                        filename
                    )

                    file_size = os.path.getsize(reference)

                    os.makedirs(
                        datashield.RECOVERY_DIR,
                        exist_ok=True
                    )

                    recovered = os.path.join(
                        datashield.RECOVERY_DIR,
                        "recovered_" + filename
                    )

                    raw_before = datashield.read_raw_bytes(
                        datashield.RECOVERY_IMAGE,
                        offset,
                        min(16, file_size)
                    )

                    with open(
                        datashield.RECOVERY_IMAGE,
                        "rb"
                    ) as disk:

                        disk.seek(offset)

                        data = disk.read(file_size)

                    with open(
                        recovered,
                        "wb"
                    ) as output_file:

                        output_file.write(data)

                    original_hash = (
                        datashield.calculate_sha256(
                            reference
                        )
                    )

                    recovered_hash = (
                        datashield.calculate_sha256(
                            recovered
                        )
                    )

                    print("=" * 70)
                    print("DATASHIELD RECOVERY RESULT")
                    print("=" * 70)
                    print()
                    print(f"Selected file : {filename}")
                    print(f"Disk offset   : {offset:,} bytes")
                    print(f"File size     : {file_size} bytes")
                    print()
                    print("RAW BYTES FOUND IN DISK IMAGE")
                    print(
                        " ".join(
                            f"{b:02X}"
                            for b in raw_before
                        )
                    )
                    print()
                    print("✓ File signature/data region verified")
                    print("✓ File carved from raw disk image")
                    print()
                    print(
                        f"Recovered file : {recovered}"
                    )
                    print()
                    print(
                        "SHA-256 INTEGRITY VERIFICATION"
                    )
                    print("-" * 70)
                    print(
                        f"Original SHA-256  : {original_hash}"
                    )
                    print(
                        f"Recovered SHA-256 : {recovered_hash}"
                    )
                    print()

                    if original_hash == recovered_hash:

                        print("INTEGRITY : MATCH")
                        print("STATUS    : RECOVERY VERIFIED")

                    else:

                        print("INTEGRITY : MISMATCH")
                        print("STATUS    : RECOVERY FAILED")

            finally:

                __builtins__.input = original_input

            st.success(
                f"Recovery completed for {filename}"
            )

            st.code(
                output.getvalue(),
                language="text"
            )


# ============================================================
# SECURE DELETE
# ============================================================

elif operation == "🧹 Securely Delete File":

    st.markdown(
        """
        <div class="operation-card">

        <div class="section-title">
            🧹 Secure Data Erasure
        </div>

        <div class="section-description">
            Overwrite the selected file's controlled storage
            region and remove the selected target file.
        </div>

        </div>
        """,
        unsafe_allow_html=True
    )

    st.warning(
        "This operation finds EVERY copy of the file on the image, overwrites it, re-scans the whole image to verify, and shreds the source file."
    )

    delete_filename = st.text_input(
        "File name",
        placeholder="Example: secret.txt",
        key="delete_filename"
    )

    st.markdown(
        """
        <div class="authorized">
        <b>Authorized erasure files</b><br><br>
        employee.txt &nbsp; | &nbsp;
        evidence.png &nbsp; | &nbsp;
        password_demo.txt &nbsp; | &nbsp;
        secret.txt &nbsp; | &nbsp;
        clip.mp4 &nbsp; | &nbsp;
        audio.mp3
        </div>
        """,
        unsafe_allow_html=True
    )

    confirm_delete = st.checkbox(
        "I confirm that I want to securely erase this file."
    )

    if st.button(
        "🧹 Start Secure Erasure",
        type="primary"
    ):

        filename = delete_filename.strip()

        if not filename:

            st.warning(
                "Please enter a file name."
            )

        elif filename not in datashield.ERASURE_LOCATIONS:

            st.error(
                f"'{filename}' is not an authorized erasure target."
            )

        elif not confirm_delete:

            st.warning(
                "Please confirm the secure erasure operation."
            )

        else:

            target = os.path.join(
                datashield.ERASURE_TARGET_DIR,
                filename
            )

            if not os.path.exists(target):

                st.error(
                    f"Target file '{filename}' does not exist."
                )

            else:

                file_size = os.path.getsize(target)

                st.write("### Erasure Process")

                st.write(f"**Selected file:** `{filename}` ({file_size} bytes)")

                plan = datashield._engine().analyze_targets(
                    datashield.ERASURE_IMAGE,
                    [target],
                    datashield._live_targets_except(filename)
                )

                st.write(
                    f"**Copies / extents found on the image:** "
                    f"`{len(plan['extents'])}` (whole-image scan, not a fixed offset)"
                )

                for extent in plan["extents"]:
                    st.code(
                        f"offset {extent['start']:,}  "
                        f"length {extent['end'] - extent['start']:,} bytes  "
                        f"found by {', '.join(extent['found_by'])}"
                        + (
                            f"  (+{extent['extended_bytes']:,} bytes beyond matched content)"
                            if extent["extended_bytes"] else ""
                        )
                    )

                log_lines = []

                with st.spinner("Erasing, verifying whole image, escalating if needed..."):
                    result = datashield.secure_erase_file(
                        filename,
                        log=lambda *a, **k: log_lines.append(" ".join(str(x) for x in a))
                    )

                for line in log_lines:
                    st.write(line)

                for rnd in result.get("rounds", []):
                    (st.success if rnd["ok"] else st.error)(
                        f"Round {rnd['round']} ({rnd['method']}): "
                        f"still recoverable = {rnd['residual_files']}, "
                        f"extents not zero = {rnd['extents_not_zero']}"
                    )

                attempt = result.get("recovery_attempt")

                if attempt and attempt["files"]:

                    row = attempt["files"][0]

                    (st.success if row["status"] == "CLEAN" else st.error)(
                        f"RECOVERY ATTEMPT : {row['state']} - {row['detail']}"
                    )

                if result["status"] == "PASSED":

                    st.success("WHOLE-IMAGE VERIFICATION : PASSED")

                    st.success(
                        "HOST COPY : SHREDDED + DELETED"
                        if result["host_file_deleted"]
                        else "HOST COPY : NOT DELETED"
                    )

                    if result.get("recovered_copy_shredded"):

                        st.success(
                            "RECOVERED COPY : SHREDDED (earlier recovery output removed)"
                        )

                    st.markdown(
                        f"""
                        ### 🛡️ Sanitization Result

                        **File:** {filename}  
                        **Verification:** whole-image scan + extent read-back  
                        **Recovery attempt:** {attempt['verdict'] if attempt else 'not run'}  
                        **Evidence ledger:** {'VALID' if result['ledger_check']['valid'] else 'BROKEN'} ({result['ledger_check']['records']} records)  
                        **Ledger head:** `{result['ledger_head']}`  
                        **Final status:** SECURE ERASURE COMPLETED
                        """
                    )

                else:

                    st.error(
                        "SANITIZATION FAILED - recoverable data remains. "
                        "The source file was NOT deleted. Escalate to a "
                        "full-image wipe or sanitize the whole device."
                    )


# ============================================================
# ERASURE PROOF
# ============================================================

elif operation == "🧾 Erasure Proof":

    st.markdown(
        """
        <div class="operation-card">

        <div class="section-title">
            🧾 Erasure Verification & Proof
        </div>

        <div class="section-description">
            Scan the controlled erasure disk image and verify
            whether the selected storage regions still contain data.
        </div>

        </div>
        """,
        unsafe_allow_html=True
    )

    if st.button(
        "🔎 Run Erasure Proof",
        type="primary"
    ):

        rows = datashield.erasure_status_rows()

        for row in rows:
            line = f"{row['filename']} - {row['state']} ({row['detail']})"
            if row["sanitized"] is True:
                st.success("✓ " + line)
            elif row["sanitized"] is False:
                st.error("✗ " + line)
            else:
                st.warning("⚠ " + line)

        from backend.app.core.evidence_chain import EvidenceLedger
        chain = EvidenceLedger(datashield.LEDGER_PATH).verify()

        recoverable = sum(r["sanitized"] is False for r in rows)
        unproven = sum(r["sanitized"] is None for r in rows)

        st.markdown("---")

        (st.success if chain["valid"] else st.error)(
            f"Evidence ledger: {'VALID' if chain['valid'] else 'BROKEN - ' + chain['reason']} "
            f"({chain['records']} records)"
        )

        if recoverable == 0 and unproven == 0 and chain["valid"]:
            st.success("ERASURE VERIFICATION : PASSED")
        elif recoverable:
            st.error(
                f"ERASURE VERIFICATION : FAILED - {recoverable} file(s) still recoverable."
            )
        else:
            st.warning(
                "ERASURE VERIFICATION : INCONCLUSIVE - some files cannot be proven "
                "clean, or the evidence ledger failed its integrity check."
            )


# ============================================================
# POST-ERASURE RECOVERY
# ============================================================

elif operation == "♻️ Post-Erasure Recovery":

    st.markdown(
        """
        <div class="operation-card">

        <div class="section-title">
            ♻️ Post-Erasure Recovery
        </div>

        <div class="section-description">
            After a secure erasure, point the recovery system at the
            erased disk image. If data can still be recovered, the
            erasure was not proper.
        </div>

        </div>
        """,
        unsafe_allow_html=True
    )

    st.info(
        "Nothing recovered = erasure verified. Data recovered = the data "
        "was NOT properly erased; it is recovered, SHA-256 checked and reported."
    )

    if not erasure_ready:

        st.error(
            "Erasure disk image not found. Run create_erasure_disk.py first."
        )

    else:

        recovery_engine = datashield._recovery_engine()

        # demo helper first, so the list below is already up to date
        with st.expander("🧪 Demo: simulate an improper erasure"):

            st.write(
                "Imitates an erasure tool that does not finish the job, "
                "so the recovery module has something to recover."
            )

            intact_files = [
                row["filename"]
                for row in datashield.erasure_status_rows()
                if row["state"] == "DATA PRESENT"
            ]

            if not intact_files:

                st.write("No intact files on the erasure disk.")

            else:

                simulate_filename = st.selectbox(
                    "File",
                    intact_files,
                    key="simulate_filename"
                )

                simulate_mode = st.radio(
                    "Improper erasure type",
                    list(recovery_engine.IMPROPER_MODES),
                    format_func=lambda m: f"{m} - {recovery_engine.IMPROPER_MODES[m]}",
                    key="simulate_mode"
                )

                if st.button("🧪 Simulate improper erasure"):

                    outcome = datashield.simulate_improper_erasure(
                        simulate_filename,
                        simulate_mode
                    )

                    st.warning(
                        f"{simulate_filename}: {outcome['detail']} "
                        f"({outcome['bytes_zeroed']} bytes wiped). "
                        "Now run the recovery below."
                    )

        records = datashield.erasure_attempt_records()

        if not records:

            st.warning(
                "No erasure has been performed yet. Use "
                "🧹 Securely Delete File first, or simulate an "
                "improper erasure above."
            )

        else:

            st.markdown(
                "<div class=\"authorized\"><b>Files with an erasure record</b><br><br>"
                + "<br>".join(
                    f"{name} &nbsp; - &nbsp; {recovery_engine.describe_attempt(record)}"
                    for name, record in records.items()
                )
                + "</div>",
                unsafe_allow_html=True
            )

            recovery_choice = st.selectbox(
                "File to test",
                ["All erased files"] + list(records),
                key="recovery_choice"
            )

            if st.button(
                "♻️ Run Post-Erasure Recovery",
                type="primary"
            ):

                with st.spinner("Scanning the whole disk image and trying to recover the data..."):

                    recovery_result = datashield.recover_after_erasure(
                        None if recovery_choice == "All erased files" else [recovery_choice],
                        log=lambda *a, **k: None
                    )

                for row in recovery_result["files"]:

                    line = f"{row['file']} - {row['state']} ({row['detail']})"

                    if row["status"] == recovery_engine.CLEAN:

                        st.success("✓ " + line)

                    elif row["status"] == recovery_engine.UNPROVEN:

                        st.warning("⚠ " + line)

                    else:

                        st.error("✗ " + line)

                        st.code(
                            f"Method            : {row['method']}\n"
                            f"Disk offset       : {row['offset']:,} bytes\n"
                            f"Recovered bytes   : {row['recovered_bytes']:,} of {row['size']:,} "
                            f"({row['recovered_pct']}%)\n"
                            f"Raw bytes found   : {row['raw_bytes']}\n"
                            f"Recovered file    : {row['output']}\n"
                            f"Original SHA-256  : {row['sha256_original']}\n"
                            f"Recovered SHA-256 : {row['sha256_recovered']}\n"
                            f"INTEGRITY         : {row['integrity']}",
                            language="text"
                        )

                chain = recovery_result.get("ledger_check")

                st.markdown("---")

                if chain:

                    (st.success if chain["valid"] else st.error)(
                        f"Evidence ledger: {'VALID' if chain['valid'] else 'BROKEN - ' + chain['reason']} "
                        f"({chain['records']} records)"
                    )

                if recovery_result["verdict"] == "ERASURE VERIFIED":

                    st.success(
                        "POST-ERASURE RECOVERY : NOTHING RECOVERED - ERASURE VERIFIED"
                    )

                elif recovery_result["verdict"] == "ERASURE FAILED":

                    st.error(
                        f"POST-ERASURE RECOVERY : DATA RECOVERED - ERASURE FAILED "
                        f"({recovery_result['recovered_files']} file(s)). "
                        "Use 🧹 Securely Delete File to erase the remaining data."
                    )

                else:

                    st.warning(
                        f"POST-ERASURE RECOVERY : {recovery_result['verdict']} - some files "
                        "cannot be proven clean (no reference file and no erased "
                        "extents in the evidence ledger)."
                    )


# ============================================================
# STORAGE STATUS
# ============================================================

elif operation == "💾 Storage Status":

    st.markdown(
        """
        <div class="operation-card">

        <div class="section-title">
            💾 Storage Status
        </div>

        <div class="section-description">
            Inspect the current state of the controlled
            recovery and erasure disk images.
        </div>

        </div>
        """,
        unsafe_allow_html=True
    )

    if st.button(
        "🔄 Refresh Storage Status",
        type="primary"
    ):

        st.write("### Recovery Disk")

        for filename, offset in datashield.RECOVERY_LOCATIONS.items():

            reference = os.path.join(
                datashield.RECOVERY_ORIGINAL_DIR,
                filename
            )

            if not os.path.exists(reference):

                st.write(
                    f"⚪ {filename} — REFERENCE MISSING"
                )

                continue

            file_size = os.path.getsize(
                reference
            )

            raw = datashield.read_raw_bytes(
                datashield.RECOVERY_IMAGE,
                offset,
                min(16, file_size)
            )

            if datashield.get_signature(filename) is not None:

                if datashield.signature_matches(filename, raw):

                    st.success(
                        f"✓ {filename} — RECOVERABLE"
                    )

                elif raw == b"\x00" * len(raw):

                    st.write(
                        f"⚫ {filename} — OVERWRITTEN"
                    )

                else:

                    st.warning(
                        f"⚠ {filename} — UNKNOWN"
                    )

            else:

                if raw == b"\x00" * len(raw):

                    st.write(
                        f"⚫ {filename} — OVERWRITTEN"
                    )

                else:

                    st.success(
                        f"✓ {filename} — RECOVERABLE"
                    )

        st.write("### Erasure Disk")

        for row in datashield.erasure_status_rows():
            text = f"{row['filename']} — {row['state']}"
            if row["sanitized"] is True:
                st.success("✓ " + text)
            elif row["sanitized"] is False:
                st.warning("⚠ " + text)
            else:
                st.info("? " + text)


# ============================================================
# FOOTER
# ============================================================

st.markdown(
    """
    <br>
    <hr>
    <center>
        <b>DataShield</b> |
        Controlled Disk-Image Demonstration |
        Secure Erasure & Authorized Recovery
    </center>
    """,
    unsafe_allow_html=True
)