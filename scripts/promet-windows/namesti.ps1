# Namesti samodejni zagon napovedi prometa na tem racunalniku (Windows).
#   - zbiralnik vsakih 15 minut
#   - izracun profila enkrat na dan (02:41; ce je racunalnik izklopljen, takoj ob naslednjem zagonu)
# Podatki: <repo>\.promet-podatki   Dnevnik: <repo>\.promet-podatki\promet.log
# Zagon:   powershell -ExecutionPolicy Bypass -File scripts\promet-windows\namesti.ps1

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$mapa = Join-Path $repo ".promet-podatki"
$dnevnik = Join-Path $mapa "promet.log"

$nodeUkaz = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeUkaz) { throw "Node.js ni najden. Namesti Node.js LTS (https://nodejs.org) in ponovi." }
$node = $nodeUkaz.Source

if (-not (Test-Path (Join-Path $repo "node_modules\luxon"))) {
  Write-Host "Namescam odvisnosti (npm install)..."
  Push-Location $repo
  try { npm install --no-audit --no-fund | Out-Null } finally { Pop-Location }
}
New-Item -ItemType Directory -Force -Path $mapa | Out-Null

function Opravilo($ime, $skripta, $sprozilec, $opis) {
  $ukaz = "/c cd /d `"$repo`" && `"$node`" scripts\$skripta >> `"$dnevnik`" 2>&1"
  $akcija = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $ukaz -WorkingDirectory $repo
  $nastavitve = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
  # S4U: tece tudi, ko uporabnik ni prijavljen, in brez utripajocega okna.
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Limited
  try {
    Register-ScheduledTask -TaskName $ime -Action $akcija -Trigger $sprozilec -Settings $nastavitve -Principal $principal -Description $opis -Force | Out-Null
  } catch {
    Write-Warning "Opravila '$ime' ni bilo mogoce namestiti v ozadju (za to so potrebne skrbniske pravice). Namescam ga za prijavljenega uporabnika; ob zagonu se lahko za trenutek pokaze okno."
    Register-ScheduledTask -TaskName $ime -Action $akcija -Trigger $sprozilec -Settings $nastavitve -Description $opis -Force | Out-Null
  }
  Write-Host "Namesceno: $ime"
}

$zacetek = (Get-Date).Date.AddHours((Get-Date).Hour).AddMinutes([math]::Ceiling((Get-Date).Minute / 15) * 15)
$vsakih15 = New-ScheduledTaskTrigger -Once -At $zacetek -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
Opravilo "UspesniJezek-Promet-Zbiralnik" "promet-zbiralnik.js" $vsakih15 "Zajem zastojev (Autobahn, DARS) vsakih 15 minut."

$dnevno = New-ScheduledTaskTrigger -Daily -At "02:41"
Opravilo "UspesniJezek-Promet-Profil" "promet-profil.js" $dnevno "Dnevni izracun profila zastojev iz zadnjih 56 dni."

Write-Host ""
Write-Host "Prvi zajem zdaj..."
Start-ScheduledTask -TaskName "UspesniJezek-Promet-Zbiralnik"
Start-Sleep -Seconds 20
if (Test-Path $dnevnik) { Get-Content $dnevnik -Tail 4 }
Write-Host ""
Write-Host "Stanje kadarkoli:  node scripts\promet-stanje.js"
Write-Host "Odstranitev:       powershell -ExecutionPolicy Bypass -File scripts\promet-windows\odstrani.ps1"
