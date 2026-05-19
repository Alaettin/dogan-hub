@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo   Dogan-Hub - Starte Dev-Server
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
echo Starte Backend  -> http://localhost:4000
echo Starte Frontend -> http://localhost:5173
echo.
echo Tipp: Beide Fenster mit Strg+C beenden.
echo.

start "Dogan-Hub Backend"  cmd /k "cd /d %~dp0backend  && npm run dev"
start "Dogan-Hub Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

endlocal
