@echo off
title VELMOR STORE - Local Preview
echo =========================================================
echo    Starting VELMOR STORE Development Server...
echo =========================================================
echo.
python mock_server.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Python not found or server failed.
    echo Please make sure Python 3 is installed.
    pause
)
