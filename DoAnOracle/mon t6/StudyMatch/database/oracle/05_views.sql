-- StudyMatch (Oracle) - Views

-- Views based on database/views.sql

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
JOIN TruongDH t ON n.TruongID = t.TruongID;


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
JOIN TruongDH t ON n.TruongID = t.TruongID;


-- Extra views similar to SQL Server versions (ported)

CREATE OR REPLACE VIEW VW_STUDENT_SCORES_SUMMARY AS
SELECT
    u.UserId,
    u.UserName,
    u.HoTen,
    u.Email,
    k.TenKhoi,
    m.TenMon,
    d.DiemThi,
    d.DiemThuong,
    CAST((d.DiemThi * d.HeSo + d.DiemThuong) AS NUMBER(5,2)) AS DiemTongCong,
    d.NgayNhap,
    ROW_NUMBER() OVER (PARTITION BY u.UserId, k.KhoiID ORDER BY d.NgayNhap DESC) AS DiemHeThong
FROM UserThi u
JOIN Diem d ON u.UserId = d.UserId
JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
JOIN KhoiThi k ON m.KhoiID = k.KhoiID;


CREATE OR REPLACE VIEW VW_UNIVERSITY_MAJOR_INFO AS
SELECT
    n.NganhID,
    n.TenNganh,
    n.MaNganh,
    t.TenTruong,
    t.MaTruong,
    t.DiaChi,
    t.Website,
    n.DiemChuan,
    n.ChiTieuTuyen,
    n.KhoiThi_YeuCau,
    COUNT(DISTINCT dg.DanhGiaID) AS SoLuongDanhGia,
    NVL(ROUND(AVG(dg.DiemDanhGia), 2), 0) AS DiemTrungBinh
FROM Nganh n
JOIN TruongDH t ON n.TruongID = t.TruongID
LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID
GROUP BY
    n.NganhID, n.TenNganh, n.MaNganh,
    t.TenTruong, t.MaTruong, t.DiaChi, t.Website,
    n.DiemChuan, n.ChiTieuTuyen, n.KhoiThi_YeuCau;


CREATE OR REPLACE VIEW VW_STUDENT_RECOMMENDED_MAJORS AS
SELECT
    u.UserId,
    u.UserName,
    u.HoTen,
    n.NganhID,
    n.TenNganh,
    t.TenTruong,
    n.DiemChuan,
    MAX(d.DiemThi * d.HeSo) AS DiemCaoNhat,
    CASE
        WHEN MAX(d.DiemThi * d.HeSo) >= NVL(n.DiemChuan, 0) THEN 'Du tieu chi'
        ELSE 'Can co gang them'
    END AS TrangThaiTuyen
FROM UserThi u
JOIN Diem d ON u.UserId = d.UserId
JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
JOIN KhoiThi k ON m.KhoiID = k.KhoiID
JOIN Nganh n ON k.TenKhoi = n.KhoiThi_YeuCau
JOIN TruongDH t ON n.TruongID = t.TruongID
GROUP BY
    u.UserId, u.UserName, u.HoTen,
    n.NganhID, n.TenNganh,
    t.TenTruong,
    n.DiemChuan;


CREATE OR REPLACE VIEW VW_TEACHER_ASSIGNMENTS AS
SELECT
    gv.GiaoVienID,
    gv.TenGiaoVien,
    gv.MonDay,
    gv.Email,
    gv.SoDienThoai,
    COUNT(DISTINCT ti.ThongTinID) AS SoNganhPhuTrach,
    (
      SELECT LISTAGG(x.TenNganh, ', ') WITHIN GROUP (ORDER BY x.TenNganh)
      FROM (
        SELECT DISTINCT n2.TenNganh
        FROM ThongTinTuyenSinh ti2
        JOIN Nganh n2 ON ti2.NganhID = n2.NganhID
        WHERE ti2.GiaoVienID = gv.GiaoVienID
      ) x
    ) AS DanhSachNganh
FROM GiaoVien gv
LEFT JOIN ThongTinTuyenSinh ti ON gv.GiaoVienID = ti.GiaoVienID
GROUP BY gv.GiaoVienID, gv.TenGiaoVien, gv.MonDay, gv.Email, gv.SoDienThoai;


CREATE OR REPLACE VIEW VW_ADMISSION_STATISTICS AS
SELECT
    t.TenTruong,
    COUNT(DISTINCT n.NganhID) AS SoNganh,
    ROUND(AVG(n.DiemChuan), 2) AS DiemChuanTrungBinh,
    SUM(n.ChiTieuTuyen) AS TongChiTieu,
    COUNT(DISTINCT dg.UserId) AS SoSinhVienDanhGia,
    MAX(dg.DiemDanhGia) AS DanhGiaMax,
    MIN(dg.DiemDanhGia) AS DanhGiaMin
FROM TruongDH t
LEFT JOIN Nganh n ON t.TruongID = n.TruongID
LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID
GROUP BY t.TruongID, t.TenTruong;


PROMPT Views created.
