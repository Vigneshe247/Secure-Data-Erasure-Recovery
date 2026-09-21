import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env file if present
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(str(_env_path))
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SANDBOX_DIR = BASE_DIR / "sandbox_storage"
RECOVERED_FILES_DIR = BASE_DIR / "recovered_files"
REPORTS_DIR = BASE_DIR / "generated_reports"
UPLOADS_DIR = SANDBOX_DIR / "uploads"
DELETED_DIR = SANDBOX_DIR / "deleted"
CERTIFICATES_DIR = BASE_DIR / "certificates"

# Ensure directories exist
SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
RECOVERED_FILES_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DELETED_DIR.mkdir(parents=True, exist_ok=True)
CERTIFICATES_DIR.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

    PROJECT_NAME: str = "DataShield — Zero-Trust Data Lifecycle & Forensic Governance Platform"
    PROJECT_VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "datashield-sih2026-super-secret-jwt-key-change-in-prod-99x2"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for demo

    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR}/datashield.db"
    SYNC_DATABASE_URL: str = f"sqlite:///{BASE_DIR}/datashield.db"

    # All common dev ports + production origins
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:5177",
        "http://127.0.0.1:3000",
    ]

    SANDBOX_PATH: Path = SANDBOX_DIR
    RECOVERED_PATH: Path = RECOVERED_FILES_DIR
    REPORTS_PATH: Path = REPORTS_DIR
    UPLOADS_PATH: Path = UPLOADS_DIR
    DELETED_PATH: Path = DELETED_DIR
    CERTIFICATES_PATH: Path = CERTIFICATES_DIR

    # Enterprise governance configuration
    RETENTION_DAYS: int = 30
    SANDBOX_MODE: bool = True
    UPLOAD_MAX_SIZE: int = 50 * 1024 * 1024  # 50 MB

    # Firebase configuration — must match your Firebase project
    FIREBASE_ENABLED: bool = True
    FIREBASE_PROJECT_ID: str = "delete-and-recovery"


settings = Settings()
