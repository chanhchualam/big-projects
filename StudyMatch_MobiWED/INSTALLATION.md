# StudyMatch - Installation Guide

## Các Bước Cài Đặt

### 1. Chuẩn Bị Môi Trường
- Đảm bảo Python 3.8+ được cài đặt
- Cài đặt Oracle Database hoặc sử dụng SQLite/MySQL

### 2. Cài Đặt Dependencies
```bash
pip install -r requirements.txt
```

### 3. Cấu Hình Database

#### Cho Oracle Database
1. Sửa file `app/__init__.py`:
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'oracle+cx_oracle://username:password@localhost:1521/service_name'
```

2. Chạy SQL scripts theo thứ tự:
   - `database/schema.sql` - Tạo tables
   - `database/views.sql` - Tạo views
   - `database/procedures.sql` - Tạo procedures
   - `database/functions.sql` - Tạo functions
   - `database/triggers.sql` - Tạo triggers

#### Cho SQLite (Development)
Sửa file `app/__init__.py`:
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///studymatch.db'
```

### 4. Khởi Tạo Database
```bash
python
>>> from app import create_app, db
>>> app = create_app()
>>> with app.app_context():
...     db.create_all()
>>> exit()
```

### 5. Thêm Dữ Liệu Ban Đầu (Optional)
Tạo file `init_data.py`:

```python
from app import create_app, db
from models.models import *
from datetime import datetime

app = create_app()

with app.app_context():
    # Thêm khối thi
    khoi_a = KhoiThi(KhoiID=1, TenKhoi='Khối A', MoTa='Khối A gồm Toán, Lý, Hóa')
    khoi_b = KhoiThi(KhoiID=2, TenKhoi='Khối B', MoTa='Khối B gồm Toán, Hóa, Sinh')
    khoi_c = KhoiThi(KhoiID=3, TenKhoi='Khối C', MoTa='Khối C gồm Văn, Sử, Địa')
    khoi_d = KhoiThi(KhoiID=4, TenKhoi='Khối D', MoTa='Khối D gồm Toán, Văn')
    
    db.session.add_all([khoi_a, khoi_b, khoi_c, khoi_d])
    
    # Thêm môn học
    mon_toan = MonTrongKhoiThi(MonID=1, KhoiID=1, TenMon='Toán', MaMon='TOAN')
    mon_ly = MonTrongKhoiThi(MonID=2, KhoiID=1, TenMon='Lý', MaMon='LY')
    mon_hoa = MonTrongKhoiThi(MonID=3, KhoiID=1, TenMon='Hóa', MaMon='HOA')
    
    db.session.add_all([mon_toan, mon_ly, mon_hoa])
    
    # Thêm trường đại học
    bkhn = TruongDH(
        TruongID=1, 
        TenTruong='Đại Học Bách Khoa Hà Nội',
        MaTruong='BKHN',
        Website='https://www.hust.edu.vn',
        DiaChi='Hà Nội',
        SoDienThoai='02438689999'
    )
    
    db.session.add(bkhn)
    
    # Thêm ngành học
    nganh_cntt = Nganh(
        NganhID=1,
        TruongID=1,
        TenNganh='Công Nghệ Thông Tin',
        MaNganh='CNTT',
        DiemChuan=24.0,
        KhoiThi_YeuCau='A',
        ChiTieuTuyen=500
    )
    
    db.session.add(nganh_cntt)
    db.session.commit()
    print("Dữ liệu ban đầu đã được thêm thành công!")
```

Chạy:
```bash
python init_data.py
```

### 6. Chạy Ứng Dụng
```bash
python run.py
```

Ứng dụng sẽ chạy tại: http://localhost:5000

## Các Lỗi Thường Gặp

### Lỗi: "ModuleNotFoundError: No module named 'flask'"
```bash
pip install -r requirements.txt
```

### Lỗi: "No such table: user_thi"
Bạn chưa chạy `db.create_all()`. Xem phần "Khởi Tạo Database" ở trên.

### Lỗi: "ORA-12514: TNS:listener does not currently know of service requested in connect descriptor"
Kiểm tra lại thông tin kết nối database của bạn.

## Cấu Trúc Ứng Dụng

```
StudyMatch/
├── app/
│   ├── __init__.py          # Khởi tạo Flask
│   ├── routes.py            # Routes & endpoints
│   ├── templates/           # HTML templates
│   └── static/              # CSS, JS
├── models/
│   └── models.py            # Database models
├── database/
│   ├── schema.sql           # Table definitions
│   ├── views.sql            # Database views
│   ├── procedures.sql       # Stored procedures
│   ├── functions.sql        # Functions
│   └── triggers.sql         # Triggers
├── run.py                   # Entry point
├── requirements.txt         # Python dependencies
└── README.md               # Documentation
```

## Tài Liệu Tham Khảo

- Flask Documentation: https://flask.palletsprojects.com/
- SQLAlchemy: https://docs.sqlalchemy.org/
- Oracle Database: https://www.oracle.com/database/

## Hỗ Trợ

Nếu bạn gặp vấn đề, vui lòng:
1. Kiểm tra lại các bước cài đặt
2. Xem logs trong terminal
3. Liên hệ với team phát triển

---

**Chúc bạn cài đặt thành công!** 🎉
