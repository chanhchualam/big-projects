# StudyMatch - SQL Server Setup Guide

## 📋 Overview
This guide will help you set up the StudyMatch database on **Microsoft SQL Server** instead of Oracle.

---

## 🔧 Prerequisites

✅ **SQL Server 2016+ Express** installed (LAPTOP-96O50AKP)
✅ **SQL Server Management Studio** installed
✅ **ODBC Driver 17 for SQL Server** installed

### Check ODBC Driver Installation:
```powershell
# In PowerShell
Get-OdbcDriver | Select-Object Name | grep "ODBC Driver"
```

If not installed, download from:
https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

---

## 📝 Step 1: Install Python Dependencies

Replace Oracle driver with SQL Server driver:

```bash
# Navigate to project directory
cd "c:\Users\ADMIN\Downloads\mon t6\StudyMatch"

# Install dependencies
pip install -r requirements.txt
```

**Key Changes:**
- ❌ Removed: `cx-Oracle==8.3.0` (Oracle driver)
- ✅ Added: `pyodbc==5.0.1` (SQL Server driver)

---

## 🗄️ Step 2: Create Database in SQL Server

**Option A: Using SQL Server Management Studio (SSMS)**

1. Open **SQL Server Management Studio**
2. Connect to: `LAPTOP-96O50AKP`
3. Right-click on **Databases** → **New Database**
4. Database name: `StudyMatch`
5. Click **OK**

**Option B: Using SQL Query**

1. Open **New Query** in SSMS
2. Run:
```sql
CREATE DATABASE StudyMatch;
GO
```

---

## 🏗️ Step 3: Execute SQL Scripts

Run the following scripts **IN ORDER** in SQL Server Management Studio:

### 3.1 Create Tables & Schema
```bash
# Open schema_sqlserver.sql
database\schema_sqlserver.sql
```
- Creates database (if not exists)
- Creates 10 main tables with relationships
- Adds indexes for performance

### 3.2 Create Views
```bash
database\views_sqlserver.sql
```
- Creates 5 useful views for querying data

### 3.3 Create Stored Procedures
```bash
database\procedures_sqlserver.sql
```
- Creates 5 procedures for common operations

### 3.4 Create Functions
```bash
database\functions_sqlserver.sql
```
- Creates 7 utility functions

### 3.5 Create Triggers
```bash
database\triggers_sqlserver.sql
```
- Creates 8 triggers for data validation

### 3.6 Insert Sample Data
```bash
database\sample_data_sqlserver.sql
```
- Inserts sample data for testing

---

## 🔌 Step 4: Configure Flask App

The app is already configured! Check `app/__init__.py`:

```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'mssql+pyodbc://LAPTOP-96O50AKP/StudyMatch?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes'
```

### Connection String Explanation:
- `mssql+pyodbc://` - SQL Server + pyodbc driver
- `LAPTOP-96O50AKP` - Server name
- `StudyMatch` - Database name
- `driver=ODBC+Driver+17+for+SQL+Server` - ODBC driver version
- `Trusted_Connection=yes` - Use Windows Authentication

### If You Use SQL Server Authentication:
```python
# Replace with:
app.config['SQLALCHEMY_DATABASE_URI'] = 'mssql+pyodbc://username:password@LAPTOP-96O50AKP/StudyMatch?driver=ODBC+Driver+17+for+SQL+Server'
```

---

## 🚀 Step 5: Run Flask Application

```bash
# Navigate to project
cd "c:\Users\ADMIN\Downloads\mon t6\StudyMatch"

# Run the app
python run.py
```

**Expected Output:**
```
 * Running on http://localhost:5000 (Press CTRL+C to quit)
 * Debug mode: on
```

**Test in Browser:**
- Visit: http://localhost:5000
- You should see the StudyMatch homepage

---

## 📊 Database Schema Overview

### Tables Created:

| Table | Purpose | Records |
|-------|---------|---------|
| **UserThi** | Student accounts | 5 |
| **KhoiThi** | Test blocks (A, B, C, D) | 4 |
| **MonTrongKhoiThi** | Subjects per block | 12 |
| **MonHoc** | All subjects list | 10 |
| **Diem** | Student scores | 15 |
| **TruongDH** | Universities | 5 |
| **Nganh** | Majors/Programs | 10 |
| **GiaoVien** | Teachers | 5 |
| **ThongTinTuyenSinh** | Admission info | 5 |
| **DanhGia** | Student ratings | 6 |

---

## 🛠️ Useful SQL Queries

### View All Databases:
```sql
SELECT name FROM sys.databases;
```

### Check Table Structure:
```sql
USE StudyMatch;
EXEC sp_tables @table_name='UserThi';
```

### View Sample Data:
```sql
USE StudyMatch;
SELECT TOP 10 * FROM UserThi;
```

### Test Stored Procedure:
```sql
EXEC sp_RegisterStudent 
    @UserName = 'testuser',
    @MatKhau = 'password123',
    @HoTen = 'Test User',
    @Email = 'test@email.com';
```

### View Student Recommendations:
```sql
EXEC sp_GetStudentRecommendations @UserId = 1;
```

---

## ⚠️ Troubleshooting

### Error: "pyodbc.InterfaceError: ('IM002', '[IM002] [Microsoft][ODBC Driver Manager]..."

**Solution:** Install ODBC Driver 17 for SQL Server
```powershell
# Check installed drivers
Get-OdbcDriver

# Download and install from:
# https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
```

### Error: "login failed for user 'ADMIN'"

**Solution:** Use Windows Authentication (already configured)
- Or add SQL Server credentials to connection string

### Error: "database 'StudyMatch' does not exist"

**Solution:** Create the database first
```sql
CREATE DATABASE StudyMatch;
```

### Flask App Won't Start

**Solution:** Check connection string in `app/__init__.py`
```bash
# Test connection with Python:
python -c "import pyodbc; print(pyodbc.connect('Driver={ODBC Driver 17 for SQL Server};Server=LAPTOP-96O50AKP;Database=StudyMatch;Trusted_Connection=yes;'))"
```

---

## 📁 Project Files Changed

| File | Change |
|------|--------|
| `app/__init__.py` | Updated database URI for SQL Server |
| `requirements.txt` | Replaced cx-Oracle with pyodbc |
| `database/schema_sqlserver.sql` | ✨ NEW - SQL Server schema |
| `database/views_sqlserver.sql` | ✨ NEW - SQL Server views |
| `database/procedures_sqlserver.sql` | ✨ NEW - SQL Server procedures |
| `database/functions_sqlserver.sql` | ✨ NEW - SQL Server functions |
| `database/triggers_sqlserver.sql` | ✨ NEW - SQL Server triggers |
| `database/sample_data_sqlserver.sql` | ✨ NEW - Sample data |

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] SQL Server Running: `LAPTOP-96O50AKP`
- [ ] Database Created: `StudyMatch`
- [ ] All 10 tables exist
- [ ] All views, procedures, functions, triggers created
- [ ] Sample data inserted (10 rows in various tables)
- [ ] Python dependencies installed (pyodbc, Flask, SQLAlchemy)
- [ ] Flask app starts without errors
- [ ] Can access http://localhost:5000

---

## 🎯 Next Steps

1. **Customize Connection String** (if needed)
2. **Add More Universities & Majors** via SQL
3. **Test Endpoints** in web interface
4. **Add User Authentication** for security
5. **Deploy to Production** (Azure, etc.)

---

## 📞 Support

For issues or questions:
- Check Flask app logs: `python run.py` output
- Check SQL Server error logs in SSMS
- Verify ODBC driver: `odbcconf.exe` command

**Happy coding! 🚀**
