@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

:: =============================================================================
:: Productiviteit ATR - Install Script (Windows)
:: =============================================================================
:: Dit script installeert alles wat nodig is en maakt snelkoppelingen aan
:: zodat de gebruiker de applicatie kan starten vanuit het Start Menu of Bureaublad.
:: Veilig om meerdere keren te draaien.
:: =============================================================================

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "APP_NAME=Productiviteit ATR"

echo.
echo ╔══════════════════════════════════════════════╗
echo ║   Productiviteit ATR - Installer (Windows)  ║
echo ╚══════════════════════════════════════════════╝
echo.

:: --- 1. Check Node.js ---
echo [STAP 1] Node.js controleren...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Node.js niet gevonden. Downloaden en installeren...
    echo.
    echo Node.js moet handmatig worden geinstalleerd.
    echo Download Node.js van: https://nodejs.org/
    echo Kies de LTS versie en installeer met standaard instellingen.
    echo Draai daarna dit script opnieuw.
    echo.
    start https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node -v') do set "NODE_RAW=%%i"
for /f "tokens=1 delims=." %%i in ('node -v') do set "NODE_MAJOR=%%i"
set "NODE_MAJOR=%NODE_MAJOR:v=%"

if %NODE_MAJOR% lss 18 (
    echo [WARN] Node.js v%NODE_MAJOR% is te oud. Versie 18 of hoger is vereist.
    echo Download de nieuwste LTS versie van: https://nodejs.org/
    start https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js gevonden: 
node -v

:: --- 2. Check npm ---
echo.
echo [STAP 2] npm controleren...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [FOUT] npm niet gevonden. Herinstalleer Node.js.
    pause
    exit /b 1
)
echo [OK] npm gevonden:
npm -v

:: --- 3. Check Git ---
echo.
echo [STAP 3] Git controleren...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Git niet gevonden. Downloaden...
    echo Git is nodig voor automatische updates.
    echo Download Git van: https://git-scm.com/download/win
    start https://git-scm.com/download/win
    echo Installeer Git en draai dit script opnieuw.
    pause
    exit /b 1
)
echo [OK] Git gevonden:
git --version

:: --- 4. Install npm dependencies ---
echo.
echo [STAP 4] Dependencies installeren (dit kan even duren)...
cd /d "%PROJECT_DIR%"
call npm install
if %errorlevel% neq 0 (
    echo [FOUT] npm install mislukt. Controleer je internetverbinding.
    pause
    exit /b 1
)

:: --- 5. Verify installation ---
echo.
echo [STAP 5] Installatie verifieren...
if not exist "%PROJECT_DIR%\node_modules\electron" (
    echo [FOUT] Electron niet geinstalleerd.
    pause
    exit /b 1
)
if not exist "%PROJECT_DIR%\node_modules\better-sqlite3" (
    echo [FOUT] better-sqlite3 niet geinstalleerd.
    pause
    exit /b 1
)
if not exist "%PROJECT_DIR%\node_modules\exceljs" (
    echo [FOUT] exceljs niet geinstalleerd.
    pause
    exit /b 1
)
echo [OK] Alle dependencies geinstalleerd.

:: --- 6. Rebuild native modules for Electron ---
echo.
echo [STAP 6] Native modules rebuilden voor Electron...
call npx electron-rebuild -f -w better-sqlite3 2>nul
if %errorlevel% neq 0 (
    echo [WARN] electron-rebuild gefaald, fallback...
    call npm rebuild better-sqlite3 2>nul
)
echo [OK] Native modules gebouwd.

:: --- 7. Create launcher batch file ---
echo.
echo [STAP 7] Launcher aanmaken...

set "LAUNCHER=%PROJECT_DIR%\Productiviteit ATR.bat"
(
    echo @echo off
    echo cd /d "%PROJECT_DIR%"
    echo start "" npx electron . 2^>nul
) > "%LAUNCHER%"

echo [OK] Launcher aangemaakt: %LAUNCHER%

:: --- 8. Create Desktop shortcut ---
echo.
echo [STAP 8] Bureaublad snelkoppeling aanmaken...

set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT_VBS=%TEMP%\create_shortcut.vbs"

(
    echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
    echo Set oLink = oWS.CreateShortcut^("%DESKTOP%\%APP_NAME%.lnk"^)
    echo oLink.TargetPath = "%LAUNCHER%"
    echo oLink.WorkingDirectory = "%PROJECT_DIR%"
    echo oLink.Description = "Productiviteit ATR - Productiviteitsoverzichten"
    echo oLink.WindowStyle = 7
    echo oLink.Save
) > "%SHORTCUT_VBS%"
cscript //nologo "%SHORTCUT_VBS%" 2>nul
del "%SHORTCUT_VBS%" 2>nul
echo [OK] Snelkoppeling op bureaublad aangemaakt.

:: --- 9. Create Start Menu shortcut ---
echo.
echo [STAP 9] Start Menu snelkoppeling aanmaken...

set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "SHORTCUT_VBS=%TEMP%\create_startmenu.vbs"

(
    echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
    echo Set oLink = oWS.CreateShortcut^("%STARTMENU%\%APP_NAME%.lnk"^)
    echo oLink.TargetPath = "%LAUNCHER%"
    echo oLink.WorkingDirectory = "%PROJECT_DIR%"
    echo oLink.Description = "Productiviteit ATR - Productiviteitsoverzichten"
    echo oLink.WindowStyle = 7
    echo oLink.Save
) > "%SHORTCUT_VBS%"
cscript //nologo "%SHORTCUT_VBS%" 2>nul
del "%SHORTCUT_VBS%" 2>nul
echo [OK] Start Menu snelkoppeling aangemaakt.

:: --- Done ---
echo.
echo ════════════════════════════════════════════════
echo   ✓ Installatie compleet!
echo ════════════════════════════════════════════════
echo.
echo De applicatie is nu beschikbaar als:
echo.
echo   1. Snelkoppeling op het bureaublad
echo      Dubbelklik op "%APP_NAME%" om te starten
echo.
echo   2. Via het Start Menu
echo      Zoek naar "%APP_NAME%"
echo.
echo   3. Via de launcher
echo      Dubbelklik op "Productiviteit ATR.bat" in de projectmap
echo.
echo Updates kunnen vanuit de app zelf worden geinstalleerd.
echo.
pause
