@echo off
title Young Jedi TCG Server
cd /d "%~dp0"

echo Building and starting server...
echo (Builds TypeScript, then runs. Default port 49152.)
echo.
call npm run serve
if errorlevel 1 (
  echo.
  echo Failed. Make sure Node.js is installed and you've run: npm install
)

pause
