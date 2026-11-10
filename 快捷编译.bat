@echo off
setlocal
cd /d "%~dp0"

rem ============================================================
rem  HuaYuZhu Tab - quick build
rem  Builds the chromium folder version and packages it as a zip.
rem  Output: dist\huayuzhu-chromium.zip
rem ============================================================

set NODE_ENV=production
set BUILD_TARGET=chromium

echo [1/3] Building...
call npx webpack
if errorlevel 1 goto fail

echo [2/3] Packaging zip...
if exist "dist\huayuzhu-chromium.zip" del /f /q "dist\huayuzhu-chromium.zip"
pushd "dist\chromium"
tar -a -c -f "..\huayuzhu-chromium.zip" *
set TARRESULT=%errorlevel%
popd
if not "%TARRESULT%"=="0" goto fail

echo [3/3] Done.
echo Output: dist\huayuzhu-chromium.zip
goto end

:fail
echo.
echo *** BUILD FAILED ***
exit /b 1

:end
endlocal
