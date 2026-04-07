# StudyMatch - Hướng Dẫn Khởi Động Nhanh

## ⚡ Bắt Đầu Nhanh (5 Phút)

### 1. Cài Đặt Dependencies
```bash
pip install -r requirements.txt
```

### 2. Cấu Hình Database
Sửa file `app/__init__.py` (dòng 10):

**Nếu dùng SQLite (Dev):**
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///studymatch.db'
```

**Nếu dùng Oracle:**
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'oracle+cx_oracle://user:pass@localhost:1521/xe'
```

### 3. Chạy Ứng Dụng
```bash
python run.py
```

Mở trình duyệt: http://localhost:5000

---

## 📁 Cấu Trúc Thư Mục

```
StudyMatch/
├── app/                          # Ứng dụng Flask
│   ├── __init__.py              # Cấu hình ứng dụng
│   ├── routes.py                # Routes chính
│   ├── templates/               # HTML templates
│   │   ├── base.html            # Template gốc
│   │   ├── index.html           # Trang chủ
│   │   ├── login.html           # Đăng nhập
│   │   ├── dashboard.html       # Dashboard
│   │   ├── major/               # Trang ngành học
│   │   ├── student/             # Trang học sinh
│   │   └── recommendation/      # Trang gợi ý
│   └── static/                  # Assets
│       ├── css/style.css        # CSS chính
│       └── js/main.js           # JavaScript
├── models/                       # Database models
│   └── models.py               # Định nghĩa các model
├── database/                     # Database scripts
│   ├── schema.sql              # Tạo tables
│   ├── views.sql               # Tạo views
│   ├── procedures.sql          # Tạo procedures
│   ├── functions.sql           # Tạo functions
│   └── triggers.sql            # Tạo triggers
├── run.py                       # Entry point
├── requirements.txt             # Dependencies
├── README.md                    # Tài liệu đầy đủ
└── INSTALLATION.md             # Hướng dẫn cài đặt
```

---

## 🎯 Tính Năng Chính

### 👤 Quản Lý Tài Khoản
- ✅ Đăng ký tài khoản mới
- ✅ Đăng nhập/Đăng xuất
- ✅ Xem hồ sơ cá nhân

### 📊 Nhập Điểm
- ✅ Nhập điểm thi THPT theo khối
- ✅ Quản lý điểm số
- ✅ Xem lịch sử

### 🎯 Gợi Ý Ngành
- ✅ Phân tích điểm
- ✅ Gợi ý ngành phù hợp
- ✅ Sắp xếp theo tỷ lệ phù hợp

### 🏫 Danh Sách Ngành
- ✅ Xem tất cả ngành
- ✅ Tìm kiếm
- ✅ Chi tiết ngành (điểm chuan, yêu cầu)

### ⭐ Đánh Giá
- ✅ Đánh giá 1-5 sao
- ✅ Viết nhận xét
- ✅ Xem đánh giá của người khác

---

## 🔐 Tài Khoản Test

### Học Sinh
- Username: `student01`
- Password: `password123`

### Giáo Viên
- Username: `teacher01`
- Password: `password123`

### Admin
- Username: `admin01`
- Password: `admin123`

---

## 🛠️ API Endpoints

### Authentication
```
POST /login            - Đăng nhập
POST /register         - Đăng ký
GET  /logout           - Đăng xuất
```

### Student
```
GET  /student/profile                 - Xem hồ sơ
GET  /student/enter-scores            - Form nhập điểm
POST /student/enter-scores            - Lưu điểm
GET  /student/view-scores             - Xem điểm
GET  /student/api/scores              - API điểm
```

### Major
```
GET  /major/list                      - Danh sách
GET  /major/<id>                      - Chi tiết
GET  /major/search?q=keyword          - Tìm kiếm
GET  /major/api/by-khoi/<khoi_id>    - API theo khối
POST /major/api/rating/<nganh_id>     - Đánh giá
```

### Recommendation
```
GET  /recommendation/get-recommendation    - Nhận gợi ý
GET  /recommendation/results               - Kết quả
```

---

## 📊 Database Objects (Oracle)

### 🔍 Views
- `V_DIEM_TRUNG_BINH` - Điểm TB của HS
- `V_NGANH_PHU_HOP` - Ngành phù hợp
- `V_TUYEN_SINH_THEO_NAM` - TS theo năm
- `V_GIAO_VIEN_INFO` - Info GV
- `V_KET_QUA_CHI_TIET` - KQ chi tiết

### ⚙️ Procedures
- `P_TINH_DIEM_TRUNG_BINH()` - Tính điểm TB
- `P_DE_XUAT_NGANH()` - Đề xuất ngành
- `P_CAP_NHAT_KET_QUA()` - Cập nhật KQ
- `P_THONG_KE_HOC_SINH()` - Thống kê HS
- `P_XOA_DU_LIEU_CU()` - Xóa dữ liệu cũ

### 🔧 Functions
- `F_KT_DA_DANG_KY()` - Kiểm tra đã đăng ký
- `F_TINH_TI_LE_PHU_HOP()` - Tính tỷ lệ
- `F_XEP_HANG_NGANH()` - Xếp hạng ngành
- `F_DEM_DANH_GIA()` - Đếm đánh giá
- `F_DANH_GIA_TRUNG_BINH()` - ĐG TB
- `F_KT_DIEM_HOP_LE()` - Kiểm tra điểm
- `F_MO_TA_MUC_DO_PHU_HOP()` - Mô tả mức độ

### ⚡ Triggers
- `TR_THEM_KET_QUA_TU_DONG` - Tự động thêm KQ
- `TR_CAP_NHAT_KET_QUA_KHI_SUA` - Cập nhật khi sửa
- `TR_XOA_KET_QUA` - Xóa KQ
- `TR_KT_DIEM_HOP_LE` - Kiểm tra điểm
- `TR_KT_DANH_GIA_HOP_LE` - Kiểm tra ĐG
- Và nhiều triggers khác...

---

## 🐛 Troubleshooting

### Lỗi: "ModuleNotFoundError"
```bash
pip install -r requirements.txt
```

### Lỗi: "No such table"
Database chưa được khởi tạo. Chạy lại:
```bash
python
>>> from app import create_app, db
>>> app = create_app()
>>> with app.app_context():
...     db.create_all()
```

### Port 5000 đã được sử dụng
Sửa trong `run.py`:
```python
app.run(port=5001)  # Dùng port khác
```

---

## 📚 Tài Liệu Thêm

- 📖 [README.md](README.md) - Tài liệu đầy đủ
- 📖 [INSTALLATION.md](INSTALLATION.md) - Hướng dẫn cài đặt chi tiết
- 📖 [database/documentation.py](database/documentation.py) - Tài liệu DB

---

## 💡 Mẹo Hữu Ích

### Chỉnh Sửa Database URI
File: `app/__init__.py` line 10

### Thêm Dữ Liệu Test
Chạy file `init_data.py` (nếu có)

### Debug Mode
Sửa trong `run.py`:
```python
app.run(debug=True)
```

### Xem Logs SQL
Thêm vào `app/__init__.py`:
```python
import logging
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```

---

## 🚀 Production Deployment

### Sử dụng Gunicorn
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

### Sử dụng Docker
Tạo `Dockerfile`:
```dockerfile
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "run.py"]
```

Chạy:
```bash
docker build -t studymatch .
docker run -p 5000:5000 studymatch
```

---

## 📝 License
MIT License - Sử dụng tự do cho mục đích giáo dục

## 🤝 Hỗ Trợ
Liên hệ: studymatch@example.com

---

**Happy Coding! 🎉**
