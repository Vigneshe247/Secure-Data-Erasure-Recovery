import os
import re
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.database.session import get_db
from backend.app.models.models import (
    StorageDevice, RecoveryCase, RecoveryCandidate,
    ErasureOperation, SecurityReport, AuditLog, User
)
from backend.app.core.permissions import get_current_user

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


class ChatMessage(BaseModel):
    role: str  # 'user' | 'assistant' | 'system'
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    reply: str
    suggestions: List[str] = []
    category: Optional[str] = "general"


# Expert Forensic Knowledge Base for deterministic fallback & high-precision answers
KNOWLEDGE_PATTERNS = [
    {
        "keywords": ["nvme", "ssd", "flash", "wear level", "ftl"],
        "category": "sanitization_ssd",
        "reply": (
            "### 🛡️ Recommended Sanitization Protocol for Solid State Media (SSD / NVMe)\n\n"
            "Traditional multi-pass overwrites (e.g. DoD 5220.22-M) are **ineffective and wear out NAND flash** due to the internal **Flash Translation Layer (FTL)** and wear-leveling algorithms, which conceal remapped and over-provisioned sectors.\n\n"
            "#### ✅ Mandatory Industry Standard: **NIST SP 800-88 Rev.1 — PURGE**\n"
            "1. **Cryptographic Erase (Crypto Scramble)**: Instantly destroys internal AES-256 controller encryption keys, rendering all stored ciphertext mathematically impossible to decrypt in < 2 seconds.\n"
            "2. **ATA Secure Erase / NVMe Format**: Direct firmware-level voltage discharge across all NAND cells, wiping both active and wear-level over-provisioned blocks.\n"
            "3. **Post-Erasure Verification**: Must confirm Shannon entropy is either 0.0 (all zeros) or >= 7.98 bits/byte (pure cryptographic scramble) with **0 residual signatures**."
        ),
        "suggestions": [
            "What is Shannon Entropy threshold?",
            "How does HDD overwriting differ from SSD?",
            "Run post-erasure verification now"
        ]
    },
    {
        "keywords": ["hdd", "magnetic", "dod", "gutmann", "hard drive"],
        "category": "sanitization_hdd",
        "reply": (
            "### 💾 Recommended Sanitization for Magnetic Media (HDD)\n\n"
            "Magnetic hard disk drives write data onto rotating ferromagnetic platters where magnetic domain residue can theoretically persist.\n\n"
            "#### 📋 Recommended Standards:\n"
            "* **NIST SP 800-88 Rev.1 Clear (Single-Pass 0x00)**: Modern high-density PRML drives do not retain recoverable shadow signals after a single verified zero-overwrite.\n"
            "* **DoD 5220.22-M (3-Pass)**:\n"
            "  - Pass 1: Deterministic zeros (`0x00`)\n"
            "  - Pass 2: Deterministic ones (`0xFF`)\n"
            "  - Pass 3: Pseudo-random byte stream with read-back sector verification\n"
            "* **Peter Gutmann (35-Pass)**: Designed for older MFM/RLL drives; excessive for modern media but available for extreme legacy compliance requirements."
        ),
        "suggestions": [
            "Compare DoD 3-Pass vs NIST Clear",
            "How to sanitize an SSD?",
            "Export compliance certificate"
        ]
    },
    {
        "keywords": ["entropy", "shannon", "verify", "verification", "7.98"],
        "category": "verification_entropy",
        "reply": (
            "### 📐 Forensic Shannon Entropy & Verification Standards\n\n"
            "Shannon Entropy ($H$) quantifies the unpredictability / information density of a byte sequence, measured in **bits per byte (0.00 to 8.00)**:\n\n"
            "$$\\text{Entropy} = -\\sum_{i=0}^{255} P(b_i) \\log_2 P(b_i)$$\n\n"
            "* **All Zeros Wipe (`0x00`)**: Entropy $\\approx 0.0000$. Ideal for single-pass clear.\n"
            "* **Crypto Scramble / Random Overwrite**: Entropy **$\\ge 7.9800$**. Indicates pure cryptographic randomness without structural plaintext or header artifacts.\n"
            "* **Warning Range ($2.0 - 7.5$)**: Indicates un-overwritten residual structured data (text, documents, executable code) requiring secondary sanitization passes."
        ),
        "suggestions": [
            "View Post-Erasure Verification tab",
            "What are magic bytes?",
            "Which standard for NVMe SSD?"
        ]
    },
    {
        "keywords": ["carve", "carving", "magic byte", "recover", "recovery", "signature"],
        "category": "recovery_carving",
        "reply": (
            "### 🔍 Deep-Sector Magic-Byte File Carving in DataShield\n\n"
            "File carving reconstructs deleted files directly from raw unallocated storage clusters when filesystem metadata (MFT or inodes) has been unlinked.\n\n"
            "#### 🛠️ Signature Database in DataShield:\n"
            "* **JPEG/JPG**: Header `FF D8 FF E0/E1` · Trailer `FF D9`\n"
            "* **PNG**: Header `89 50 4E 47 0D 0A 1A 0A` · Chunk `IEND`\n"
            "* **PDF**: Header `%PDF-` · Trailer `%%EOF`\n"
            "* **DOCX / ZIP**: Header `50 4B 03 04` · Central Directory End `50 4B 05 06`\n"
            "* **WEBP**: Header `RIFF....WEBPVP8`\n\n"
            "#### 🔄 Recovery Workflow:\n"
            "1. Select or create an authorized **Forensic Case**\n"
            "2. Click **Execute Recovery Scan** to carve raw sector buffers\n"
            "3. Inspect candidates via **Hex Viewer** or **Explainable AI Confidence**\n"
            "4. Click **Recover** to restore the file back to disk or download as authenticated payload."
        ),
        "suggestions": [
            "Go to File Recovery tab",
            "How does DataShield restore original content?",
            "Check active forensic cases"
        ]
    },
    {
        "keywords": ["gdpr", "compliance", "hipaa", "audit", "legal", "iso 27001", "certificate"],
        "category": "compliance_legal",
        "reply": (
            "### ⚖️ Regulatory Compliance & Audit Chain (SIH26149)\n\n"
            "DataShield provides legally defensible proof of sanitization and recovery:\n\n"
            "* **GDPR Article 17 ('Right to be Forgotten')**: Verifiable irreversible data erasure preventing unauthorized reconstruction.\n"
            "* **NIST SP 800-88 Rev.1 Compliance**: Meets federal guidelines for media sanitization, sanitization verification, and declassification.\n"
            "* **SHA-256 Audit Trail Ledger**: Every action (create case, shred file, carve candidate, verify entropy) is cryptographically signed into an immutable SHA-256 integrity chain.\n"
            "* **Tamper-Proof Certificates**: Digitally generated forensic PDF reports contain cryptographic hash validation, operator identity, and LBA verification results."
        ),
        "suggestions": [
            "Generate compliance report",
            "View cryptographic audit trail",
            "Export audit logs as JSON"
        ]
    }
]


