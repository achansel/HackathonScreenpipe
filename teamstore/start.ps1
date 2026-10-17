# friction-assist — équipes chiffrées : une commande (Windows). Voir teamstore\README.md.
#   teamstore\start.cmd            démo PipingTable
#   teamstore\start.cmd moi        mon poste, avec mes collègues (options : --heberger, --serveur <url>)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$bunHome = Join-Path $env:USERPROFILE ".bun\bin"
if (-not (Get-Command bun -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $bunHome "bun.exe"))) { $env:Path = "$bunHome;$env:Path" }
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "Bun (le moteur JavaScript du projet) n'est pas installé."
  $ok = Read-Host "L'installer maintenant depuis https://bun.sh ? [o/N]"
  if ($ok -match '^(o|oui|y)$') { powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"; $env:Path = "$bunHome;$env:Path" }
  else { Write-Host "Installer Bun puis relancer : https://bun.sh"; exit 1 }
}
& bun teamstore/start.ts @args
exit $LASTEXITCODE
