# StudyMatch - Hệ Thống Gợi Ý Chọn Ngành Đại Học

## Giới Thiệu

**StudyMatch** là một ứng dụng web thông minh được thiết kế để giúp học sinh bậc THPT:
- Nhập và quản lý điểm thi THPT của mình
- Nhận gợi ý chọn ngành học phù hợp
- Tìm hiểu chi tiết về các ngành học tại các trường đại học
- Xem đánh giá từ các học sinh khác

## Yêu Cầu Hệ Thống

- Python 3.8+ (khuyến nghị Python 3.11/3.12)
- Oracle Database 19c+ (khuyến nghị Oracle XE 18c/21c)
- pip (Python Package Manager)

## Cài Đặt

### 1. Clone/Tải Dự Án
```bash
cd StudyMatch
```

### 2. Cài Đặt Dependencies
```bash
pip install -r requirements.txt
```

### 3. Cấu Hình Database
Sửa file `.env` theo mẫu `.env.example` để điền đúng thông tin Oracle của bạn.

- Nếu dùng biến rời: `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE`.
- Hoặc set thẳng chuỗi kết nối: `ORACLE_URI=oracle+oracledb://user:pass@host:1521/?service_name=XEPDB1`

Lưu ý: Oracle XE 18c/21c thường dùng `service_name=XEPDB1`; bản XE cũ có thể là `XE`.

### 4. Khởi Tạo Database
Khuyên dùng: import schema + data bằng Oracle SQL Developer với file:

- `database/oracle/studymatch_oracle_full.sql` (Run Script / F5)

Lưu ý: với Oracle, **không nên** chạy `db.create_all()` vì có thể tạo bảng dạng quoted (ví dụ "DanhGia") và thiếu sequence/trigger.

### 5. Chạy Ứng Dụng
```bash
python run.py
```

Ứng dụng sẽ chạy tại: `http://localhost:5000`

## Chạy nhanh (Oracle)
- Cài + cấu hình 1 lần: `setup_oracle.bat` (hoặc `powershell -ExecutionPolicy Bypass -File .\setup_oracle.ps1`)
- Chạy web: `run_oracle.bat` (hoặc `powershell -ExecutionPolicy Bypass -File .\run_oracle.ps1`)

## Cấu Trúc Dự Án

```
StudyMatch/
├── app/
│   ├── __init__.py          # Khởi tạo Flask app
│   ├── routes.py            # Định nghĩa routes
│   ├── templates/           # HTML templates
│   │   ├── base.html
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── dashboard.html
│   │   ├── student/
│   │   ├── major/
│   │   └── recommendation/
│   └── static/
│       ├── css/
│       │   └── style.css    # Stylesheet
│       └── js/
│           └── main.js      # JavaScript
├── models/
│   └── models.py            # Database models
├── database/
│   └── oracle/              # Oracle scripts (schema, functions, procedures, triggers, views, sample data)
├── run.py                   # Entry point
├── requirements.txt         # Dependencies
├── .env.example             # Environment variables example
└── README.md               # Documentation
```

## Các Tính Năng Chính

### 1. Quản Lý Tài Khoản
- Đăng ký tài khoản mới
- Đăng nhập/Đăng xuất
- Quản lý hồ sơ cá nhân

### 2. Nhập Điểm Số
- Nhập điểm thi THPT theo các khối (A, B, C, D)
- Quản lý điểm số
- Xem lịch sử nhập điểm

### 3. Gợi Ý Ngành Học
- Phân tích điểm số
- Gợi ý ngành học phù hợp (sắp xếp theo tỷ lệ phù hợp)
- Lưu kết quả gợi ý

### 4. Danh Sách Ngành Học
- Xem danh sách tất cả các ngành
- Tìm kiếm ngành học
- Xem chi tiết từng ngành (điểm chuan, yêu cầu, v.v.)

