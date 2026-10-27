# Runs the built production server on port 8009 and restarts it if it exits.
# Used by the startup Scheduled Task (see install-startup.ps1); can also be run
# by hand. Build first with `pnpm build`.
#
# Output goes to logs/server.log (overwritten on each start of this script).

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$entry = Join-Path $root '.output\server\index.mjs'
if (-not (Test-Path $entry)) {
  throw "No build found at $entry - run 'pnpm build' first."
}

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'server.log'

# Stopping the Scheduled Task kills this script but not its node child, so
# clear out any server a previous run left holding the port.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*$entry*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# Decode node's output as UTF-8 so the log isn't mojibake.
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$env:NODE_ENV = 'production'
$env:PORT = '8009'

"[$(Get-Date -Format s)] start.ps1 starting server on port $env:PORT" |
  Out-File $log -Encoding utf8

while ($true) {
  # Node writes to stderr for warnings; don't let that stop the loop.
  $ErrorActionPreference = 'Continue'
  & node --env-file-if-exists=.env.local $entry 2>&1 |
    Out-File $log -Append -Encoding utf8
  $code = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'

  "[$(Get-Date -Format s)] server exited with code $code, restarting in 5s" |
    Out-File $log -Append -Encoding utf8
  Start-Sleep -Seconds 5
}
