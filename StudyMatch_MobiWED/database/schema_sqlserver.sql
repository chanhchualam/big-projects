-- ==================== SQL SERVER SCHEMA CREATION ====================
-- StudyMatch Database - SQL Server 2016+ Compatible

-- Drop database if exists (optional for fresh setup)
-- DROP DATABASE IF EXISTS StudyMatch;
-- GO

-- Create database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'StudyMatch')
BEGIN
    CREATE DATABASE StudyMatch;
END
GO

USE StudyMatch;
GO

-- ==================== TABLE CREATION ====================

-- Bảng UserThi (Users/Students)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserThi')
BEGIN
    CREATE TABLE UserThi (
        UserId INT PRIMARY KEY IDENTITY(1,1),
        UserName VARCHAR(100) NOT NULL UNIQUE,
        MatKhau VARCHAR(255) NOT NULL,
        HoTen VARCHAR(150) NOT NULL,
        Email VARCHAR(100) UNIQUE,
        LoaiUser VARCHAR(50) DEFAULT 'Student',
        NgayTao DATETIME DEFAULT GETDATE()
    );
END
GO

-- Bảng KhoiThi (Test Blocks)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'KhoiThi')
BEGIN
    CREATE TABLE KhoiThi (
        KhoiID INT PRIMARY KEY IDENTITY(1,1),
        TenKhoi VARCHAR(50) NOT NULL UNIQUE,
        MoTa VARCHAR(500)
    );
END
GO

-- Bảng MonTrongKhoiThi (Subjects in Test Blocks)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MonTrongKhoiThi')
BEGIN
    CREATE TABLE MonTrongKhoiThi (
        MonID INT PRIMARY KEY IDENTITY(1,1),
        KhoiID INT NOT NULL REFERENCES KhoiThi(KhoiID),
        TenMon VARCHAR(100) NOT NULL,
        MaMon VARCHAR(20) UNIQUE,
        HeSo DECIMAL(3,1) DEFAULT 1.0
    );
    
    CREATE INDEX idx_KhoiID ON MonTrongKhoiThi(KhoiID);
END
GO

-- Bảng MonHoc (Subjects)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MonHoc')
BEGIN
    CREATE TABLE MonHoc (
        MonHocID INT PRIMARY KEY IDENTITY(1,1),
        TenMonHoc VARCHAR(100) NOT NULL,
        MaMonHoc VARCHAR(20) UNIQUE,
        MoTa VARCHAR(500)
    );
END
GO

-- Bảng Diem (Scores)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Diem')
BEGIN
    CREATE TABLE Diem (
        DiemID INT PRIMARY KEY IDENTITY(1,1),
        UserId INT NOT NULL REFERENCES UserThi(UserId),
        MonID INT NOT NULL REFERENCES MonTrongKhoiThi(MonID),
        DiemThi DECIMAL(4,2) NOT NULL,
        DiemThuong DECIMAL(4,2) DEFAULT 0,
        HeSo DECIMAL(3,1) DEFAULT 1.0,
        NgayNhap DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX idx_UserId ON Diem(UserId);
    CREATE INDEX idx_MonID ON Diem(MonID);
END
GO

-- Bảng TruongDH (Universities)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TruongDH')
BEGIN
    CREATE TABLE TruongDH (
        TruongID INT PRIMARY KEY IDENTITY(1,1),
        TenTruong VARCHAR(200) NOT NULL,
        MaTruong VARCHAR(50) UNIQUE,
        Website VARCHAR(200),
        DiaChi VARCHAR(300),
        SoDienThoai VARCHAR(20),
        Email VARCHAR(100)
    );
END
GO

-- Bảng Nganh (Majors)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Nganh')
BEGIN
    CREATE TABLE Nganh (
        NganhID INT PRIMARY KEY IDENTITY(1,1),
        TruongID INT NOT NULL REFERENCES TruongDH(TruongID),
        TenNganh VARCHAR(200) NOT NULL,
        MaNganh VARCHAR(50),
        MoTa VARCHAR(1000),
        ChiTieuTuyen INT,
        DiemChuan DECIMAL(5,2),
        KhoiThi_YeuCau VARCHAR(50)
    );
    
    CREATE INDEX idx_TruongID ON Nganh(TruongID);
END
GO

-- Bảng GiaoVien (Teachers)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GiaoVien')
BEGIN
    CREATE TABLE GiaoVien (
        GiaoVienID INT PRIMARY KEY IDENTITY(1,1),
        TenGiaoVien VARCHAR(150) NOT NULL,
        MonDay VARCHAR(100),
        Email VARCHAR(100),
        SoDienThoai VARCHAR(20),
        ChuyenMon VARCHAR(200)
    );
END
GO

-- Bảng ThongTinTuyenSinh (Admission Information)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ThongTinTuyenSinh')
BEGIN
    CREATE TABLE ThongTinTuyenSinh (
        ThongTinID INT PRIMARY KEY IDENTITY(1,1),
        NganhID INT NOT NULL REFERENCES Nganh(NganhID),
        GiaoVienID INT REFERENCES GiaoVien(GiaoVienID),
        TenHinhThuc VARCHAR(100),
        NamTuyen INT,
        DiemChuan DECIMAL(5,2),
        DuToanChiTieu INT
    );
    
    CREATE INDEX idx_NganhID ON ThongTinTuyenSinh(NganhID);
END
GO

-- Bảng DanhGia (Ratings/Reviews)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DanhGia')
BEGIN
    CREATE TABLE DanhGia (
        DanhGiaID INT PRIMARY KEY IDENTITY(1,1),
        NganhID INT NOT NULL REFERENCES Nganh(NganhID),
        UserId INT NOT NULL REFERENCES UserThi(UserId),
        DiemDanhGia INT CHECK (DiemDanhGia >= 1 AND DiemDanhGia <= 5),
        NhanXet VARCHAR(500),
        NgayDanhGia DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX idx_NganhID_Rating ON DanhGia(NganhID);
    CREATE INDEX idx_UserId_Rating ON DanhGia(UserId);
END
GO

-- ==================== DATA INTEGRITY SETUP ====================

-- Add constraints if needed
ALTER TABLE MonTrongKhoiThi
ADD CONSTRAINT CK_HeSo_Mon CHECK (HeSo > 0);
GO

ALTER TABLE Diem
ADD CONSTRAINT CK_HeSo_Diem CHECK (HeSo > 0);
GO

ALTER TABLE Diem
ADD CONSTRAINT CK_DiemThi CHECK (DiemThi >= 0 AND DiemThi <= 10);
GO

ALTER TABLE Diem
ADD CONSTRAINT CK_DiemThuong CHECK (DiemThuong >= 0 AND DiemThuong <= 10);
GO

-- ==================== END SCHEMA CREATION ====================
PRINT 'StudyMatch database schema created successfully on SQL Server!';
GO
