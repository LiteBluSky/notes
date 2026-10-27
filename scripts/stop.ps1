# Stops the server started by start.ps1: first the restart loop, then node.
# Stopping the Scheduled Task alone isn't enough - it only kills the conhost
# wrapper, leaving start.ps1 and node running. Used by install-startup.ps1 and
# uninstall-startup.ps1; safe to run when nothing is running.

$ErrorActionPreference = 'Stop'

$startScript = Join-Path $PSScriptRoot 'start.ps1'
$entry = Join-Path (Split-Path -Parent $PSScriptRoot) '.output\server\index.mjs'

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like "*$startScript*" } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    Write-Host "Stopped start.ps1 (pid $($_.ProcessId))."
  }

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*$entry*" } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    Write-Host "Stopped server (pid $($_.ProcessId))."
  }
