@echo off
cd /d "%~dp0backend"
if not exist .venv\Scripts\python.exe python -m venv .venv
if errorlevel 1 goto failed
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto failed
.venv\Scripts\python.exe app.py
goto end
:failed
echo Setup failed. Read the error above.
:end
pause
