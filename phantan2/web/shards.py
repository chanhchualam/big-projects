"""
Truy vấn phân mảnh (shard) + nghiệp vụ: BangLai_HanhChinh, BangLai, BangLai_Diem, PhuongTien, BienBan, LoiViPham, ...
Ghi đè SQL trong config/WebApp/Demo.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

import pyodbc

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "connections.json"


def _load_web() -> dict:
    if not CONFIG_PATH.is_file():
        return {}
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("WebApp") or {}


def _demo_sql(key: str, default: str) -> str:
    web = _load_web()
    demo = web.get("Demo") or {}
    return str(demo.get(key) or default).strip()


def default_shard_defs() -> list[dict]:
    return [
        {
            "id": "trung",
            "title": "Miền Trung — CSGT_MIENTRUNG (máy chủ Web)",
            "sql": """
                SELECT MaDonVi, TenDonVi, KhuVuc
                FROM CSGT_MIENTRUNG.dbo.DonViCSGT
            """,
        },
        {
            "id": "nam",
            "title": "Miền Nam — LINK_NAM → CSGT_MIENNAM (TEST2)",
            "sql": """
                SELECT MaDonVi, TenDonVi, KhuVuc
                FROM LINK_NAM.CSGT_MIENNAM.dbo.DonViCSGT
            """,
        },
        {
            "id": "bac",
            "title": "Miền Bắc — LINK_BAC → CSGT_MIENBAC (TEST1)",
            "sql": """
                SELECT MaDonVi, TenDonVi, KhuVuc
                FROM LINK_BAC.CSGT_MIENBAC.dbo.DonViCSGT
            """,
        },
    ]


def get_shard_defs() -> list[dict]:
    web = _load_web()
    custom = web.get("Shards")
    if isinstance(custom, list) and len(custom) > 0:
        out = []
        for i, s in enumerate(custom):
            if not isinstance(s, dict):
                continue
            sid = str(s.get("id") or f"shard{i}")
            title = str(s.get("title") or s.get("label") or sid)
            sql = (s.get("sql") or "").strip()
            if sql:
                out.append({"id": sid, "title": title, "sql": sql})
        if out:
            return out
    return default_shard_defs()


def fetch_don_vi_shards(cs: str, shard_ids: set[str] | None = None) -> dict:
    """
    shard_ids: None = tất cả shard; ví dụ {'nam','bac'} chỉ gọi các shard đó (id trong config).
    """
    rows: list[dict] = []
    errors: list[dict] = []
    for sh in get_shard_defs():
        if shard_ids is not None and sh["id"] not in shard_ids:
            continue
        try:
            with pyodbc.connect(cs, timeout=20) as conn:
                conn.autocommit = True
                cur = conn.cursor()
                cur.execute(sh["sql"])
                for r in cur.fetchall():
                    rows.append(
                        {
                            "MaDonVi": r[0],
                            "TenDonVi": r[1],
                            "KhuVuc": r[2],
                            "NguonDuLieu": sh["title"],
                            "ShardId": sh["id"],
                        }
                    )
        except Exception as e:
            errors.append(
                {"id": sh["id"], "title": sh["title"], "message": str(e)}
            )
    return {"rows": rows, "errors": errors}


def row_to_legacy(r: dict) -> dict:
    return {
        "MaDonVi": r.get("MaDonVi"),
        "TenDonVi": r.get("TenDonVi"),
        "KhuVuc": r.get("KhuVuc"),
    }


# --- Tra cứu bằng lái: BangLai_HanhChinh trên 3 miền + điểm (BangLai_Diem / BangLai) ---

_HANH_CHINH_SOURCES: list[tuple[str, str, str]] = [
    (
        "Miền Trung",
        "Miền Trung — CSGT_MIENTRUNG",
        """
SELECT TOP (1)
    hc.SoBangLai,
    hc.HoTen,
    hc.NgaySinh,
    hc.HangBang
