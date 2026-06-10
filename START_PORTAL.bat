@echo off
title SHAMA PREMIUM CHART PORTAL - Starter
color 0b
echo ====================================================
echo   🚀 STARTING SHAMA PREMIUM CHART PORTAL...
echo ====================================================
cd /d "C:\Users\abc\Desktop\SHAMA CHART PORTAL"

if not exist node_modules (
    echo [-] Missing node_modules. Installing dependencies...
    call npm install
)

echo [+] Starting Portal Backend Server (Port 8080)...
start cmd /k "title PORTAL BACKEND & node server.js"

echo [+] Waiting for server to initialize...
timeout /t 3 >nul

echo [+] Opening Secure Login Portal in your browser...
start http://localhost:8080

echo ====================================================
echo   ✅ PORTAL IS ACTIVE!
echo   👉 Share http://localhost:8080 with your clients
echo   👉 Login with Admin Credentials:
echo      - User ID: shama786
echo      - Password: Shama@2024
echo ====================================================
exit
