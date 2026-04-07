-- StudyMatch (Oracle) - Sample data
-- Notes:
-- - No GO
-- - Use SYSTIMESTAMP
-- - MonTrongKhoiThi.MaMon must be unique => use suffix _A/_B/_C/_D

-- ===== KhoiThi =====
INSERT INTO KhoiThi (KhoiID, TenKhoi, MoTa) VALUES (NULL, 'A', 'Khối A - Toán, Lý, Hóa');
INSERT INTO KhoiThi (KhoiID, TenKhoi, MoTa) VALUES (NULL, 'B', 'Khối B - Toán, Hóa, Sinh');
INSERT INTO KhoiThi (KhoiID, TenKhoi, MoTa) VALUES (NULL, 'C', 'Khối C - Toán, Địa, Sử');
INSERT INTO KhoiThi (KhoiID, TenKhoi, MoTa) VALUES (NULL, 'D', 'Khối D - Ngữ Văn, Tiếng Anh, Lịch Sử');

-- ===== MonTrongKhoiThi =====
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='A'), 'Toán', 'TOAN_A', 1.0);
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='A'), 'Vật Lý', 'LY_A', 1.0);
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='A'), 'Hóa Học', 'HOA_A', 1.0);

INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='B'), 'Toán', 'TOAN_B', 1.0);
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='B'), 'Hóa Học', 'HOA_B', 1.0);
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='B'), 'Sinh Học', 'SINH_B', 1.0);

INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='C'), 'Toán', 'TOAN_C', 1.0);
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='C'), 'Địa Lý', 'DIA_C', 1.0);
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='C'), 'Lịch Sử', 'SU_C', 1.0);

INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='D'), 'Ngữ Văn', 'VAN_D', 1.0);
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='D'), 'Tiếng Anh', 'ANH_D', 1.0);
INSERT INTO MonTrongKhoiThi (MonID, KhoiID, TenMon, MaMon, HeSo)
VALUES (NULL, (SELECT KhoiID FROM KhoiThi WHERE TenKhoi='D'), 'Lịch Sử', 'SU_D', 1.0);

-- ===== MonHoc =====
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Toán Học', 'TOAN', 'Môn Toán - Tư duy logic và tính toán');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Vật Lý', 'LY', 'Môn Vật Lý - Khám phá hiện tượng tự nhiên');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Hóa Học', 'HOA', 'Môn Hóa - Khoa học về phản ứng hóa học');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Sinh Học', 'SINH', 'Môn Sinh - Khoa học sự sống');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Địa Lý', 'DIA', 'Môn Địa - Học về không gian địa lý');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Lịch Sử', 'SU', 'Môn Sử - Học lịch sử và các sự kiện');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Ngữ Văn', 'VAN', 'Môn Văn - Học văn chương và tiếng Việt');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Tiếng Anh', 'ANH', 'Môn Anh - Ngôn ngữ quốc tế');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Tin Học', 'TINHOC', 'Môn Tin - Lập trình và khoa học máy tính');
INSERT INTO MonHoc (MonHocID, TenMonHoc, MaMonHoc, MoTa) VALUES (NULL, 'Thể Dục', 'THEDUC', 'Môn Thể Dục - Rèn luyện sức khoẻ');

-- ===== TruongDH =====
INSERT INTO TruongDH (TruongID, TenTruong, MaTruong, Website, DiaChi, SoDienThoai, Email)
VALUES (NULL, 'Đại học Bách Khoa Hà Nội', 'HUST', 'https://hust.edu.vn', '1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội', '0243869000', 'info@hust.edu.vn');
INSERT INTO TruongDH (TruongID, TenTruong, MaTruong, Website, DiaChi, SoDienThoai, Email)
VALUES (NULL, 'Đại học Quốc gia Hà Nội', 'VNU', 'https://vnu.edu.vn', '144 Xuân Thuỷ, Cầu Giấy, Hà Nội', '0243754000', 'info@vnu.edu.vn');
INSERT INTO TruongDH (TruongID, TenTruong, MaTruong, Website, DiaChi, SoDienThoai, Email)
VALUES (NULL, 'Đại học Kinh Tế Quốc Dân', 'NEU', 'https://neu.edu.vn', '207 Giải Phóng, Hà Nội', '0243551100', 'info@neu.edu.vn');
INSERT INTO TruongDH (TruongID, TenTruong, MaTruong, Website, DiaChi, SoDienThoai, Email)
VALUES (NULL, 'Đại học Sư Phạm Hà Nội', 'HNUE', 'https://hnue.edu.vn', '136 Xuân Thuy, Hà Nội', '0243755180', 'info@hnue.edu.vn');
INSERT INTO TruongDH (TruongID, TenTruong, MaTruong, Website, DiaChi, SoDienThoai, Email)
VALUES (NULL, 'Đại học Công Nghiệp Hà Nội', 'HAUI', 'https://haui.edu.vn', '298 Cầu Diễn, Hà Nội', '0243636558', 'info@haui.edu.vn');

