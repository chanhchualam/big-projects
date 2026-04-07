import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from urllib.parse import quote_plus

db = SQLAlchemy()


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _build_oracle_uri() -> str:
    user = os.getenv("ORACLE_USER")
    password = os.getenv("ORACLE_PASSWORD")
    host = os.getenv("ORACLE_HOST", "localhost")
    port = os.getenv("ORACLE_PORT", "1521")
    service = os.getenv("ORACLE_SERVICE") or os.getenv("ORACLE_SID")

    missing = [
        key
        for key, val in {
            "ORACLE_USER": user,
            "ORACLE_PASSWORD": password,
            "ORACLE_SERVICE (or ORACLE_SID)": service,
        }.items()
        if not val
    ]
    if missing:
        raise RuntimeError(
            "Missing Oracle configuration: " + ", ".join(missing) + ". "
            "Create a .env file based on .env.example or set environment variables."
        )

    # SQLAlchemy Oracle (python-oracledb) thin mode connection
    # Example: oracle+oracledb://user:pass@localhost:1521/?service_name=xe
    return (
        "oracle+oracledb://"
        f"{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/?service_name={quote_plus(service)}"
    )

def seed_database():
    """Seed initial data into the database"""
    from models.models import KhoiThi, MonTrongKhoiThi, UserThi, TruongDH, Nganh, MonHoc, GiaoVien
    
    try:
        # Seed Khối Thi if not exists
        if KhoiThi.query.first() is None:
            khoi_data = [
                {'TenKhoi': 'A', 'MoTa': 'Khối A - Toán, Lý, Hóa'},
                {'TenKhoi': 'B', 'MoTa': 'Khối B - Toán, Hóa, Sinh'},
                {'TenKhoi': 'C', 'MoTa': 'Khối C - Toán, Địa, Sử'},
                {'TenKhoi': 'D', 'MoTa': 'Khối D - Ngữ Văn, Tiếng Anh, Lịch Sử'},
            ]
            for khoi in khoi_data:
                new_khoi = KhoiThi(TenKhoi=khoi['TenKhoi'], MoTa=khoi['MoTa'])
                db.session.add(new_khoi)
            db.session.commit()
            print("[+] Added Khoi Thi")
        
        # Seed Mon Hoc trong Khoi if not exists
        if MonTrongKhoiThi.query.first() is None:
            mon_data = [
                # Khoi A
                {'KhoiID': 1, 'TenMon': 'Toán', 'MaMon': 'TOAN_A', 'HeSo': 1.0},
                {'KhoiID': 1, 'TenMon': 'Vật Lý', 'MaMon': 'LY_A', 'HeSo': 1.0},
                {'KhoiID': 1, 'TenMon': 'Hóa Học', 'MaMon': 'HOA_A', 'HeSo': 1.0},
                # Khoi B
                {'KhoiID': 2, 'TenMon': 'Toán', 'MaMon': 'TOAN_B', 'HeSo': 1.0},
                {'KhoiID': 2, 'TenMon': 'Hóa Học', 'MaMon': 'HOA_B', 'HeSo': 1.0},
                {'KhoiID': 2, 'TenMon': 'Sinh Học', 'MaMon': 'SINH_B', 'HeSo': 1.0},
                # Khoi C
                {'KhoiID': 3, 'TenMon': 'Toán', 'MaMon': 'TOAN_C', 'HeSo': 1.0},
                {'KhoiID': 3, 'TenMon': 'Địa Lý', 'MaMon': 'DIA_C', 'HeSo': 1.0},
                {'KhoiID': 3, 'TenMon': 'Lịch Sử', 'MaMon': 'SU_C', 'HeSo': 1.0},
                # Khoi D
                {'KhoiID': 4, 'TenMon': 'Ngữ Văn', 'MaMon': 'VAN_D', 'HeSo': 1.0},
                {'KhoiID': 4, 'TenMon': 'Tiếng Anh', 'MaMon': 'ANH_D', 'HeSo': 1.0},
                {'KhoiID': 4, 'TenMon': 'Lịch Sử', 'MaMon': 'SU_D', 'HeSo': 1.0},
            ]
            for mon in mon_data:
                new_mon = MonTrongKhoiThi(
                    KhoiID=mon['KhoiID'],
                    TenMon=mon['TenMon'],
                    MaMon=mon['MaMon'],
                    HeSo=mon['HeSo']
                )
                db.session.add(new_mon)
            db.session.commit()
            print(f"[+] Added {len(mon_data)} Mon Hoc")
        
        # Seed other data...
        if UserThi.query.filter_by(UserName='test_student').first() is None:
            test_students = [
                {'UserName': 'test_student', 'MatKhau': '123456', 'HoTen': 'Nguyen Van A', 'Email': 'student1@example.com'},
                {'UserName': 'student_b', 'MatKhau': '123456', 'HoTen': 'Tran Thi B', 'Email': 'student2@example.com'},
            ]
            for std in test_students:
                new_std = UserThi(
                    UserName=std['UserName'],
                    MatKhau=std['MatKhau'],
                    HoTen=std['HoTen'],
                    Email=std['Email'],
                    LoaiUser='Student'
                )
                db.session.add(new_std)
            db.session.commit()
            print("[+] Added test students")

        # Repair/normalize Vietnamese names (idempotent)
        try:
            monhoc_map = {
                'TOAN': 'Toán',
                'LY': 'Vật Lý',
                'HOA': 'Hóa Học',
                'SINH': 'Sinh Học',
                'VAN': 'Ngữ Văn',
                'ANH': 'Tiếng Anh',
                'SU': 'Lịch Sử',
                'DIA': 'Địa Lý',
            }
            montrongkhoi_map = {
                'TOAN_A': 'Toán',
                'LY_A': 'Vật Lý',
                'HOA_A': 'Hóa Học',
                'TOAN_B': 'Toán',
                'HOA_B': 'Hóa Học',
                'SINH_B': 'Sinh Học',
                'TOAN_C': 'Toán',
                'DIA_C': 'Địa Lý',
                'SU_C': 'Lịch Sử',
                'VAN_D': 'Ngữ Văn',
                'ANH_D': 'Tiếng Anh',
                'SU_D': 'Lịch Sử',
            }

            changed = 0
            for ma, ten in monhoc_map.items():
                row = MonHoc.query.filter_by(MaMonHoc=ma).first()
                if row and row.TenMonHoc != ten:
                    row.TenMonHoc = ten
                    changed += 1

            for ma, ten in montrongkhoi_map.items():
                row = MonTrongKhoiThi.query.filter_by(MaMon=ma).first()
                if row and row.TenMon != ten:
                    row.TenMon = ten
                    changed += 1

            if changed:
                db.session.commit()
                print(f"[+] Normalized Vietnamese subject names ({changed} updates)")
        except Exception as repair_err:
            db.session.rollback()
            print(f"[-] Error normalizing Vietnamese subject names: {repair_err}")
    except Exception as e:
        print(f"[-] Error seeding database: {e}")
        db.session.rollback()

