@echo off
REM Setup Windows Task Scheduler to auto-kill ghost database connections every 5 minutes

echo Setting up automatic ghost connection cleanup...
echo.

REM Get the current directory
set SCRIPT_PATH=%~dp0auto-kill-ghost-connections.js

echo Script path: %SCRIPT_PATH%
echo.

REM Create scheduled task
schtasks /create /tn "CRM_KillGhostConnections" /tr "node \"%SCRIPT_PATH%\"" /sc minute /mo 5 /f /ru SYSTEM

if %ERRORLEVEL% EQU 0 (
    echo ✅ Scheduled task created successfully!
    echo Task will run every 5 minutes to kill ghost database connections
    echo.
    echo To view the task:
    echo   schtasks /query /tn "CRM_KillGhostConnections"
    echo.
    echo To delete the task:
    echo   schtasks /delete /tn "CRM_KillGhostConnections" /f
    echo.
    echo To run manually:
    echo   node auto-kill-ghost-connections.js
) else (
    echo ❌ Failed to create scheduled task
    echo Please run this script as Administrator
)

pause
