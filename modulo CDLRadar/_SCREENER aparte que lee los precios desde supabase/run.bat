@echo off
title Market Screener - Local Server

REM === CONFIG ===
set PORT=5500
set URL=http://localhost:%PORT%

echo ================================
echo   Market Screener - Supabase
echo ================================
echo.

REM === Check Python ===
python --version >nul 2>&1
if errorlevel 1 (
  echo ❌ Python no está instalado o no está en el PATH.
  echo 👉 Descárgalo de https://www.python.org/downloads/
  pause
  exit
)

echo ✅ Python detectado
echo.

REM === Start server ===
echo 🚀 Iniciando servidor en %URL%
echo.
start "" %URL%
python -m http.server %PORT%

pause
