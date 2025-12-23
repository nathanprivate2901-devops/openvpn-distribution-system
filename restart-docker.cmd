@echo off
echo ============================================================
echo Restarting Docker Desktop
echo ============================================================
echo.

echo Step 1: Stopping Docker Desktop...
taskkill /F /IM "Docker Desktop.exe" 2>nul
timeout /t 5 /nobreak >nul

echo Step 2: Waiting for processes to stop...
timeout /t 10 /nobreak >nul

echo Step 3: Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo.
echo Step 4: Waiting for Docker Desktop to initialize...
echo This may take 30-60 seconds...
timeout /t 30 /nobreak >nul

echo.
echo Step 5: Testing Docker engine...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo SUCCESS: Docker engine is accessible!
    echo.
    docker ps
) else (
    echo WARNING: Docker engine not yet ready. Wait 30 more seconds and run:
    echo    docker ps
)

echo.
echo ============================================================
echo Docker Desktop restart complete
echo ============================================================
pause
