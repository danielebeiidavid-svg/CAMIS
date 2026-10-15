@echo off
title CAMIS Automatic Search Launcher
cd /d "%~dp0"
echo Starting CAMIS Automatic Search Launcher...
echo.
node camis-search-launcher.js
echo.
echo Launcher stopped.
pause
