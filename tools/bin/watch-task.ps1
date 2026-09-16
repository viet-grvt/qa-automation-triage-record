# watch-task.ps1 — what the scheduled task runs.
#
# Pulls SLACK_BOT_TOKEN from the User environment (setx writes there; a service session does not
# inherit the shell's copy), runs one pass of the watcher, and appends the output to a dated log
# so a silent failure at 03:00 is still readable in the morning.
#
#   Register:  see the schtasks command in the project README
#   By hand:   powershell -ExecutionPolicy Bypass -File tools\bin\watch-task.ps1 -Channels manual-automation

param(
  [string]$Channels = "manual-automation",
  [int]$Limit = 50,
  [switch]$DryRun,
  # Default to cron runs only: a workflow_dispatch run is someone testing by hand, and they do not
  # want a triage reply on it. Pass -IncludeDispatch to answer those too.
  [switch]$IncludeDispatch
)

$ErrorActionPreference = "Stop"
# $PSScriptRoot is <root>\tools\bin, so the project root is two levels up.
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..") | Select-Object -ExpandProperty Path
Set-Location -LiteralPath $root

$env:SLACK_BOT_TOKEN = [Environment]::GetEnvironmentVariable("SLACK_BOT_TOKEN", "User")
if (-not $env:SLACK_BOT_TOKEN) {
  Write-Output "SLACK_BOT_TOKEN is not set at User scope. Run: setx SLACK_BOT_TOKEN `"xoxb-...`""
  exit 2
}

$logDir = Join-Path $root "reports\watch-log"
if (-not (Test-Path -LiteralPath $logDir)) {
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}
$log = Join-Path $logDir ("{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

# NOT $args — that is a PowerShell automatic variable and assigning to it breaks argument passing.
$nodeArgs = @("tools/bin/watch.js", "--channel", $Channels, "--limit", $Limit, "--dump")
if (-not $IncludeDispatch) { $nodeArgs += "--scheduled-only" }
if (-not $DryRun) { $nodeArgs += "--post" }

"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') · channels=$Channels$(if ($DryRun) {' · DRY RUN'}) ===" |
  Out-File -FilePath $log -Append -Encoding utf8

try {
  $out = & node $nodeArgs 2>&1
  $out | Out-File -FilePath $log -Append -Encoding utf8
  $out | Write-Output
} catch {
  "FAILED: $_" | Out-File -FilePath $log -Append -Encoding utf8
  throw
}
