# =============================================================================
# Productiviteit ATR - Install Script (Windows PowerShell)
# =============================================================================
# Dit script installeert alles wat nodig is en maakt snelkoppelingen aan
# zodat de gebruiker de applicatie kan starten vanuit het Start Menu of Bureaublad.
# Veilig om meerdere keren te draaien.
# =============================================================================

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppName = "Productiviteit ATR"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Productiviteit ATR - Installer (Windows)       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Check Node.js ---
Write-Host "[STAP 1] Node.js controleren..." -ForegroundColor Yellow

$nodeExists = $null
try { $nodeExists = Get-Command node -ErrorAction SilentlyContinue } catch {}

if (-not $nodeExists) {
    Write-Host "[FOUT] Node.js is niet geinstalleerd." -ForegroundColor Red
    Write-Host ""
    Write-Host "Download Node.js LTS van: https://nodejs.org/" -ForegroundColor White
    Write-Host "Installeer met standaard instellingen en draai dit script opnieuw." -ForegroundColor White
    Write-Host ""
    Start-Process "https://nodejs.org/"
    Read-Host "Druk op Enter om af te sluiten"
    exit 1
}

$nodeVersion = (node -v) -replace 'v','' -split '\.' | Select-Object -First 1
$nodeMajor = [int]$nodeVersion

if ($nodeMajor -lt 18 -or $nodeMajor -gt 22) {
    if ($nodeMajor -gt 22) {
        Write-Host "[FOUT] Node.js v$nodeMajor is te nieuw! Versies boven v22 zijn niet compatibel." -ForegroundColor Red
    } else {
        Write-Host "[FOUT] Node.js v$nodeMajor is te oud. Versie 18-22 is vereist." -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Download Node.js v20 LTS van: https://nodejs.org/download/release/latest-v20.x/" -ForegroundColor White
    Write-Host "Installeer met standaard instellingen en draai dit script opnieuw." -ForegroundColor White
    Write-Host ""
    Start-Process "https://nodejs.org/download/release/latest-v20.x/"
    Read-Host "Druk op Enter om af te sluiten"
    exit 1
}

Write-Host "[OK] Node.js $(node -v) gevonden (compatibel: v18-v22)." -ForegroundColor Green

# --- 2. Check npm ---
Write-Host "[STAP 2] npm controleren..." -ForegroundColor Yellow

$npmExists = $null
try { $npmExists = Get-Command npm -ErrorAction SilentlyContinue } catch {}

if (-not $npmExists) {
    Write-Host "[FOUT] npm niet gevonden. Herinstalleer Node.js." -ForegroundColor Red
    Read-Host "Druk op Enter om af te sluiten"
    exit 1
}

Write-Host "[OK] npm $(npm -v) gevonden." -ForegroundColor Green

# --- 3. Check Git ---
Write-Host "[STAP 3] Git controleren..." -ForegroundColor Yellow

$gitExists = $null
try { $gitExists = Get-Command git -ErrorAction SilentlyContinue } catch {}

if (-not $gitExists) {
    Write-Host "[WAARSCHUWING] Git niet gevonden." -ForegroundColor DarkYellow
    Write-Host "Git is nodig voor automatische updates vanuit de app." -ForegroundColor White
    Write-Host "Download Git van: https://git-scm.com/download/win" -ForegroundColor White
    Write-Host ""
    Start-Process "https://git-scm.com/download/win"
    Write-Host "Je kunt doorgaan zonder Git, maar updates werken dan niet." -ForegroundColor DarkYellow
    Write-Host ""
}
else {
    Write-Host "[OK] Git gevonden: $(git --version)" -ForegroundColor Green
}

# --- 4. Install npm dependencies ---
Write-Host ""
Write-Host "[STAP 4] Dependencies installeren (dit kan even duren)..." -ForegroundColor Yellow

Push-Location $ProjectDir
try {
    & npm install 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "npm install mislukt"
    }
}
catch {
    Write-Host "[FOUT] npm install mislukt. Controleer je internetverbinding." -ForegroundColor Red
    Pop-Location
    Read-Host "Druk op Enter om af te sluiten"
    exit 1
}

# --- 5. Verify installation ---
Write-Host ""
Write-Host "[STAP 5] Installatie verifieren..." -ForegroundColor Yellow

$allOk = (Test-Path "$ProjectDir\node_modules\electron") -and
         (Test-Path "$ProjectDir\node_modules\better-sqlite3") -and
         (Test-Path "$ProjectDir\node_modules\exceljs")

if (-not $allOk) {
    Write-Host "[FOUT] Niet alle dependencies zijn geinstalleerd." -ForegroundColor Red
    Pop-Location
    Read-Host "Druk op Enter om af te sluiten"
    exit 1
}

