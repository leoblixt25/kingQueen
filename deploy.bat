@echo off
REM Sandy Scorekeeper - Quick Deploy Script for Windows

echo ========================================
echo  Sandy Scorekeeper Deployment
echo  Firebase Hosting + Firestore Rules
echo ========================================
echo.

REM Step 1: Check if Firebase CLI is installed
where firebase >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Firebase CLI not installed!
    echo Installing...
    npm install -g firebase-tools
    if errorlevel 1 (
        echo Failed to install Firebase CLI. Please install manually.
        exit /b 1
    )
)

echo ✓ Firebase CLI found
echo.

REM Step 2: Login to Firebase (if not already logged in)
echo Checking Firebase login...
firebase login:list >nul 2>nul
if %errorlevel% neq 0 (
    echo Please login to Firebase...
    firebase login
    if errorlevel 1 (
        echo Firebase login failed.
        exit /b 1
    )
)

echo ✓ Firebase login confirmed
echo.

REM Step 3: Install dependencies
echo Installing dependencies...
npm install
if errorlevel 1 (
    echo Failed to install dependencies.
    exit /b 1
)

echo ✓ Dependencies installed
echo.

REM Step 4: Build the app
echo Building application...
npm run build
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

echo ✓ Build successful
echo.

REM Step 5: Initialize Firebase (if not already initialized)
if not exist "firebase.json" (
    echo Initializing Firebase...
    firebase init hosting --project kingqueen-c3543
    if errorlevel 1 (
        echo Firebase initialization failed.
        exit /b 1
    )
) else (
    echo ✓ Firebase already configured
)
echo.

REM Step 6: Deploy to Firebase
echo ========================================
echo  Deploying to Firebase Hosting...
echo ========================================
echo.

firebase deploy --only hosting --project kingqueen-c3543

if errorlevel 1 (
    echo Deployment failed!
    exit /b 1
)

echo.
echo ========================================
echo  ✓ DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo Your app is now live at:
echo https://kingqueen-c3543.web.app
echo.
echo Next steps:
echo 1. Test all features
echo 2. Check Firebase Console
echo 3. Share with users!
echo.
