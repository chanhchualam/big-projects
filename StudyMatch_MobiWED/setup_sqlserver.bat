@echo off
REM ==================== StudyMatch SQL Server Setup Script ====================
REM Run this batch file to set up the entire database in SQL Server

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ==================== StudyMatch - SQL Server Setup ====================
echo.
echo This script will:
echo 1. Install Python dependencies (pyodbc, Flask, SQLAlchemy)
echo 2. Guide you through creating database in SQL Server
echo 3. Provide commands to run SQL scripts
echo.
echo ==================== STEP 1: Install Dependencies ====================
echo.
echo Installing Python packages...
pip install -r requirements.txt

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo ✓ Dependencies installed successfully!
echo.

REM ==================== STEP 2: Database Setup Instructions ====================
echo ==================== STEP 2: SQL Server Database Setup ====================
echo.
echo Please follow these steps to create the database:
echo.
echo Option A - Using SQL Server Management Studio (GUI):
echo   1. Open SQL Server Management Studio
echo   2. Connect to: LAPTOP-96O50AKP
echo   3. Right-click on Databases ^> New Database
echo   4. Name: StudyMatch
echo   5. Click OK
echo.
echo Option B - Using SQL Query:
echo   1. Open SQL Server Management Studio
echo   2. Click New Query
echo   3. Copy and paste: CREATE DATABASE StudyMatch;
echo   4. Press F5 or click Execute
echo.
echo Press any key when database is created...
pause

REM ==================== STEP 3: Execute SQL Scripts ====================
echo.
echo ==================== STEP 3: Running SQL Scripts ====================
echo.
echo.
echo The following SQL scripts need to be executed in order:
echo.
echo 1. database\schema_sqlserver.sql        - Create tables and structure
echo 2. database\views_sqlserver.sql         - Create views
echo 3. database\procedures_sqlserver.sql    - Create stored procedures
echo 4. database\functions_sqlserver.sql     - Create functions
echo 5. database\triggers_sqlserver.sql      - Create triggers
echo 6. database\sample_data_sqlserver.sql   - Insert sample data
echo.
echo To execute scripts:
echo   A. Open each file in SQL Server Management Studio
echo   B. Press F5 or click Execute
echo   C. Repeat for each file in order
echo.
echo Alternatively, use sqlcmd:
echo   sqlcmd -S LAPTOP-96O50AKP -d StudyMatch -i database\schema_sqlserver.sql
echo   sqlcmd -S LAPTOP-96O50AKP -d StudyMatch -i database\views_sqlserver.sql
echo   ... and so on for other files
echo.
echo Press any key when all SQL scripts are executed...
pause

REM ==================== STEP 4: Verify Flask Connection ====================
echo.
echo ==================== STEP 4: Verifying Flask Connection ====================
echo.
echo Testing Python/Flask connection to SQL Server...
python -c "import pyodbc; print('✓ pyodbc imported successfully'); print('Testing connection...'); conn = pyodbc.connect('Driver={ODBC Driver 17 for SQL Server};Server=LAPTOP-96O50AKP;Database=StudyMatch;Trusted_Connection=yes;'); print('✓ Connection to SQL Server successful!')"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo WARNING: Could not connect to SQL Server
    echo Please verify:
    echo   1. SQL Server is running on LAPTOP-96O50AKP
    echo   2. StudyMatch database exists
    echo   3. ODBC Driver 17 for SQL Server is installed
    echo.
    echo To check ODBC drivers:
    echo   1. Windows ^> Settings ^> ODBC Data Sources (64-bit)
    echo   2. Look for "ODBC Driver 17 for SQL Server"
    echo.
    pause
    goto :skip_flask_test
)

echo ✓ Database connection verified!
echo.

:skip_flask_test

REM ==================== STEP 5: Start Flask Application ====================
echo.
echo ==================== Setup Complete! ====================
echo.
echo To start the StudyMatch application, run:
echo   python run.py
echo.
echo Then visit: http://localhost:5000
echo.
echo Press any key to close this window...
pause
