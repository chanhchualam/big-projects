"""
Tạo stored procedure / view trên database Web (CSGT_MIENTRUNG) — khắc phục lỗi 2812.

Cách dùng (từ thư mục gốc dự án):
  python scripts/deploy_mientrung_procedures.py

Dùng cùng chuỗi kết nối với Flask (config/connections.json → WebApp.ConnectionString
hoặc biến môi trường CSGT_CONNECTION_STRING).

File SQL: sql/14_quick_deploy_csgt_mientrung.sql (tách theo GO — pyodbc không dùng GO).

Lưu ý: nếu batch gọi LINK_BAC / LINK_NAM mà chưa tạo linked server, batch đó sẽ lỗi —
chạy sql/13_setup_linked_servers.sql trong SSMS trước.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SQL_FILE = ROOT / "sql" / "14_quick_deploy_csgt_mientrung.sql"

try:
    import pyodbc
except ImportError:
    print("Cài: pip install pyodbc")
    sys.exit(1)

sys.path.insert(0, str(ROOT))
from web.app import load_connection_string  # noqa: E402


def _configure_stdio_utf8() -> None:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def _strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"/\*[\s\S]*?\*/", "", sql)
    lines = []
    for line in sql.splitlines():
        s = line.strip()
        if s.startswith("--"):
            continue
        if "--" in line:
            line = line.split("--", 1)[0].rstrip()
        lines.append(line)
    return "\n".join(lines)


def _split_go_batches(sql: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    for line in sql.splitlines():
        if re.match(r"^\s*GO\s*$", line, re.I):
            chunk = "\n".join(buf).strip()
            if chunk:
                parts.append(chunk)
            buf = []
        else:
            buf.append(line)
    tail = "\n".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


def main() -> int:
    _configure_stdio_utf8()
    if not SQL_FILE.is_file():
        print(f"Không thấy: {SQL_FILE}")
        return 1

    raw = SQL_FILE.read_text(encoding="utf-8")
    raw = _strip_sql_comments(raw)
    batches = _split_go_batches(raw)
    if not batches:
        print("File SQL không có batch hợp lệ.")
        return 1

    try:
        cs = load_connection_string()
    except Exception as e:
        print(f"Không đọc được chuỗi kết nối: {e}")
        return 1

    print(f"Kết nối: ... (cùng cấu hình với Web)")
    print(f"Số batch: {len(batches)}\n")

    try:
        conn = pyodbc.connect(cs, timeout=30)
    except Exception as e:
        print(f"Lỗi kết nối: {e}")
        return 1

    try:
        conn.autocommit = True
        cur = conn.cursor()
        for i, batch in enumerate(batches, 1):
            preview = batch.replace("\n", " ")[:72].strip()
            print(f"[{i}/{len(batches)}] {preview}...")
            try:
                cur.execute(batch)
            except Exception as e:
                print(f"  -> LỖI: {e}")
                return 1
            print("  -> OK")
    finally:
        conn.close()

    print("\nKiểm tra procedure:")
    try:
        conn = pyodbc.connect(cs, timeout=15)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            """
            SELECT name FROM sys.procedures
            WHERE name IN (
                'sp_CSGT_TruDiem',
                'usp_TraCuuPhatNguoi', 'usp_TruDiemBangLai', 'usp_DemTaiXeVuPhamTren3Lan'
            )
            ORDER BY name
            """
        )
        names = [r[0] for r in cur.fetchall()]
        conn.close()
        for n in names:
            print(f"  [OK] dbo.{n}")
        if len(names) < 4:
            print("  (Thiếu object — xem lỗi batch phía trên)")
    except Exception as e:
        print(f"  Không kiểm tra được: {e}")

    print("\nXong. Tải lại trang web (Xử lý vi phạm, Phạt nguội, …).")
    return 0


if __name__ == "__main__":
    os.chdir(ROOT)
    raise SystemExit(main())