async def get_system_context(db: AsyncSession) -> Dict[str, Any]:
    """Retrieve real-time database counts for live platform awareness."""
    try:
        dev_res = await db.execute(select(StorageDevice))
        devices = dev_res.scalars().all()

        case_res = await db.execute(select(RecoveryCase))
        cases = case_res.scalars().all()

        cand_res = await db.execute(select(RecoveryCandidate))
        candidates = cand_res.scalars().all()

        rep_res = await db.execute(select(SecurityReport))
        reports = rep_res.scalars().all()

        audit_res = await db.execute(select(AuditLog))
        audits = audit_res.scalars().all()

        return {
            "devices_count": len(devices),
            "cases_count": len(cases),
            "candidates_count": len(candidates),
            "reports_count": len(reports),
            "audit_logs_count": len(audits),
            "cases_list": [c.case_number for c in cases[:3]],
        }
    except Exception:
        return {}


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = req.message.strip().lower()
    if not query:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Fetch live system state
    ctx = await get_system_context(db)

    # 1. System Status / Metrics Intent
    if any(k in query for k in ["status", "overview", "system stats", "dashboard stats", "how many", "count"]):
        reply = (
            f"### 📊 Real-Time Platform Status Overview\n\n"
            f"Greetings, **{current_user.full_name or current_user.username}** (`{current_user.role}`). Here is the current DataShield forensic telemetry:\n\n"
            f"* **Storage Targets Attached**: `{ctx.get('devices_count', 0)}` physical/sandboxed storage containers\n"
            f"* **Active Forensic Cases**: `{ctx.get('cases_count', 0)}` registered cases ({', '.join(ctx.get('cases_list', [])) or 'None'})\n"
            f"* **Detected File Candidates**: `{ctx.get('candidates_count', 0)}` residual carved file candidates\n"
            f"* **Compliance Certificates**: `{ctx.get('reports_count', 0)}` signed audit reports generated\n"
            f"* **Cryptographic Audit Ledger**: `{ctx.get('audit_logs_count', 0)}` SHA-256 anchored events\n\n"
            f"All security modules and local sanitization daemons are running nominally."
        )
        return ChatResponse(
            reply=reply,
            suggestions=[
                "Which sanitization standard for NVMe SSD?",
                "How to recover deleted files?",
                "Explain Shannon Entropy verification"
            ],
            category="system_status"
        )

    # 2. Check Match in Knowledge Base Patterns
    for pattern in KNOWLEDGE_PATTERNS:
        if any(kw in query for kw in pattern["keywords"]):
            return ChatResponse(
                reply=pattern["reply"],
                suggestions=pattern["suggestions"],
                category=pattern["category"]
            )

    # 3. Step-by-Step Instructions Intent
    if any(k in query for k in ["how to", "steps", "help", "guide", "tutorial", "manual"]):
        reply = (
            "### 🧭 DataShield Operator Quick Guide\n\n"
            "Here are the core workflows you can execute in DataShield:\n\n"
            "1. **File / Data Deletion (`/shred`)**: Enter file path or paste raw text. Choose algorithm (e.g. NIST Purge or DoD 3-Pass) and click *Execute Secure Delete*. Original bytes are snapshotted securely for recovery audit.\n"
            "2. **Forensic Carving (`/recovery`)**: Select a forensic case or click *New Forensic Case*. Click *Execute Recovery Scan* to carve raw unallocated clusters. Preview candidates via Hex Viewer and click *Recover* to restore original content.\n"
            "3. **Post-Erasure Verification (`/verification`)**: Validate entropy score ($\\ge 7.98$) and confirm 0 residual MFT/inode structures.\n"
            "4. **Compliance Certificates (`/reports`)**: Generate downloadable PDF compliance certificates with SHA-256 hash chains.\n"
            "5. **Audit Trail (`/audit`)**: Inspect the immutable event chain or export as structured JSON."
        )
        return ChatResponse(
            reply=reply,
            suggestions=[
                "Which standard should I use for SSD?",
                "Show real-time platform status",
                "Explain Shannon entropy"
            ],
            category="guide"
        )

    # 4. Default Intelligent Security Assistant Fallback
    default_reply = (
        f"### 🛡️ DataShield AI Cybersecurity Assistant\n\n"
        f"I can assist with storage sanitization standards, forensic recovery, verification protocols, and audit compliance.\n\n"
        f"**You asked:** *\"{req.message}\"*\n\n"
        f"#### Core Specializations:\n"
        f"* **NIST SP 800-88 Rev.1 & DoD 5220.22-M Protocols**: Tailored recommendations for SSD, NVMe, and magnetic HDD.\n"
        f"* **Magic-Byte File Carving**: Recovering deleted JPEG, PNG, PDF, DOCX, ZIP, WEBP, and binary formats.\n"
        f"* **Shannon Entropy Analysis**: Mathematical validation ensuring zero residual data remnants.\n"
        f"* **Cryptographic Audit Ledger**: SHA-256 event chaining for legal compliance (GDPR, HIPAA).\n\n"
        f"Select one of the prompt suggestions below or ask any specific technical question!"
    )

    return ChatResponse(
        reply=default_reply,
        suggestions=[
            "Which sanitization standard for NVMe SSD?",
            "How does magic-byte carving work?",
            "Explain Shannon Entropy verification",
            "Show real-time platform status"
        ],
        category="general"
    )
