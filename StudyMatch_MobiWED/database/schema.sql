-- ==================== TABLE CREATION ====================

-- Bảng UserThi
CREATE TABLE UserThi (
    UserId INTEGER PRIMARY KEY,
    UserName VARCHAR(100) NOT NULL UNIQUE,
    MatKhau VARCHAR(255) NOT NULL,
    HoTen VARCHAR(150) NOT NULL,
    Email VARCHAR(100) UNIQUE,
    LoaiUser VARCHAR(50),
    NgayTao TIMESTAMP DEFAULT SYSDATE
);

-- Bảng KhoiThi
CREATE TABLE KhoiThi (
    KhoiID INTEGER PRIMARY KEY,
    TenKhoi VARCHAR(50) NOT NULL UNIQUE,
    MoTa VARCHAR(500)
);

-- Bảng MonTrongKhoiThi
CREATE TABLE MonTrongKhoiThi (
    MonID INTEGER PRIMARY KEY,
    KhoiID INTEGER REFERENCES KhoiThi(KhoiID),
    TenMon VARCHAR(100) NOT NULL,
    MaMon VARCHAR(20) UNIQUE,
    HeSo DECIMAL(3,1) DEFAULT 1.0
);

-- Bảng MonHoc
CREATE TABLE MonHoc (
    MonHocID INTEGER PRIMARY KEY,
    TenMonHoc VARCHAR(100) NOT NULL,
    MaMonHoc VARCHAR(20) UNIQUE,
    MoTa VARCHAR(500)
);

-- Bảng Diem
CREATE TABLE Diem (
    DiemID INTEGER PRIMARY KEY,
    UserId INTEGER REFERENCES UserThi(UserId),
    MonID INTEGER REFERENCES MonTrongKhoiThi(MonID),
    DiemThi DECIMAL(4,2) NOT NULL,
    DiemThuong DECIMAL(4,2) DEFAULT 0,
    HeSo DECIMAL(3,1) DEFAULT 1.0,
    NgayNhap TIMESTAMP DEFAULT SYSDATE
);

-- Bảng TruongDH
CREATE TABLE TruongDH (
    TruongID INTEGER PRIMARY KEY,
    TenTruong VARCHAR(200) NOT NULL,
    MaTruong VARCHAR(50) UNIQUE,
    Website VARCHAR(200),
    DiaChi VARCHAR(300),
    SoDienThoai VARCHAR(20),
    Email VARCHAR(100)
);

-- Bảng Nganh
CREATE TABLE Nganh (
    NganhID INTEGER PRIMARY KEY,
    TruongID INTEGER REFERENCES TruongDH(TruongID),
    TenNganh VARCHAR(200) NOT NULL,
    MaNganh VARCHAR(50),
    MoTa VARCHAR(1000),
    ChiTieuTuyen INTEGER,
    DiemChuan DECIMAL(5,2),
    KhoiThi_YeuCau VARCHAR(50)
);

-- Bảng GiaoVien
CREATE TABLE GiaoVien (
    GiaoVienID INTEGER PRIMARY KEY,
    TenGiaoVien VARCHAR(150) NOT NULL,
    MonDay VARCHAR(100),
    Email VARCHAR(100),
    SoDienThoai VARCHAR(20),
    ChuyenMon VARCHAR(200)
);

-- Bảng ThongTinTuyenSinh
CREATE TABLE ThongTinTuyenSinh (
    ThongTinID INTEGER PRIMARY KEY,
    NganhID INTEGER REFERENCES Nganh(NganhID),
    GiaoVienID INTEGER REFERENCES GiaoVien(GiaoVienID),
    TenHinhThuc VARCHAR(100),
    NamTuyen INTEGER,
    DiemChuan DECIMAL(5,2),
    DuToanChiTieu INTEGER
);

-- Bảng DanhGia
CREATE TABLE DanhGia (
    DanhGiaID INTEGER PRIMARY KEY,
    NganhID INTEGER REFERENCES Nganh(NganhID),
    UserId INTEGER REFERENCES UserThi(UserId),
    DiemDanhGia INTEGER,
    NhanXet VARCHAR(500),
    NgayDanhGia TIMESTAMP DEFAULT SYSDATE
);

-- Bảng HinhAnhGiaoVien
CREATE TABLE HinhAnhGiaoVien (
    HinhAnhID INTEGER PRIMARY KEY,
    GiaoVienID INTEGER REFERENCES GiaoVien(GiaoVienID),
    DuongDan VARCHAR(300) NOT NULL,
    MoTa VARCHAR(500)
);

-- Bảng KetQuaDuDoan
CREATE TABLE KetQuaDuDoan (
    KetQuaID INTEGER PRIMARY KEY,
    UserId INTEGER REFERENCES UserThi(UserId),
    NganhID INTEGER REFERENCES Nganh(NganhID),
    DiemTrungBinh DECIMAL(5,2),
    TiLePhuHop DECIMAL(5,2),
    NgayTinhToan TIMESTAMP DEFAULT SYSDATE
);

-- ==================== SEQUENCES ====================

CREATE SEQUENCE seq_userid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_khoiid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_monid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_monhocid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_diemid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_truongid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_nganhid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_giaovenid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_ttuyenid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_danhgiaid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_hinhanhid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_ketquaid START WITH 1 INCREMENT BY 1;

-- ==================== INDEXES ====================

CREATE INDEX idx_diem_userid ON Diem(UserId);
CREATE INDEX idx_diem_monid ON Diem(MonID);
CREATE INDEX idx_nganh_truongid ON Nganh(TruongID);
CREATE INDEX idx_danh_gia_userid ON DanhGia(UserId);
CREATE INDEX idx_danh_gia_nganhid ON DanhGia(NganhID);
CREATE INDEX idx_ketqua_userid ON KetQuaDuDoan(UserId);
CREATE INDEX idx_ketqua_nganhid ON KetQuaDuDoan(NganhID);

-- ==================== CONSTRAINTS ====================

ALTER TABLE Diem ADD CONSTRAINT chk_diem_trong_khoang CHECK (DiemThi BETWEEN 0 AND 10);
ALTER TABLE DanhGia ADD CONSTRAINT chk_danh_gia_1_5 CHECK (DiemDanhGia BETWEEN 1 AND 5);
ALTER TABLE KetQuaDuDoan ADD CONSTRAINT chk_ti_le_0_100 CHECK (TiLePhuHop BETWEEN 0 AND 100);
