@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul
echo.
echo ========================================
echo   LEVELFORGE - FBX Converter + Unity
echo ========================================
echo.

REM ===== Read config.txt for output path =====
set "UNITY_PATH="
set "CONFIG_FILE=%~dp0config.txt"

if exist "!CONFIG_FILE!" (
    set /p UNITY_PATH=<"!CONFIG_FILE!"
)

if "!UNITY_PATH!"=="" (
    echo [INFO] No Unity path configured - FBX will be created in Level folder only
) else (
    echo [OK] Unity path: !UNITY_PATH!
)
echo.

REM Auto-detect Blender path
set BLENDER_PATH=

REM 1. Steam version
if exist "C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe" (
    set "BLENDER_PATH=C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe"
    goto :found
)
if exist "C:\Program Files\Steam\steamapps\common\Blender\blender.exe" (
    set "BLENDER_PATH=C:\Program Files\Steam\steamapps\common\Blender\blender.exe"
    goto :found
)
if exist "D:\Steam\steamapps\common\Blender\blender.exe" (
    set "BLENDER_PATH=D:\Steam\steamapps\common\Blender\blender.exe"
    goto :found
)
if exist "D:\SteamLibrary\steamapps\common\Blender\blender.exe" (
    set "BLENDER_PATH=D:\SteamLibrary\steamapps\common\Blender\blender.exe"
    goto :found
)
if exist "E:\Steam\steamapps\common\Blender\blender.exe" (
    set "BLENDER_PATH=E:\Steam\steamapps\common\Blender\blender.exe"
    goto :found
)
if exist "E:\SteamLibrary\steamapps\common\Blender\blender.exe" (
    set "BLENDER_PATH=E:\SteamLibrary\steamapps\common\Blender\blender.exe"
    goto :found
)

REM 2. Standard installation
for %%v in (4.3 4.2 4.1 4.0 3.6 3.5 3.4) do (
    if exist "C:\Program Files\Blender Foundation\Blender %%v\blender.exe" (
        set "BLENDER_PATH=C:\Program Files\Blender Foundation\Blender %%v\blender.exe"
        goto :found
    )
)

if exist "C:\Program Files\Blender Foundation\Blender\blender.exe" (
    set "BLENDER_PATH=C:\Program Files\Blender Foundation\Blender\blender.exe"
    goto :found
)

:notfound
echo [ERROR] Blender not found!
echo.
echo Checked locations:
echo   - Steam: C:\Program Files (x86)\Steam\steamapps\common\Blender\
echo   - Standard: C:\Program Files\Blender Foundation\
echo.
echo Enter Blender path manually (or press Enter to cancel):
set /p BLENDER_PATH="Path: "
if "!BLENDER_PATH!"=="" exit /b 1
if not exist "!BLENDER_PATH!" (
    echo [ERROR] File not found: !BLENDER_PATH!
    pause
    exit /b 1
)

:found
echo [OK] Blender: !BLENDER_PATH!
echo.

REM Check JSON file
if "%~1"=="" (
    echo [INFO] No JSON file specified - searching folder...
    "!BLENDER_PATH!" --background --python "%~dp0levelforge_to_fbx.py"
) else (
    echo [INFO] Input file: %~1
    "!BLENDER_PATH!" --background --python "%~dp0levelforge_to_fbx.py" -- "%~1"
)

echo.

REM Find latest FBX file
set "LATEST_FBX="
for /f "delims=" %%i in ('dir /b /o-d "%~dp0*.fbx" 2^>nul') do (
    if not defined LATEST_FBX set "LATEST_FBX=%%i"
)

if not defined LATEST_FBX (
    echo [ERROR] FBX file not found!
    if "%~1"=="" pause
    exit /b 1
)

echo [OK] FBX file: !LATEST_FBX!

REM Copy to Unity if path is configured
if "!UNITY_PATH!"=="" (
    echo [INFO] Skipping Unity copy - no path configured
    goto :done
)

REM Create Unity folder if not exists
if not exist "!UNITY_PATH!" (
    echo [INFO] Creating Unity folder...
    mkdir "!UNITY_PATH!" 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo [WARN] Could not create folder - check path
        goto :done
    )
)

REM Copy FBX (overwrite)
copy /Y "%~dp0!LATEST_FBX!" "!UNITY_PATH!\!LATEST_FBX!" > nul

if !ERRORLEVEL! EQU 0 (
    echo [OK] Copied to Unity!
    echo     - !UNITY_PATH!\!LATEST_FBX!
) else (
    echo [ERROR] Copy failed!
)

:done
echo.
echo ========================================
echo   Done!
echo ========================================

REM Skip pause in auto mode
if "%~1"=="" (
    pause
) else (
    timeout /t 1 /nobreak > nul
)

endlocal