FROM CSGT_MIENTRUNG.dbo.BangLai_HanhChinh hc
WHERE hc.SoBangLai = ?
""",
    ),
    (
        "Miền Nam",
        "Miền Nam — LINK_NAM → CSGT_MIENNAM",
        """
SELECT TOP (1)
    hc.SoBangLai,
    hc.HoTen,
    hc.NgaySinh,
    hc.HangBang
FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai_HanhChinh hc
WHERE hc.SoBangLai = ?
""",
    ),
    (
        "Miền Bắc",
        "Miền Bắc — LINK_BAC → CSGT_MIENBAC",
        """
SELECT TOP (1)
    hc.SoBangLai,
    hc.HoTen,
    hc.NgaySinh,
    hc.HangBang
FROM LINK_BAC.CSGT_MIENBAC.dbo.BangLai_HanhChinh hc
WHERE hc.SoBangLai = ?
""",
    ),
]

_SQL_DIEM_NAM = """
SELECT TOP (1) d.DiemConLai
FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai_Diem d
WHERE d.SoBangLai = ?
"""

_SQL_DIEM_BAC = """
SELECT TOP (1) d.DiemConLai
FROM LINK_BAC.CSGT_MIENBAC.dbo.BangLai_Diem d
WHERE d.SoBangLai = ?
"""

_SQL_DIEM_BANGLAI_1 = """
SELECT TOP (1) bl.DiemConLai
FROM CSGT_MIENTRUNG.dbo.BangLai bl
WHERE bl.SoBangLai = ?
"""

_SQL_DIEM_BANGLAI_2 = """
SELECT TOP (1) bl.TongDiem
FROM CSGT_MIENTRUNG.dbo.BangLai bl
WHERE bl.SoBangLai = ?
"""

_SQL_BANGLAI_NAM_1 = """
SELECT TOP (1) bl.DiemConLai
FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai bl
WHERE bl.SoBangLai = ?
"""

_SQL_BANGLAI_NAM_2 = """
SELECT TOP (1) bl.TongDiem
FROM LINK_NAM.CSGT_MIENNAM.dbo.BangLai bl
WHERE bl.SoBangLai = ?
"""

_SQL_BANGLAI_BAC_1 = """
SELECT TOP (1) bl.DiemConLai
FROM LINK_BAC.CSGT_MIENBAC.dbo.BangLai bl
WHERE bl.SoBangLai = ?
"""

_SQL_BANGLAI_BAC_2 = """
SELECT TOP (1) bl.TongDiem
FROM LINK_BAC.CSGT_MIENBAC.dbo.BangLai bl
WHERE bl.SoBangLai = ?
"""


def _fetch_scalar(cs: str, sql: str, param: str) -> object | None:
    with pyodbc.connect(cs, timeout=20) as conn:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql, (param,))
        r = cur.fetchone()
        if not r:
            return None
        return r[0]


def _fetch_hanh_chinh_row(
    cs: str, so_bang_lai: str, allowed_regions: set[str] | None = None
) -> dict | None:
    """Thử BangLai_HanhChinh lần lượt Trung → Nam → Bắc (linked server có thể lỗi → bỏ qua)."""
    for khu, label, sql in _HANH_CHINH_SOURCES:
        if allowed_regions is not None and khu not in allowed_regions:
            continue
        try:
            with pyodbc.connect(cs, timeout=20) as conn:
                conn.autocommit = True
                cur = conn.cursor()
                cur.execute(sql, (so_bang_lai,))
                r = cur.fetchone()
                if not r:
                    continue
                return {
                    "SoBangLai": r[0],
                    "HoTen": r[1],
                    "NgaySinh": r[2],
                    "HangBang": r[3],
                    "_NguonHanhChinh": label,
                }
        except Exception:
            continue
    return None


def tra_cuu_bang_lai_xuyen_mien(
    cs: str, so_bang_lai: str, allowed_regions: set[str] | None = None
) -> dict | None:
    """
    BangLai_HanhChinh: thử Trung, rồi Nam (LINK_NAM), rồi Bắc (LINK_BAC).
    Điểm: thử BangLai_Diem Nam/Bắc, BangLai Trung/Nam/Bắc (DiemConLai / TongDiem).
    allowed_regions: None = mọi miền; set {'Miền Nam', ...} giới hạn tra cứu.
    Ghi đè: WebApp.Demo.TraCuuBangLai — một ? ; một dòng (fetch_rows_dynamic).
    """
    so_bang_lai = (so_bang_lai or "").strip()
    if not so_bang_lai:
        return None

    custom = _demo_sql("TraCuuBangLai", "").strip()
    if custom:
        cols, rows = fetch_rows_dynamic(cs, custom, (so_bang_lai,))
        if not rows:
            return None
        return rows[0]

    base = _fetch_hanh_chinh_row(cs, so_bang_lai, allowed_regions)
    if base is None:
        return None

    nguon_hc = base.pop("_NguonHanhChinh", None)

    out = {
        **base,
        "DiemConLai": None,
        "_NguonDiem": None,
        "_NguonHanhChinh": nguon_hc,
    }

    diem_strategies: list[tuple[str, str, str]] = [
        ("Miền Nam", "BangLai_Diem (Miền Nam)", _SQL_DIEM_NAM),
        ("Miền Bắc", "BangLai_Diem (Miền Bắc)", _SQL_DIEM_BAC),
        ("Miền Trung", "BangLai.DiemConLai (Miền Trung)", _SQL_DIEM_BANGLAI_1),
        ("Miền Trung", "BangLai.TongDiem (Miền Trung)", _SQL_DIEM_BANGLAI_2),
        ("Miền Nam", "BangLai.DiemConLai (Miền Nam)", _SQL_BANGLAI_NAM_1),
        ("Miền Nam", "BangLai.TongDiem (Miền Nam)", _SQL_BANGLAI_NAM_2),
        ("Miền Bắc", "BangLai.DiemConLai (Miền Bắc)", _SQL_BANGLAI_BAC_1),
        ("Miền Bắc", "BangLai.TongDiem (Miền Bắc)", _SQL_BANGLAI_BAC_2),
    ]
    for khu, label, sql in diem_strategies:
        if allowed_regions is not None and khu not in allowed_regions:
            continue
        try:
            val = _fetch_scalar(cs, sql, so_bang_lai)
            if val is not None:
                out["DiemConLai"] = val
                out["_NguonDiem"] = label
                break
        except Exception:
            continue

    if out["DiemConLai"] is None and out["_NguonDiem"] is None:
        out["_NguonDiem"] = (
            "Chưa có dữ liệu điểm (BangLai_Diem / BangLai trên các miền)"
        )

    return out


def fetch_rows_dynamic(cs: str, sql: str, params: tuple = ()) -> tuple[list[str], list[dict]]:
    """Trả về (tên cột, danh sách dict) — dùng cho PhuongTien, BienBan khi mỗi DB khác cột."""
    with pyodbc.connect(cs, timeout=20) as conn:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql, params)
        if not cur.description:
            return [], []
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    return cols, rows


def fetch_phuong_tien(cs: str) -> tuple[list[str], list[dict]]:
    sql = _demo_sql(
        "ListPhuongTien",
        "SELECT TOP 100 * FROM CSGT_MIENTRUNG.dbo.PhuongTien",
    )
    return fetch_rows_dynamic(cs, sql)


def fetch_bien_so_phuong_tien_trung(cs: str) -> list[str]:
    """Biển số có trong PhuongTien (Trung) — gợi ý ô «Biển số xe» form xử lý vi phạm."""
    sql = _demo_sql(
        "ListBienSoPhuongTienTrung",
        """
        SELECT TOP 200 BienSo
        FROM CSGT_MIENTRUNG.dbo.PhuongTien
        ORDER BY BienSo
        """,
    )
    _, rows = fetch_rows_dynamic(cs, sql)
    out: list[str] = []
    for r in rows:
        v = r.get("BienSo")
        if v is not None and str(v).strip():
            out.append(str(v).strip())
    return out


def fetch_so_bang_lai_trung(cs: str) -> list[str]:
    """SoBangLai có trong BangLai (Trung) — thỏa FK BienBan -> BangLai; gợi ý ô số bằng."""
    sql = _demo_sql(
        "ListSoBangLaiTrung",
        """
        SELECT TOP 200 SoBangLai
        FROM CSGT_MIENTRUNG.dbo.BangLai
        ORDER BY SoBangLai
        """,
    )
    _, rows = fetch_rows_dynamic(cs, sql)
    out: list[str] = []
    for r in rows:
        v = r.get("SoBangLai")
        if v is not None and str(v).strip():
            out.append(str(v).strip())
    return out


def _sql_bien_ban_shard(nguon_mien: str, db_dbo: str) -> str:
    """db_dbo: ví dụ CSGT_MIENTRUNG.dbo — JOIN cùng schema trên một shard."""
    esc = nguon_mien.replace("'", "''")
    return f"""
