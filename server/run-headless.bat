@echo off
REM Build and run headless bot self-play training.
REM Optional args: [gamesPerBatch] [batches] [promoteRate] [lightDeckId] [darkDeckId]
REM Or set env: HEADLESS_GAMES, HEADLESS_BATCHES, HEADLESS_PROMOTE_RATE, HEADLESS_LIGHT_DECK, HEADLESS_DARK_DECK
cd /d "%~dp0"
call npm run build
if errorlevel 1 exit /b 1
echo.
node dist/headless-runner.js %*
exit /b 0
