Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $projectDir
$pythonInVenv = Join-Path $repoRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $pythonInVenv)) {
    Write-Host "[-] Missing venv. Run .\\setup_oracle.ps1 first." -ForegroundColor Red
    exit 1
}

Set-Location $projectDir

# For Oracle, schema is managed by SQL scripts; avoid ORM create_all by default.
$env:AUTO_CREATE_TABLES = 'false'

& $pythonInVenv run.py