### 5. Đánh Giá & Review
- Đánh giá các ngành học (1-5 sao)
- Viết nhận xét
- Xem đánh giá của học sinh khác

## Models (Bảng Database)

### UserThi
- Quản lý người dùng hệ thống

### KhoiThi
- Các khối thi (A, B, C, D)

### MonTrongKhoiThi
- Các môn học trong từng khối

### Diem
- Điểm thi của học sinh

### TruongDH
- Thông tin trường đại học

### Nganh
- Các ngành học tại các trường

### GiaoVien
- Thông tin giáo viên hướng dẫn

### ThongTinTuyenSinh
- Thông tin tuyển sinh của các ngành

### DanhGia
- Đánh giá các ngành học

### KetQuaDuDoan
- Kết quả gợi ý ngành học

## API Endpoints

### Authentication
- `POST /login` - Đăng nhập
- `POST /register` - Đăng ký
- `GET /logout` - Đăng xuất

### Student
- `GET /student/profile` - Xem hồ sơ
- `GET /student/enter-scores` - Form nhập điểm
- `POST /student/enter-scores` - Lưu điểm
- `GET /student/view-scores` - Xem điểm
- `GET /student/api/scores` - API lấy điểm

### Major
- `GET /major/list` - Danh sách ngành
- `GET /major/<id>` - Chi tiết ngành
- `GET /major/search` - Tìm kiếm ngành
- `GET /major/api/by-khoi/<khoi_id>` - API lấy ngành theo khối
- `POST /major/api/rating/<nganh_id>` - API đánh giá

### Recommendation
- `GET /recommendation/get-recommendation` - Nhận gợi ý
- `GET /recommendation/results` - Xem kết quả gợi ý

## Database Objects (Oracle)

### Views
- V_DIEM_TRUNG_BINH - Xem điểm trung bình
- V_NGANH_PHU_HOP - Xem ngành phù hợp

### Procedures
- P_TINH_DIEM_TRUNG_BINH - Tính điểm trung bình
- P_DE_XUAT_NGANH - Đề xuất ngành

### Functions
- F_KT_DANG_KY - Kiểm tra đăng ký
- F_TINH_TI_LE - Tính tỷ lệ phù hợp

### Triggers
- TR_THEM_KET_QUA - Trigger thêm kết quả
- TR_CAP_NHAT_DIEM - Trigger cập nhật điểm

## Hướng Dẫn Sử Dụng

### Cho Học Sinh
1. Tạo tài khoản mới
2. Đăng nhập vào hệ thống
3. Nhập điểm thi THPT
4. Nhận gợi ý ngành học
5. Xem chi tiết các ngành được gợi ý
6. Đánh giá và để lại nhận xét

### Cho Quản Trị Viên
1. Quản lý danh sách ngành học
2. Quản lý thông tin trường đại học
3. Cập nhật điểm chuan
4. Quản lý giáo viên hướng dẫn

## Troubleshooting

### Lỗi: "cx_Oracle.DatabaseError: ORA-12514"
- Kiểm tra lại thông tin kết nối database
- Đảm bảo Oracle service đang chạy

### Lỗi: "ModuleNotFoundError"
- Chạy `pip install -r requirements.txt` lại

### Lỗi: "404 Not Found"
- Kiểm tra lại routes trong `app/routes.py`
- Kiểm tra templates tồn tại

## Phát Triển Tiếp Theo

- [ ] Thêm xác thực hai yếu tố (2FA)
- [ ] Tích hợp thanh toán online
- [ ] Thêm chức năng chat với giáo viên
- [ ] Mobile app
- [ ] Machine learning để dự đoán chính xác hơn

## License

MIT License - Tự do sử dụng cho mục đích giáo dục

## Hỗ Trợ

Nếu bạn gặp vấn đề, vui lòng:
1. Kiểm tra file README
2. Xem lại các logs trong terminal
3. Liên hệ với team phát triển

## Tác Giả

StudyMatch Development Team - 2024
