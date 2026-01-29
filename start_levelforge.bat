@echo off
echo Starting LEVELFORGE...

REM Start watcher in background
start "LEVELFORGE Converter" cmd /c "npm start"

REM Open web app in browser
timeout /t 1 /nobreak > nul
start "" "index.html"

echo.
echo LEVELFORGE started!
echo - Web app opened in browser
echo - Auto converter running in background
