-- ==================== SQL SERVER SAMPLE DATA ====================
-- StudyMatch Database Sample Data - SQL Server 2016+ Compatible

USE StudyMatch;
GO

PRINT 'Inserting sample data into StudyMatch database...';
GO

-- ==================== Insert KhoiThi (Test Blocks) ====================
INSERT INTO KhoiThi (TenKhoi, MoTa) VALUES
('A', 'Khối A - Toán, Lý, Hóa'),
('B', 'Khối B - Toán, Hóa, Sinh'),
('C', 'Khối C - Toán, Địa, Sử'),
('D', 'Khối D - Ngữ Văn, Tiếng Anh, Lịch Sử');
GO

-- ==================== Insert MonTrongKhoiThi (Subjects) ====================
INSERT INTO MonTrongKhoiThi (KhoiID, TenMon, MaMon, HeSo) VALUES
(1, 'Toán', 'TOAN', 1.0),
(1, 'Vật Lý', 'LY', 1.0),
(1, 'Hóa Học', 'HOA', 1.0),
(2, 'Toán', 'TOAN', 1.0),
(2, 'Hóa Học', 'HOA', 1.0),
(2, 'Sinh Học', 'SINH', 1.0),
(3, 'Toán', 'TOAN', 1.0),
(3, 'Địa Lý', 'DIA', 1.0),
(3, 'Lịch Sử', 'SU', 1.0),
(4, 'Ngữ Văn', 'VAN', 1.0),
(4, 'Tiếng Anh', 'ANH', 1.0),
(4, 'Lịch Sử', 'SU', 1.0);
GO

-- ==================== Insert MonHoc (All Subjects) ====================
INSERT INTO MonHoc (TenMonHoc, MaMonHoc, MoTa) VALUES
('Toán Học', 'TOAN', 'Môn Toán - Tư duy logic và tính toán'),
('Vật Lý', 'LY', 'Môn Vật Lý - Khám phá hiện tượng tự nhiên'),
('Hóa Học', 'HOA', 'Môn Hóa - Khoa học về phản ứng hóa học'),
('Sinh Học', 'SINH', 'Môn Sinh - Khoa học sự sống'),
('Địa Lý', 'DIA', 'Môn Địa - Học về không gian địa lý'),
('Lịch Sử', 'SU', 'Môn Sử - Học lịch sử và các sự kiện'),
('Ngữ Văn', 'VAN', 'Môn Văn - Học văn chương và tiếng Việt'),
('Tiếng Anh', 'ANH', 'Môn Anh - Ngôn ngữ quốc tế'),
('Tin Học', 'TINHOC', 'Môn Tin - Lập trình và khoa học máy tính'),
('Thể Dục', 'THEDUC', 'Môn Thể Dục - Rèn luyện sức khoẻ');
GO

-- ==================== Insert TruongDH (Universities) ====================
INSERT INTO TruongDH (TenTruong, MaTruong, Website, DiaChi, SoDienThoai, Email) VALUES
('Đại học Bách Khoa Hà Nội', 'HUST', 'https://hust.edu.vn', '1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội', '0243869000', 'info@hust.edu.vn'),
('Đại học Quốc gia Hà Nội', 'VNU', 'https://vnu.edu.vn', '144 Xuân Thuỷ, Cầu Giấy, Hà Nội', '0243754000', 'info@vnu.edu.vn'),
('Đại học Kinh Tế Quốc Dân', 'NEU', 'https://neu.edu.vn', '207 Giải Phóng, Hà Nội', '0243551100', 'info@neu.edu.vn'),
('Đại học Sư Phạm Hà Nội', 'HNUE', 'https://hnue.edu.vn', '136 Xuân Thuy, Hà Nội', '0243755180', 'info@hnue.edu.vn'),
('Đại học Công Nghiệp Hà Nội', 'HaUI', 'https://haui.edu.vn', '298 Cầu Diễn, Hà Nội', '0243636558', 'info@haui.edu.vn');
GO

-- ==================== Insert Nganh (Majors) ====================
INSERT INTO Nganh (TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau) VALUES
(1, 'Kỹ Thuật Máy', 'KTMT', 'Chuyên ngành về cơ khí và máy móc', 150, 24.0, 'A'),
(1, 'Công Nghệ Thông Tin', 'CNTT', 'Lập trình, phân tích hệ thống', 200, 25.5, 'A'),
(1, 'Điện - Điện Tử', 'DDET', 'Kỹ thuật điện và điện tử', 100, 23.5, 'A'),
(2, 'Quản Lý Kinh Tế', 'QLKT', 'Quản lý và điều hành doanh nghiệp', 250, 22.0, 'B'),
(2, 'Luật Quốc Tế', 'LQTE', 'Chuyên gia về luật quốc tế', 80, 23.0, 'C'),
(3, 'Kế Toán', 'KT', 'Quản lý tài chính và kế toán', 300, 21.0, 'B'),
(3, 'Kinh Tế Lượng', 'KTL', 'Phân tích kinh tế bằng toán học', 100, 23.5, 'A'),
(4, 'Sư Phạm Toán', 'SPTN', 'Đào tạo giáo viên Toán', 200, 22.5, 'A'),
(4, 'Sư Phạm Tiếng Anh', 'SPTA', 'Đào tạo giáo viên Tiếng Anh', 180, 20.0, 'D'),
(5, 'Kỹ Thuật Xây Dựng', 'KTXD', 'Thiết kế và thi công công trình', 120, 23.0, 'A');
GO

