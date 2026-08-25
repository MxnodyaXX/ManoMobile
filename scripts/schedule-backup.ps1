# Registers the nightly Mano Mobile backup with Windows Task Scheduler.
#
# Run once, from an elevated PowerShell:
#     powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1
#
# Defaults to 10:30pm daily, which is after the shop closes but while the PC is
# usually still on. Change -At below if your hours differ.
#
# -StartWhenAvailable matters more than the exact time: if the PC was off at
# 10:30pm, the task runs at the next opportunity instead of silently skipping a
# day. A backup that only happens when the machine happened to be awake is the
# kind that turns out to be three weeks stale on the day you need it.

param(
    [string]$At      = "22:30",
    [int]$Keep       = 30,
    [string]$TaskName = "ManoMobile Daily Backup"
)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "node was not found on PATH. Install Node.js, or run this from a shell where node works." }

$script = Join-Path $repo "scripts\backup.mjs"
if (-not (Test-Path $script)) { throw "Cannot find $script" }

$logDir = Join-Path $repo "backups\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# cmd wraps the call only so stdout and stderr can be captured to a log; Task
# Scheduler itself records that a task ran, never what it printed, and "why did
# last night's backup fail" is unanswerable without the output.
$logFile = Join-Path $logDir "backup.log"
$cmd     = "/c `"`"$node`" `"$script`" --keep $Keep >> `"$logFile`" 2>&1`""

$action    = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $cmd -WorkingDirectory $repo
$trigger   = New-ScheduledTaskTrigger -Daily -At $At
$settings  = New-ScheduledTaskSettingsSet `
                -StartWhenAvailable `
                -DontStopIfGoingOnBatteries `
                -AllowStartIfOnBatteries `
                -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
                -MultipleInstances IgnoreNew

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop } catch {}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Nightly local backup of the Mano Mobile Supabase database and intake photos." `
    -RunLevel Limited | Out-Null

Write-Host "Registered '$TaskName' - daily at $At, keeping $Keep backups."
Write-Host "Log:     $logFile"
Write-Host "Backups: $(Join-Path $repo 'backups')"
Write-Host ""
Write-Host "Run it now to confirm it works:"
Write-Host "    Start-ScheduledTask -TaskName '$TaskName'"
