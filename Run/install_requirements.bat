@echo off
setlocal enabledelayedexpansion

echo Checking system requirements...

set NODE_EXISTS=0
set NPM_EXISTS=0

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set NODE_EXISTS=1
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
)

:: Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set NPM_EXISTS=1
)

if %NODE_EXISTS% equ 1 (
    if %NPM_EXISTS% equ 1 (
        echo.
        echo Requirements (Node.js and npm) already exist and are up to date.
        echo Current Node version: %NODE_VER%
        echo.
    ) else (
        echo Node.js is installed but npm was not found.
        pause
        exit /b 1
    )
) else (
    echo Node.js and npm were not found. 
    echo Please install Node.js (v18+) from https://nodejs.org/
    pause
    exit /b 1
)

echo Installing/Updating project dependencies (node_modules)...
call npm install

if %ERRORLEVEL% equ 0 (
    echo.
    echo --------------------------------------------------
    echo Dependencies installed successfully!
    echo You can now run the project using: Run\launcher.bat
    echo --------------------------------------------------
    echo.
) else (
    echo.
    echo Error occurred during npm install. Please check the logs above.
    echo.
)

pause
