$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

# Ensure Node is available even when PATH is stale in the current shell.
$nodeInstallDir = 'C:\Program Files\nodejs'
if ((Test-Path (Join-Path $nodeInstallDir 'node.exe')) -and -not (Get-Command node -ErrorAction SilentlyContinue)) {
    $env:Path = "$nodeInstallDir;$env:Path"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '[ERROR] Node.js wurde nicht gefunden. Bitte installiere Node LTS.' -ForegroundColor Red
    Write-Host 'Tipp: winget install OpenJS.NodeJS.LTS' -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host '[ERROR] npm wurde nicht gefunden.' -ForegroundColor Red
    exit 1
}

if (-not (Test-Path '.env')) {
    Set-Content -Path '.env' -Value "GEMINI_API_KEY=your_api_key_here`nOPENWEATHER_API_KEY=`nFINNHUB_API_KEY=`n" -Encoding UTF8
    Write-Host '[ERROR] .env wurde erstellt. Bitte trage deinen GEMINI_API_KEY ein und starte erneut.' -ForegroundColor Red
    exit 1
}

$envContent = Get-Content '.env' -Raw
if ($envContent -notmatch 'GEMINI_API_KEY\s*=') {
    Write-Host '[ERROR] GEMINI_API_KEY fehlt in .env.' -ForegroundColor Red
    exit 1
}

if ($envContent -match 'your_api_key_here') {
    Write-Host '[ERROR] Bitte ersetze den Platzhalter in .env durch deinen echten GEMINI_API_KEY.' -ForegroundColor Red
    exit 1
}

if ($envContent -notmatch 'OPENWEATHER_API_KEY\s*=') {
    Add-Content -Path '.env' -Value "`nOPENWEATHER_API_KEY="
    Write-Host '[INFO] OPENWEATHER_API_KEY wurde zu .env hinzugefuegt (optional).' -ForegroundColor Cyan
}

if ($envContent -notmatch 'FINNHUB_API_KEY\s*=') {
    Add-Content -Path '.env' -Value "`nFINNHUB_API_KEY="
    Write-Host '[INFO] FINNHUB_API_KEY wurde zu .env hinzugefuegt (optional).' -ForegroundColor Cyan
}

if (-not (Test-Path 'node_modules')) {
    Write-Host '[INFO] node_modules fehlt, installiere npm dependencies...' -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[ERROR] npm install fehlgeschlagen.' -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# Clean up stale listeners that block startup on expected ports.
try {
    $portsToFree = @(8000, 5173)
    foreach ($port in $portsToFree) {
        $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($listeners) {
            $listenerPids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($procId in $listenerPids) {
                if ($procId -and $procId -ne $PID) {
                    Write-Host "[INFO] Beende alten Prozess auf Port $port (PID $procId)..." -ForegroundColor Yellow
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
}
catch {
    Write-Host '[WARN] Konnte Port-Check nicht ausfuehren. Starte trotzdem.' -ForegroundColor Yellow
}

Write-Host '[INFO] Starte ADA Dev-Stack (Vite + Electron + Python Backend)...' -ForegroundColor Green

# Prevent stale Python bytecode from loading outdated backend code.
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:TQDM_DISABLE = '1'
if (Test-Path '.\backend\__pycache__') {
    Get-ChildItem '.\backend\__pycache__\*.pyc' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}

npm run dev
exit $LASTEXITCODE
