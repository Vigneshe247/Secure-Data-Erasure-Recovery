from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

from backend.app.core.config import settings, BASE_DIR
from backend.app.database.session import async_engine, Base, SyncSessionLocal, sync_engine
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables asynchronously on startup
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize demo data if needed
    try:
        from backend.seed_demo import seed_initial_data
        seed_initial_data()
    except Exception as e:
        print(f"Seed check: {e}")

    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Cybersecurity Platform for Storage-Aware Secure Erasure, Authorized File Recovery & Verification (SIH26149)",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open for development / Vite local dev
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


# Include API Routers
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

FRONTEND_DIST = Path(BASE_DIR).parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Allow requests to API documentation
        if full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None

        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "platform": "DataShield",
            "description": "AI-Assisted Secure Data Erasure + Authorized File Recovery (SIH26149)",
            "status": "OPERATIONAL",
            "docs_url": "/docs",
            "note": "Frontend build not found. Run 'npm run build' in the frontend folder."
        }
