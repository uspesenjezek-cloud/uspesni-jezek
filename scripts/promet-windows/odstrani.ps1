# Odstrani samodejni zagon napovedi prometa. Zbrani podatki v .promet-podatki ostanejo.
foreach ($ime in @("UspesniJezek-Promet-Zbiralnik", "UspesniJezek-Promet-Profil")) {
  if (Get-ScheduledTask -TaskName $ime -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $ime -Confirm:$false
    Write-Host "Odstranjeno: $ime"
  }
}
