import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SANDBOX_DIR = BASE_DIR / "sandbox_storage"
RECOVERED_FILES_DIR = BASE_DIR / "recovered_files"
REPORTS_DIR = BASE_DIR / "generated_reports"

# Ensure directories exist
SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
RECOVERED_FILES_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True)

    PROJECT_NAME: str = "DataShield — AI-Assisted Secure Data Erasure & File Recovery Platform"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "datashield-sih2026-super-secret-jwt-key-change-in-prod-99x2"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for demo

    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR}/datashield.db"
    SYNC_DATABASE_URL: str = f"sqlite:///{BASE_DIR}/datashield.db"

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    SANDBOX_PATH: Path = SANDBOX_DIR
    RECOVERED_PATH: Path = RECOVERED_FILES_DIR
    REPORTS_PATH: Path = REPORTS_DIR

    # Firebase configuration (optional cloud sync)
    FIREBASE_ENABLED: bool = False
    FIREBASE_PROJECT_ID: str = "datashield-sih2026"


settings = Settings()
