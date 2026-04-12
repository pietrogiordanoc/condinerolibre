param(
  [ValidateSet('home','modhome','portal')]
  [string]$Page = 'home',
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$urls = @{
  home = "http://127.0.0.1:$Port/index.html"
  modhome = "http://127.0.0.1:$Port/modulo%20home/index.html"
  portal = "http://127.0.0.1:$Port/cdl-portal/index.html"
}

# Free the port if it is occupied by an old local session.
$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($connections) {
  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    try {
      Stop-Process -Id $pid -Force -ErrorAction Stop
      Write-Host "Stopped process on port $Port (PID: $pid)"
    } catch {
      Write-Warning "Could not stop PID $pid."
    }
  }
}

Write-Host "Opening $($urls[$Page])"
Start-Process $urls[$Page]

Write-Host "Starting local server on port $Port..."
npx --yes http-server -p $Port -c-1
