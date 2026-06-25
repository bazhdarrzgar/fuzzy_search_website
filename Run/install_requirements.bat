@echo off
setlocal enabledelayedexpansion

echo Checking system requirements...

set NODE_EXISTS=0
set NUB_EXISTS=0

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set NODE_EXISTS=1
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
)

:: Check for nub
where nub >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set NUB_EXISTS=1
    for /f "tokens=*" %%i in ('nub --version 2^>nul') do set NUB_VER=%%i
)

if %NODE_EXISTS% equ 1 (
    if %NUB_EXISTS% equ 0 (
        echo nub was not found. Attempting to install nub...
        where npm >nul 2>nul
        if %ERRORLEVEL% equ 0 (
            echo Installing nub globally via npm...
            call npm install -g --ignore-scripts=false @nubjs/nub
        ) else (
            echo Installing nub via PowerShell...
            powershell -Command "irm https://nubjs.com/install.ps1 | iex"
        )
        
        :: Re-check nub
        where nub >nul 2>nul
        if %ERRORLEVEL% equ 0 (
            set NUB_EXISTS=1
            for /f "tokens=*" %%i in ('nub --version 2^>nul') do set NUB_VER=%%i
        ) else (
            echo Could not install nub automatically. Please install it manually:
            echo npm install -g @nubjs/nub   OR   irm https://nubjs.com/install.ps1 ^| iex
            pause
            exit /b 1
        )
    )
    
    echo.
    echo Requirements (Node.js and nub) already exist and are up to date.
    echo Current Node version: %NODE_VER%
    echo Current nub version: %NUB_VER%
    echo.
) else (
    echo Node.js was not found. 
    echo Please install Node.js (v18+) from https://nodejs.org/
    pause
    exit /b 1
)

echo Installing/Updating project dependencies (node_modules)...
call nub install

if %ERRORLEVEL% equ 0 (
    echo.
    echo --------------------------------------------------
    echo Dependencies installed successfully!
    echo You can now run the project using: Run\launcher.bat
    echo --------------------------------------------------
    echo.
) else (
    echo.
    echo Error occurred during nub install. Please check the logs above.
    echo.
)

pause
