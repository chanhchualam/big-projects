import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

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
                {'KhoiID': 1, 'TenMon': 'Toan', 'MaMon': 'TOAN_A', 'HeSo': 1.0},
                {'KhoiID': 1, 'TenMon': 'Vat Ly', 'MaMon': 'LY_A', 'HeSo': 1.0},
                {'KhoiID': 1, 'TenMon': 'Hoa Hoc', 'MaMon': 'HOA_A', 'HeSo': 1.0},
                # Khoi B
                {'KhoiID': 2, 'TenMon': 'Toan', 'MaMon': 'TOAN_B', 'HeSo': 1.0},
                {'KhoiID': 2, 'TenMon': 'Hoa Hoc', 'MaMon': 'HOA_B', 'HeSo': 1.0},
                {'KhoiID': 2, 'TenMon': 'Sinh Hoc', 'MaMon': 'SINH_B', 'HeSo': 1.0},
                # Khoi C
                {'KhoiID': 3, 'TenMon': 'Toan', 'MaMon': 'TOAN_C', 'HeSo': 1.0},
                {'KhoiID': 3, 'TenMon': 'Dia Ly', 'MaMon': 'DIA_C', 'HeSo': 1.0},
                {'KhoiID': 3, 'TenMon': 'Lich Su', 'MaMon': 'SU_C', 'HeSo': 1.0},
                # Khoi D
                {'KhoiID': 4, 'TenMon': 'Ngu Van', 'MaMon': 'VAN_D', 'HeSo': 1.0},
                {'KhoiID': 4, 'TenMon': 'Tieng Anh', 'MaMon': 'ANH_D', 'HeSo': 1.0},
                {'KhoiID': 4, 'TenMon': 'Lich Su', 'MaMon': 'SU_D', 'HeSo': 1.0},
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
    except Exception as e:
        print(f"[-] Error seeding database: {e}")
        db.session.rollback()

def create_app():
    app = Flask(__name__)
    
    # Check if running in development mode (local SQLite) or production (SQL Server)
    use_sqlite = os.getenv('USE_SQLITE', 'true').lower() == 'true'
    
    if use_sqlite:
        # Development: Use SQLite
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///studymatch.db'
    else:
        # Production: Use SQL Server
        # Format: mssql+pyodbc://[username:password@]server_name/database_name?driver=ODBC+Driver+17+for+SQL+Server
        app.config['SQLALCHEMY_DATABASE_URI'] = 'mssql+pyodbc://LAPTOP-96O50AKP/StudyMatch?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes'
    
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
        db.create_all()
        # Seed initial data
        seed_database()
    
    return app

