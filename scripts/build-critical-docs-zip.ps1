# Build C2K critical docs zip on Desktop (2026-06-06 bundle)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$Root\docs\README.md")) {
    $Root = "c:\Users\shkin\Desktop\coast-to-coast-kink"
}
$Date = Get-Date -Format 'yyyy-MM-dd'
$OutZip = Join-Path $env:USERPROFILE "Desktop\C2K-critical-docs-$Date.zip"
$Stage = Join-Path $env:TEMP "C2K-critical-docs-$Date"

if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Path $Stage | Out-Null

$IncludeRoots = @(
    @{ Src = 'docs'; Patterns = @('*.md', '*.txt') },
    @{ Src = '.cursor\rules'; Patterns = @('*.mdc') },
    @{ Src = '.cursor\skills\c2k-feature-loop'; Patterns = @('SKILL.md') }
)

$ExcludeDirNames = @('archive', 'screenshots', 'ui1')

function ShouldExcludePath([string]$FullPath) {
    foreach ($d in $ExcludeDirNames) {
        if ($FullPath -match "[\\/]$d[\\/]" -or $FullPath -match "[\\/]$d$") { return $true }
    }
    return $false
}

$Copied = [System.Collections.Generic.List[string]]::new()

foreach ($entry in $IncludeRoots) {
    $srcBase = Join-Path $Root $entry.Src
    if (-not (Test-Path $srcBase)) { continue }
    foreach ($pattern in $entry.Patterns) {
        Get-ChildItem -Path $srcBase -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
            if (ShouldExcludePath $_.FullName) { return }
            $rel = $_.FullName.Substring($Root.Length).TrimStart('\', '/')
            $dest = Join-Path $Stage $rel
            $destDir = Split-Path $dest -Parent
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item $_.FullName $dest -Force
            $Copied.Add($rel) | Out-Null
        }
    }
}

# audits/ui generated JSON only (no PNGs)
$genJson = Join-Path $Root 'docs\audits\ui\generated'
if (Test-Path $genJson) {
    Get-ChildItem -Path $genJson -Filter '*.json' -File | ForEach-Object {
        $rel = $_.FullName.Substring($Root.Length).TrimStart('\', '/')
        $dest = Join-Path $Stage $rel
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item $_.FullName $dest -Force
        $Copied.Add($rel) | Out-Null
    }
}

$manifest = @(
    "C2K Critical Documentation Bundle",
    "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Source: $Root",
    "Files: $($Copied.Count)",
    "",
    "--- File list ---"
) + ($Copied | Sort-Object)
$manifestPath = Join-Path $Stage 'MANIFEST.txt'
$manifest | Set-Content -Path $manifestPath -Encoding UTF8

if (Test-Path $OutZip) { Remove-Item -Force $OutZip }
tar -a -cf $OutZip -C $Stage .

$sizeMb = [math]::Round((Get-Item $OutZip).Length / 1MB, 2)
Write-Output "ZIP=$OutZip"
Write-Output "FILES=$($Copied.Count)"
Write-Output "SIZE_MB=$sizeMb"

Remove-Item -Recurse -Force $Stage
