param(
    [string]$WowAddonsPath = "C:\Program Files (x86)\World of Warcraft\_classic_beta_\Interface\AddOns"
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$addonSourceRoot = Join-Path $repoRoot "apps\addon"

if (-not (Test-Path -LiteralPath $WowAddonsPath -PathType Container)) {
    throw "WoW AddOns directory not found: $WowAddonsPath"
}

foreach ($addonName in @("FlockSync", "FlockSync_AppHelper")) {
    $sourcePath = Join-Path $addonSourceRoot $addonName
    $linkPath = Join-Path $WowAddonsPath $addonName

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
        throw "Addon source directory not found: $sourcePath"
    }

    if (Test-Path -LiteralPath $linkPath) {
        throw "Cannot create addon junction because the destination already exists: $linkPath"
    }

    New-Item -ItemType Junction -Path $linkPath -Target $sourcePath | Out-Null
    Write-Output "Linked $addonName to $linkPath"
}
