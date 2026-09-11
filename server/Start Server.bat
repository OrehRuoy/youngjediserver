@echo off
title Young Jedi TCG Server
cd /d "%~dp0"

echo Syncing cards, building, and starting server...
echo (Default port 49152. Ctrl+C to stop.)
echo.
call npm run serve
if errorlevel 1 (
  echo.
  echo Failed. Make sure Node.js is installed and you've run: npm install
)

pause