-- ===== Nganh =====
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='HUST'), 'Kỹ Thuật Máy', 'KTMT', 'Chuyên ngành về cơ khí và máy móc', 150, 24.0, 'A');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='HUST'), 'Công Nghệ Thông Tin', 'CNTT', 'Lập trình, phân tích hệ thống', 200, 25.5, 'A');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='HUST'), 'Điện - Điện Tử', 'DDET', 'Kỹ thuật điện và điện tử', 100, 23.5, 'A');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='VNU'), 'Quản Lý Kinh Tế', 'QLKT', 'Quản lý và điều hành doanh nghiệp', 250, 22.0, 'B');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='VNU'), 'Luật Quốc Tế', 'LQTE', 'Chuyên gia về luật quốc tế', 80, 23.0, 'C');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='NEU'), 'Kế Toán', 'KT', 'Quản lý tài chính và kế toán', 300, 21.0, 'B');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='NEU'), 'Kinh Tế Lượng', 'KTL', 'Phân tích kinh tế bằng toán học', 100, 23.5, 'A');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='HNUE'), 'Sư Phạm Toán', 'SPTN', 'Đào tạo giáo viên Toán', 200, 22.5, 'A');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='HNUE'), 'Sư Phạm Tiếng Anh', 'SPTA', 'Đào tạo giáo viên Tiếng Anh', 180, 20.0, 'D');
INSERT INTO Nganh (NganhID, TruongID, TenNganh, MaNganh, MoTa, ChiTieuTuyen, DiemChuan, KhoiThi_YeuCau)
VALUES (NULL, (SELECT TruongID FROM TruongDH WHERE MaTruong='HAUI'), 'Kỹ Thuật Xây Dựng', 'KTXD', 'Thiết kế và thi công công trình', 120, 23.0, 'A');

-- ===== UserThi =====
INSERT INTO UserThi (UserId, UserName, MatKhau, HoTen, Email, LoaiUser, NgayTao)
VALUES (NULL, 'student001', 'hashed_password_1', 'Nguyễn Văn A', 'vana@student.edu.vn', 'Student', SYSTIMESTAMP);
INSERT INTO UserThi (UserId, UserName, MatKhau, HoTen, Email, LoaiUser, NgayTao)
VALUES (NULL, 'student002', 'hashed_password_2', 'Trần Thị B', 'thib@student.edu.vn', 'Student', SYSTIMESTAMP);
INSERT INTO UserThi (UserId, UserName, MatKhau, HoTen, Email, LoaiUser, NgayTao)
VALUES (NULL, 'student003', 'hashed_password_3', 'Lê Minh C', 'minhc@student.edu.vn', 'Student', SYSTIMESTAMP);
INSERT INTO UserThi (UserId, UserName, MatKhau, HoTen, Email, LoaiUser, NgayTao)
VALUES (NULL, 'student004', 'hashed_password_4', 'Phạm Thu D', 'thud@student.edu.vn', 'Student', SYSTIMESTAMP);
INSERT INTO UserThi (UserId, UserName, MatKhau, HoTen, Email, LoaiUser, NgayTao)
VALUES (NULL, 'student005', 'hashed_password_5', 'Hoàng Quốc E', 'quoce@student.edu.vn', 'Student', SYSTIMESTAMP);

