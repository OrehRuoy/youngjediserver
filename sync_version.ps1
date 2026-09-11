# Sync version from single source (server/data/version.json) to client and launcher project.godot.
# Usage: bump version in server/data/version.json, then run: .\sync_version.ps1
# During development, use launcher with YOUNG_JEDI_DEV=1 to skip version check (no bump needed).

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$versionPath = Join-Path $root "server\data\version.json"
if (-not (Test-Path $versionPath)) {
    Write-Error "Not found: $versionPath"
}
$data = Get-Content $versionPath -Raw | ConvertFrom-Json
$ver = $data.version
if (-not $ver) {
    Write-Error "No 'version' in $versionPath"
}
Write-Host "Syncing version: $ver"

foreach ($proj in @("client\project.godot", "launcher\project.godot")) {
    $path = Join-Path $root $proj
    if (-not (Test-Path $path)) { continue }
    $content = Get-Content $path -Raw
    $content = $content -replace 'config/version="[^"]*"', "config/version=`"$ver`""
    Set-Content $path $content -NoNewline
    Write-Host "  Updated $proj"
}
Write-Host "Done. Only server/data/version.json needs to be edited for releases."