SELECT TOP (100)
    N'{esc}' AS NguonMien,
    bb.MaBienBan,
    bb.NgayViPham,
    bb.DiaDiem,
    bb.TrangThai,
    bb.BienSo,
    bb.SoBangLai,
    bb.MaDonVi_XuLy,
    dv.TenDonVi AS TenDonViXuLy,
    ctp.MaLoi,
    lv.TenLoi AS TenLoiViPham,
    ctp.SoTien AS SoTienPhat,
    ctp.HinhAnhMinhHoa,
    qd.SoQuyetDinh,
    qd.NgayRaQD,
    qd.TongTien AS TongTienQuyetDinh,
    gd.MaGD,
    gd.NgayNop,
    gd.SoTien AS SoTienNop,
    gd.NoiNop
FROM {db_dbo}.BienBan bb
LEFT JOIN {db_dbo}.DonViCSGT dv ON dv.MaDonVi = bb.MaDonVi_XuLy
LEFT JOIN {db_dbo}.ChiTietPhat ctp ON ctp.MaBienBan = bb.MaBienBan
LEFT JOIN {db_dbo}.LoiViPham lv ON lv.MaLoi = ctp.MaLoi
LEFT JOIN {db_dbo}.QuyetDinhXuPhat qd ON qd.MaBienBan = bb.MaBienBan
LEFT JOIN {db_dbo}.GiaoDichNopPhat gd ON gd.SoQuyetDinh = qd.SoQuyetDinh
WHERE 1 = 1
"""


_BIEN_BAN_SHARD_DEFS: list[tuple[str, str]] = [
    ("Miền Trung", "CSGT_MIENTRUNG.dbo"),
    ("Miền Nam", "LINK_NAM.CSGT_MIENNAM.dbo"),
    ("Miền Bắc", "LINK_BAC.CSGT_MIENBAC.dbo"),
]


def _sort_bien_ban_rows(rows: list[dict]) -> list[dict]:
    from datetime import date as date_type

    def key(r: dict):
        d = r.get("NgayViPham")
        m = r.get("MaBienBan")
        try:
            mi = int(m) if m is not None else 0
        except (TypeError, ValueError):
            mi = 0
        if d is None:
            t = datetime.min
        elif isinstance(d, datetime):
            t = d
        elif isinstance(d, date_type):
            t = datetime.combine(d, datetime.min.time())
        else:
            t = datetime.min
        return (t, mi)

    out = list(rows)
    out.sort(key=key, reverse=True)
    return out[:100]


def fetch_bien_ban_tra_cuu(
    cs: str,
    ma_bien_ban: str | None = None,
    bien_so: str | None = None,
    so_bang_lai: str | None = None,
    allowed_regions: set[str] | None = None,
) -> tuple[list[str], list[dict]]:
    """
    Tra cứu biên bản trên 3 miền (UNION thủ công qua từng shard), cột NguonMien.
    Ghi đè khi không lọc: WebApp.Demo.ListBienBan (câu SELECT tùy ý — không gộp shard).
    Khi có điều kiện lọc hoặc duyệt mặc định: gọi từng miền rồi gộp, sắp xếp, TOP 100.
    """
    ma_bien_ban = (ma_bien_ban or "").strip()
    bien_so = (bien_so or "").strip()
    so_bang_lai = (so_bang_lai or "").strip()
    has_filter = bool(ma_bien_ban or bien_so or so_bang_lai)

    custom_browse = _demo_sql(
        "ListBienBan",
        "",
    ).strip()
    if custom_browse and not has_filter:
        return fetch_rows_dynamic(cs, custom_browse)

    params: list = []
    tail = ""
    if ma_bien_ban:
        try:
            ma_int = int(ma_bien_ban)
        except ValueError as e:
            raise ValueError("Mã biên bản phải là số nguyên (MaBienBan).") from e
        tail += " AND bb.MaBienBan = ?"
        params.append(ma_int)
    if bien_so:
        tail += " AND bb.BienSo LIKE ?"
        params.append(f"%{bien_so}%")
    if so_bang_lai:
        tail += " AND bb.SoBangLai = ?"
        params.append(so_bang_lai)
    tail += " ORDER BY bb.NgayViPham DESC, bb.MaBienBan DESC"
    tup = tuple(params)

    merged: list[dict] = []
    cols_out: list[str] | None = None
    for khu, db_dbo in _BIEN_BAN_SHARD_DEFS:
        if allowed_regions is not None and khu not in allowed_regions:
            continue
        sql = _sql_bien_ban_shard(khu, db_dbo) + tail
        try:
            cols, part = fetch_rows_dynamic(cs, sql, tup)
            if cols_out is None:
                cols_out = cols
            merged.extend(part)
        except Exception:
            continue

    if not merged:
        empty_cols = [
            "NguonMien",
            "MaBienBan",
            "NgayViPham",
            "DiaDiem",
            "TrangThai",
            "BienSo",
            "SoBangLai",
            "MaDonVi_XuLy",
            "TenDonViXuLy",
            "MaLoi",
            "TenLoiViPham",
            "SoTienPhat",
            "HinhAnhMinhHoa",
            "SoQuyetDinh",
            "NgayRaQD",
            "TongTienQuyetDinh",
            "MaGD",
            "NgayNop",
            "SoTienNop",
            "NoiNop",
        ]
        return empty_cols, []

    ordered = _sort_bien_ban_rows(merged)
    return cols_out or list(ordered[0].keys()), ordered


def fetch_bien_ban_mau(cs: str) -> tuple[list[str], list[dict]]:
    """Tương thích: danh sách không lọc (có thể ghi đè ListBienBan)."""
    return fetch_bien_ban_tra_cuu(cs)


_LOI_SQL_TRUNG = """
SELECT MaLoi, TenLoi, MucPhatTien, DiemTru, N'Miền Trung' AS NguonMien
FROM CSGT_MIENTRUNG.dbo.LoiViPham
"""
_LOI_SQL_NAM = """
SELECT MaLoi, TenLoi, MucPhatTien, DiemTru, N'Miền Nam' AS NguonMien
FROM LINK_NAM.CSGT_MIENNAM.dbo.LoiViPham
"""
_LOI_SQL_BAC = """
SELECT MaLoi, TenLoi, MucPhatTien, DiemTru, N'Miền Bắc' AS NguonMien
FROM LINK_BAC.CSGT_MIENBAC.dbo.LoiViPham
"""


def list_loi_vi_pham(
    cs: str, allowed_regions: set[str] | None = None
) -> list[dict]:
    """
    Gộp LoiViPham từ 3 miền (qua linked server). Ghi đè WebApp.Demo.ListLoiViPham = một SELECT
    thì chỉ chạy câu đó (một miền / tùy biến).
    """
    custom = _demo_sql("ListLoiViPham", "").strip()
    if custom:
        with pyodbc.connect(cs, timeout=15) as conn:
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(custom)
            cols = [c[0] for c in cur.description] if cur.description else []
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        return rows

    parts: list[tuple[str, str]] = [
        ("Miền Trung", _LOI_SQL_TRUNG),
        ("Miền Nam", _LOI_SQL_NAM),
        ("Miền Bắc", _LOI_SQL_BAC),
    ]
    out: list[dict] = []
    for khu, sql in parts:
        if allowed_regions is not None and khu not in allowed_regions:
            continue
        try:
            with pyodbc.connect(cs, timeout=15) as conn:
                conn.autocommit = True
                cur = conn.cursor()
                cur.execute(sql + " ORDER BY MaLoi")
                for r in cur.fetchall():
                    out.append(
                        {
                            "MaLoi": r[0],
                            "TenLoi": r[1],
                            "MucPhatTien": r[2],
                            "DiemTru": r[3],
                            "NguonMien": r[4],
                        }
                    )
        except Exception:
            continue
    out.sort(
        key=lambda x: (str(x.get("MaLoi") or ""), str(x.get("NguonMien") or ""))
    )
    return out


def insert_loi_vi_pham(cs: str, ma: str, ten: str, muc_phat: float, diem_tru: int) -> None:
    try:
        ma_loi = int(str(ma).strip())
    except ValueError as e:
        raise ValueError("Mã lỗi phải là số nguyên (khớp cột MaLoi trong LoiViPham).") from e
    sql = _demo_sql(
        "InsertLoiViPham",
        """
        INSERT INTO dbo.LoiViPham (MaLoi, TenLoi, MucPhatTien, DiemTru)
        VALUES (?, ?, ?, ?)
        """,
    )
    with pyodbc.connect(cs, timeout=15) as conn:
        cur = conn.cursor()
        cur.execute(sql, (ma_loi, ten.strip(), muc_phat, diem_tru))
        conn.commit()


def _safe_proc(name: str) -> str:
    name = name.strip()
    if not re.match(r"^[\w\.]+$", name):
        raise ValueError("Tên procedure không hợp lệ")
    return name


def goi_proc_tru_diem(cs: str, so_bang: str, ma_loi: str, noi_lap: str) -> None:
    proc = _safe_proc(_demo_sql("ProcTruDiem", "dbo.sp_CSGT_TruDiem"))
    so_bang = (so_bang or "").strip()
    ma_loi = (ma_loi or "").strip()
    noi_lap = (noi_lap or "").strip()
    with pyodbc.connect(cs, timeout=30) as conn:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            f"EXEC {proc} @SoBangLai=?, @MaLoi=?, @NoiLap=?",
            (so_bang, ma_loi, noi_lap),
        )


def dem_loi_tren_bac_qua_link(cs: str) -> int | None:
    """Tương thích cũ: chỉ đếm Miền Bắc qua LINK_BAC."""
    d = dem_loi_vi_pham_counts(cs, shard_ids=None)
    return d.get("bac")


def dem_loi_vi_pham_counts(
    cs: str, shard_ids: set[str] | None = None
) -> dict[str, int | None]:
    """Đếm dòng LoiViPham trên từng shard (từ node điều phối)."""
    sql_trung = _demo_sql(
        "CountLoiTrung",
        "SELECT COUNT(*) FROM CSGT_MIENTRUNG.dbo.LoiViPham",
    )
    sql_nam = _demo_sql(
        "CountLoiNam",
        "SELECT COUNT(*) FROM LINK_NAM.CSGT_MIENNAM.dbo.LoiViPham",
    )
    sql_bac = _demo_sql(
        "CountLoiBac",
        "SELECT COUNT(*) FROM LINK_BAC.CSGT_MIENBAC.dbo.LoiViPham",
    )
    out: dict[str, int | None] = {"trung": None, "nam": None, "bac": None}
    for key, sql in (("trung", sql_trung), ("nam", sql_nam), ("bac", sql_bac)):
        if shard_ids is not None and key not in shard_ids:
            out[key] = None
            continue
        try:
            with pyodbc.connect(cs, timeout=15) as conn:
                conn.autocommit = True
                cur = conn.cursor()
                cur.execute(sql)
                r = cur.fetchone()
                out[key] = int(r[0]) if r else 0
        except Exception:
            out[key] = None
    return out


def thong_ke_bien_ban_toan_quoc(
    cs: str, shard_ids: set[str] | None = None
) -> dict:
    """Đếm biên bản trên 3 miền (tùy chọn minh họa thêm). shard_ids lọc theo quyền."""
    sql_trung = _demo_sql(
        "CountBienBanTrung",
        "SELECT COUNT(*) FROM CSGT_MIENTRUNG.dbo.BienBan",
    )
    sql_nam = _demo_sql(
        "CountBienBanNam",
        "SELECT COUNT(*) FROM LINK_NAM.CSGT_MIENNAM.dbo.BienBan",
    )
    sql_bac = _demo_sql(
        "CountBienBanBac",
        "SELECT COUNT(*) FROM LINK_BAC.CSGT_MIENBAC.dbo.BienBan",
    )
    out = {"trung": None, "nam": None, "bac": None, "errors": []}
    for key, sql in (("trung", sql_trung), ("nam", sql_nam), ("bac", sql_bac)):
        if shard_ids is not None and key not in shard_ids:
            out[key] = None
            continue
        try:
            with pyodbc.connect(cs, timeout=15) as conn:
                conn.autocommit = True
                cur = conn.cursor()
                cur.execute(sql)
                r = cur.fetchone()
                out[key] = int(r[0]) if r else 0
        except Exception as e:
            out[key] = None
            out["errors"].append(f"{key}: {e}")
    return out


# --- Báo cáo Miền Trung: phạt chi tiết > 10 triệu (đề phân tán / bài tập SQL) ---

_SQL_PHAT_TREN_10_TRIEU_TRUNG = """
SELECT
    qd.SoQuyetDinh,
    qd.TongTien AS TongTienPhat,
    lv.TenLoi AS TenLoiViPham