-- ===== Diem =====
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student001'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='TOAN_A'), 8.5, 0.5, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student001'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='LY_A'), 7.8, 0.3, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student001'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='HOA_A'), 8.2, 0.4, 1.0, SYSTIMESTAMP);

INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student002'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='TOAN_B'), 9.0, 0.5, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student002'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='HOA_B'), 8.5, 0.4, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student002'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='SINH_B'), 7.9, 0.3, 1.0, SYSTIMESTAMP);

INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student003'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='TOAN_C'), 7.5, 0.3, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student003'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='DIA_C'), 8.1, 0.4, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student003'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='SU_C'), 7.8, 0.3, 1.0, SYSTIMESTAMP);

INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student004'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='VAN_D'), 8.8, 0.5, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student004'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='ANH_D'), 9.2, 0.5, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student004'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='SU_D'), 8.5, 0.4, 1.0, SYSTIMESTAMP);

INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student005'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='TOAN_A'), 6.5, 0.2, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student005'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='LY_A'), 7.2, 0.3, 1.0, SYSTIMESTAMP);
INSERT INTO Diem (DiemID, UserId, MonID, DiemThi, DiemThuong, HeSo, NgayNhap)
VALUES (seq_diemid.NEXTVAL, (SELECT UserId FROM UserThi WHERE UserName='student005'), (SELECT MonID FROM MonTrongKhoiThi WHERE MaMon='HOA_A'), 6.8, 0.2, 1.0, SYSTIMESTAMP);

-- ===== GiaoVien =====
INSERT INTO GiaoVien (GiaoVienID, TenGiaoVien, MonDay, Email, SoDienThoai, ChuyenMon)
VALUES (NULL, 'Thầy Phạm Quân', 'Toán', 'quan.pham@hust.edu.vn', '0912345678', 'Đại Số, Giải Tích');
INSERT INTO GiaoVien (GiaoVienID, TenGiaoVien, MonDay, Email, SoDienThoai, ChuyenMon)
VALUES (NULL, 'Cô Hoàng Hoa', 'Vật Lý', 'hoa.hoang@hust.edu.vn', '0912345679', 'Cơ Học, Điện Từ');
INSERT INTO GiaoVien (GiaoVienID, TenGiaoVien, MonDay, Email, SoDienThoai, ChuyenMon)
VALUES (NULL, 'Thầy Trần Long', 'Hóa Học', 'long.tran@hust.edu.vn', '0912345680', 'Hóa Hữu Cơ, Vô Cơ');
INSERT INTO GiaoVien (GiaoVienID, TenGiaoVien, MonDay, Email, SoDienThoai, ChuyenMon)
VALUES (NULL, 'Cô Lý Huân', 'Sinh Học', 'huan.ly@hnue.edu.vn', '0912345681', 'Tế Bào, Di Truyền');
INSERT INTO GiaoVien (GiaoVienID, TenGiaoVien, MonDay, Email, SoDienThoai, ChuyenMon)
VALUES (NULL, 'Thầy Bùi Minh', 'Tiếng Anh', 'minh.bui@hnue.edu.vn', '0912345682', 'Văn Phạm Anh, Phát Âm');

-- ===== ThongTinTuyenSinh =====
INSERT INTO ThongTinTuyenSinh (ThongTinID, NganhID, GiaoVienID, TenHinhThuc, NamTuyen, DiemChuan, DuToanChiTieu)
VALUES (NULL,
        (SELECT NganhID FROM Nganh WHERE MaNganh='KTMT'),
        (SELECT GiaoVienID FROM GiaoVien WHERE TenGiaoVien='Thầy Phạm Quân'),
        'Xét tuyển đại học', 2024, 24.0, 150);

INSERT INTO ThongTinTuyenSinh (ThongTinID, NganhID, GiaoVienID, TenHinhThuc, NamTuyen, DiemChuan, DuToanChiTieu)
VALUES (NULL,
        (SELECT NganhID FROM Nganh WHERE MaNganh='CNTT'),
        (SELECT GiaoVienID FROM GiaoVien WHERE TenGiaoVien='Thầy Phạm Quân'),
        'Xét tuyển đại học', 2024, 25.5, 200);

