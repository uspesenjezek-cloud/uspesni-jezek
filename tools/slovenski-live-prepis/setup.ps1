param([switch]$Force)

$ErrorActionPreference = "Stop"
$runtimeRelease = "v0.2.0"
$runtimeRepository = "handy-computer/transcribe.cpp"
$runtimeAssetName = "transcribe-native-0.2.0-windows-x86_64-cpu-vulkan.tar.gz"
$modelRepo = "handy-computer/canary-1b-v2-gguf"
$modelName = "canary-1b-v2-Q5_K_M.gguf"
$nemotronRepo = "handy-computer/nemotron-3.5-asr-streaming-0.6b-gguf"
$nemotronName = "nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf"
$dataRoot = if ($env:UJ_SPEECH_HOME) { $env:UJ_SPEECH_HOME } else { Join-Path $env:LOCALAPPDATA "UspesniJezek\speech" }
if (-not $dataRoot) { throw "LOCALAPPDATA ni nastavljen. Nastavite UJ_SPEECH_HOME." }
New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dataRoot "downloads") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dataRoot "model") | Out-Null

function Confirm-Hash([string]$Path, [string]$Expected) {
  if (-not $Expected) { throw "Izdajatelj ni objavil SHA-256 za $Path." }
  $stream = [IO.File]::OpenRead($Path)
  try {
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $actual = ([BitConverter]::ToString($hasher.ComputeHash($stream))).Replace("-", "").ToLowerInvariant() }
    finally { $hasher.Dispose() }
  } finally { $stream.Dispose() }
  if ($actual -ne $Expected.ToLowerInvariant()) { throw "SHA-256 se ne ujema za $Path.`nPričakovano: $Expected`nDejansko: $actual" }
}

function Download-Verified([string]$Url, [string]$Destination, [string]$Sha256) {
  if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
    try { Confirm-Hash $Destination $Sha256; Write-Host "Že preverjeno: $Destination"; return } catch { }
  }
  $partial = "$Destination.partial"
  if ((Test-Path -LiteralPath $partial) -and -not $Force) {
    try {
      Confirm-Hash $partial $Sha256
      Move-Item -Force -LiteralPath $partial -Destination $Destination
      Write-Host "Preverjen je že preneseni začasni arhiv: $Destination"
      return
    } catch { }
  }
  Write-Host "Prenašam: $Destination"
  & curl.exe -L --fail --progress-bar --output $partial $Url
  if ($LASTEXITCODE -ne 0) { throw "Prenos ni uspel: $Url" }
  Confirm-Hash $partial $Sha256
  Move-Item -Force -LiteralPath $partial -Destination $Destination
}

Write-Host "Preverjam uradni transcribe.cpp Windows CPU+Vulkan runtime $runtimeRelease ..."
$runtimeData = Invoke-RestMethod -Headers @{ "User-Agent" = "UspesniJezek-local-setup" } -Uri "https://api.github.com/repos/$runtimeRepository/releases/tags/$runtimeRelease"
$asset = $runtimeData.assets | Where-Object { $_.name -eq $runtimeAssetName } | Select-Object -First 1
if (-not $asset) { throw "Uradni Windows CPU+Vulkan runtime ne obstaja v izdaji $runtimeRelease." }
$runtimeDigest = [string]$asset.digest
if (-not $runtimeDigest.StartsWith("sha256:")) { throw "GitHub za $runtimeAssetName ni objavil SHA-256." }
$runtimeArchive = Join-Path $dataRoot "downloads\$runtimeAssetName"
Download-Verified $asset.browser_download_url $runtimeArchive $runtimeDigest.Substring(7)
$runtimeDestination = Join-Path $dataRoot "runtime\transcribe\$runtimeRelease"
$runtimeDll = Join-Path $runtimeDestination "transcribe-native-windows-x86_64-cpu-vulkan\transcribe.dll"
if ($Force -or -not (Test-Path -LiteralPath $runtimeDll)) {
  New-Item -ItemType Directory -Force -Path $runtimeDestination | Out-Null
  & tar.exe -xzf $runtimeArchive -C $runtimeDestination
  if ($LASTEXITCODE -ne 0) { throw "Razširjanje transcribe.cpp runtime ni uspelo." }
  if (-not (Test-Path -LiteralPath $runtimeDll)) { throw "Arhiv transcribe.cpp ne vsebuje pričakovane knjižnice transcribe.dll." }
} else {
  Write-Host "Transcribe.cpp CPU+Vulkan runtime je že razširjen: $runtimeDestination"
}

Write-Host "Preverjam Handyjev Canary Q5 model ..."
$modelData = Invoke-RestMethod -Headers @{ "User-Agent" = "UspesniJezek-local-setup" } -Uri "https://huggingface.co/api/models/$modelRepo`?blobs=true"
$modelFile = $modelData.siblings | Where-Object { $_.rfilename -eq $modelName } | Select-Object -First 1
$modelSha = if ($modelFile.lfs.sha256) { [string]$modelFile.lfs.sha256 } elseif ($modelFile.lfs.oid) { [string]$modelFile.lfs.oid } else { "" }
if (-not $modelSha) { throw "Hugging Face ni objavil LFS SHA-256 za $modelName." }
$modelUrl = "https://huggingface.co/$modelRepo/resolve/main/$modelName`?download=true"
$modelPath = Join-Path $dataRoot "model\$modelName"
Download-Verified $modelUrl $modelPath $modelSha

Write-Host "Preverjam Nemotron Streaming 3.5 Q8 za nemški prepis v živo ..."
$nemotronData = Invoke-RestMethod -Headers @{ "User-Agent" = "UspesniJezek-local-setup" } -Uri "https://huggingface.co/api/models/$nemotronRepo`?blobs=true"
$nemotronFile = $nemotronData.siblings | Where-Object { $_.rfilename -eq $nemotronName } | Select-Object -First 1
$nemotronSha = if ($nemotronFile.lfs.sha256) { [string]$nemotronFile.lfs.sha256 } elseif ($nemotronFile.lfs.oid) { [string]$nemotronFile.lfs.oid } else { "" }
if (-not $nemotronSha) { throw "Hugging Face ni objavil LFS SHA-256 za $nemotronName." }
$nemotronUrl = "https://huggingface.co/$nemotronRepo/resolve/main/$nemotronName`?download=true"
$nemotronPath = Join-Path $dataRoot "model\$nemotronName"
Download-Verified $nemotronUrl $nemotronPath $nemotronSha

$metadata = [ordered]@{
  installedAt = (Get-Date).ToUniversalTime().ToString("o")
  transcribeRelease = $runtimeRelease
  transcribeAsset = $runtimeAssetName
  transcribeSha256 = $runtimeDigest.Substring(7)
  modelRepository = $modelRepo
  modelFile = $modelName
  modelSha256 = $modelSha
  atenaLanguage = "de-DE"
  atenaModelRepository = $nemotronRepo
  atenaModelFile = $nemotronName
  atenaModelSha256 = $nemotronSha
  localOnly = $true
} | ConvertTo-Json
Set-Content -LiteralPath (Join-Path $dataRoot "install.json") -Value $metadata -Encoding UTF8
Copy-Item -Force -LiteralPath (Join-Path $PSScriptRoot "THIRD_PARTY_NOTICES.md") -Destination (Join-Path $dataRoot "THIRD_PARTY_NOTICES.md")
Write-Host ""
Write-Host "Namestitev je pripravljena in preverjena v: $dataRoot" -ForegroundColor Green
Write-Host "Zagon: npm run start:slovenski-prepis"
