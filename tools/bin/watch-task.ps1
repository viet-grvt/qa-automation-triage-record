# watch-task.ps1 — what the scheduled task runs.
#
# Pulls SLACK_BOT_TOKEN from the User environment (setx writes there; a service session does not
# inherit the shell's copy), runs one pass of the watcher, and appends the output to a dated log
# so a silent failure at 03:00 is still readable in the morning.
#
#   Register:  see the schtasks command in the project README
#   By hand:   powershell -ExecutionPolicy Bypass -File tools\bin\watch-task.ps1 -Channels manual-automation

param(
  # Empty means "whatever config/channel.json marks enabled" — watch.js falls back to those flags
  # when no --channel is passed, which keeps that file the per-channel switch.
  [string]$Channels = "",
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
$nodeArgs = @("tools/bin/watch.js", "--limit", $Limit, "--dump")
if ($Channels) { $nodeArgs += @("--channel", $Channels) }
if (-not $IncludeDispatch) { $nodeArgs += "--scheduled-only" }
if (-not $DryRun) { $nodeArgs += "--post" }

$label = if ($Channels) { $Channels } else { "all enabled" }
"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') channels=$label$(if ($DryRun) {' DRY RUN'}) ===" |
  Out-File -FilePath $log -Append -Encoding utf8

# A bot that dies quietly is worse than no bot: the channel still looks answered because
# yesterday's notes are sitting in it. The alert has to be local - when the Slack token is what
# broke, Slack is exactly the channel that cannot carry the warning.
$flag = Join-Path $logDir "FAILING.txt"

function Notify {
  param([string]$Title, [string]$Body)
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $icon = New-Object System.Windows.Forms.NotifyIcon
    $icon.Icon = [System.Drawing.SystemIcons]::Warning
    $icon.Visible = $true
    $icon.ShowBalloonTip(20000, $Title, $Body, [System.Windows.Forms.ToolTipIcon]::Warning)
    Start-Sleep -Seconds 6
    $icon.Dispose()
  }
  catch {
    # A missing desktop session is not a reason to fail the run; the flag file still records it.
  }
}

$failed = $false
$reason = ""
$text = ""

try {
  # ErrorActionPreference=Stop makes PowerShell throw on node's FIRST stderr line, which is the
  # stack frame ("...watch.js:70"), losing the line that actually names the problem. Relax it just
  # for this call so every stderr line is captured and the Slack error name survives.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $out = & node $nodeArgs 2>&1
  $ErrorActionPreference = $prev

  $text = ($out | Out-String)
  $out | Out-File -FilePath $log -Append -Encoding utf8
  $out | Write-Output
  if ($LASTEXITCODE -ne 0) { $failed = $true; $reason = "watch.js exited $LASTEXITCODE" }
}
catch {
  $ErrorActionPreference = "Stop"
  $failed = $true
  $reason = "$_"
  $text = "$_`n" + ($_.Exception.Message)
  "FAILED: $_" | Out-File -FilePath $log -Append -Encoding utf8
}

# Whichever way it ended, the Slack refusal is named in the text. Prefer that over an exit code
# or a stack frame: "invalid_auth" tells you what to do, "watch.js:70" does not.
foreach ($pat in @("invalid_auth", "not_authed", "token_revoked", "account_inactive", "missing_scope", "not_in_channel", "channel_not_found", "ratelimited")) {
  if ($text -match $pat) { $failed = $true; $reason = $pat; break }
}

if ($failed) {
  $what = switch -Regex ($reason) {
    "invalid_auth|not_authed|token_revoked|account_inactive" {
      "The Slack token is dead - reinstalling the app issues a new one. Nothing will post until SLACK_BOT_TOKEN is updated."
    }
    "missing_scope" { "The app is missing a scope. Add it, then Reinstall to Workspace." }
    "not_in_channel" { "The bot is not in one of its channels. /invite @qauibot there." }
    default { "Run failed: $reason" }
  }
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  [$label]  $reason - $what" |
    Out-File -FilePath $flag -Append -Encoding utf8
  Notify "QA Triage Bot is not working" "$label - $what"
  exit 1
}

# Clear the marker only when this channel is the one that had been failing, so a healthy channel
# does not mask another one that is still broken.
if (Test-Path -LiteralPath $flag) {
  $kept = Get-Content -LiteralPath $flag | Where-Object { $_ -notmatch "\[$label\]" }
  if ($kept) { $kept | Out-File -FilePath $flag -Encoding utf8 }
  else { Remove-Item -LiteralPath $flag -Force }
}
