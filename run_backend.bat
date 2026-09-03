@echo off
title DataShield Backend (FastAPI)
echo ======================================================================
echo           Starting DataShield Backend Service (Port 8000)
echo ======================================================================
cd /d "%~dp0"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
