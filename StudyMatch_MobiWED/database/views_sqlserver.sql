-- ==================== SQL SERVER VIEWS ====================
-- StudyMatch Database Views - SQL Server 2016+ Compatible

USE StudyMatch;
GO

-- View 1: Student Scores Summary
IF OBJECT_ID('dbo.vw_StudentScoresSummary', 'V') IS NOT NULL
    DROP VIEW vw_StudentScoresSummary;
GO

CREATE VIEW vw_StudentScoresSummary AS
SELECT 
    u.UserId,
    u.UserName,
    u.HoTen,
    u.Email,
    k.TenKhoi,
    m.TenMon,
    d.DiemThi,
    d.DiemThuong,
    CAST((d.DiemThi * d.HeSo + d.DiemThuong) AS DECIMAL(5,2)) AS DiemTongCong,
    d.NgayNhap,
    ROW_NUMBER() OVER (PARTITION BY u.UserId, k.KhoiID ORDER BY d.NgayNhap DESC) AS DiemHeThong
FROM UserThi u
INNER JOIN Diem d ON u.UserId = d.UserId
INNER JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
INNER JOIN KhoiThi k ON m.KhoiID = k.KhoiID;
GO

-- View 2: University Major Information
IF OBJECT_ID('dbo.vw_UniversityMajorInfo', 'V') IS NOT NULL
    DROP VIEW vw_UniversityMajorInfo;
GO

CREATE VIEW vw_UniversityMajorInfo AS
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
    ISNULL(AVG(CAST(dg.DiemDanhGia AS FLOAT)), 0) AS DiemTrungBinh
FROM Nganh n
INNER JOIN TruongDH t ON n.TruongID = t.TruongID
LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID
GROUP BY n.NganhID, n.TenNganh, n.MaNganh, t.TenTruong, t.MaTruong, 
         t.DiaChi, t.Website, n.DiemChuan, n.ChiTieuTuyen, n.KhoiThi_YeuCau;
GO

-- View 3: Student Recommended Majors
IF OBJECT_ID('dbo.vw_StudentRecommendedMajors', 'V') IS NOT NULL
    DROP VIEW vw_StudentRecommendedMajors;
GO

CREATE VIEW vw_StudentRecommendedMajors AS
SELECT DISTINCT
    u.UserId,
    u.UserName,
    u.HoTen,
    n.NganhID,
    n.TenNganh,
    t.TenTruong,
    n.DiemChuan,
    MAX(d.DiemThi * d.HeSo) AS DiemCaoNhat,
    CASE 
        WHEN MAX(d.DiemThi * d.HeSo) >= n.DiemChuan THEN 'Đủ tiêu chí'
        ELSE 'Cần cố gắng thêm'
    END AS TrangThaiTuyen
FROM UserThi u
INNER JOIN Diem d ON u.UserId = d.UserId
INNER JOIN MonTrongKhoiThi m ON d.MonID = m.MonID
INNER JOIN Nganh n ON m.KhoiID IN (
    SELECT KhoiID FROM KhoiThi WHERE TenKhoi = n.KhoiThi_YeuCau
)
INNER JOIN TruongDH t ON n.TruongID = t.TruongID
GROUP BY u.UserId, u.UserName, u.HoTen, n.NganhID, n.TenNganh, 
         t.TenTruong, n.DiemChuan;
GO

-- View 4: Teacher Schedule and Assignments
IF OBJECT_ID('dbo.vw_TeacherAssignments', 'V') IS NOT NULL
    DROP VIEW vw_TeacherAssignments;
GO

CREATE VIEW vw_TeacherAssignments AS
SELECT 
    gv.GiaoVienID,
    gv.TenGiaoVien,
    gv.MonDay,
    gv.Email,
    gv.SoDienThoai,
    COUNT(DISTINCT ti.ThongTinID) AS SoNganhPhuTrach,
    STRING_AGG(DISTINCT n.TenNganh, ', ') AS DanhSachNganh
FROM GiaoVien gv
LEFT JOIN ThongTinTuyenSinh ti ON gv.GiaoVienID = ti.GiaoVienID
LEFT JOIN Nganh n ON ti.NganhID = n.NganhID
GROUP BY gv.GiaoVienID, gv.TenGiaoVien, gv.MonDay, gv.Email, gv.SoDienThoai;
GO

-- View 5: Detailed Admission Statistics
IF OBJECT_ID('dbo.vw_AdmissionStatistics', 'V') IS NOT NULL
    DROP VIEW vw_AdmissionStatistics;
GO

CREATE VIEW vw_AdmissionStatistics AS
SELECT 
    t.TenTruong,
    COUNT(DISTINCT n.NganhID) AS SoNghanh,
    AVG(n.DiemChuan) AS DiemChuanTrungBinh,
    SUM(n.ChiTieuTuyen) AS TongChiTieu,
    COUNT(DISTINCT dg.UserId) AS SoSinhVienDanhGia,
    MAX(dg.DiemDanhGia) AS DanhGiaMax,
    MIN(dg.DiemDanhGia) AS DanhGiaMin
FROM TruongDH t
LEFT JOIN Nganh n ON t.TruongID = n.TruongID
LEFT JOIN DanhGia dg ON n.NganhID = dg.NganhID
GROUP BY t.TruongID, t.TenTruong;
GO

PRINT 'All views created successfully!';
GO
