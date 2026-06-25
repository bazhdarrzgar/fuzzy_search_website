@echo off
echo Building the application for production...
call nub run build

if %ERRORLEVEL% equ 0 (
    echo Build successful! Starting production server...
    call nub run start
) else (
    echo Build failed. Please check the errors above.
    pause
    exit /b 1
)
