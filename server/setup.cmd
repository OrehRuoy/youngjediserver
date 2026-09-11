@echo off
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js not found. Install from https://nodejs.org and ensure node is in your PATH.
  exit /b 1
)
echo Installing dependencies...
call npm install
if errorlevel 1 exit /b 1
echo Building TypeScript...
call npm run build
if errorlevel 1 exit /b 1
echo Setup complete. Run: npm start
