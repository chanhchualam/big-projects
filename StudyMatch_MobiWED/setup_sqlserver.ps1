# ==================== StudyMatch SQL Server Setup Script ====================
# PowerShell version for Windows SQL Server setup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "StudyMatch - SQL Server Configuration" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

# ==================== STEP 1: Install Dependencies ====================
Write-Host "STEP 1: Installing Python Dependencies" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Installing: Flask, SQLAlchemy, pyodbc..."
Write-Host ""

pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies!" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

# ==================== STEP 2: Check SQL Server Connection ====================
Write-Host "STEP 2: Checking SQL Server Connection" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Checking connection to SQL Server: LAPTOP-96O50AKP" -ForegroundColor Cyan
Write-Host ""

try {
    $testConnection = @"
    import pyodbc
    try:
        conn = pyodbc.connect('Driver={ODBC Driver 17 for SQL Server};Server=LAPTOP-96O50AKP;Trusted_Connection=yes;')
        print('✓ SQL Server is running!')
        print(f'  Server: {conn.getinfo(pyodbc.SQL_SERVER_NAME)}')
        print(f'  Driver: {conn.getinfo(pyodbc.SQL_DRIVER_NAME)}')
        conn.close()
    except Exception as e:
        print(f'✗ Cannot connect to SQL Server: {e}')
        print('')
        print('Please ensure:')
        print('  1. SQL Server is running')
        print('  2. Server name is: LAPTOP-96O50AKP')
        print('  3. ODBC Driver 17 for SQL Server is installed')
"@
    python -c $testConnection
}
catch {
    Write-Host "Warning: Could not test SQL Server connection" -ForegroundColor Yellow
}

Write-Host ""

# ==================== STEP 3: Create Database Instructions ====================
Write-Host "STEP 3: Create Database in SQL Server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "The database 'StudyMatch' needs to be created. Choose an option:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option A - Using SQL Server Management Studio (Recommended):" -ForegroundColor Green
Write-Host "  1. Open SQL Server Management Studio" -ForegroundColor White
Write-Host "  2. Connect to: LAPTOP-96O50AKP" -ForegroundColor White
Write-Host "  3. Right-click 'Databases' > New Database" -ForegroundColor White
Write-Host "  4. Name: StudyMatch" -ForegroundColor White
Write-Host "  5. Click OK" -ForegroundColor White
Write-Host ""
Write-Host "Option B - Using PowerShell/Command Line:" -ForegroundColor Green
Write-Host "  sqlcmd -S LAPTOP-96O50AKP -Q `"CREATE DATABASE StudyMatch;`"" -ForegroundColor White
Write-Host ""

$createDB = Read-Host "Do you want to create the database now using Option B? (y/n)"
if ($createDB -eq 'y' -or $createDB -eq 'Y') {
    Write-Host ""
    Write-Host "Creating database..." -ForegroundColor Cyan
    sqlcmd -S LAPTOP-96O50AKP -Q "CREATE DATABASE StudyMatch;"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database created successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "✗ Failed to create database. Please create it manually in SSMS." -ForegroundColor Red
    }
    Write-Host ""
}
else {
    Write-Host "Please create the database manually and press Enter to continue..."
    Read-Host "Press Enter when done"
}

# ==================== STEP 4: Execute SQL Scripts ====================
Write-Host ""
Write-Host "STEP 4: Executing SQL Scripts" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "The following SQL scripts need to be executed in order:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. database\schema_sqlserver.sql        - Tables and structure"
Write-Host "2. database\views_sqlserver.sql         - Views"
Write-Host "3. database\procedures_sqlserver.sql    - Stored procedures"
Write-Host "4. database\functions_sqlserver.sql     - Functions"
Write-Host "5. database\triggers_sqlserver.sql      - Triggers"
Write-Host "6. database\sample_data_sqlserver.sql   - Sample data"
Write-Host ""

$scriptFiles = @(
    "database\schema_sqlserver.sql",
    "database\views_sqlserver.sql",
    "database\procedures_sqlserver.sql",
    "database\functions_sqlserver.sql",
    "database\triggers_sqlserver.sql",
    "database\sample_data_sqlserver.sql"
)

$executeScripts = Read-Host "Do you want to execute all SQL scripts now? (y/n)"
if ($executeScripts -eq 'y' -or $executeScripts -eq 'Y') {
    Write-Host ""
    foreach ($scriptFile in $scriptFiles) {
        if (Test-Path $scriptFile) {
            Write-Host "Executing: $scriptFile" -ForegroundColor Cyan
            sqlcmd -S LAPTOP-96O50AKP -d StudyMatch -i $scriptFile
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ Done" -ForegroundColor Green
            }
            else {
                Write-Host "  ✗ Error executing $scriptFile" -ForegroundColor Red
            }
            Write-Host ""
        }
        else {
            Write-Host "  ✗ File not found: $scriptFile" -ForegroundColor Red
        }
    }
}
else {
    Write-Host "Manual SQL Script Execution:" -ForegroundColor Yellow
    Write-Host "Open SQL Server Management Studio and run each script:" -ForegroundColor Cyan
    foreach ($scriptFile in $scriptFiles) {
        Write-Host "  - $scriptFile" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Press Enter when all scripts are executed..."
    Read-Host "Press Enter to continue"
}

# ==================== STEP 5: Verify Connection ====================
Write-Host ""
Write-Host "STEP 5: Verifying Database Setup" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Testing connection to StudyMatch database..." -ForegroundColor Cyan
Write-Host ""

$verifyScript = @"
import pyodbc
try:
    conn = pyodbc.connect('Driver={ODBC Driver 17 for SQL Server};Server=LAPTOP-96O50AKP;Database=StudyMatch;Trusted_Connection=yes;')
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM sys.tables')
    table_count = cursor.fetchone()[0]
    print(f'✓ Database connection successful!')
    print(f'✓ Found {table_count} tables')
    
    cursor.execute('SELECT COUNT(*) FROM UserThi')
    user_count = cursor.fetchone()[0]
    print(f'✓ Sample data: {user_count} users')
    
    conn.close()
except Exception as e:
    print(f'✗ Error: {e}')
"@

python -c $verifyScript

# ==================== STEP 6: Start Flask ====================
Write-Host ""
Write-Host "STEP 6: Starting Flask Application" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "✓ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the StudyMatch application:" -ForegroundColor Cyan
Write-Host "  1. Open PowerShell/Command Prompt" -ForegroundColor White
Write-Host "  2. Navigate to: c:\Users\ADMIN\Downloads\mon t6\StudyMatch" -ForegroundColor White
Write-Host "  3. Run: python run.py" -ForegroundColor White
Write-Host ""
Write-Host "Then visit: http://localhost:5000" -ForegroundColor Green
Write-Host ""

$startApp = Read-Host "Do you want to start Flask now? (y/n)"
if ($startApp -eq 'y' -or $startApp -eq 'Y') {
    Write-Host ""
    Write-Host "Starting Flask application..." -ForegroundColor Cyan
    python run.py
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete! Enjoy StudyMatch!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
