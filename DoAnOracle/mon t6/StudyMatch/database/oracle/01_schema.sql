-- StudyMatch (Oracle) - Schema + Sequences + Indexes + Constraints
-- Recommended Oracle 12c+.

-- ===== Tables =====

CREATE TABLE UserThi (
    UserId       NUMBER(10) PRIMARY KEY,
    UserName     VARCHAR2(100) NOT NULL,
    MatKhau      VARCHAR2(255) NOT NULL,
    HoTen        VARCHAR2(150) NOT NULL,
    Email        VARCHAR2(100),
    LoaiUser     VARCHAR2(50) DEFAULT 'Student',
    NgayTao      TIMESTAMP DEFAULT SYSTIMESTAMP,
    NgayCapNhat  TIMESTAMP
);

ALTER TABLE UserThi ADD CONSTRAINT uq_userthi_username UNIQUE (UserName);
ALTER TABLE UserThi ADD CONSTRAINT uq_userthi_email UNIQUE (Email);

CREATE TABLE KhoiThi (
    KhoiID   NUMBER(10) PRIMARY KEY,
    TenKhoi  VARCHAR2(50) NOT NULL,
    MoTa     VARCHAR2(500)
);

ALTER TABLE KhoiThi ADD CONSTRAINT uq_khoithi_tenkhoi UNIQUE (TenKhoi);

CREATE TABLE MonTrongKhoiThi (
    MonID   NUMBER(10) PRIMARY KEY,
    KhoiID  NUMBER(10) NOT NULL,
    TenMon  VARCHAR2(100) NOT NULL,
    MaMon   VARCHAR2(20),
    HeSo    NUMBER(3,1) DEFAULT 1.0
);

ALTER TABLE MonTrongKhoiThi
  ADD CONSTRAINT fk_montrongkhoi_khoithi FOREIGN KEY (KhoiID) REFERENCES KhoiThi(KhoiID);
ALTER TABLE MonTrongKhoiThi ADD CONSTRAINT uq_montrongkhoi_mamon UNIQUE (MaMon);
ALTER TABLE MonTrongKhoiThi ADD CONSTRAINT ck_montrongkhoi_heso CHECK (HeSo > 0);

CREATE TABLE MonHoc (
    MonHocID  NUMBER(10) PRIMARY KEY,
    TenMonHoc VARCHAR2(100) NOT NULL,
    MaMonHoc  VARCHAR2(20),
    MoTa      VARCHAR2(500)
);

ALTER TABLE MonHoc ADD CONSTRAINT uq_monhoc_mamonhoc UNIQUE (MaMonHoc);

CREATE TABLE TruongDH (
    TruongID    NUMBER(10) PRIMARY KEY,
    TenTruong   VARCHAR2(200) NOT NULL,
    MaTruong    VARCHAR2(50),
    Website     VARCHAR2(200),
    DiaChi      VARCHAR2(300),
    SoDienThoai VARCHAR2(20),
    Email       VARCHAR2(100)
);

ALTER TABLE TruongDH ADD CONSTRAINT uq_truongdh_matruong UNIQUE (MaTruong);

CREATE TABLE Nganh (
    NganhID        NUMBER(10) PRIMARY KEY,
    TruongID       NUMBER(10) NOT NULL,
    TenNganh       VARCHAR2(200) NOT NULL,
    MaNganh        VARCHAR2(50),
    MoTa           VARCHAR2(1000),
    ChiTieuTuyen   NUMBER(10),
    DiemChuan      NUMBER(5,2),
    KhoiThi_YeuCau VARCHAR2(50),
    NgaySua        TIMESTAMP
);

ALTER TABLE Nganh
  ADD CONSTRAINT fk_nganh_truongdh FOREIGN KEY (TruongID) REFERENCES TruongDH(TruongID);
ALTER TABLE Nganh
  ADD CONSTRAINT ck_nganh_diemchuan CHECK (DiemChuan IS NULL OR (DiemChuan BETWEEN 0 AND 30));

CREATE TABLE GiaoVien (
    GiaoVienID  NUMBER(10) PRIMARY KEY,
    TenGiaoVien VARCHAR2(150) NOT NULL,
    MonDay      VARCHAR2(100),
    Email       VARCHAR2(100),
    SoDienThoai VARCHAR2(20),
    ChuyenMon   VARCHAR2(200)
);

CREATE TABLE ThongTinTuyenSinh (
    ThongTinID   NUMBER(10) PRIMARY KEY,
    NganhID      NUMBER(10) NOT NULL,
    GiaoVienID   NUMBER(10),
    TenHinhThuc  VARCHAR2(100),
    NamTuyen     NUMBER(10),
    DiemChuan    NUMBER(5,2),
    DuToanChiTieu NUMBER(10)
);

ALTER TABLE ThongTinTuyenSinh
  ADD CONSTRAINT fk_ttts_nganh FOREIGN KEY (NganhID) REFERENCES Nganh(NganhID);
ALTER TABLE ThongTinTuyenSinh
  ADD CONSTRAINT fk_ttts_giaovien FOREIGN KEY (GiaoVienID) REFERENCES GiaoVien(GiaoVienID);

