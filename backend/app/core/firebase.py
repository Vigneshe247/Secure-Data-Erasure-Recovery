import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger("datashield.firebase")

# Project settings
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "delete-and-recovery")
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Check for potential service account keys
KEY_CANDIDATES = [
    BASE_DIR / "serviceAccountKey.json",
    BASE_DIR.parent / "serviceAccountKey.json",
    Path("C:/Users/E VIGNESH/Downloads/serviceAccountKey.json"),
    Path("C:/Users/E VIGNESH/Downloads/credentials.json"),
    BASE_DIR / "credentials.json",
]

_firebase_app = None
_firestore_db = None
_is_initialized = False


def initialize_firebase():
    global _firebase_app, _firestore_db, _is_initialized
    if _is_initialized:
        return _firebase_app

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if firebase_admin._apps:
            _firebase_app = firebase_admin.get_app()
            _is_initialized = True
            logger.info("Firebase Admin already initialized.")
            try:
                _firestore_db = firestore.client()
            except Exception as e:
                logger.warning(f"Firestore client init warning: {e}")
            return _firebase_app

        cert_path = None
        for candidate in KEY_CANDIDATES:
            if candidate.exists():
                cert_path = candidate
                break

        if cert_path:
            logger.info(f"Initializing Firebase Admin with service account: {cert_path}")
            cred = credentials.Certificate(str(cert_path))
            _firebase_app = firebase_admin.initialize_app(cred, {
                "projectId": FIREBASE_PROJECT_ID,
            })
        else:
            logger.info(f"Initializing Firebase Admin with project ID: {FIREBASE_PROJECT_ID}")
            # Initialize with default options (compatible with Google Cloud environment or ADC)
            _firebase_app = firebase_admin.initialize_app(options={
                "projectId": FIREBASE_PROJECT_ID,
            })

        _is_initialized = True
        try:
            _firestore_db = firestore.client()
            logger.info("Firestore client initialized successfully.")
        except Exception as e:
            logger.warning(f"Firestore client warning (credentials may need setup): {e}")

        return _firebase_app

    except Exception as err:
        logger.warning(f"Firebase Admin SDK initialization in fallback mode: {err}")
        _is_initialized = False
        return None


# Initialize on module load
initialize_firebase()


def verify_firebase_token(id_token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies a Firebase ID token using firebase_admin.auth.
    Returns decoded token dictionary on success, or None on failure.
    """
    if not id_token:
        return None

    try:
        import firebase_admin
        from firebase_admin import auth

        # If app is initialized, verify with firebase_admin
        if firebase_admin._apps:
            decoded = auth.verify_id_token(id_token, check_revoked=False)
            return decoded
    except Exception as e:
        logger.debug(f"Firebase token verification failed: {e}")

    return None


def get_firestore_client():
    global _firestore_db
    if _firestore_db:
        return _firestore_db
    try:
        import firebase_admin
        from firebase_admin import firestore
        if firebase_admin._apps:
            _firestore_db = firestore.client()
            return _firestore_db
    except Exception:
        pass
    return None


async def sync_audit_event_to_firestore(event_data: Dict[str, Any]) -> bool:
    """
    Replicates an audit event into Firestore collection 'audit_logs'.
    Non-blocking and fails gracefully if offline or unauthenticated.
    """
    try:
        db = get_firestore_client()
        if not db:
            return False

        doc_data = {
            **event_data,
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "source": "backend_api",
        }
        # Clean None values for Firestore
        cleaned = {k: v for k, v in doc_data.items() if v is not None}
        db.collection("audit_logs").add(cleaned)
        return True
    except Exception as err:
        logger.debug(f"Firestore audit sync fallback: {err}")
        return False


async def sync_erasure_record_to_firestore(erasure_data: Dict[str, Any]) -> bool:
    """
    Replicates an erasure operation record into Firestore collection 'erasure_records'.
    """
    try:
        db = get_firestore_client()
        if not db:
            return False

        doc_data = {
            **erasure_data,
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "source": "backend_erasure_engine",
        }
        cleaned = {k: v for k, v in doc_data.items() if v is not None}
        op_id = cleaned.get("operation_id") or cleaned.get("id")
        if op_id:
            db.collection("erasure_records").document(str(op_id)).set(cleaned, merge=True)
        else:
            db.collection("erasure_records").add(cleaned)
        return True
    except Exception as err:
        logger.debug(f"Firestore erasure sync fallback: {err}")
        return False
