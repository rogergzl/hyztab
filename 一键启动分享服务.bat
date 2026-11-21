@echo off
setlocal
cd /d "%~dp0"

rem ============================================================
rem  HuaYuZhu Tab - one-click temporary link-share relay
rem  Uses the bundled zero-dependency Node server. No extra npm
rem  packages are installed; closing this window stops the relay.
rem ============================================================

if "%SHARE_PORT%"=="" set SHARE_PORT=8787
set SHARE_HOST=0.0.0.0

set "LAN_IP="
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /R /C:"IPv4" ^| findstr /V /C:"127.0.0.1"') do set "LAN_IP=%%i"
set "LAN_IP=%LAN_IP: =%"

echo.
echo [HuaYuZhu Tab] Temporary link-share relay
echo ------------------------------------------------------------
echo Listening: 0.0.0.0:%SHARE_PORT%
if defined LAN_IP (
  echo LAN address: http://%LAN_IP%:%SHARE_PORT%
) else (
  echo No LAN IPv4 found, use: http://127.0.0.1:%SHARE_PORT%
)
echo Paste that address into the extension's Link share settings.
echo Data: share-data\shares.json
echo Close this window to stop the server.
echo ------------------------------------------------------------
echo.

call npm run share-server
if errorlevel 1 goto fail
goto end

:fail
echo Failed to start. Check Node.js and that port %SHARE_PORT% is free.
pause

:end
