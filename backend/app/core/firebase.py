import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger("datashield.firebase")

# Project settings — reads from environment (set in .env or system env)
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "delete-and-recovery")
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Search candidates for Firebase service account key JSON
# Priority: env var → project-local paths → user downloads
_env_cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
KEY_CANDIDATES = []
if _env_cred_path:
    KEY_CANDIDATES.append(Path(_env_cred_path))
KEY_CANDIDATES += [
    BASE_DIR / "serviceAccountKey.json",
    BASE_DIR / "credentials.json",
    BASE_DIR.parent / "serviceAccountKey.json",
    BASE_DIR.parent / "credentials.json",
    Path("C:/Users/E VIGNESH/Downloads/serviceAccountKey.json"),
    Path("C:/Users/E VIGNESH/Downloads/credentials.json"),
    Path("C:/Users/SHARMILA/Downloads/serviceAccountKey.json"),
    Path("C:/Users/SHARMILA/Downloads/credentials.json"),
    # Generic user Downloads fallback
    Path.home() / "Downloads" / "serviceAccountKey.json",
    Path.home() / "Downloads" / "credentials.json",
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
                logger.info(f"Found Firebase service account key at: {cert_path}")
                break

        if cert_path:
            logger.info(f"Initializing Firebase Admin with service account: {cert_path}")
            cred = credentials.Certificate(str(cert_path))
            _firebase_app = firebase_admin.initialize_app(cred, {
                "projectId": FIREBASE_PROJECT_ID,
            })
        else:
            logger.warning(
                f"No serviceAccountKey.json found. Attempting Firebase Admin with default credentials. "
                f"Place serviceAccountKey.json at: {BASE_DIR / 'serviceAccountKey.json'}"
            )
            # Fallback: use Application Default Credentials (ADC) or project-only init
            _firebase_app = firebase_admin.initialize_app(options={
                "projectId": FIREBASE_PROJECT_ID,
            })

        _is_initialized = True
        try:
            _firestore_db = firestore.client()
            logger.info("✅ Firestore client initialized successfully.")
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


async def sync_user_to_firestore(user_data: Dict[str, Any]) -> bool:
    """
    Creates or updates a user document in Firestore 'users' collection.
    Called on login and registration to keep Firebase Auth and Firestore in sync.

    user_data should contain: uid (str), email, username, role, full_name,
                               last_login (ISO string), is_active
    """
    try:
        db = get_firestore_client()
        if not db:
            return False

        uid = user_data.get("uid") or user_data.get("id")
        if not uid:
            logger.warning("sync_user_to_firestore: no uid provided, skipping.")
            return False

        doc_data = {
            **user_data,
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "source": "backend_api",
        }
        # Firestore does not accept None values; clean them out
        cleaned = {k: v for k, v in doc_data.items() if v is not None}

        db.collection("users").document(str(uid)).set(cleaned, merge=True)
        logger.info(f"✅ Synced user '{user_data.get('username')}' to Firestore users/{uid}")
        return True
    except Exception as err:
        logger.warning(f"Firestore user sync fallback (non-blocking): {err}")
        return False


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
