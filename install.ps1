# PHANTOM - Windows PowerShell Installer (v1.0.0)
$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '  PHANTOM - AI-Powered Pentesting Command Center' -ForegroundColor Green
Write-Host '  ============================================================' -ForegroundColor DarkGray
Write-Host '  PHANTOM - Windows PowerShell Installer (v1.0.0)' -ForegroundColor Green
Write-Host '  ------------------------------------------------------------' -ForegroundColor DarkGray

# Check Node.js prerequisite
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host '  [X] Node.js is not installed.' -ForegroundColor Red
    Write-Host '  [!] Please install Node.js 18+ from https://nodejs.org or via winget:' -ForegroundColor Yellow
    Write-Host '      winget install OpenJS.NodeJS.LTS' -ForegroundColor Cyan
    exit 1
}

$nodeVersion = node -v
Write-Host '  [OK] Detected Node.js' $nodeVersion -ForegroundColor DarkGreen

# Determine installation directory
$userProfile = $env:USERPROFILE
$installDir = Join-Path $userProfile '.phantom'

if (Test-Path 'package.json') {
    $pkgJson = Get-Content 'package.json' -Raw
    if ($pkgJson -match 'phantom') {
        $installDir = (Get-Item .).FullName
        Write-Host '  [>] Installing in current directory:' $installDir -ForegroundColor Cyan
    }
}

if ($installDir -ne (Get-Item .).FullName) {
    Write-Host '  [>] Installing PHANTOM to:' $installDir -ForegroundColor Cyan
    if (Test-Path $installDir) {
        Write-Host '  Updating existing repository...' -ForegroundColor DarkGray
        git -C $installDir pull --rebase
    } else {
        git clone https://github.com/OmYarewar/PHANTOM.git $installDir
    }
}

Set-Location $installDir

Write-Host '  [>] Installing dependencies (npm install)...' -ForegroundColor Cyan
npm install --quiet

Write-Host '  [>] Building native binaries (better-sqlite3, sharp)...' -ForegroundColor Cyan
npm rebuild better-sqlite3 sharp --quiet

# Configure PowerShell command launcher
$binDir = Join-Path $userProfile '.local\bin'
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

$srcCmd = Join-Path $installDir 'bin\phantom.cmd'
$destCmd = Join-Path $binDir 'phantom.cmd'
Copy-Item -Path $srcCmd -Destination $destCmd -Force

# Add binDir to User PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike ('*' + $binDir + '*')) {
    $newPath = $userPath + ';' + $binDir
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    $env:Path = $env:Path + ';' + $binDir
    Write-Host '  [OK] Added bin directory to User PATH environment variable.' -ForegroundColor DarkGreen
}

# Configure PowerShell Profile
if ($PROFILE) {
    $profileDir = Split-Path -Parent $PROFILE
    if (-not (Test-Path $profileDir)) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }
    if (-not (Test-Path $PROFILE)) {
        New-Item -ItemType File -Path $PROFILE -Force | Out-Null
    }

    $profileContent = Get-Content -Path $PROFILE -Raw -ErrorAction SilentlyContinue
    if ($profileContent -notlike '*function phantom*') {
        $profileLines = @(
            '# PHANTOM CLI Function',
            'function phantom { phantom.cmd $args }'
        )
        Add-Content -Path $PROFILE -Value $profileLines
        Write-Host '  [OK] Configured phantom command in PowerShell profile' -ForegroundColor DarkGreen
    }
}

Write-Host '  ------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host '  [+] PHANTOM CLI successfully installed and configured for Windows PowerShell!' -ForegroundColor Green
Write-Host ''
Write-Host '  Launch server in any PowerShell terminal window using:' -ForegroundColor White
Write-Host '    phantom start        # Launch production PHANTOM server' -ForegroundColor Green
Write-Host '    phantom dev          # Launch dev mode (Backend + Vite UI)' -ForegroundColor Green
Write-Host '    phantom --port 8080  # Launch on custom port' -ForegroundColor Green
Write-Host '    phantom --help       # Display CLI help menu' -ForegroundColor Green
Write-Host ''
Write-Host '  [!] Note: Restart your PowerShell window or run: . $PROFILE' -ForegroundColor DarkGray
Write-Host '  ------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host ''
