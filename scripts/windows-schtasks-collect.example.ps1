# OPTIONAL fallback only — preferred path is a long-running `pnpm worker`.
# Prefer: pnpm start  +  pnpm worker  (two processes).
# This script registers a Scheduled Task that starts the worker if you cannot keep a daemon.
# Edit $ProjectRoot then run in elevated PowerShell once.

$ProjectRoot = "E:\wwwroot\ai-price-radar"
$TaskName = "AIPriceRadar-Worker"
$Pnpm = (Get-Command pnpm -ErrorAction SilentlyContinue)?.Source
if (-not $Pnpm) { throw "pnpm not found on PATH" }

# Long-running worker (exits only on stop). If the task already has a running instance, skip starting another.
$Args = "worker"

$Action = New-ScheduledTaskAction -Execute $Pnpm -Argument $Args -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force
Write-Host "Registered $TaskName to start pnpm worker at logon/startup in $ProjectRoot"
Write-Host "Optional: PROXY_API_URL or PROXY_URL in .env.local for 链动; PREWARM_BASE_URL for cache refresh."
