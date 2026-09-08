@echo off
echo ========================================
echo  Push to GitHub
echo ========================================
echo.

echo This script will commit and push all changes to GitHub.
echo.

REM Check if Git is available
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed or not in PATH!
    echo.
    echo Please install Git from: https://git-scm.com/download/win
    echo Or add Git to your system PATH.
    echo.
    echo Alternatively, you can manually push using GitHub Desktop:
    echo 1. Open GitHub Desktop
    echo 2. Open this repository
    echo 3. Commit all changes
    echo 4. Click "Push origin"
    echo.
    pause
    exit /b 1
)

echo Git found! Proceeding...
echo.

REM Navigate to script directory
cd /d "%~dp0"

REM Show current status
echo Current Git Status:
git status
echo.

REM Add all changes
echo Adding all changes...
git add .
echo.

REM Show what will be committed
echo Files to be committed:
git status --short
echo.

REM Ask for confirmation
set /p confirm="Do you want to commit and push? (y/n): "
if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit /b 0
)

REM Get commit message
set /p message="Enter commit message (or press Enter for auto-generated): "
if "%message%"=="" (
    set message=feat: Add pending approval registration, admin approval, and PDF export - %date%
)

echo.
echo Committing changes...
git commit -m "%message%"
if errorlevel 1 (
    echo.
    echo No changes to commit or commit failed.
    pause
    exit /b 1
)

echo.
echo Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo Push failed! You may need to:
    echo 1. Check your internet connection
    echo 2. Verify you have push access to the repository
    echo 3. Pull latest changes first: git pull origin main
    pause
    exit /b 1
)

echo.
echo ========================================
echo  ✓ SUCCESS! Changes pushed to GitHub
echo ========================================
echo.
echo Repository: https://github.com/leoblixt25/sandy-scorekeeper
echo.
pause
