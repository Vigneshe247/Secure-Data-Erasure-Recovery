# DataShield — AI-Assisted Secure Data Erasure, Authorized File Recovery & Verification Platform

> **Smart India Hackathon 2026 — Problem Statement SIH26149**  
> **Domain**: Cybersecurity / Data Security  
> **Concept**: `DETECT → ANALYZE → RECOVER / ERASE → VERIFY → REPORT`

---

## 1. Executive Summary

In modern enterprise and forensic computing environments, standard file deletion (`DELETE ≠ DESTROY`) simply removes the filesystem reference while leaving raw data blocks recoverable on physical media. Conversely, traditional multi-pass overwriting strategies (e.g. DoD 5220.22-M) fail on modern flash-based media (SSDs and NVMe drives) due to the **Flash Translation Layer (FTL)**, wear-leveling algorithms, and over-provisioned blocks.

**DataShield** is an AI-assisted, storage-aware cybersecurity platform that provides:
1. **Authorized Forensic File Recovery**: Deterministic magic-byte signature analysis, deep file carving, fragment continuity scoring, and explainable AI recovery confidence.
2. **Storage-Aware Secure Data Sanitization**: Evaluates underlying media architecture (HDD vs SSD/NVMe) and applies tailored sanitization protocols (NIST SP 800-88 Rev. 1 Clear vs Purge, Cryptographic Scramble, DoD 5220.22-M).
3. **Independent Post-Erasure Verification**: Scans for residual magic-byte fragments, calculates Shannon entropy across sector blocks, and runs controlled recovery probes with a 4-state scientific verdict (`PASSED`, `PASSED_WITH_WARNING`, `FAILED`, `INCONCLUSIVE`).
4. **Immutable Audit Trail & PDF Certification**: SHA-256 chained audit logs and automatic generation of official digital certificates.

---

## 2. System Architecture

```text
                         ┌─────────────────────────────────┐
                         │   React 18 + TypeScript + Vite  │
                         │    Cybersecurity SOC Theme      │
                         └───────────────┬─────────────────┘
                                         │ REST / WebSockets
                                         ▼
                         ┌─────────────────────────────────┐
                         │       FastAPI API Gateway       │
                         │   JWT Auth • Granular RBAC      │
                         └───────────────┬─────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
   ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
   │   Storage Analyzer    │  │    Recovery Engine    │  │    Erasure Engine     │
   ├───────────────────────┤  ├───────────────────────┤  ├───────────────────────┤
   │ • Real Host Drives    │  │ • Signature Scanner   │  │ • Storage-Aware       │
   │ • Safe Demo Sandbox   │  │ • File Carving Engine │  │ • HDD vs SSD/FTL      │
   │ • FTL / TRIM Profiler │  │ • Explainable Conf AI │  │ • 6-Step Safety Guard │
   └──────────┬────────────┘  └──────────┬────────────┘  └──────────┬────────────┘
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         ▼
                              ┌─────────────────────┐
                              │ Verification Engine │
                              │ • Residual Scan     │
                              │ • Shannon Entropy   │
                              │ • 4-State Verdict   │
                              └──────────┬──────────┘
                                         ▼
                              ┌─────────────────────┐
                              │  AI Analytics Layer │
                              │ • Risk Engine       │
                              │ • NLP Summarizer    │
                              └──────────┬──────────┘
                                         ▼
                              ┌─────────────────────┐
                              │  Audit & Evidence   │
                              │ • SHA-256 Ledger    │
                              │ • PDF Certificates │
                              └─────────────────────┘
```

---

## 3. Five Distinct User Roles & Demo Credentials

