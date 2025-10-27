@echo off
echo Updating GitHub repository...
echo.

REM Add all changes
git add .

REM Check if there are any changes to commit
git diff-index --quiet HEAD || (
    REM Commit changes with timestamp
    git commit -m "Auto-update: %date% %time%"
    
    REM Push to GitHub
    echo Pushing changes to GitHub...
    git push origin main
    
    echo.
    echo GitHub repository updated successfully!
) || (
    echo.
    echo No changes to commit. Repository is up to date.
)

echo.
echo Script completed.
pause