@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is missing. Install Node.js 22.13 or newer, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vinext.cmd" (
  echo Installing project dependencies. This requires internet on the first run.
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. Check your connection and run this file again.
    pause
    exit /b 1
  )
)

echo Open the Local address shown below in your browser, usually http://localhost:5173/
echo Keep this window open during the demo. Press Ctrl+C to stop.
call npm run dev
pause
