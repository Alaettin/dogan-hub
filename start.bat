@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo   MyHub - Starte Dev-Server
echo ============================================
echo.

if not exist "backend\node_modules" (
    echo [backend] node_modules fehlt - installiere...
    pushd backend
    call npm install --no-audit --no-fund
    popd
)

if not exist "frontend\node_modules" (
    echo [frontend] node_modules fehlt - installiere...
    pushd frontend
    call npm install --no-audit --no-fund
    popd
)

echo.
echo Starte Backend  -^> http://localhost:4000
echo Starte Frontend -^> http://localhost:5173
echo.
echo Tipp: Beide Fenster mit Strg+C beenden.
echo.

REM /D setzt das Working-Directory ohne cd zu brauchen.
REM cmd /k haelt das Fenster offen, auch wenn npm crasht.
start "MyHub Backend"  /D "%~dp0backend"  cmd /k npm run dev
start "MyHub Frontend" /D "%~dp0frontend" cmd /k npm run dev

endlocal
