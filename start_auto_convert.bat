@echo off
echo.
echo Starting LEVELFORGE Auto Converter...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0auto_convert.ps1"
pause
