[CmdletBinding()]
param(
    [string]$ReleaseVersion = "0.6.0"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $repoRoot "release"
$manifestPath = Join-Path $releaseRoot "flocksync-release.json"

function Get-PackageVersion([string]$relativePath) {
    (Get-Content -LiteralPath (Join-Path $repoRoot $relativePath) -Raw | ConvertFrom-Json).version
}

function Get-AddonVersion([string]$name) {
    $toc = Get-Content -LiteralPath (Join-Path $repoRoot "apps\addon\$name\$name.toc")
    $line = @($toc | Where-Object { $_ -match '^## Version: ' })
    if ($line.Count -ne 1) { throw "Expected one version in $name TOC" }
    $line[0].Substring("## Version: ".Length).Trim()
}

Push-Location $repoRoot
try {
    if (Test-Path -LiteralPath $manifestPath) { Remove-Item -LiteralPath $manifestPath }
    $desktop = Get-PackageVersion "apps\desktop\package.json"
    $server = Get-PackageVersion "apps\api\package.json"
    if ($server -ne (Get-PackageVersion "apps\web\package.json")) {
        throw "API and web versions must match."
    }
    $addon = Get-AddonVersion "FlockSync"
    $helper = Get-AddonVersion "FlockSync_AppHelper"
    $versions = @($ReleaseVersion, $desktop, $server, $addon, $helper)
    foreach ($version in $versions) {
        if ($version -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta)(?:\.(0|[1-9]\d*))?)?$') {
            throw "Unsupported version: $version"
        }
    }
    & pnpm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "Typecheck failed." }
    & pnpm --filter @flocksync/api build
    if ($LASTEXITCODE -ne 0) { throw "API build failed." }
    & pnpm --filter @flocksync/web build
    if ($LASTEXITCODE -ne 0) { throw "Web build failed." }
    & pnpm --filter @flocksync/desktop package:win
    if ($LASTEXITCODE -ne 0) { throw "Desktop packaging failed." }
    & (Join-Path $PSScriptRoot "package-addons.ps1")
    & (Join-Path $PSScriptRoot "package-pi-deploy.ps1")
    $desktopAssets = @("FlockSync-Setup-$desktop-x64.exe", "FlockSync-Portable-$desktop-x64.exe")
    foreach ($name in $desktopAssets) {
        $source = Join-Path $repoRoot "apps\desktop\release\$name"
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing desktop artifact: $source" }
        Copy-Item -LiteralPath $source -Destination (Join-Path $releaseRoot $name) -Force
    }
    $components = [ordered]@{
        desktop = @{ version = $desktop; assets = $desktopAssets }
        server = @{ version = $server; assets = @("FlockSync_Pi_Deploy.zip") }
        addon = @{ version = $addon; assets = @("FlockSync-Raider-Only.zip", "FlockSync-Addon-Bundle.zip") }
        helper = @{ version = $helper; assets = @("FlockSync-Addon-Bundle.zip") }
    }
    foreach ($component in $components.Values) {
        foreach ($name in $component.assets) {
            $file = Get-Item -LiteralPath (Join-Path $releaseRoot $name)
            if ($file.Length -eq 0) { throw "Empty artifact: $name" }
        }
    }
    $manifest = [ordered]@{ schemaVersion = 1; releaseVersion = $ReleaseVersion; components = $components }
    $json = $manifest | ConvertTo-Json -Depth 6
    [IO.File]::WriteAllText($manifestPath, $json, [Text.UTF8Encoding]::new($false))
    $releaseType = if ($ReleaseVersion -match '-(alpha|beta)') { "prerelease" } else { "stable release" }
    Write-Output "Publish ONE $releaseType tagged v$ReleaseVersion with these files:"
    @($desktopAssets) + @("FlockSync_Pi_Deploy.zip", "FlockSync-Raider-Only.zip",
        "FlockSync-Addon-Bundle.zip", "flocksync-release.json") |
        ForEach-Object { Write-Output (Join-Path $releaseRoot $_) }
} finally {
    Pop-Location
}
