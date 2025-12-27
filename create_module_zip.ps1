$backendSource = "apps\backend\src\modules\sistema"
$frontendSource = "apps\frontend\src\app\modules\sistema"
$buildDir = "temp_zip_build_v2"
$output = "sistema.zip"

Write-Host "Cleaning previous build..."
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
if (Test-Path $output) { Remove-Item $output -Force }

New-Item -ItemType Directory -Path $buildDir | Out-Null
New-Item -ItemType Directory -Path "$buildDir\backend" | Out-Null
New-Item -ItemType Directory -Path "$buildDir\frontend" | Out-Null

# 1. Copy Backend Files
Write-Host "Copying Backend files from $backendSource..."
$backendItems = Get-ChildItem -Path $backendSource
foreach ($item in $backendItems) {
    if ($item.Name -in "node_modules", ".git", "dist", ".DS_Store") { continue }
    
    # Exclude 'frontend' folder found in backend source!
    if ($item.Name -eq "frontend") { continue }

    if ($item.Name -eq "module.json") {
        # Copy to root
        Copy-Item -Path $item.FullName -Destination $buildDir
    } else {
        # Copy to backend/
        Copy-Item -Path $item.FullName -Destination "$buildDir\backend" -Recurse -Force
    }
}

# 2. Copy Frontend Files
if (Test-Path $frontendSource) {
    Write-Host "Copying Frontend files from $frontendSource..."
    Copy-Item -Path "$frontendSource\*" -Destination "$buildDir\frontend" -Recurse -Force
} else {
    Write-Warning "Frontend source not found at $frontendSource"
}

# Zip it
Write-Host "Zipping to $output..."
Compress-Archive -Path "$buildDir\*" -DestinationPath $output -Force

# Clean
Remove-Item $buildDir -Recurse -Force

Write-Host "Done! Created $output"
