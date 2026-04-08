@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_ada.ps1"
if errorlevel 1 (
  echo.
  echo Start fehlgeschlagen. Bitte Meldungen oben pruefen.
  pause
)
