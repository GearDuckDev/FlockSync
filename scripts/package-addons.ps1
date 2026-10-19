[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$addonRoot = Join-Path $repoRoot "apps\addon"
$releaseRoot = Join-Path $repoRoot "release"

try {
    foreach ($name in @("FlockSync", "FlockSync_AppHelper")) {
        $toc = Join-Path $addonRoot "$name\$name.toc"
        if (-not (Test-Path -LiteralPath $toc -PathType Leaf)) {
            throw "Addon TOC not found: $toc"
        }
    }
    New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
    $main = Join-Path $addonRoot "FlockSync"
    $helper = Join-Path $addonRoot "FlockSync_AppHelper"
    $bundle = Join-Path $releaseRoot "FlockSync-Addon-Bundle.zip"
    $raider = Join-Path $releaseRoot "FlockSync-Raider-Only.zip"
    Compress-Archive -LiteralPath $main, $helper -DestinationPath $bundle -Force
    Compress-Archive -LiteralPath $main -DestinationPath $raider -Force
    Write-Output "Officer bundle: $bundle"
    Write-Output "Raider addon: $raider"
} catch {
    Write-Error "Addon packaging failed: $_"
    throw
}
