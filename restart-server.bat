@echo off
echo Stopping server on port 3000...

REM Find and kill process on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do (
    echo Killing process %%a on port 3000
    taskkill //F //PID %%a 2>nul
)

echo Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo Starting server on port 3000...
npm run dev