INSERT INTO ThongTinTuyenSinh (ThongTinID, NganhID, GiaoVienID, TenHinhThuc, NamTuyen, DiemChuan, DuToanChiTieu)
VALUES (NULL,
        (SELECT NganhID FROM Nganh WHERE MaNganh='KT'),
        (SELECT GiaoVienID FROM GiaoVien WHERE TenGiaoVien='Thầy Trần Long'),
        'Xét tuyển đại học', 2024, 21.0, 300);

INSERT INTO ThongTinTuyenSinh (ThongTinID, NganhID, GiaoVienID, TenHinhThuc, NamTuyen, DiemChuan, DuToanChiTieu)
VALUES (NULL,
        (SELECT NganhID FROM Nganh WHERE MaNganh='SPTA'),
        (SELECT GiaoVienID FROM GiaoVien WHERE TenGiaoVien='Thầy Bùi Minh'),
        'Xét tuyển đại học', 2024, 20.0, 180);

INSERT INTO ThongTinTuyenSinh (ThongTinID, NganhID, GiaoVienID, TenHinhThuc, NamTuyen, DiemChuan, DuToanChiTieu)
VALUES (NULL,
        (SELECT NganhID FROM Nganh WHERE MaNganh='KTXD'),
        (SELECT GiaoVienID FROM GiaoVien WHERE TenGiaoVien='Cô Hoàng Hoa'),
        'Xét tuyển đại học', 2024, 23.0, 120);

-- ===== DanhGia =====
INSERT INTO DanhGia (DanhGiaID, NganhID, UserId, DiemDanhGia, NhanXet, NgayDanhGia)
VALUES (NULL, (SELECT NganhID FROM Nganh WHERE MaNganh='KTMT'), (SELECT UserId FROM UserThi WHERE UserName='student001'), 4, 'Ngành rất tuyệt vời, cơ sở vật chất tốt', SYSTIMESTAMP);
INSERT INTO DanhGia (DanhGiaID, NganhID, UserId, DiemDanhGia, NhanXet, NgayDanhGia)
VALUES (NULL, (SELECT NganhID FROM Nganh WHERE MaNganh='CNTT'), (SELECT UserId FROM UserThi WHERE UserName='student001'), 5, 'Giảng dạy chất lượng, học được nhiều điều bổ ích', SYSTIMESTAMP);
INSERT INTO DanhGia (DanhGiaID, NganhID, UserId, DiemDanhGia, NhanXet, NgayDanhGia)
VALUES (NULL, (SELECT NganhID FROM Nganh WHERE MaNganh='DDET'), (SELECT UserId FROM UserThi WHERE UserName='student002'), 4, 'Nội dung hay, đòi hỏi sự tập trung cao', SYSTIMESTAMP);
INSERT INTO DanhGia (DanhGiaID, NganhID, UserId, DiemDanhGia, NhanXet, NgayDanhGia)
VALUES (NULL, (SELECT NganhID FROM Nganh WHERE MaNganh='KT'), (SELECT UserId FROM UserThi WHERE UserName='student003'), 5, 'Giáo viên tâm huyết, hỗ trợ sinh viên tốt', SYSTIMESTAMP);
INSERT INTO DanhGia (DanhGiaID, NganhID, UserId, DiemDanhGia, NhanXet, NgayDanhGia)
VALUES (NULL, (SELECT NganhID FROM Nganh WHERE MaNganh='SPTA'), (SELECT UserId FROM UserThi WHERE UserName='student004'), 4, 'Khóa học bổ ích, kỹ năng thực tiễn tốt', SYSTIMESTAMP);
INSERT INTO DanhGia (DanhGiaID, NganhID, UserId, DiemDanhGia, NhanXet, NgayDanhGia)
VALUES (NULL, (SELECT NganhID FROM Nganh WHERE MaNganh='QLKT'), (SELECT UserId FROM UserThi WHERE UserName='student005'), 3, 'Nội dung có phần nặng, cần học tập chăm chỉ', SYSTIMESTAMP);

COMMIT;

PROMPT Sample data inserted.
