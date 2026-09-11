# Young Jedi server setup: install dependencies and build
# Requires Node.js 18+ (https://nodejs.org)

Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Install from https://nodejs.org and ensure 'node' is in your PATH." -ForegroundColor Red
    exit 1
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building TypeScript..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Setup complete. Run: npm start" -ForegroundColor Green