-- ==================== Insert UserThi (Students) ====================
INSERT INTO UserThi (UserName, MatKhau, HoTen, Email, LoaiUser, NgayTao) VALUES
('student001', 'hashed_password_1', 'Nguyễn Văn A', 'vana@student.edu.vn', 'Student', GETDATE()),
('student002', 'hashed_password_2', 'Trần Thị B', 'thib@student.edu.vn', 'Student', GETDATE()),
('student003', 'hashed_password_3', 'Lê Minh C', 'minhc@student.edu.vn', 'Student', GETDATE()),
('student004', 'hashed_password_4', 'Phạm Thu D', 'thud@student.edu.vn', 'Student', GETDATE()),
('student005', 'hashed_password_5', 'Hoàng Quốc E', 'quoce@student.edu.vn', 'Student', GETDATE());
GO

-- ==================== Insert Diem (Scores) ====================
INSERT INTO Diem (UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap) VALUES
(1, 1, 8.5, 0.5, 1.0, GETDATE()),
(1, 2, 7.8, 0.3, 1.0, GETDATE()),
(1, 3, 8.2, 0.4, 1.0, GETDATE()),
(2, 4, 9.0, 0.5, 1.0, GETDATE()),
(2, 5, 8.5, 0.4, 1.0, GETDATE()),
(2, 6, 7.9, 0.3, 1.0, GETDATE()),
(3, 7, 7.5, 0.3, 1.0, GETDATE()),
(3, 8, 8.1, 0.4, 1.0, GETDATE()),
(3, 9, 7.8, 0.3, 1.0, GETDATE()),
(4, 10, 8.8, 0.5, 1.0, GETDATE()),
(4, 11, 9.2, 0.5, 1.0, GETDATE()),
(4, 12, 8.5, 0.4, 1.0, GETDATE()),
(5, 1, 6.5, 0.2, 1.0, GETDATE()),
(5, 2, 7.2, 0.3, 1.0, GETDATE()),
(5, 3, 6.8, 0.2, 1.0, GETDATE());
GO

-- ==================== Insert GiaoVien (Teachers) ====================
INSERT INTO GiaoVien (TenGiaoVien, MonDay, Email, SoDienThoai, ChuyenMon) VALUES
('Thầy Phạm Quân', 'Toán', 'quan.pham@hust.edu.vn', '0912345678', 'Đại Số, Giải Tích'),
('Cô Hoàng Hoa', 'Vật Lý', 'hoa.hoang@hust.edu.vn', '0912345679', 'Cơ Học, Điện Từ'),
('Thầy Trần Long', 'Hóa Học', 'long.tran@hust.edu.vn', '0912345680', 'Hóa Hữu Cơ, Vô Cơ'),
('Cô Lý Huân', 'Sinh Học', 'huan.ly@hnue.edu.vn', '0912345681', 'Tế Bào, Di Truyền'),
('Thầy Bùi Minh', 'Tiếng Anh', 'minh.bui@hnue.edu.vn', '0912345682', 'Văn Phạm Anh, Phát Âm');
GO

-- ==================== Insert ThongTinTuyenSinh (Admission Info) ====================
INSERT INTO ThongTinTuyenSinh (NganhID, GiaoVienID, TenHinhThuc, NamTuyen, DiemChuan, DuToanChiTieu) VALUES
(1, 1, 'Xét tuyển đại học', 2024, 24.0, 150),
(2, 1, 'Xét tuyển đại học', 2024, 25.5, 200),
(6, 3, 'Xét tuyển đại học', 2024, 21.0, 300),
(9, 5, 'Xét tuyển đại học', 2024, 20.0, 180),
(10, 2, 'Xét tuyển đại học', 2024, 23.0, 120);
GO

-- ==================== Insert DanhGia (Ratings) ====================
INSERT INTO DanhGia (NganhID, UserId, DiemDanhGia, NhanXet, NgayDanhGia) VALUES
(1, 1, 4, 'Ngành rất tuyệt vời, cơ sở vật chất tốt', GETDATE()),
(2, 1, 5, 'Giảng dạy chất lượng, học được nhiều điều bổ ích', GETDATE()),
(3, 2, 4, 'Nội dung hay, đòi hỏi sự tập trung cao', GETDATE()),
(6, 3, 5, 'Giáo viên tâm huyết, hỗ trợ sinh viên tốt', GETDATE()),
(9, 4, 4, 'Khóa học bổ ích, kỹ năng thực tiễn tốt', GETDATE()),
(4, 5, 3, 'Nội dung có phần nặng, cần học tập chăm chỉ', GETDATE());
GO

PRINT 'Sample data inserted successfully!';
PRINT '';
PRINT '========== SUMMARY ==========';
PRINT 'Khối Thi (Test Blocks): 4 khối';
PRINT 'Môn học (Subjects): 12 môn trong khối + 10 môn tổng quát';
PRINT 'Trường đại học: 5 trường';
PRINT 'Ngành học: 10 ngành';
PRINT 'Sinh viên: 5 học sinh';
PRINT 'Giáo viên: 5 giáo viên';
PRINT 'Điểm: 15 bản ghi';
PRINT 'Đánh giá: 6 đánh giá';
PRINT 'Thông tin tuyển sinh: 5 hình thức';
PRINT '============================';
GO
