@echo off
echo ===================================================
echo     ELITE ARBITRAGE CONTINUOUS SYSTEM BOOT
echo ===================================================
echo.
echo Starting Live API Engine (Background Process)...
start "Elite API Engine" cmd /k "cd autoglm-agent && node agent.js"

echo Starting React Dashboard UI...
start "Elite Dashboard" cmd /k "cd arbitrage-landing-page && npm run dev"

echo.
echo System Initialized!
echo The Dashboard is running at http://localhost:5174
echo The API Engine will continuously fetch new products every 15 seconds.
echo.
pause