Write-Host "[OK] Alle dependencies geinstalleerd." -ForegroundColor Green

# --- 6. Rebuild native modules for Electron ---
Write-Host ""
Write-Host "[STAP 6] Native modules rebuilden voor Electron..." -ForegroundColor Yellow
Write-Host "Dit zorgt ervoor dat better-sqlite3 werkt met Electron (niet systeem Node)..." -ForegroundColor Gray

$rebuildOk = $false

# Method 1: npx electron-rebuild
try {
    & npx electron-rebuild -f -w better-sqlite3 2>&1 | Out-Host
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] electron-rebuild succesvol." -ForegroundColor Green
        $rebuildOk = $true
    }
}
catch {
    Write-Host "[WAARSCHUWING] electron-rebuild mislukt, alternatieve methode..." -ForegroundColor DarkYellow
}

# Method 2: manual rebuild with electron target
if (-not $rebuildOk) {
    try {
        $electronVersion = node -e "console.log(require('./node_modules/electron/package.json').version)"
        if ($electronVersion) {
            Write-Host "Electron versie: $electronVersion, handmatig rebuilden..." -ForegroundColor Gray
            & npm rebuild better-sqlite3 --runtime=electron "--target=$electronVersion" --disturl=https://electronjs.org/headers 2>&1 | Out-Host
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] Handmatige rebuild succesvol." -ForegroundColor Green
                $rebuildOk = $true
            }
        }
    }
    catch {
        Write-Host "[WAARSCHUWING] Handmatige rebuild ook mislukt." -ForegroundColor DarkYellow
    }
}

if (-not $rebuildOk) {
    Write-Host "[WAARSCHUWING] Kon native modules niet rebuilden. De app zal dit automatisch proberen bij eerste start." -ForegroundColor DarkYellow
}

# --- 7. Create launcher .cmd file ---
Write-Host ""
Write-Host "[STAP 7] Launcher aanmaken..." -ForegroundColor Yellow

$launcherPath = Join-Path $ProjectDir "Productiviteit ATR.cmd"
$launcherContent = @"
@echo off
cd /d "$ProjectDir"
start "" npx electron .
exit
"@

Set-Content -Path $launcherPath -Value $launcherContent -Encoding ASCII
Write-Host "[OK] Launcher aangemaakt: $launcherPath" -ForegroundColor Green

# --- 8. Create Desktop shortcut ---
Write-Host ""
Write-Host "[STAP 8] Bureaublad snelkoppeling aanmaken..." -ForegroundColor Yellow

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $shortcut = $WshShell.CreateShortcut("$desktopPath\$AppName.lnk")
    $shortcut.TargetPath = $launcherPath
    $shortcut.WorkingDirectory = $ProjectDir
    $shortcut.Description = "Productiviteit ATR - Productiviteitsoverzichten"
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Host "[OK] Snelkoppeling op bureaublad aangemaakt." -ForegroundColor Green
}
catch {
    Write-Host "[WAARSCHUWING] Kon geen bureaublad snelkoppeling maken: $_" -ForegroundColor DarkYellow
}

# --- 9. Create Start Menu shortcut ---
Write-Host ""
Write-Host "[STAP 9] Start Menu snelkoppeling aanmaken..." -ForegroundColor Yellow

try {
    $startMenuPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
    $shortcut = $WshShell.CreateShortcut("$startMenuPath\$AppName.lnk")
    $shortcut.TargetPath = $launcherPath
    $shortcut.WorkingDirectory = $ProjectDir
    $shortcut.Description = "Productiviteit ATR - Productiviteitsoverzichten"
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Host "[OK] Start Menu snelkoppeling aangemaakt." -ForegroundColor Green
}
catch {
    Write-Host "[WAARSCHUWING] Kon geen Start Menu snelkoppeling maken: $_" -ForegroundColor DarkYellow
}

Pop-Location

# --- Done ---
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "   Installatie compleet!                          " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "De applicatie is nu beschikbaar als:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Snelkoppeling op het bureaublad" -ForegroundColor White
Write-Host "     Dubbelklik op '$AppName' om te starten" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Via het Start Menu" -ForegroundColor White
Write-Host "     Zoek naar '$AppName'" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Via de launcher in de projectmap" -ForegroundColor White
Write-Host "     Dubbelklik op 'Productiviteit ATR.cmd'" -ForegroundColor Gray
Write-Host ""
Write-Host "Updates kunnen vanuit de app zelf worden geinstalleerd." -ForegroundColor White
Write-Host ""
Read-Host "Druk op Enter om af te sluiten"
