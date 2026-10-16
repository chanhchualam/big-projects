Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $projectDir
$venvDir = Join-Path $repoRoot '.venv'
$pythonInVenv = Join-Path $venvDir 'Scripts\python.exe'

Write-Host "[+] Project: $projectDir"
Write-Host "[+] Repo root: $repoRoot"

# 1) Ensure Python 3.12 is available
try {
    $null = py -3.12 --version
} catch {
    Write-Host "[-] Python 3.12 not found via 'py -3.12'. Install Python 3.12 then retry." -ForegroundColor Red
    Write-Host "    winget install -e --id Python.Python.3.12" -ForegroundColor Yellow
    exit 1
}

# 2) Create venv
if (-not (Test-Path $pythonInVenv)) {
    Write-Host "[+] Creating venv at $venvDir"
    py -3.12 -m venv $venvDir
}

# 3) Install deps
Write-Host "[+] Installing dependencies"
& $pythonInVenv -m pip install --upgrade pip
& $pythonInVenv -m pip install -r (Join-Path $projectDir 'requirements.txt')

# 4) Ensure .env exists
$envExample = Join-Path $projectDir '.env.example'
$envFile = Join-Path $projectDir '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "[+] Created .env from .env.example"
}

# 5) Prompt for Oracle connection (do not echo password)
Write-Host "\n[?] Oracle connection info (SQL Developer: service name is usually XEPDB1 on XE 18c/21c)"
$oracleUser = Read-Host 'ORACLE_USER (schema username)'
$oraclePass = Read-Host 'ORACLE_PASSWORD' -AsSecureString
$oracleHost = Read-Host 'ORACLE_HOST [localhost]'
$oraclePort = Read-Host 'ORACLE_PORT [1521]'
$oracleSvc  = Read-Host 'ORACLE_SERVICE [XEPDB1]'

if ([string]::IsNullOrWhiteSpace($oracleHost)) { $oracleHost = 'localhost' }
if ([string]::IsNullOrWhiteSpace($oraclePort)) { $oraclePort = '1521' }
if ([string]::IsNullOrWhiteSpace($oracleSvc))  { $oracleSvc  = 'XEPDB1' }

$oraclePassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($oraclePass)
)

# 6) Update .env (simple line replacements)
$content = Get-Content $envFile -Raw

function Replace-OrAddLine([string]$text, [string]$key, [string]$value) {
    $pattern = "(?m)^" + [regex]::Escape($key) + "=.*$"
    if ($text -match $pattern) {
        return [regex]::Replace($text, $pattern, "$key=$value")
    }
    return $text + "`r`n$key=$value`r`n"
}

$content = Replace-OrAddLine $content 'DB_PROVIDER' 'oracle'
$content = Replace-OrAddLine $content 'ORACLE_USER' $oracleUser
$content = Replace-OrAddLine $content 'ORACLE_PASSWORD' $oraclePassPlain
$content = Replace-OrAddLine $content 'ORACLE_HOST' $oracleHost
$content = Replace-OrAddLine $content 'ORACLE_PORT' $oraclePort
$content = Replace-OrAddLine $content 'ORACLE_SERVICE' $oracleSvc
$content = Replace-OrAddLine $content 'AUTO_CREATE_TABLES' 'false'

$seed = Read-Host 'SEED_DATABASE [true/false] (recommended: false if you already ran studymatch_oracle_full.sql) [false]'
if ([string]::IsNullOrWhiteSpace($seed)) { $seed = 'false' }
$content = Replace-OrAddLine $content 'SEED_DATABASE' $seed

Set-Content -Path $envFile -Value $content -Encoding UTF8
Write-Host "[+] Updated .env"

Write-Host "\n[!] Database import reminder:" -ForegroundColor Yellow
Write-Host "    Run in SQL Developer (schema $oracleUser): database/oracle/studymatch_oracle_full.sql" -ForegroundColor Yellow
Write-Host "    If you ever see duplicate tables (DANHGIA + DanhGia), run: database/oracle/07_cleanup_quoted_tables.sql" -ForegroundColor Yellow

Write-Host "\n[+] Done. Start the app with: .\\run_oracle.ps1"