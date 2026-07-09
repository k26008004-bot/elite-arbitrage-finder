# start_env.ps1
# Elite Arbitrage Environment Startup Script for Windows PowerShell
# This automates the startup of your entire workflow (replaces tmux for Windows users).

Write-Host "Starting Elite Arbitrage Development Environment..." -ForegroundColor Cyan

$WorkspacePath = "c:\Users\Administrator\Pictures\ebay dmfjn"
$LandingPagePath = "$WorkspacePath\arbitrage-landing-page"

# 1. Open Cursor IDE
Write-Host "Launching Cursor IDE..." -ForegroundColor Green
# Assuming cursor is in PATH. If not, this might need the full path to cursor.exe
try {
    Start-Process "cursor" -ArgumentList "." -WorkingDirectory $WorkspacePath -NoNewWindow
} catch {
    Write-Host "Cursor CLI not found in PATH. Make sure it's installed." -ForegroundColor Red
}

# 2. Start Vercel Dev Server in a new Windows Terminal tab (or new window)
Write-Host "Starting Vite/React Frontend Server..." -ForegroundColor Green
Start-Process "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$LandingPagePath'; npm run dev" -WorkingDirectory $LandingPagePath

# 3. Open a dedicated Git/Tasks terminal
Write-Host "Opening Git/Tasks Terminal..." -ForegroundColor Green
Start-Process "powershell.exe" -ArgumentList "-NoExit", "-Command", "git status" -WorkingDirectory $WorkspacePath

Write-Host "Environment Successfully Bootstrapped!" -ForegroundColor Cyan
Write-Host "You now have your IDE, Frontend Server, and Task Terminal running simultaneously." -ForegroundColor White
