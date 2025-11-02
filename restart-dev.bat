@echo off
echo Stopping processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)

echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo Starting Next.js dev server...
npm run dev