| Role | Username | Password | Purpose & Capabilities |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | `adminpassword123` | Full access: user management, global policies, all operations, audit viewer. |
| **IT / Security Admin** | `security_admin` | `secadminpass123` | Operational primary: storage analysis, erasure execution, verification, report generation. |
| **Forensic Analyst** | `forensic_analyst` | `analystpass123` | Authorized deleted-file recovery, file carving, evidence hashing. **Explicitly NO destructive erasure permissions.** |
| **Compliance Auditor** | `auditor` | `auditorpass123` | Read-only compliance auditor: audit trail verification, certificate inspector. |
| **SIH Evaluation Judge** | `demo_user` | `demouserpass123` | Dedicated SIH demo persona confined exclusively to isolated Safe Demo Storage sandboxes. |

*Quick 1-Click Role Switcher is available in both the top navigation bar and login screen.*

---

## 4. Key Engineering Modules

### A. Storage Topography & FTL Awareness
- **Magnetic HDD**: Sequential track overwrites (NIST SP 800-88 Clear / DoD 5220.22-M 3-pass).
- **SSD / NVMe**: Detects Flash Translation Layer (FTL) wear-leveling and over-provisioning; enforces Cryptographic Purge / Block Erase.
- **Safe Demo Sandbox**: Isolated `.img` virtual disk containers for risk-free evaluation.

### B. Deterministic Recovery & File Carving Engine
- **Signature Registry**: Detects `JPG`, `PNG`, `PDF`, `DOCX`, `ZIP`, and `MP4` magic bytes.
- **Explainable Recovery Confidence AI**:
  $$\text{Confidence} = 0.35 \times \text{SigMatch} + 0.25 \times \text{Structure} + 0.20 \times \text{Continuity} + 0.15 \times \text{Metadata} + 0.05 \times \text{Size}$$
- **Payload Extraction**: Exports intact files and registers SHA-256 checksums in the audit ledger.

### C. Multi-Step Safety & Sanitization Visualizer
- Multi-step review dialog requiring exact typing of the generated phrase (e.g. `ERASE SAFE DEMO STORAGE A`).
- Real-time 64-sector storage block bitmap visualizer with live byte telemetry.

### D. Verification Engine
- Calculates **Shannon Entropy** ($H(X) = -\sum P(x) \log_2 P(x)$) across all sectors.
- Probes for residual magic bytes and runs a simulated recovery attempt.
- 4-State Verdict: `PASSED`, `PASSED_WITH_WARNING`, `FAILED`, `INCONCLUSIVE`.

---

## 5. Quick Start & Execution

### Prerequisites
- Python 3.12+
- Node.js 18+ and npm

### Backend Setup
```bash
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Seed database, virtual storage sandboxes, and demo cases
python seed_demo.py

# 3. Start FastAPI server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at: `http://127.0.0.1:8000/docs`

### Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install packages & build
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. Running Automated Tests

```bash
pytest backend/tests/
```
Runs 9 comprehensive automated tests verifying:
- Authentication & JWT token generation
- RBAC permissions (verifying forensic analyst cannot execute destructive erasures)
- Magic-byte signature parsing & recovery confidence calculation
- Storage-aware sanitization & multi-step confirmation phrase matching
- Shannon entropy calculations & 4-state verification logic.

---

## 7. SIH Demonstration Workflow (Happy Path)

1. Log in with **Quick Preset** as `demo_user` or `security_admin`.
2. Click **SIH Demo Lab** from the sidebar.
3. Click **Automate Full SIH Lifecycle** or walk through stage-by-stage:
   - **Stage 1**: Detect storage topography & identify NVMe wear leveling.
   - **Stage 2**: Carve deleted files (`JPG`, `PNG`, `PDF`, `DOCX`, `ZIP`) with explainable AI scores.
   - **Stage 3**: Recover high-confidence file & register SHA-256 hash.
   - **Stage 4**: Authorize storage-aware sanitization with confirmation phrase.
   - **Stage 5**: Observe real-time 64-sector wipe matrix & run post-erasure verification.
   - **Stage 6**: Compile official PDF Compliance Certificate and inspect immutable SHA-256 audit ledger.

---

## 8. License & Credits

Built for **Smart India Hackathon 2026 (SIH26149)**  
Developed with FastAPI, React, TypeScript, TailwindCSS, SQLAlchemy, and ReportLab.
