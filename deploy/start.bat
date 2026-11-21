@echo off
setlocal
cd /d "%~dp0"

rem ============================================================
rem  HuaYuZhu Tab - start the offline relay node (Windows entry)
rem  It just calls the real deploy script inside the package.
rem  Keep all output in ASCII: cmd.exe reads this file as GBK.
rem ============================================================

echo.
echo [HuaYuZhu Tab] Offline relay node
echo ------------------------------------------------------------
echo Package: .\\huayuzhu-relay-offline
echo.

where bash >nul 2>&1
if errorlevel 1 (
  echo Git Bash not found. On Windows install Git, or run ./start.sh on Linux.
  goto fail
)

if not exist "huayuzhu-relay-offline\\deploy.sh" (
  echo deploy.sh not found in huayuzhu-relay-offline directory.
  goto fail
)

bash huayuzhu-relay-offline/deploy.sh
if errorlevel 1 goto fail
echo.
echo Started. Manage at http://^<server-ip^>:8787/admin
echo ------------------------------------------------------------
pause
exit /b 0

:fail
echo.
echo Failed to start. Check Docker Desktop and .env settings.
echo ------------------------------------------------------------
pause
exit /b 1
