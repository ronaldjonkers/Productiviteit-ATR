@echo off
:: =============================================================================
:: Productiviteit ATR - Windows Installer Launcher
:: Dubbelklik dit bestand om de installatie te starten.
:: Dit start automatisch het PowerShell installatiescript.
:: =============================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
