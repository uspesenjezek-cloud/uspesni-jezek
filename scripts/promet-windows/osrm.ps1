# Pripravi in zazene lokalni OSRM (pot + cas voznje brez prometa) v Docker Desktop.
#   Slovenija:           powershell -ExecutionPolicy Bypass -File scripts\promet-windows\osrm.ps1 -Drzava SI
#   Nemcija, ena dezela: ... -Drzava DE -Obmocje europe/germany/bayern
#   Cela Nemcija:        ... -Drzava DE -Obmocje europe/germany   (potrebuje ~16 GB RAM in ~1 h)
# SI tece na http://localhost:5000, DE na http://localhost:5001. Docker ga ob zagonu sam znova zazene.

param(
  [ValidateSet("SI", "DE")] [string]$Drzava = "SI",
  [string]$Obmocje = "",
  [switch]$Posodobi
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker ni najden. Namesti Docker Desktop (https://www.docker.com/products/docker-desktop) in ga zazeni."
}
if (-not $Obmocje) { $Obmocje = if ($Drzava -eq "SI") { "europe/slovenia" } else { "europe/germany/bayern" } }

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$mapa = Join-Path $repo (".promet-podatki\osrm\" + $Drzava.ToLower())
New-Item -ItemType Directory -Force -Path $mapa | Out-Null
$ime = ($Obmocje -split "/")[-1]
$pbf = Join-Path $mapa "$ime-latest.osm.pbf"
$slika = "ghcr.io/project-osrm/osrm-backend"
$vrata = if ($Drzava -eq "SI") { 5000 } else { 5001 }
$posoda = "uj-osrm-" + $Drzava.ToLower()

if ($Posodobi -or -not (Test-Path $pbf)) {
  $url = "https://download.geofabrik.de/$Obmocje-latest.osm.pbf"
  Write-Host "Prenasam $url ..."
  Invoke-WebRequest -Uri $url -OutFile $pbf -UseBasicParsing
}

$osrm = Join-Path $mapa "$ime-latest.osrm"
if ($Posodobi -or -not (Test-Path "$osrm.mldgr")) {
  Write-Host "Priprava grafa (lahko traja nekaj minut)..."
  docker run --rm -t -v "${mapa}:/data" $slika osrm-extract -p /opt/car.lua "/data/$ime-latest.osm.pbf"
  if ($LASTEXITCODE -ne 0) { throw "osrm-extract ni uspel (premalo pomnilnika v Docker Desktop?)." }
  docker run --rm -t -v "${mapa}:/data" $slika osrm-partition "/data/$ime-latest.osrm"
  if ($LASTEXITCODE -ne 0) { throw "osrm-partition ni uspel." }
  docker run --rm -t -v "${mapa}:/data" $slika osrm-customize "/data/$ime-latest.osrm"
  if ($LASTEXITCODE -ne 0) { throw "osrm-customize ni uspel." }
}

$ErrorActionPreference = "Continue"
docker rm -f $posoda 2>&1 | Out-Null
docker run -d --name $posoda --restart unless-stopped -p "${vrata}:5000" -v "${mapa}:/data" $slika osrm-routed --algorithm mld "/data/$ime-latest.osrm" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "OSRM streznika ni bilo mogoce zagnati." }
Write-Host "OSRM ($Drzava, $Obmocje) tece na http://localhost:$vrata"
