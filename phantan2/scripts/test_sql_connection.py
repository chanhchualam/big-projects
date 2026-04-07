"""
Kiểm tra kết nối tới 4 CSDL (Bắc / Trung / Nam / Coordinator).
Cài: pip install pyodbc
Windows: cần ODBC Driver 17/18 for SQL Server.
"""
import json
import os
import sys

try:
    import pyodbc
except ImportError:
    print("Chạy: pip install pyodbc")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(ROOT, "config", "connections.json")


def load_strings():
    if os.path.isfile(CFG):
        with open(CFG, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("ConnectionStrings", {})
    # fallback: sửa trực tiếp
    drv = "Driver={ODBC Driver 18 for SQL Server};"
    return {
        "Bac": os.environ.get(
            "SQL_BAC",
            f"{drv}Server=localhost;Database=TrafficViolation_Bac;Trusted_Connection=yes;TrustServerCertificate=yes;",
        ),
        "Trung": os.environ.get(
            "SQL_TRUNG",
            f"{drv}Server=localhost;Database=TrafficViolation_Trung;Trusted_Connection=yes;TrustServerCertificate=yes;",
        ),
        "Nam": os.environ.get(
            "SQL_NAM",
            f"{drv}Server=localhost;Database=TrafficViolation_Nam;Trusted_Connection=yes;TrustServerCertificate=yes;",
        ),
        "Coordinator": os.environ.get(
            "SQL_COORD",
            f"{drv}Server=localhost;Database=TrafficViolation_Coordinator;Trusted_Connection=yes;TrustServerCertificate=yes;",
        ),
    }


def main():
    conns = load_strings()
    for name, cs in conns.items():
        try:
            c = pyodbc.connect(cs, timeout=5)
            cur = c.cursor()
            cur.execute("SELECT DB_NAME(), @@VERSION")
            row = cur.fetchone()
            print(f"[OK] {name}: DB={row[0]}")
            c.close()
        except Exception as e:
            print(f"[LOI] {name}: {e}")


if __name__ == "__main__":
    main()
