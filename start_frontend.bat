@echo off
cd /d "%~dp0frontend"
call npm ci
if errorlevel 1 goto failed
call npm run dev
goto end
:failed
echo Setup failed. Read the error above. Use Node.js 22.12 or newer.
:end
pause