FROM CSGT_MIENTRUNG.dbo.BienBan AS bb
INNER JOIN CSGT_MIENTRUNG.dbo.ChiTietPhat AS ctp
       ON ctp.MaBienBan = bb.MaBienBan
INNER JOIN CSGT_MIENTRUNG.dbo.LoiViPham AS lv
       ON lv.MaLoi = ctp.MaLoi
LEFT JOIN CSGT_MIENTRUNG.dbo.QuyetDinhXuPhat AS qd
       ON qd.MaBienBan = bb.MaBienBan
WHERE ctp.SoTien > 10000000
ORDER BY qd.SoQuyetDinh, bb.MaBienBan, lv.TenLoi
"""


def fetch_phat_tren_10_trieu_mien_trung(cs: str) -> tuple[list[str], list[dict]]:
    """
    Site Miền Trung: Số QĐ, Tổng tiền phạt, Tên lỗi — chi tiết > 10.000.000 đ.
    Ghi đè: WebApp.Demo.QueryPhatTren10TrieuTrung trong config/connections.json.
    """
    sql = _demo_sql(
        "QueryPhatTren10TrieuTrung",
        _SQL_PHAT_TREN_10_TRIEU_TRUNG,
    ).strip()
    return fetch_rows_dynamic(cs, sql)


_SQL_THU_NGAN_SACH_TOAN_QUOC = """
SELECT N'Bắc' AS MaKhuVuc, SUM(ISNULL(gd.SoTien, 0)) AS TongTienDaThu
FROM LINK_BAC.CSGT_MIENBAC.dbo.GiaoDichNopPhat AS gd
UNION ALL
SELECT N'Trung', SUM(ISNULL(gd.SoTien, 0))
FROM CSGT_MIENTRUNG.dbo.GiaoDichNopPhat AS gd
UNION ALL
SELECT N'Nam', SUM(ISNULL(gd.SoTien, 0))
FROM LINK_NAM.CSGT_MIENNAM.dbo.GiaoDichNopPhat AS gd
"""


def fetch_thu_ngan_sach_toan_quoc(cs: str) -> tuple[list[str], list[dict]]:
    """
    Câu 5 đồ án: SUM(GiaoDichNopPhat) theo miền qua Linked Server (đứng tại Trung).
    Ghi đè: WebApp.Demo.QueryThuNganSachToanQuoc — hoặc tạo view dbo.vw_ThuNganSachTheoMien (sql/12...).
    """
    sql = _demo_sql(
        "QueryThuNganSachToanQuoc",
        _SQL_THU_NGAN_SACH_TOAN_QUOC,
    ).strip()
    return fetch_rows_dynamic(cs, sql)


def exec_tra_cuu_phat_nguoi(cs: str, bien_so: str) -> tuple[list[str], list[dict]]:
    """
    Câu 3: EXEC dbo.usp_TraCuuPhatNguoi trên CSGT_MIENTRUNG (phiên bản Trung trong sql/12).
    Ghi đè tên: WebApp.Demo.ProcTraCuuPhatNguoi.
    """
    bien_so = (bien_so or "").strip()
    if not bien_so:
        return [], []
    proc = _safe_proc(_demo_sql("ProcTraCuuPhatNguoi", "dbo.usp_TraCuuPhatNguoi"))
    with pyodbc.connect(cs, timeout=45) as conn:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"EXEC {proc} ?", (bien_so,))
        if not cur.description:
            return [], []
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    return cols, rows


def exec_usp_tru_diem_bang_lai(cs: str, so_bang_lai: str, diem_tru: int) -> dict | None:
    """
    Câu 4: EXEC dbo.usp_TruDiemBangLai — trừ điểm qua LINK_NAM (Miền Nam).
    Ghi đè: WebApp.Demo.ProcTruDiemBangLai.
    """
    proc = _safe_proc(_demo_sql("ProcTruDiemBangLai", "dbo.usp_TruDiemBangLai"))
    so_bang_lai = (so_bang_lai or "").strip()
    with pyodbc.connect(cs, timeout=45) as conn:
        # autocommit: tránh transaction ngoài + UPDATE linked server (7395/7412).
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"EXEC {proc} ?, ?", (so_bang_lai, int(diem_tru)))
        if not cur.description:
            return None
        cols = [c[0] for c in cur.description]
        row = cur.fetchone()
        if not row:
            return None
        return dict(zip(cols, row))


def exec_dem_tai_xe_vu_pham_tren3_lan(
    cs: str, nam: int
) -> dict[str, object]:
    """
    Câu 7: hai tập kết quả từ dbo.usp_DemTaiXeVuPhamTren3Lan.
    Ghi đè: WebApp.Demo.ProcDemTaiXeVuPhamTren3Lan.
    """
    proc = _safe_proc(
        _demo_sql("ProcDemTaiXeVuPhamTren3Lan", "dbo.usp_DemTaiXeVuPhamTren3Lan")
    )
    out: dict[str, object] = {
        "total_row": None,
        "detail_columns": [],
        "detail_rows": [],
    }
    with pyodbc.connect(cs, timeout=90) as conn:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"EXEC {proc} ?", (int(nam),))
        if cur.description:
            cols = [c[0] for c in cur.description]
            r = cur.fetchone()
            if r:
                out["total_row"] = dict(zip(cols, r))
        if cur.nextset() and cur.description:
            dcols = [c[0] for c in cur.description]
            out["detail_columns"] = dcols
            out["detail_rows"] = [
                dict(zip(dcols, row)) for row in cur.fetchall()
            ]
    return out
