@echo off
title VELMOR STORE - Push Changes & Update Domain
echo =========================================================
echo    VELMOR STORE - Push Updates to GitHub & Live Domain
echo =========================================================
echo.
echo Current git status:
git status --short
echo.
set /p commit_msg="Enter description of your updates (Press Enter for default): "
if "%commit_msg%"=="" set commit_msg=Update website design and UI

echo.
echo [+] Staging updated files...
git add .
echo [+] Saving commit: %commit_msg%
git commit -m "%commit_msg%"
echo [+] Pushing to GitHub...
git push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo =========================================================
    echo [SUCCESS] Updates uploaded to GitHub successfully!
    echo =========================================================
) else (
    echo [ERROR] Failed to push to GitHub. Check your internet connection or git login.
)
pause
