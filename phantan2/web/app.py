"""
Ứng dụng web quản lý CSGT — đăng nhập, dashboard, danh sách, lọc, xuất CSV.
Chạy: python -m flask --app web.app run
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

import pyodbc
from flask import (
    Flask,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    Response,
    session,
    url_for,
)
from urllib.parse import urlencode

from web import auth_users
from web import shards

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config" / "connections.json"

_SQL_SERVER_DRIVER_PREFERENCE = (
    "ODBC Driver 18 for SQL Server",
    "ODBC Driver 17 for SQL Server",
    "ODBC Driver 13 for SQL Server",
    "ODBC Driver 11 for SQL Server",
    "SQL Server Native Client 11.0",
    "SQL Server Native Client 10.0",
    "SQL Server",
)


def _installed_odbc_drivers() -> set[str]:
    return set(pyodbc.drivers())


def _pick_sql_server_driver() -> str:
    installed = _installed_odbc_drivers()
    for name in _SQL_SERVER_DRIVER_PREFERENCE:
        if name in installed:
            return name
    raise RuntimeError(
        "Chưa có ODBC driver cho SQL Server trên máy này. "
        "Cài 'Microsoft ODBC Driver 17 or 18 for SQL Server'. "
        f"Drivers hiện có: {sorted(installed) or '(trống)'}"
    )


def resolve_connection_string(raw: str) -> str:
    raw = raw.strip()
    m = re.search(r"Driver\s*=\s*\{([^}]*)\}", raw, flags=re.IGNORECASE)
    if not m:
        d = _pick_sql_server_driver()
        sep = "" if raw.endswith(";") else ";"
        return f"Driver={{{d}}}{sep}{raw}"

    requested = m.group(1).strip()
    if requested in _installed_odbc_drivers():
        return raw

    chosen = _pick_sql_server_driver()
    return re.sub(
        r"Driver\s*=\s*\{[^}]*\}",
        f"Driver={{{chosen}}}",
        raw,
        count=1,
        flags=re.IGNORECASE,
    )


_ORDER_KHU = ("Miền Bắc", "Miền Trung", "Miền Nam")


def load_connection_string() -> str:
    env = os.environ.get("CSGT_CONNECTION_STRING")
    if env:
        return resolve_connection_string(env.strip())
    if not CONFIG_PATH.is_file():
        raise FileNotFoundError(f"Không thấy {CONFIG_PATH}")
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    web = data.get("WebApp") or {}
    cs = web.get("ConnectionString") or data.get("CsgtConnectionString")
    if not cs:
        raise KeyError("Thiếu WebApp.ConnectionString trong config/connections.json")
    return resolve_connection_string(cs)


def load_connection_string_for_shard(shard: str) -> str:
    """Chuỗi ODBC tới đúng CSDL miền (trung | nam | bac) — dùng khi ghi danh mục lỗi."""
    key = {"trung": "Trung", "nam": "Nam", "bac": "Bac"}.get(shard)
    if not key:
        raise ValueError("shard phải là trung, nam hoặc bac")
    if not CONFIG_PATH.is_file():
        raise FileNotFoundError(f"Không thấy {CONFIG_PATH}")
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    raw = (data.get("ConnectionStrings") or {}).get(key)
    if not raw:
        raise KeyError(f"Thiếu ConnectionStrings.{key} trong config/connections.json")
    return resolve_connection_string(str(raw).strip())


def current_allowed_regions() -> set[str] | None:
    """None = toàn quốc."""
    from flask import session

    return auth_users.allowed_region_names_from_session(session)


def current_shard_ids() -> set[str] | None:
    return auth_users.shard_ids_for_session(current_allowed_regions())


def fetch_don_vi(shard_ids: set[str] | None = None) -> list[dict]:
    """Phân mảnh ngang: gọi từng shard (Linked Server); có cột NguonDuLieu."""
    cs = load_connection_string()
    res = shards.fetch_don_vi_shards(cs, shard_ids=shard_ids)
    if not res["rows"] and res["errors"]:
        raise RuntimeError(
            "Không lấy được dữ liệu từ bất kỳ shard nào: "
            + "; ".join(e["message"] for e in res["errors"])
        )
    return res["rows"]


def fetch_don_vi_shard_result(shard_ids: set[str] | None = None) -> dict:
    """Trả về cả dòng lỗi shard (minh họa giả lập sự cố một node)."""
    cs = load_connection_string()
    return shards.fetch_don_vi_shards(cs, shard_ids=shard_ids)


def stats_from_rows(rows: list[dict]) -> dict:
    c = Counter((r.get("KhuVuc") or "").strip() for r in rows)
    if "" in c:
        del c[""]
    items: list[tuple[str, int]] = []
    for k in _ORDER_KHU:
        if k in c:
            items.append((k, c[k]))
    for k, v in sorted(c.items()):
        if k not in _ORDER_KHU:
            items.append((k, v))
    return {"tong": len(rows), "theo_khu": items}


def _match_text(field_lower: str, ql: str, khop: str) -> bool:
    if khop == "chua":
        return ql in field_lower
    if khop == "bat_dau":
        return field_lower.startswith(ql)
    return False


def filter_rows(
    rows: list[dict],
    q: str | None,
    khu_vucs: list[str] | None,
    tim_trong: str = "tat_ca",
    khop: str = "chua",
) -> list[dict]:
    """
    khu_vucs: None hoặc [] = tất cả miền; danh sách = chỉ các KhuVuc trong tập.
    tim_trong: tat_ca | ma | ten
    khop: chua | bat_dau | chinh_xac_ma (chỉ áp dụng mã đơn vị)
    """
    q_raw = (q or "").strip()
    ql = q_raw.lower()
    region_set: set[str] | None = None
    if khu_vucs:
        region_set = {x.strip() for x in khu_vucs if x.strip()}

    out: list[dict] = []
    for r in rows:
        rkv = str(r.get("KhuVuc") or "").strip()
        if region_set is not None and rkv not in region_set:
            continue

        if not q_raw:
            out.append(r)
            continue

        ma = str(r.get("MaDonVi") or "").strip()
        ten = str(r.get("TenDonVi") or "").strip()
        ma_l = ma.lower()
        ten_l = ten.lower()

        if khop == "chinh_xac_ma":
            if ma_l == ql:
                out.append(r)
            continue

        ok = False
        if tim_trong == "ma":
            ok = _match_text(ma_l, ql, khop)
        elif tim_trong == "ten":
            ok = _match_text(ten_l, ql, khop)
        else:
            ok = _match_text(ma_l, ql, khop) or _match_text(ten_l, ql, khop)

        if ok:
            out.append(r)
    return out


def sort_rows(rows: list[dict], sap_xep: str) -> list[dict]:
    r = list(rows)
    if sap_xep in (None, "", "mac_dinh"):
        return r
    if sap_xep == "ma_asc":
        r.sort(key=lambda x: str(x.get("MaDonVi") or "").lower())
    elif sap_xep == "ma_desc":
        r.sort(key=lambda x: str(x.get("MaDonVi") or "").lower(), reverse=True)
    elif sap_xep == "ten_asc":
        r.sort(key=lambda x: str(x.get("TenDonVi") or "").lower())
    elif sap_xep == "ten_desc":
        r.sort(key=lambda x: str(x.get("TenDonVi") or "").lower(), reverse=True)
    elif sap_xep == "khu_asc":
        r.sort(key=lambda x: str(x.get("KhuVuc") or "").lower())
    elif sap_xep == "khu_desc":
        r.sort(key=lambda x: str(x.get("KhuVuc") or "").lower(), reverse=True)
    return r


def parse_don_vi_filters(req) -> dict:
    q = (req.args.get("q") or "").strip()
    kv = [x.strip() for x in req.args.getlist("kv") if x.strip()]
    legacy = (req.args.get("khu_vuc") or "").strip()
    if not kv and legacy:
        kv = [legacy]

    tim_trong = req.args.get("tim_trong") or "tat_ca"
    if tim_trong not in ("tat_ca", "ma", "ten"):
        tim_trong = "tat_ca"

    khop = req.args.get("khop") or "chua"
    if khop not in ("chua", "bat_dau", "chinh_xac_ma"):
        khop = "chua"

    sap_xep = req.args.get("sap_xep") or "mac_dinh"
    allowed = {
        "mac_dinh",
        "ma_asc",
        "ma_desc",
        "ten_asc",
        "ten_desc",
        "khu_asc",
        "khu_desc",
    }
    if sap_xep not in allowed:
        sap_xep = "mac_dinh"

    try:
        per_page = int(req.args.get("per_page", "25"))
    except ValueError:
        per_page = 25
    per_page = max(5, min(200, per_page))

    try:
        page = int(req.args.get("page", "1"))
    except ValueError:
        page = 1

    khu_vucs_arg = kv if kv else None
    return {
        "q": q,
        "kv": kv,
        "khu_vucs": khu_vucs_arg,
        "tim_trong": tim_trong,
        "khop": khop,
        "sap_xep": sap_xep,
        "per_page": per_page,
        "page": page,
    }


def build_query_url(endpoint: str, req, *, drop_page: bool = False, page: int | None = None, **replace) -> str:
    rep_keys = set(replace.keys())
    pairs: list[tuple[str, str]] = []
    for k, vals in req.args.lists():
        for v in vals:
            if k in rep_keys:
                continue
            if drop_page and k == "page":
                continue
            pairs.append((k, v))
    for k, v in replace.items():
        if v is None:
            continue
        if isinstance(v, (list, tuple)):
            for item in v:
                pairs.append((k, str(item)))
        else:
            pairs.append((k, str(v)))
    if page is not None:
        pairs.append(("page", str(page)))
    qs = urlencode(pairs)
    base = url_for(endpoint)
    return base + ("?" + qs if qs else "")


def unique_khu_vuc(rows: list[dict]) -> list[str]:
    s = {str(r.get("KhuVuc") or "").strip() for r in rows}
    s.discard("")
    return sorted(s)


def format_sql_proc_error(exc: Exception) -> str:
    """Gợi ý khi thiếu stored procedure (lỗi 2812)."""
    msg = str(exc)
    if "2812" in msg or "Could not find stored procedure" in msg:
        return (
            msg
            + "\n\n→ Trên SSMS: kết nối đúng server như WebApp.ConnectionString, chọn database "
            "CSGT_MIENTRUNG → mở sql/14_quick_deploy_csgt_mientrung.sql → Execute toàn bộ. "
            "Trước đó cần LINK_BAC và LINK_NAM (sql/13_setup_linked_servers.sql)."
        )
    return msg


def create_app():
    app = Flask(__name__)
    app.secret_key = auth_users.load_secret_key()

    @app.before_request
    def require_login():
        if request.endpoint in ("dang_nhap", "static") or request.endpoint is None:
            return
        if request.path.startswith("/static"):
            return
        if session.get("user"):
            return
        if request.path.startswith("/api"):
            return jsonify(ok=False, error="Unauthorized"), 401
        return redirect(url_for("dang_nhap", next=request.path))

    @app.route("/dang-nhap", methods=["GET", "POST"])
    def dang_nhap():
        if session.get("user"):
            return redirect(url_for("dashboard"))
        if request.method == "POST":
            u = (request.form.get("username") or "").strip()
            p = (request.form.get("password") or "").strip()
            creds = auth_users.try_login(u, p)
            if creds:
                session["user"] = creds["username"]
                session["region_scope"] = auth_users.region_scope_for_session(
                    creds["regions"]
                )
                flash("Đăng nhập thành công.", "ok")
                nxt = request.form.get("next") or ""
                if nxt.startswith("/"):
                    return redirect(nxt)
                return redirect(url_for("dashboard"))
            flash("Sai tên đăng nhập hoặc mật khẩu.", "err")
        return render_template("login.html", next=request.args.get("next", ""))

    @app.route("/dang-xuat")
    def dang_xuat():
        session.pop("user", None)
        session.pop("region_scope", None)
        flash("Đã đăng xuất.", "ok")
        return redirect(url_for("dang_nhap"))

    @app.route("/")
    def home():
        return redirect(url_for("dashboard"))

    @app.route("/dashboard")
    def dashboard():
        err = None
        stats = {"tong": 0, "theo_khu": []}
        shard_errors: list = []
        bb_stats: dict | None = None
        try:
            sid = current_shard_ids()
            sr = fetch_don_vi_shard_result(sid)
            shard_errors = sr.get("errors") or []
            stats = stats_from_rows(
                [shards.row_to_legacy(r) for r in sr["rows"]]
            )
            try:
                bb_stats = shards.thong_ke_bien_ban_toan_quoc(
                    load_connection_string(), shard_ids=sid
                )
            except Exception:
                bb_stats = None
        except Exception as e:
            err = str(e)
        return render_template(
            "dashboard.html",
            active="dashboard",
            stats=stats,
            error=err,
            shard_errors=shard_errors,
            bb_stats=bb_stats,
        )

    @app.route("/thong-ke-toan-quoc")
    def thong_ke_toan_quoc():
        err = None
        sr = {"rows": [], "errors": []}
        bb = None
        try:
            cs = load_connection_string()
            sid = current_shard_ids()
            sr = shards.fetch_don_vi_shards(cs, shard_ids=sid)
            bb = shards.thong_ke_bien_ban_toan_quoc(cs, shard_ids=sid)
        except Exception as e:
            err = str(e)
        return render_template(
            "thong_ke_toan_quoc.html",
            active="thong_ke",
            rows=sr.get("rows") or [],
            shard_errors=sr.get("errors") or [],
            bb_stats=bb,
            error=err,
        )

    @app.route("/tra-cuu-bang-lai", methods=["GET", "POST"])
    def tra_cuu_bang_lai():
        ket_qua = None
        err = None
        so = (request.form.get("so_bang") or request.args.get("so_bang") or "").strip()
        if so:
            try:
                ket_qua = shards.tra_cuu_bang_lai_xuyen_mien(
                    load_connection_string(),
                    so,
                    allowed_regions=None,
                )
                if so and ket_qua is None:
                    err = (
                        "Không tìm thấy SoBangLai trong BangLai_HanhChinh trên "
                        "cả ba miền (Trung / Nam qua LINK_NAM / Bắc qua LINK_BAC), "
                        "hoặc sai tên cột — chỉnh WebApp.Demo.TraCuuBangLai trong config."
                    )
            except Exception as e:
                err = str(e)
        return render_template(
            "tra_cuu_bang_lai.html",
            active="tra_cuu",
            so_bang=so,
            ket_qua=ket_qua,
            error=err,
        )

    @app.route("/xu-ly-vi-pham", methods=["GET", "POST"])
    def xu_ly_vi_pham():
        err = None
        ok = False
        if request.method == "POST":
            so = (request.form.get("so_bang") or "").strip()
            ma_loi = (request.form.get("ma_loi") or "").strip()
            noi_lap = (request.form.get("noi_lap") or "").strip()
            if not so or not ma_loi or not noi_lap:
                err = "Điền đủ: số bằng (có trong BangLai), mã lỗi, nơi lập biên bản."
            else:
                try:
                    shards.goi_proc_tru_diem(
                        load_connection_string(), so, ma_loi, noi_lap
                    )
                    ok = True
                    flash(
                        "Đã ghi biên bản và trừ điểm (procedure trên SQL Server).",
                        "ok",
                    )
                except Exception as e:
                    err = str(e)
        ds_loi: list = []
        try:
            ds_loi = shards.list_loi_vi_pham(
                load_connection_string(),
                allowed_regions=current_allowed_regions(),
            )
        except Exception:
            pass
        ds_so_bang: list = []
        try:
            ds_so_bang = shards.fetch_so_bang_lai_trung(load_connection_string())
        except Exception:
            pass
        return render_template(
            "xu_ly_vi_pham.html",
            active="xu_ly",
            error=err,
            ok=ok,
            ds_loi=ds_loi,
            ds_so_bang=ds_so_bang,
        )

    @app.route("/danh-muc-loi", methods=["GET", "POST"])
    def danh_muc_loi():
        err = None
        rows: list = []
        dem_loi = None
        try:
            rows = shards.list_loi_vi_pham(
                load_connection_string(),
                allowed_regions=current_allowed_regions(),
            )
            dem_loi = shards.dem_loi_vi_pham_counts(
                load_connection_string(), shard_ids=current_shard_ids()
            )
        except Exception as e:
            err = str(e)
            dem_loi = None
        if request.method == "POST" and not err:
            try:
                allowed = current_allowed_regions()
                shard = (request.form.get("mien_ghi") or "").strip().lower()
                if shard not in ("trung", "nam", "bac"):
                    shard = auth_users.pick_insert_shard_for_user(allowed)
                else:
                    need = {
                        "trung": "Miền Trung",
                        "nam": "Miền Nam",
                        "bac": "Miền Bắc",
                    }[shard]
                    if allowed is not None and need not in allowed:
                        raise ValueError(
                            f"Tài khoản chỉ được ghi danh mục tại: {', '.join(sorted(allowed))}."
                        )
                cs_ins = load_connection_string_for_shard(shard)
                shards.insert_loi_vi_pham(
                    cs_ins,
                    request.form.get("ma_loi") or "",
                    request.form.get("ten_loi") or "",
                    float(request.form.get("muc_phat") or 0),
                    int(request.form.get("diem_tru") or 0),
                )
                flash(
                    f"Đã thêm lỗi vi phạm (ghi tại {shard}).",
                    "ok",
                )
                rows = shards.list_loi_vi_pham(
                    load_connection_string(),
                    allowed_regions=current_allowed_regions(),
                )
                dem_loi = shards.dem_loi_vi_pham_counts(
                    load_connection_string(), shard_ids=current_shard_ids()
                )
            except Exception as e:
                err = str(e)
        return render_template(
            "danh_muc_loi.html",
            active="danh_muc",
            rows=rows,
            dem_loi=dem_loi,
            error=err,
            insert_default_shard=auth_users.pick_insert_shard_for_user(
                current_allowed_regions()
            ),
            insert_shard_choices=auth_users.insert_shard_choices(
                current_allowed_regions()
            ),
            region_scope=session.get("region_scope"),
        )

    @app.route("/giai-lap-su-co")
    def giai_lap_su_co():
        sr = {"rows": [], "errors": []}
        try:
            sr = fetch_don_vi_shard_result(current_shard_ids())
        except Exception:
            pass
        return render_template(
            "giai_lap_su_co.html",
            active="su_co",
            shard_errors=sr.get("errors") or [],
            row_count=len(sr.get("rows") or []),
        )

    @app.route("/phuong-tien")
    def phuong_tien():
        err = None
        columns: list = []
        rows: list = []
        try:
            columns, rows = shards.fetch_phuong_tien(load_connection_string())
        except Exception as e:
            err = str(e)
        return render_template(
            "phuong_tien.html",
            active="phuong_tien",
            columns=columns,
            rows=rows,
            error=err,
        )

    @app.route("/bien-ban", methods=["GET", "POST"])
    def bien_ban():
        err = None
        columns: list = []
        rows: list = []
        ma = (request.values.get("ma_bien_ban") or "").strip()
        bien_so = (request.values.get("bien_so") or "").strip()
        so_bang = (request.values.get("so_bang") or "").strip()
        try:
            # Tra cứu luôn gộp 3 miền (node điều phối + LINK_NAM/LINK_BAC), không lọc theo
            # phạm vi đăng nhập — giống UNION trên SQL; nếu không, user chỉ 1 miền sẽ
            # không thấy biên bản lưu tại miền khác.
            columns, rows = shards.fetch_bien_ban_tra_cuu(
                load_connection_string(),
                ma_bien_ban=ma or None,
                bien_so=bien_so or None,
                so_bang_lai=so_bang or None,
                allowed_regions=None,
            )
        except Exception as e:
            err = str(e)
        return render_template(
            "bien_ban.html",
            active="bien_ban",
            columns=columns,
            rows=rows,
            ma_bien_ban=ma,
            bien_so=bien_so,
            so_bang=so_bang,
            error=err,
        )

    @app.route("/don-vi")
    def don_vi():
        err = None
        all_rows: list[dict] = []
        try:
            all_rows = fetch_don_vi(current_shard_ids())
        except Exception as e:
            err = str(e)

        f = parse_don_vi_filters(request)
        q = f["q"]
        khu_vucs = f["khu_vucs"]
        tim_trong = f["tim_trong"]
        khop = f["khop"]
        sap_xep = f["sap_xep"]
        per_page = f["per_page"]
        page = f["page"]

        filtered = filter_rows(all_rows, q, khu_vucs, tim_trong, khop)
        ordered = sort_rows(filtered, sap_xep)
        total = len(ordered)
        total_pages = max(1, (total + per_page - 1) // per_page) if total else 1
        page = max(1, min(page, total_pages))
        start_idx = (page - 1) * per_page
        page_rows = ordered[start_idx : start_idx + per_page]

        page_info = {
            "total": total,
            "total_pages": total_pages,
            "start": start_idx + 1 if total else 0,
            "end": min(start_idx + len(page_rows), total),
        }

        url_prev = (
            build_query_url("don_vi", request, drop_page=True, page=page - 1)
            if page > 1
            else None
        )
        url_next = (
            build_query_url("don_vi", request, drop_page=True, page=page + 1)
            if page < total_pages
            else None
        )
        url_csv = build_query_url("xuat_don_vi_csv", request, drop_page=True)

        return render_template(
            "don_vi.html",
            active="don_vi",
            rows=page_rows,
            error=err,
            q=q,
            kv_selected=f["kv"],
            khu_vucs=unique_khu_vuc(all_rows),
            tim_trong=tim_trong,
            khop=khop,
            sap_xep=sap_xep,
            page=page,
            per_page=per_page,
            page_info=page_info,
            url_prev=url_prev,
            url_next=url_next,
            url_csv=url_csv,
            show_nguon=bool(
                all_rows and all_rows[0].get("NguonDuLieu") is not None
            ),
        )

    @app.route("/don-vi/xuat-csv")
    def xuat_don_vi_csv():
        try:
            raw = fetch_don_vi(current_shard_ids())
        except Exception as e:
            flash(str(e), "err")
            return redirect(url_for("don_vi"))
        f = parse_don_vi_filters(request)
        rows = sort_rows(
            filter_rows(
                raw,
                f["q"],
                f["khu_vucs"],
                f["tim_trong"],
                f["khop"],
            ),
            f["sap_xep"],
        )
        buf = io.StringIO()
        w = csv.writer(buf)
        if rows and "NguonDuLieu" in rows[0]:
            w.writerow(["MaDonVi", "TenDonVi", "KhuVuc", "NguonDuLieu"])
            for r in rows:
                w.writerow(
                    [
                        r.get("MaDonVi"),
                        r.get("TenDonVi"),
                        r.get("KhuVuc"),
                        r.get("NguonDuLieu"),
                    ]
                )
        else:
            w.writerow(["MaDonVi", "TenDonVi", "KhuVuc"])
            for r in rows:
                w.writerow([r.get("MaDonVi"), r.get("TenDonVi"), r.get("KhuVuc")])
        data = buf.getvalue().encode("utf-8-sig")
        return Response(
            data,
            mimetype="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": "attachment; filename=don-vi-csgt.csv",
            },
        )

    @app.route("/phat-tren-10-trieu-mien-trung")
    def phat_tren_10_trieu_mien_trung():
        err = None
        columns: list = []
        rows: list = []
        try:
            columns, rows = shards.fetch_phat_tren_10_trieu_mien_trung(
                load_connection_string()
            )
        except Exception as e:
            err = str(e)
        return render_template(
            "phat_tren_10_trieu.html",
            active="phat_10t",
            columns=columns,
            rows=rows,
            error=err,
        )

    @app.route("/thu-ngan-sach-toan-quoc")
    def thu_ngan_sach_toan_quoc():
        err = None
        columns: list = []
        rows: list = []
        try:
            columns, rows = shards.fetch_thu_ngan_sach_toan_quoc(load_connection_string())
        except Exception as e:
            err = str(e)
        return render_template(
            "thu_ngan_sach.html",
            active="thu_ns",
            columns=columns,
            rows=rows,
            error=err,
        )

    @app.route("/tra-cuu-phat-nguoi", methods=["GET", "POST"])
    def tra_cuu_phat_nguoi():
        err = None
        columns: list = []
        rows: list = []
        bien_so = (request.values.get("bien_so") or "").strip()
        if request.method == "POST" or bien_so:
            try:
                columns, rows = shards.exec_tra_cuu_phat_nguoi(
                    load_connection_string(), bien_so
                )
            except Exception as e:
                err = format_sql_proc_error(e)
        return render_template(
            "tra_cuu_phat_nguoi.html",
            active="phat_nguoi",
            columns=columns,
            rows=rows,
            bien_so=bien_so,
            error=err,
        )

    @app.route("/tru-diem-bang-lai", methods=["GET", "POST"])
    def tru_diem_bang_lai_bai_tap():
        err = None
        ket_qua = None
        so = (request.values.get("so_bang") or "").strip()
        diem_raw = (request.values.get("diem_tru") or "").strip()
        if request.method == "POST" and so and diem_raw:
            try:
                diem = int(diem_raw)
            except ValueError:
                err = "Điểm trừ phải là số nguyên."
            else:
                try:
                    ket_qua = shards.exec_usp_tru_diem_bang_lai(
                        load_connection_string(), so, diem
                    )
                    if ket_qua is not None:
                        flash("Đã thực hiện dbo.usp_TruDiemBangLai.", "ok")
                except Exception as e:
                    err = format_sql_proc_error(e)
        return render_template(
            "tru_diem_bang_lai.html",
            active="tru_diem_bt",
            ket_qua=ket_qua,
            so_bang=so,
            diem_tru=diem_raw,
            error=err,
        )

    @app.route("/dem-tai-xe-nhieu-vu", methods=["GET", "POST"])
    def dem_tai_xe_nhieu_vu():
        err = None
        total_row = None
        detail_columns: list = []
        detail_rows: list = []
        nam_hint = datetime.now().year
        nam_raw = (request.values.get("nam") or "").strip()
        nam_display = nam_raw or str(nam_hint)
        try:
            nam = int(nam_display)
        except ValueError:
            nam = 0
        chay = request.method == "POST" or (request.args.get("run") == "1")
        if chay and nam >= 2000:
            try:
                r = shards.exec_dem_tai_xe_vu_pham_tren3_lan(
                    load_connection_string(), nam
                )
                total_row = r.get("total_row")
                detail_columns = list(r.get("detail_columns") or [])
                detail_rows = list(r.get("detail_rows") or [])
            except Exception as e:
                err = format_sql_proc_error(e)
        return render_template(
            "dem_tai_xe_nhieu_vu.html",
            active="dem_tx",
            total_row=total_row,
            detail_columns=detail_columns,
            detail_rows=detail_rows,
            nam=nam_display,
            error=err,
            chay=chay,
        )

    @app.route("/bai-tap/cau-6-trigger")
    def cau_6_trigger():
        return render_template("cau_6_trigger.html", active="cau_6")

    @app.route("/gioi-thieu")
    def gioi_thieu():
        return render_template("gioi_thieu.html", active="gioi_thieu")

    @app.route("/api/don-vi-csgt")
    def api_don_vi():
        try:
            return jsonify(ok=True, data=fetch_don_vi(current_shard_ids()))
        except Exception as e:
            return jsonify(ok=False, error=str(e)), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
