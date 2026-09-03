@echo off
title DataShield - Launch All Services
echo ======================================================================
echo           DataShield Cybersecurity Platform (SIH26149)
echo ======================================================================
echo.
echo Starting Backend Server (FastAPI on http://127.0.0.1:8000)...
start "DataShield Backend (FastAPI)" cmd /k "cd /d ""%~dp0"" && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Frontend Server (Vite React)...
start "DataShield Frontend (Vite)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo Both services are starting in separate windows.
echo - Backend API:  http://127.0.0.1:8000
echo - Swagger Docs: http://127.0.0.1:8000/docs
echo - Frontend UI:  http://localhost:5176 (or assigned Vite port)
echo.
pause
