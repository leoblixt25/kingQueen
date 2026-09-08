@echo off
cd /d "%~dp0.."
echo ============================================
echo  Delete all registered players (admin kept)
echo ============================================
echo.
node scripts-firebase-tools\delete-auth-users.mjs "%USERPROFILE%\Downloads\kingqueen-c3543-firebase-adminsdk-fbsvc-1a3341d699.json"
echo.
pause
