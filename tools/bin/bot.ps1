# bot.ps1 - the on/off switch for the triage bot.
#
# One scheduled task PER CHANNEL, so start and stop take the same -Channels argument and each
# channel is independent. With no -Channels, both act on every channel marked enabled in
# config/channel.json, which stays the per-channel default.
#
#   .\tools\bin\bot.ps1 start                          # start every enabled channel
#   .\tools\bin\bot.ps1 start -Channels pwa-testnet    # start just that one
#   .\tools\bin\bot.ps1 stop  -Channels pwa-testnet    # stop just that one
#   .\tools\bin\bot.ps1 stop                           # stop everything
#   .\tools\bin\bot.ps1 status                         # every channel and its own state
#   .\tools\bin\bot.ps1 run   -Channels pwa-testnet    # one pass now, no scheduling
#   .\tools\bin\bot.ps1 run   -Channels pwa-testnet -DryRun
#
# ASCII only on purpose: Windows PowerShell 5.1 reads .ps1 as ANSI when there is no BOM, and a
# stray em-dash is enough to corrupt the quoting and break the parser.

param(
  [Parameter(Position = 0)]
  [ValidateSet("start", "stop", "status", "run")]
  [string]$Action = "status",

  [string]$Channels = "",
  [int]$Every = 15,
  # Work hours. The first run of the day is what attests to everything that ran overnight, so it
  # sits at the start of the day rather than whenever the bot happened to be switched on.
  [string]$At = "08:00",
  # Empty means never stop: repeat round the clock. Give a time (e.g. 17:30) to confine the bot
  # to working hours instead - but then anything that runs overnight waits until the next -At.
  [string]$Until = "",
  [switch]$IncludeDispatch,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..") | Select-Object -ExpandProperty Path
$worker = Join-Path $root "tools\bin\watch-task.ps1"
$launcher = Join-Path $root "tools\bin\run-hidden.vbs"
$prefix = "QA Triage Bot"

function Get-Channels {
  $cfgPath = Join-Path $root "config\channel.json"
  if (-not (Test-Path -LiteralPath $cfgPath)) { throw "config/channel.json not found" }
  (Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json).channels
}

function Resolve-Keys {
  param([string]$Spec, [switch]$AllWhenEmpty)
  $all = Get-Channels
  if ($Spec) {
    $want = $Spec -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $bad = $want | Where-Object { $all.key -notcontains $_ }
    if ($bad) { throw "Unknown channel key(s): $($bad -join ', '). Known: $($all.key -join ', ')" }
    return $want
  }
  if ($AllWhenEmpty) {
    # "start" with no -Channels means every channel. Reading it as "only the enabled ones" is the
    # kind of surprise that leaves a channel silently unstarted; the enabled flag governs what the
    # rest of the toolchain treats as its daily set, not what this switch turns on.
    return $all.key
  }
  return @()
}

function Task-Name { param([string]$Key) "$prefix - $Key" }

function Get-BotTasks {
  Get-ScheduledTask -TaskName "$prefix*" -ErrorAction SilentlyContinue
}

if ($Action -eq "start") {
  $keys = Resolve-Keys -Spec $Channels -AllWhenEmpty
  if (-not $keys) { Write-Output "No channels to start."; return }

  foreach ($key in $keys) {
    # Go through wscript rather than powershell.exe directly: a task that launches PowerShell
    # flashes a console for a moment even with -WindowStyle Hidden, and six channels on a
    # 15-minute cycle makes that constant. wscript has no console of its own.
    $argList = "`"$launcher`" $key"
    if ($IncludeDispatch) { $argList = $argList + " -IncludeDispatch" }

    $a = New-ScheduledTaskAction -Execute "wscript.exe" -Argument $argList -WorkingDirectory $root
    # StartWhenAvailable is what makes it resume after the machine has been off, with no logon
    # trigger: the run missed while it was off is simply caught up.
    $s = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    # Stagger the starts so six channels do not all hit Slack in the same second.
    $offset = ([array]::IndexOf($keys, $key)) * 20
    $startAt = ([datetime]::Today + [timespan]::Parse($At)).AddSeconds($offset)

    if ($Until) {
      $span = [timespan]::Parse($Until) - [timespan]::Parse($At)
      if ($span.TotalMinutes -le 0) { throw "-Until ($Until) must be later than -At ($At)" }
      # Confined to a window: a daily trigger at -At, repeating until -Until. Task Scheduler needs
      # the repetition copied off a Once trigger; a Daily trigger cannot be given one directly.
      $t = New-ScheduledTaskTrigger -Daily -At $startAt
      $t.Repetition = (New-ScheduledTaskTrigger -Once -At $startAt `
          -RepetitionInterval (New-TimeSpan -Minutes $Every) `
          -RepetitionDuration $span).Repetition
    }
    else {
      # Round the clock. A Once trigger with no duration repeats for ever, so there is no gap
      # overnight - an 01:00 regression failure is answered at 02:00, not at 08:00 tomorrow.
      $t = New-ScheduledTaskTrigger -Once -At $startAt -RepetitionInterval (New-TimeSpan -Minutes $Every)
    }

    Register-ScheduledTask -TaskName (Task-Name $key) -Action $a -Trigger $t -Settings $s -Force -Description "Triage bot for $key" | Out-Null
    $i = Get-ScheduledTaskInfo -TaskName (Task-Name $key)
    $window = if ($Until) { "$At-$Until" } else { "from $At, round the clock" }
    Write-Output ("STARTED  {0,-20} {1}, every {2} min, next {3}" -f $key, $window, $Every, $i.NextRunTime)
  }
}
elseif ($Action -eq "stop") {
  $keys = Resolve-Keys -Spec $Channels
  $tasks = Get-BotTasks
  if (-not $tasks) { Write-Output "Nothing set up - nothing to stop."; return }

  if (-not $keys) {
    # No -Channels: stop everything that exists, not just the enabled ones. A channel left
    # running because it was disabled in config after being started is exactly the surprise
    # this avoids.
    foreach ($t in $tasks) {
      if ($t.State -ne "Disabled") { Disable-ScheduledTask -TaskName $t.TaskName | Out-Null }
      Write-Output ("STOPPED  {0}" -f ($t.TaskName -replace [regex]::Escape("$prefix - "), ""))
    }
    return
  }

  foreach ($key in $keys) {
    $name = Task-Name $key
    if (-not (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue)) {
      Write-Output ("(not set up) {0}" -f $key)
      continue
    }
    Disable-ScheduledTask -TaskName $name | Out-Null
    Write-Output ("STOPPED  {0}" -f $key)
  }
}
elseif ($Action -eq "status") {
  $all = Get-Channels
  $tasks = Get-BotTasks
  Write-Output "  CHANNEL              CONFIG   BOT        EVERY   LAST RUN             NEXT RUN"
  foreach ($c in $all) {
    $cfgState = if ($c.enabled -eq $false) { "off" } else { "ON " }
    $t = $tasks | Where-Object { $_.TaskName -eq (Task-Name $c.key) }
    if (-not $t) {
      Write-Output ("  {0,-20} {1}      {2,-10} {3,-7} {4,-20} {5}" -f $c.key, $cfgState, "-", "-", "-", "-")
      continue
    }
    $i = Get-ScheduledTaskInfo -TaskName $t.TaskName
    $state = if ($t.State -eq "Disabled") { "stopped" } else { "RUNNING" }
    # ISO-8601 durations: PT15M, PT2H, PT1H30M. Render them as plain minutes.
    $iv = $t.Triggers[0].Repetition.Interval
    $h = if ($iv -match "(\d+)H") { [int]$matches[1] } else { 0 }
    $m = if ($iv -match "(\d+)M") { [int]$matches[1] } else { 0 }
    $mins = $h * 60 + $m
    # A task that has never run reports 1899-11-30 and result 267011 ("not yet run"), which reads
    # as a real run at a nonsense date unless it is caught here.
    $ran = $i.LastRunTime -and $i.LastRunTime.Year -gt 2000
    $code = switch ($i.LastTaskResult) { 0 { "ok" } 267009 { "running" } 267011 { "never" } default { "ERR $($i.LastTaskResult)" } }
    $last = if ($ran) { "{0} {1}" -f $i.LastRunTime.ToString("MM-dd HH:mm"), $code } else { "never" }
    $next = if ($t.State -ne "Disabled" -and $i.NextRunTime) { $i.NextRunTime.ToString("MM-dd HH:mm") } else { "-" }
    Write-Output ("  {0,-20} {1}      {2,-10} {3,-7} {4,-20} {5}" -f $c.key, $cfgState, $state, "$mins m", $last, $next)
  }
  Write-Output ""

  # A bot that stops working silently is worse than no bot: the channel still looks answered
  # because yesterday's notes are sitting there. Check the credential itself, not just whether
  # the task ran. Local output only - nothing is sent anywhere.
  $tok = [Environment]::GetEnvironmentVariable("SLACK_BOT_TOKEN", "User")
  if (-not $tok) {
    Write-Output "  TOKEN: NOT SET - nothing can post. setx SLACK_BOT_TOKEN `"xoxb-...`""
  }
  else {
    try {
      $auth = Invoke-RestMethod -Uri "https://slack.com/api/auth.test" -Headers @{ Authorization = "Bearer $tok" } -Method Post -TimeoutSec 10
      if ($auth.ok) { Write-Output "  TOKEN: ok - $($auth.user) in $($auth.team)" }
      else { Write-Output "  TOKEN: BROKEN - Slack says '$($auth.error)'. Every run fails until this is fixed." }
    }
    catch {
      Write-Output "  TOKEN: could not be checked - $($_.Exception.Message)"
    }
  }

  # Surface failing channels here rather than leaving them to be found in the log by chance.
  $bad = @()
  foreach ($c in $all) {
    $t = $tasks | Where-Object { $_.TaskName -eq (Task-Name $c.key) }
    if (-not $t -or $t.State -eq "Disabled") { continue }
    $i = Get-ScheduledTaskInfo -TaskName $t.TaskName
    # 267009 = currently running, 267011 = has not run yet. Neither is a failure.
    $benign = @(0, 267009, 267011)
    if ($i.LastRunTime -and $i.LastRunTime.Year -gt 2000 -and $benign -notcontains $i.LastTaskResult) { $bad += $c.key }
  }
  if ($bad.Count -gt 0) { Write-Output "  FAILING: $($bad -join ', ') - last run did not exit 0, see the log" }
  else { Write-Output "  FAILING: none" }

  Write-Output ""
  Write-Output "  CONFIG = enabled flag in config/channel.json (what plain 'start' picks up)"
  Write-Output "  LAST RUN result 0 = ok, anything else = the run failed, check the log"
  $log = Join-Path $root ("reports\watch-log\{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
  if (Test-Path -LiteralPath $log) { Write-Output "  log: $log" }
}
elseif ($Action -eq "run") {
  $p = @("-ExecutionPolicy", "Bypass", "-File", $worker)
  if ($Channels) { $p = $p + @("-Channels", $Channels) }
  if ($IncludeDispatch) { $p = $p + "-IncludeDispatch" }
  if ($DryRun) { $p = $p + "-DryRun" }
  & powershell.exe @p
}
