@echo off
echo Killing processes on ports 3000, 3001, 3002...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000.*LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001.*LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3002.*LISTENING"') do taskkill /F /PID %%a 2>nul

echo Done!
timeout /t 2 /nobreak >nul