CREATE TABLE DanhGia (
    DanhGiaID   NUMBER(10) PRIMARY KEY,
    NganhID     NUMBER(10) NOT NULL,
    UserId      NUMBER(10) NOT NULL,
    DiemDanhGia NUMBER(10),
    NhanXet     VARCHAR2(500),
    NgayDanhGia TIMESTAMP DEFAULT SYSTIMESTAMP
);

ALTER TABLE DanhGia
  ADD CONSTRAINT fk_danhgia_nganh FOREIGN KEY (NganhID) REFERENCES Nganh(NganhID);
ALTER TABLE DanhGia
  ADD CONSTRAINT fk_danhgia_userthi FOREIGN KEY (UserId) REFERENCES UserThi(UserId);
ALTER TABLE DanhGia
  ADD CONSTRAINT ck_danhgia_diem CHECK (DiemDanhGia BETWEEN 1 AND 5);

CREATE TABLE HinhAnhGiaoVien (
    HinhAnhID  NUMBER(10) PRIMARY KEY,
    GiaoVienID NUMBER(10) NOT NULL,
    DuongDan   VARCHAR2(300) NOT NULL,
    MoTa       VARCHAR2(500)
);

ALTER TABLE HinhAnhGiaoVien
  ADD CONSTRAINT fk_hinhanh_gv FOREIGN KEY (GiaoVienID) REFERENCES GiaoVien(GiaoVienID);

CREATE TABLE Diem (
    DiemID     NUMBER(10) PRIMARY KEY,
    UserId     NUMBER(10) NOT NULL,
    MonID      NUMBER(10) NOT NULL,
    DiemThi    NUMBER(4,2) NOT NULL,
    DiemThuong NUMBER(4,2) DEFAULT 0,
    HeSo       NUMBER(3,1) DEFAULT 1.0,
    NgayNhap   TIMESTAMP DEFAULT SYSTIMESTAMP
);

ALTER TABLE Diem
  ADD CONSTRAINT fk_diem_userthi FOREIGN KEY (UserId) REFERENCES UserThi(UserId);
ALTER TABLE Diem
  ADD CONSTRAINT fk_diem_montrongkhoi FOREIGN KEY (MonID) REFERENCES MonTrongKhoiThi(MonID);
ALTER TABLE Diem
  ADD CONSTRAINT ck_diem_thi CHECK (DiemThi BETWEEN 0 AND 10);
ALTER TABLE Diem
  ADD CONSTRAINT ck_diem_thuong CHECK (DiemThuong BETWEEN 0 AND 1);
ALTER TABLE Diem
  ADD CONSTRAINT ck_diem_heso CHECK (HeSo > 0);

CREATE TABLE KetQuaDuDoan (
    KetQuaID     NUMBER(10) PRIMARY KEY,
    UserId       NUMBER(10) NOT NULL,
    NganhID      NUMBER(10) NOT NULL,
    DiemTrungBinh NUMBER(5,2),
    TiLePhuHop   NUMBER(5,2),
    NgayTinhToan TIMESTAMP DEFAULT SYSTIMESTAMP
);

ALTER TABLE KetQuaDuDoan
  ADD CONSTRAINT fk_ketqua_userthi FOREIGN KEY (UserId) REFERENCES UserThi(UserId);
ALTER TABLE KetQuaDuDoan
  ADD CONSTRAINT fk_ketqua_nganh FOREIGN KEY (NganhID) REFERENCES Nganh(NganhID);
ALTER TABLE KetQuaDuDoan
  ADD CONSTRAINT ck_ketqua_tile CHECK (TiLePhuHop BETWEEN 0 AND 100);

-- Optional history/audit table used by triggers
CREATE TABLE Lich_Su_Diem (
    LichSuID    NUMBER(10) PRIMARY KEY,
    DiemID      NUMBER(10) NOT NULL,
    UserId      NUMBER(10) NOT NULL,
    DiemCu      NUMBER(4,2),
    DiemMoi     NUMBER(4,2),
    NgayThayDoi TIMESTAMP DEFAULT SYSTIMESTAMP
);

ALTER TABLE Lich_Su_Diem
  ADD CONSTRAINT fk_lichsu_diem FOREIGN KEY (DiemID) REFERENCES Diem(DiemID);

-- ===== Sequences =====
CREATE SEQUENCE seq_userid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_khoiid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_monid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_monhocid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_diemid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_truongid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_nganhid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_giaovienid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_ttuyenid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_danhgiaid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_hinhanhid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_ketquaid START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_lichsuid START WITH 1 INCREMENT BY 1;

-- ===== Indexes =====
CREATE INDEX idx_diem_userid ON Diem(UserId);
CREATE INDEX idx_diem_monid ON Diem(MonID);
CREATE INDEX idx_montrongkhoi_khoiid ON MonTrongKhoiThi(KhoiID);
CREATE INDEX idx_nganh_truongid ON Nganh(TruongID);
CREATE INDEX idx_danhgia_userid ON DanhGia(UserId);
CREATE INDEX idx_danhgia_nganhid ON DanhGia(NganhID);
CREATE INDEX idx_ketqua_userid ON KetQuaDuDoan(UserId);
CREATE INDEX idx_ketqua_nganhid ON KetQuaDuDoan(NganhID);

PROMPT Schema created.
