-- ==================== VIEWS ====================

-- View: Lấy điểm trung bình của từng học sinh
CREATE OR REPLACE VIEW V_DIEM_TRUNG_BINH AS
SELECT 
    u.UserId,
    u.HoTen,
    u.Email,
    COUNT(d.DiemID) AS SoMonThi,
    ROUND(AVG(d.DiemThi), 2) AS DiemTrungBinh,
    MAX(d.DiemThi) AS DiemCaoNhat,
    MIN(d.DiemThi) AS DiemThapNhat
FROM UserThi u
LEFT JOIN Diem d ON u.UserId = d.UserId
GROUP BY u.UserId, u.HoTen, u.Email;

-- View: Danh sách ngành học phù hợp dựa trên điểm
CREATE OR REPLACE VIEW V_NGANH_PHU_HOP AS
SELECT 
    n.NganhID,
    n.TenNganh,
    t.TenTruong,
    n.DiemChuan,
    n.KhoiThi_YeuCau,
    n.ChiTieuTuyen,
    ROUND((n.DiemChuan * 0.85), 2) AS DiemToiThieu,
    ROUND((n.DiemChuan * 1.05), 2) AS DiemToiDa,
    COUNT(DISTINCT dg.DanhGiaID) AS SoDanhGia,
    ROUND(AVG(dg.DiemDanhGia), 2) AS DiemDanhGiaTrungBinh
FROM Nganh n
LEFT JOIN TruongDH t ON n.TruongID = t.TruongID
LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID
GROUP BY n.NganhID, n.TenNganh, t.TenTruong, n.DiemChuan, n.KhoiThi_YeuCau, n.ChiTieuTuyen;

-- View: Thông tin tuyển sinh theo năm
CREATE OR REPLACE VIEW V_TUYEN_SINH_THEO_NAM AS
SELECT 
    tts.NamTuyen,
    n.TenNganh,
    t.TenTruong,
    tts.TenHinhThuc,
    tts.DiemChuan,
    tts.DuToanChiTieu,
    ROW_NUMBER() OVER (PARTITION BY tts.NamTuyen ORDER BY tts.DiemChuan DESC) AS XepHang
FROM ThongTinTuyenSinh tts
JOIN Nganh n ON tts.NganhID = n.NganhID
JOIN TruongDH t ON n.TruongID = t.TruongID
ORDER BY tts.NamTuyen DESC, tts.DiemChuan DESC;

-- View: Danh sách giáo viên và thông tin liên hệ
CREATE OR REPLACE VIEW V_GIAO_VIEN_INFO AS
SELECT 
    gv.GiaoVienID,
    gv.TenGiaoVien,
    gv.MonDay,
    gv.Email,
    gv.SoDienThoai,
    COUNT(DISTINCT ha.HinhAnhID) AS SoHinhAnh,
    COUNT(DISTINCT tts.ThongTinID) AS SoLanDayKhoa
FROM GiaoVien gv
LEFT JOIN HinhAnhGiaoVien ha ON gv.GiaoVienID = ha.GiaoVienID
LEFT JOIN ThongTinTuyenSinh tts ON gv.GiaoVienID = tts.GiaoVienID
GROUP BY gv.GiaoVienID, gv.TenGiaoVien, gv.MonDay, gv.Email, gv.SoDienThoai;

-- View: Kết quả dự đoán với thông tin chi tiết
CREATE OR REPLACE VIEW V_KET_QUA_CHI_TIET AS
SELECT 
    kq.KetQuaID,
    u.HoTen,
    n.TenNganh,
    t.TenTruong,
    kq.DiemTrungBinh,
    kq.TiLePhuHop,
    n.DiemChuan,
    CASE 
        WHEN kq.TiLePhuHop >= 90 THEN 'Rất Phù Hợp'
        WHEN kq.TiLePhuHop >= 80 THEN 'Phù Hợp'
        WHEN kq.TiLePhuHop >= 70 THEN 'Khá Phù Hợp'
        WHEN kq.TiLePhuHop >= 60 THEN 'Bình Thường'
        ELSE 'Ít Phù Hợp'
    END AS MucDoDanhGia,
    kq.NgayTinhToan
FROM KetQuaDuDoan kq
JOIN UserThi u ON kq.UserId = u.UserId
JOIN Nganh n ON kq.NganhID = n.NganhID
JOIN TruongDH t ON n.TruongID = t.TruongID
ORDER BY kq.NgayTinhToan DESC;
