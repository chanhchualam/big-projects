/*
  Schema dùng chung cho mỗi CSDL vùng (Bắc / Trung / Nam).
  Thay @DbName bằng: TrafficViolation_Bac | TrafficViolation_Trung | TrafficViolation_Nam
  Hoặc chạy riêng từng khối USE ... GO bên dưới.
*/

/* ========== BẮC ========== */
USE TrafficViolation_Bac;
GO

-- Vùng & đơn vị (snapshot tại vùng)
IF OBJECT_ID(N'dbo.DonViHanhChinh', N'U') IS NULL
CREATE TABLE dbo.DonViHanhChinh (
    MaDonVi      VARCHAR(10)  NOT NULL PRIMARY KEY,
    TenDonVi     NVARCHAR(200) NOT NULL,
    Cap          TINYINT      NOT NULL, -- 1: Tỉnh/TP, 2: Quận/Huyện
    MaCha        VARCHAR(10)  NULL REFERENCES dbo.DonViHanhChinh(MaDonVi)
);

IF OBJECT_ID(N'dbo.ChuPhuongTien', N'U') IS NULL
CREATE TABLE dbo.ChuPhuongTien (
    MaChu        VARCHAR(20)  NOT NULL PRIMARY KEY,
    HoTen        NVARCHAR(100) NOT NULL,
    CCCD         VARCHAR(20)  NULL,
    DienThoai    VARCHAR(20)  NULL,
    DiaChi       NVARCHAR(300) NULL,
    NgayTao      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.PhuongTien', N'U') IS NULL
CREATE TABLE dbo.PhuongTien (
    BienSo       VARCHAR(20)  NOT NULL PRIMARY KEY,
    MaChu        VARCHAR(20)  NOT NULL REFERENCES dbo.ChuPhuongTien(MaChu),
    LoaiXe       NVARCHAR(50) NOT NULL,
    NhanHieu     NVARCHAR(80) NULL,
    MauSon       NVARCHAR(40) NULL,
    MaTinhDK     VARCHAR(10)  NOT NULL -- gắn với phân mảnh vùng
);

IF OBJECT_ID(N'dbo.TramGhiHinh', N'U') IS NULL
CREATE TABLE dbo.TramGhiHinh (
    MaTram       VARCHAR(20)  NOT NULL PRIMARY KEY,
    TenTram      NVARCHAR(200) NOT NULL,
    MaDonVi      VARCHAR(10)  NOT NULL REFERENCES dbo.DonViHanhChinh(MaDonVi),
    KinhDo       DECIMAL(10,7) NULL,
    ViDo         DECIMAL(10,7) NULL,
    DangHoatDong BIT NOT NULL DEFAULT 1
);

IF OBJECT_ID(N'dbo.ViPhamGiaoThong', N'U') IS NULL
CREATE TABLE dbo.ViPhamGiaoThong (
    MaViPham     BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BienSo       VARCHAR(20)  NOT NULL REFERENCES dbo.PhuongTien(BienSo),
    MaTram       VARCHAR(20)  NULL REFERENCES dbo.TramGhiHinh(MaTram),
    MaDonVi      VARCHAR(10)  NOT NULL REFERENCES dbo.DonViHanhChinh(MaDonVi),
    ThoiGianVP   DATETIME2      NOT NULL,
    LoaiViPham   NVARCHAR(200) NOT NULL,
    DieuKhoan    VARCHAR(50)  NULL,
    MucPhatTien  DECIMAL(18,2) NOT NULL,
    GhiChu       NVARCHAR(500) NULL,
    NguonGhiNhan NVARCHAR(50) NOT NULL DEFAULT N'Tuần tra', -- Tuần tra | Phạt nguội
    NgayTao      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ViPham_ThoiGian ON dbo.ViPhamGiaoThong(ThoiGianVP);
CREATE INDEX IX_ViPham_BienSo ON dbo.ViPhamGiaoThong(BienSo);

IF OBJECT_ID(N'dbo.PhatNguoi', N'U') IS NULL
CREATE TABLE dbo.PhatNguoi (
    MaPhatNguoi  BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaViPham     BIGINT NOT NULL REFERENCES dbo.ViPhamGiaoThong(MaViPham),
    MaAnh        VARCHAR(40)  NOT NULL, -- tham chiếu blob/object storage
    DoTinCay     DECIMAL(5,2) NULL,      -- điểm AI / xác thực
    TrangThai    NVARCHAR(40) NOT NULL DEFAULT N'Chờ xác minh',
    NgayDongBo   DATETIME2      NULL
);
CREATE INDEX IX_PhatNguoi_TrangThai ON dbo.PhatNguoi(TrangThai);

IF OBJECT_ID(N'dbo.XuLyViPham', N'U') IS NULL
CREATE TABLE dbo.XuLyViPham (
    MaXuLy       BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaViPham     BIGINT NOT NULL REFERENCES dbo.ViPhamGiaoThong(MaViPham),
    TrangThai    NVARCHAR(40) NOT NULL,
    NgayQuyetDinh DATETIME2     NULL,
    SoQuyetDinh  VARCHAR(50)  NULL,
    DaNopPhat    BIT NOT NULL DEFAULT 0,
    NgayCapNhat  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

GO

/* ========== TRUNG (cùng schema) ========== */
USE TrafficViolation_Trung;
GO

IF OBJECT_ID(N'dbo.DonViHanhChinh', N'U') IS NULL
CREATE TABLE dbo.DonViHanhChinh (
    MaDonVi      VARCHAR(10)  NOT NULL PRIMARY KEY,
    TenDonVi     NVARCHAR(200) NOT NULL,
    Cap          TINYINT      NOT NULL,
    MaCha        VARCHAR(10)  NULL REFERENCES dbo.DonViHanhChinh(MaDonVi)
);
IF OBJECT_ID(N'dbo.ChuPhuongTien', N'U') IS NULL
CREATE TABLE dbo.ChuPhuongTien (
    MaChu        VARCHAR(20)  NOT NULL PRIMARY KEY,
    HoTen        NVARCHAR(100) NOT NULL,
    CCCD         VARCHAR(20)  NULL,
    DienThoai    VARCHAR(20)  NULL,
    DiaChi       NVARCHAR(300) NULL,
    NgayTao      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'dbo.PhuongTien', N'U') IS NULL
CREATE TABLE dbo.PhuongTien (
    BienSo       VARCHAR(20)  NOT NULL PRIMARY KEY,
    MaChu        VARCHAR(20)  NOT NULL REFERENCES dbo.ChuPhuongTien(MaChu),
    LoaiXe       NVARCHAR(50) NOT NULL,
    NhanHieu     NVARCHAR(80) NULL,
    MauSon       NVARCHAR(40) NULL,
    MaTinhDK     VARCHAR(10)  NOT NULL
);
IF OBJECT_ID(N'dbo.TramGhiHinh', N'U') IS NULL
CREATE TABLE dbo.TramGhiHinh (
    MaTram       VARCHAR(20)  NOT NULL PRIMARY KEY,
    TenTram      NVARCHAR(200) NOT NULL,
    MaDonVi      VARCHAR(10)  NOT NULL REFERENCES dbo.DonViHanhChinh(MaDonVi),
    KinhDo       DECIMAL(10,7) NULL,
    ViDo         DECIMAL(10,7) NULL,
    DangHoatDong BIT NOT NULL DEFAULT 1
);
IF OBJECT_ID(N'dbo.ViPhamGiaoThong', N'U') IS NULL
CREATE TABLE dbo.ViPhamGiaoThong (
    MaViPham     BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BienSo       VARCHAR(20)  NOT NULL REFERENCES dbo.PhuongTien(BienSo),
    MaTram       VARCHAR(20)  NULL REFERENCES dbo.TramGhiHinh(MaTram),
    MaDonVi      VARCHAR(10)  NOT NULL REFERENCES dbo.DonViHanhChinh(MaDonVi),
    ThoiGianVP   DATETIME2      NOT NULL,
    LoaiViPham   NVARCHAR(200) NOT NULL,
    DieuKhoan    VARCHAR(50)  NULL,
    MucPhatTien  DECIMAL(18,2) NOT NULL,
    GhiChu       NVARCHAR(500) NULL,
    NguonGhiNhan NVARCHAR(50) NOT NULL DEFAULT N'Tuần tra',
    NgayTao      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ViPham_ThoiGian ON dbo.ViPhamGiaoThong(ThoiGianVP);
CREATE INDEX IX_ViPham_BienSo ON dbo.ViPhamGiaoThong(BienSo);
IF OBJECT_ID(N'dbo.PhatNguoi', N'U') IS NULL
CREATE TABLE dbo.PhatNguoi (
    MaPhatNguoi  BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaViPham     BIGINT NOT NULL REFERENCES dbo.ViPhamGiaoThong(MaViPham),
    MaAnh        VARCHAR(40)  NOT NULL,
    DoTinCay     DECIMAL(5,2) NULL,
    TrangThai    NVARCHAR(40) NOT NULL DEFAULT N'Chờ xác minh',
    NgayDongBo   DATETIME2      NULL
);
CREATE INDEX IX_PhatNguoi_TrangThai ON dbo.PhatNguoi(TrangThai);
IF OBJECT_ID(N'dbo.XuLyViPham', N'U') IS NULL
CREATE TABLE dbo.XuLyViPham (
    MaXuLy       BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaViPham     BIGINT NOT NULL REFERENCES dbo.ViPhamGiaoThong(MaViPham),
    TrangThai    NVARCHAR(40) NOT NULL,
    NgayQuyetDinh DATETIME2     NULL,
    SoQuyetDinh  VARCHAR(50)  NULL,
    DaNopPhat    BIT NOT NULL DEFAULT 0,
    NgayCapNhat  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

/* ========== NAM ========== */
USE TrafficViolation_Nam;
GO

IF OBJECT_ID(N'dbo.DonViHanhChinh', N'U') IS NULL
CREATE TABLE dbo.DonViHanhChinh (
    MaDonVi      VARCHAR(10)  NOT NULL PRIMARY KEY,
    TenDonVi     NVARCHAR(200) NOT NULL,
    Cap          TINYINT      NOT NULL,
    MaCha        VARCHAR(10)  NULL REFERENCES dbo.DonViHanhChinh(MaDonVi)
);
IF OBJECT_ID(N'dbo.ChuPhuongTien', N'U') IS NULL
CREATE TABLE dbo.ChuPhuongTien (
    MaChu        VARCHAR(20)  NOT NULL PRIMARY KEY,
    HoTen        NVARCHAR(100) NOT NULL,
    CCCD         VARCHAR(20)  NULL,
    DienThoai    VARCHAR(20)  NULL,
    DiaChi       NVARCHAR(300) NULL,
    NgayTao      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'dbo.PhuongTien', N'U') IS NULL
CREATE TABLE dbo.PhuongTien (
    BienSo       VARCHAR(20)  NOT NULL PRIMARY KEY,
    MaChu        VARCHAR(20)  NOT NULL REFERENCES dbo.ChuPhuongTien(MaChu),
    LoaiXe       NVARCHAR(50) NOT NULL,
    NhanHieu     NVARCHAR(80) NULL,
    MauSon       NVARCHAR(40) NULL,
    MaTinhDK     VARCHAR(10)  NOT NULL
);
IF OBJECT_ID(N'dbo.TramGhiHinh', N'U') IS NULL
CREATE TABLE dbo.TramGhiHinh (
    MaTram       VARCHAR(20)  NOT NULL PRIMARY KEY,
    TenTram      NVARCHAR(200) NOT NULL,
    MaDonVi      VARCHAR(10)  NOT NULL REFERENCES dbo.DonViHanhChinh(MaDonVi),
    KinhDo       DECIMAL(10,7) NULL,
    ViDo         DECIMAL(10,7) NULL,
    DangHoatDong BIT NOT NULL DEFAULT 1
);
IF OBJECT_ID(N'dbo.ViPhamGiaoThong', N'U') IS NULL
CREATE TABLE dbo.ViPhamGiaoThong (
    MaViPham     BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    BienSo       VARCHAR(20)  NOT NULL REFERENCES dbo.PhuongTien(BienSo),
    MaTram       VARCHAR(20)  NULL REFERENCES dbo.TramGhiHinh(MaTram),
    MaDonVi      VARCHAR(10)  NOT NULL REFERENCES dbo.DonViHanhChinh(MaDonVi),
    ThoiGianVP   DATETIME2      NOT NULL,
    LoaiViPham   NVARCHAR(200) NOT NULL,
    DieuKhoan    VARCHAR(50)  NULL,
    MucPhatTien  DECIMAL(18,2) NOT NULL,
    GhiChu       NVARCHAR(500) NULL,
    NguonGhiNhan NVARCHAR(50) NOT NULL DEFAULT N'Tuần tra',
    NgayTao      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ViPham_ThoiGian ON dbo.ViPhamGiaoThong(ThoiGianVP);
CREATE INDEX IX_ViPham_BienSo ON dbo.ViPhamGiaoThong(BienSo);
IF OBJECT_ID(N'dbo.PhatNguoi', N'U') IS NULL
CREATE TABLE dbo.PhatNguoi (
    MaPhatNguoi  BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaViPham     BIGINT NOT NULL REFERENCES dbo.ViPhamGiaoThong(MaViPham),
    MaAnh        VARCHAR(40)  NOT NULL,
    DoTinCay     DECIMAL(5,2) NULL,
    TrangThai    NVARCHAR(40) NOT NULL DEFAULT N'Chờ xác minh',
    NgayDongBo   DATETIME2      NULL
);
CREATE INDEX IX_PhatNguoi_TrangThai ON dbo.PhatNguoi(TrangThai);
IF OBJECT_ID(N'dbo.XuLyViPham', N'U') IS NULL
CREATE TABLE dbo.XuLyViPham (
    MaXuLy       BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MaViPham     BIGINT NOT NULL REFERENCES dbo.ViPhamGiaoThong(MaViPham),
    TrangThai    NVARCHAR(40) NOT NULL,
    NgayQuyetDinh DATETIME2     NULL,
    SoQuyetDinh  VARCHAR(50)  NULL,
    DaNopPhat    BIT NOT NULL DEFAULT 0,
    NgayCapNhat  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
