# Preprost lokalni streznik za testiranje strani na telefonu/drugi napravi v istem omrezju.
# Ne potrebuje namescanja Python/Node - uporablja samo vgrajene .NET razrede.
param(
  [int]$Port = 8000
)

$root = (Get-Location).Path
$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any, $Port)
$listener.Start(50)
Write-Host "Streznik tece na vratih $Port, mapa: $root"

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".json" = "application/json"
}

while ($true) {
  # AcceptTcpClient() je bil prej KLICAN ZUNAJ try/catch spodaj - ce je vrgel
  # izjemo (npr. ker je ngrok povezavo takoj prekinil, ali je $listener
  # medtem nehal poslusati), je to podrlo CELO zanko in s tem streznik, ker
  # nobena naslednja zahteva ni bila vec sprejeta (od tod ERR_NGROK_3004 -
  # ngrok ni dobil NOBENEGA odgovora). Zdaj je klic v svojem try/catch, da
  # ena spodletela povezava ne ustavi poslusanja naslednjih.
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
  } catch {
    if (-not $listener.Server.IsBound) {
      Write-Host "Poslusalec je ustavljen, streznik se zaustavlja."
      break
    }
    Write-Host "Napaka pri sprejemanju povezave: $_"
    continue
  }

  try {
    $stream = $client.GetStream()
    # Ce brskalnik odpre povezavo, a takoj ne poslje zahteve (npr. "obticala"
    # povezava), streznik caka samo omejen cas namesto v neskoncnost - drugace
    # bi ena sama taka povezava zablokirala VSE ostale zahteve, ker streznik
    # obravnava eno povezavo naenkrat.
    $stream.ReadTimeout = 2000
    $buffer = New-Object byte[] 8192
    $bytesRead = $stream.Read($buffer, 0, $buffer.Length)
    if ($bytesRead -eq 0) { continue }
    # Prva vrstica zahteve (npr. "GET /prijava.html HTTP/1.1") je vse, kar
    # nas zanima. Morebitne dodatne glave, ki jih doda ngrok (X-Forwarded-For,
    # X-Forwarded-Proto ipd.), so v preostanku $requestText, a ker jih tu
    # nikoli ne beremo, ne morejo povzrociti napake pri parsanju.
    $requestText = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $bytesRead)
    $firstLine = ($requestText -split "`r`n")[0]
    $parts = $firstLine -split " "
    $path = if ($parts.Length -ge 2) { $parts[1] } else { "/" }
    $path = $path.Split("?")[0]
    if ($path -eq "/") { $path = "/index.html" }
    $path = [System.Uri]::UnescapeDataString($path)
    $filePath = Join-Path $root ($path.TrimStart("/"))

    # Content-Length spodaj vedno racunamo iz .Length dejanskega byte
    # array-a (ne stringa pred UTF-8 enkodiranjem), da se natancno ujema s
    # stevilom bajtov, ki jih dejansko poslje $stream.Write - ngrok kot
    # strog HTTP/1.1 posrednik zahtevo zavrze kot nepopolno, ce se
    # napovedana in dejanska dolzina telesa ne ujemata.
    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
      $content = [System.IO.File]::ReadAllBytes($filePath)
      $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($content.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($content, 0, $content.Length)
    } else {
      $body = "404 Not Found: $path"
      $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($bodyBytes, 0, $bodyBytes.Length)
    }
    # Izrecen Flush pred zapiranjem zagotovi, da so VSI bajti (glave + telo)
    # dejansko poslani preko TCP povezave, preden $client.Close() spodaj
    # povezavo prekine - brez tega bi ngrok lahko dobil prekinjeno/nepopolno
    # povezavo, ce zapiranje prehiti oddajo zadnjih bajtov v medpomnilniku.
    $stream.Flush()
    $stream.Close()
  } catch {
    Write-Host "Napaka pri obdelavi zahteve: $_"
  } finally {
    if ($client -ne $null) { $client.Close() }
  }
}
