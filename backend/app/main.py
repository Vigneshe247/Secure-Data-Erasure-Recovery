import sys
import os
import asyncio
from pathlib import Path

# Add project root directory to sys.path so imports work regardless of launch directory
_root = str(Path(__file__).resolve().parent.parent.parent)
if _root not in sys.path:
    sys.path.insert(0, _root)

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.core.config import settings, BASE_DIR
from backend.app.database.session import async_engine, Base, SyncSessionLocal, sync_engine, AsyncSessionLocal
from backend.app.api.auth import router as auth_router
from backend.app.api.users import router as users_router
from backend.app.api.storage import router as storage_router
from backend.app.api.recovery import router as recovery_router
from backend.app.api.erasure import router as erasure_router
from backend.app.api.verification import router as verification_router
from backend.app.api.audit import router as audit_router
from backend.app.api.reports import router as reports_router
from backend.app.api.dashboard import router as dashboard_router
from backend.app.api.assistant import router as assistant_router
from backend.app.api.ws import router as ws_router
# Enterprise governance routers
from backend.app.api.files import router as files_router
from backend.app.api.admin import router as admin_router
from backend.app.api.forensic import router as forensic_router

# Import enterprise models so they are registered with Base.metadata
from backend.app.models.enterprise_models import EnterpriseFile, RecoveryRequest, AuditBlock


async def _retention_worker():
    """Background task: check and purge expired retention files every hour."""
    from backend.app.services.retention_service import RetentionService
    while True:
        try:
            await asyncio.sleep(3600)  # Every hour
            async with AsyncSessionLocal() as db:
                purged = await RetentionService.check_and_purge_expired(db)
                if purged:
                    print(f"[RETENTION] Auto-purged {len(purged)} expired files")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[RETENTION] Error in retention worker: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables asynchronously on startup (includes new enterprise tables)
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize demo data if needed
    try:
        from backend.seed_demo import seed_initial_data
        seed_initial_data()
    except Exception as e:
        print(f"Seed check: {e}")

    # Start retention automation background task
    retention_task = asyncio.create_task(_retention_worker())

    yield

    # Cancel retention worker on shutdown
    retention_task.cancel()
    try:
        await retention_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Zero-Trust Data Lifecycle & Forensic Governance Platform — Controlled Deletion, Admin-Only Recovery, Secure Erasure, Tamper-Evident Audit (SIH26149)",
    lifespan=lifespan,
)

# CORS Middleware - allows any localhost/127.0.0.1 port for Vite dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": str(exc),
        },
    )


# Include API Routers — existing
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(storage_router, prefix=settings.API_V1_STR)
app.include_router(recovery_router, prefix=settings.API_V1_STR)
app.include_router(erasure_router, prefix=settings.API_V1_STR)
app.include_router(verification_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(reports_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(assistant_router, prefix=settings.API_V1_STR)
app.include_router(ws_router, prefix=settings.API_V1_STR)
# Include API Routers — enterprise governance
app.include_router(files_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(forensic_router, prefix=settings.API_V1_STR)

FRONTEND_DIST = Path(BASE_DIR).parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Do not intercept API or docs routes
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API route not found")
        if full_path.startswith("docs") or full_path.startswith("openapi.json") or full_path.startswith("redoc"):
            raise HTTPException(status_code=404, detail="Not Found")

        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "platform": "DataShield",
            "description": "Zero-Trust Data Lifecycle & Forensic Governance Platform (SIH26149)",
            "status": "OPERATIONAL",
            "docs_url": "/docs",
            "note": "Frontend build not found. Run 'npm run build' in the frontend folder."
        }


