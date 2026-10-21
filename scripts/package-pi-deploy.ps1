[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $repoRoot "release"
$zipPath = Join-Path $releaseRoot "FlockSync_Pi_Deploy.zip"
$stagingRoot = Join-Path $repoRoot ".pi_staging"
$stagingProject = Join-Path $stagingRoot "FlockSync"
$excludedNames = @("node_modules", "dist", "out", ".git")
$rootFiles = @(
    "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "tsconfig.base.json",
    "Dockerfile.api", "Dockerfile.web", "docker-compose.yml",
    ".dockerignore", ".env.example"
)
$sourceFolders = @("apps\api", "apps\web", "packages\shared-types", "deploy")

function Copy-DeployFolder {
    param([string]$Source, [string]$Destination)

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    foreach ($item in Get-ChildItem -LiteralPath $Source -Recurse -Force -Exclude $excludedNames) {
        $relative = $item.FullName.Substring($Source.Length).TrimStart('\', '/')
        $segments = $relative -split '[\\/]'
        if (@($segments | Where-Object { $_ -in $excludedNames }).Count -gt 0) { continue }
        # Reject links and any descendants of junctions, even on older PowerShell.
        $ancestor = $item
        $isLink = $false
        while ($ancestor -and $ancestor.FullName.Length -gt $Source.Length) {
            if ($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                $isLink = $true
                break
            }
            $ancestor = if ($ancestor.PSIsContainer) { $ancestor.Parent } else { $ancestor.Directory }
        }
        if ($isLink) { continue }
        if ($item.Name -match '\.db(?:-wal|-shm)?$') { continue }
        if (($item.Name -eq ".env" -or $item.Name -like ".env.*") -and
            $item.Name -notlike "*.example") { continue }
        $target = Join-Path $Destination $relative
        if ($item.PSIsContainer) {
            New-Item -ItemType Directory -Path $target -Force | Out-Null
        } else {
            New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
            Copy-Item -LiteralPath $item.FullName -Destination $target -Force
        }
    }
}

if (Test-Path -LiteralPath $stagingRoot) {
    throw "Staging path already exists: $stagingRoot. Inspect and remove it before packaging."
}
foreach ($relativePath in @($rootFiles) + @($sourceFolders)) {
    $source = Get-Item -LiteralPath (Join-Path $repoRoot $relativePath) -Force
    if ($source.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "Deployment input must not be a symbolic link or junction: $relativePath"
    }
}
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

try {
    New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $stagingProject | Out-Null
    foreach ($name in $rootFiles) {
        $source = Join-Path $repoRoot $name
        $target = Join-Path $stagingProject $name
        Copy-Item -LiteralPath $source -Destination $target -Force
        if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
            throw "Required root file was not copied: $name"
        }
    }
    foreach ($relativePath in $sourceFolders) {
        Copy-DeployFolder -Source (Join-Path $repoRoot $relativePath) `
            -Destination (Join-Path $stagingProject $relativePath)
    }
    # Unlike Compress-Archive, this includes dotfiles on all supported hosts.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory(
        $stagingRoot, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false
    )
} catch {
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    throw
} finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}

Write-Host "Pi deployment package created: $zipPath" -ForegroundColor Green
