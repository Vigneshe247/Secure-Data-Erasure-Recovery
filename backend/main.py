"""
DataShield Backend Entry Point
Allows starting the FastAPI server directly with:
    python main.py
or
    python -m uvicorn main:app --reload
from within the backend directory.
"""
import sys
from pathlib import Path

# Add project root directory to sys.path
_root = str(Path(__file__).resolve().parent.parent)
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.app.main import app  # noqa: F401

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("  DataShield FastAPI Backend Service starting on http://127.0.0.1:8000")
    print("  API Documentation: http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
