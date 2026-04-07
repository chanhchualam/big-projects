"""
Đăng nhập đa tài khoản + phạm vi miền (Miền Bắc / Trung / Nam) từ config/connections.json.
Biến môi trường CSGT_WEB_USER / CSGT_WEB_PASS (cả hai) ghi đè và mở full quyền mọi miền.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "connections.json"

VALID_REGION_DISPLAY = ("Miền Bắc", "Miền Trung", "Miền Nam")

REGION_TO_SHARD_ID = {
    "Miền Bắc": "bac",
    "Miền Trung": "trung",
    "Miền Nam": "nam",
}

SHARD_ID_TO_REGION = {v: k for k, v in REGION_TO_SHARD_ID.items()}


def _norm_one_region(s: str) -> str | None:
    s = (s or "").strip()
    if s in VALID_REGION_DISPLAY:
        return s
    low = s.lower().replace(" ", "")
    aliases = {
        "bac": "Miền Bắc",
        "mienbac": "Miền Bắc",
        "b": "Miền Bắc",
        "trung": "Miền Trung",
        "mientrung": "Miền Trung",
        "t": "Miền Trung",
        "nam": "Miền Nam",
        "miennam": "Miền Nam",
        "n": "Miền Nam",
    }
    return aliases.get(low)


def normalize_regions_list(raw: list | None) -> list[str] | None:
    """None = toàn quốc. Danh sách rỗng sau chuẩn hóa = toàn quốc."""
    if raw is None:
        return None
    out: list[str] = []
    seen: set[str] = set()
    for x in raw:
        n = _norm_one_region(str(x))
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out if out else None


def load_users_from_config() -> list[dict]:
    if not CONFIG_PATH.is_file():
        return [
            {"username": "admin", "password": "admin123", "regions": None},
        ]
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    web = data.get("WebApp") or {}
    auth = web.get("Auth") or {}

    env_u = (os.environ.get("CSGT_WEB_USER") or "").strip()
    env_p = (os.environ.get("CSGT_WEB_PASS") or "").strip()
    if env_u and env_p:
        return [{"username": env_u, "password": env_p, "regions": None}]

    users = auth.get("Users")
    if isinstance(users, list) and users:
        result: list[dict] = []
        for u in users:
            if not isinstance(u, dict):
                continue
            un = (u.get("Username") or u.get("username") or "").strip()
            pw = (u.get("Password") or u.get("password") or "").strip()
            if not un:
                continue
            regions = normalize_regions_list(u.get("Regions"))
            result.append({"username": un, "password": pw, "regions": regions})
        if result:
            return result

    u = (auth.get("Username") or "admin").strip()
    p = (auth.get("Password") or "admin123").strip()
    return [{"username": u, "password": p, "regions": None}]


def load_secret_key() -> str:
    if not CONFIG_PATH.is_file():
        return os.environ.get("FLASK_SECRET_KEY") or "dev-secret-doi-khi-trien-khai"
    with open(CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    web = data.get("WebApp") or {}
    return (
        os.environ.get("FLASK_SECRET_KEY")
        or web.get("SecretKey")
        or "dev-secret-doi-khi-trien-khai"
    )


def try_login(username: str, password: str) -> dict | None:
    u = (username or "").strip()
    p = (password or "").strip()
    for row in load_users_from_config():
        if row["username"] == u and row["password"] == p:
            return {"username": row["username"], "regions": row["regions"]}
    return None


def region_scope_for_session(regions: list[str] | None) -> str | list[str]:
    """Lưu trong Flask session: 'all' hoặc danh sách miền."""
    if regions is None:
        return "all"
    return list(regions)


def allowed_region_names_from_session(session: dict) -> set[str] | None:
    """None = được xem mọi miền; set không rỗng = chỉ các miền đó."""
    rs = session.get("region_scope")
    if rs is None or rs == "all":
        return None
    if isinstance(rs, list) and rs:
        return set(rs)
    return None


def shard_ids_for_session(allowed: set[str] | None) -> set[str] | None:
    if allowed is None:
        return None
    out = {REGION_TO_SHARD_ID[r] for r in allowed if r in REGION_TO_SHARD_ID}
    return out or set()


def pick_insert_shard_for_user(allowed: set[str] | None) -> str:
    """Chọn DB ghi danh mục lỗi: ưu tiên Trung nếu được phép, không thì miền đầu trong tập."""
    if allowed is None:
        return "trung"
    if "Miền Trung" in allowed:
        return "trung"
    if "Miền Nam" in allowed:
        return "nam"
    if "Miền Bắc" in allowed:
        return "bac"
    return "trung"


def insert_shard_choices(allowed: set[str] | None) -> list[tuple[str, str]]:
    """(shard_id, nhãn hiển thị) cho form thêm lỗi."""
    order = ("Miền Trung", "Miền Nam", "Miền Bắc")
    m = {"Miền Trung": "trung", "Miền Nam": "nam", "Miền Bắc": "bac"}
    if allowed is None:
        return [(m[k], k) for k in order]
    return [(m[k], k) for k in order if k in allowed]