def create_app():
    app = Flask(__name__)

    # Load environment variables from .env (if present)
    load_dotenv(override=False)
    
    # Database selection
    # Keep the project Oracle-first; optionally allow sqlite for quick local dev.
    # Override explicitly with DB_PROVIDER: oracle | sqlite
    db_provider = (os.getenv("DB_PROVIDER") or "oracle").strip().lower()

    if db_provider == "sqlite":
        app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SQLITE_URI", "sqlite:///studymatch.db")
    elif db_provider == "oracle":
        app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("ORACLE_URI") or _build_oracle_uri()
    else:
        raise RuntimeError(f"Unsupported DB_PROVIDER: {db_provider}. Use oracle | sqlite")
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'your_secret_key_here_change_in_production'
    
    db.init_app(app)
    
    # Đăng ký các blueprint (routes)
    from app.routes import main_bp, student_bp, major_bp, recommendation_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(major_bp)
    app.register_blueprint(recommendation_bp)
    
    with app.app_context():
        # For Oracle we expect the schema to be created by the provided SQL scripts
        # (database/oracle/studymatch_oracle_full.sql). Auto-creating tables via
        # SQLAlchemy can lead to missing sequences/triggers.
        auto_create = _bool_env("AUTO_CREATE_TABLES", default=(db_provider != "oracle"))
        if auto_create:
            db.create_all()

        if _bool_env("SEED_DATABASE", default=True):
            seed_database()
    
    return app

