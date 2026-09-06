$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$nodePath = (Get-Command node).Source
try { $healthy = (Invoke-RestMethod http://localhost:8001/__dev-auth-health -TimeoutSec 10).ok } catch { $healthy = $false }
if ($healthy) { & $nodePath scripts/verify-local-source.js --url http://localhost:8001 --require-auth-egress; exit $LASTEXITCODE }
$listener = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  & $nodePath scripts/verify-local-source.js --url http://localhost:8001
  if ($LASTEXITCODE -ne 0) { throw 'Na 8001 je drug projekt.' }
  $running = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener[0].OwningProcess)
  if ($running.CommandLine -notlike '*local-server.js*--port 8001*') { throw 'Nepričakovan proces na 8001.' }
  & taskkill /PID $running.ProcessId /F
  if ($LASTEXITCODE -ne 0) { throw 'Ustavitev ni uspela.' }
}
Start-Process -FilePath $nodePath -ArgumentList 'scripts/local-server.js','--port','8001' -WorkingDirectory $projectRoot -WindowStyle Hidden
Start-Sleep -Seconds 2
& $nodePath scripts/verify-local-source.js --url http://localhost:8001 --require-auth-egress
exit $LASTEXITCODE
