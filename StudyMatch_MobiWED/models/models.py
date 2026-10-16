from app import db
from datetime import datetime

class UserThi(db.Model):
    """Model cho người dùng hệ thống"""
    __tablename__ = 'UserThi'
    
    UserId = db.Column(db.Integer, primary_key=True)
    UserName = db.Column(db.String(100), nullable=False, unique=True)
    MatKhau = db.Column(db.String(255), nullable=False)
    HoTen = db.Column(db.String(150), nullable=False)
    Email = db.Column(db.String(100), unique=True)
    LoaiUser = db.Column(db.String(50))  # Student, Teacher, Admin
    NgayTao = db.Column(db.DateTime, default=datetime.now)
    
    def __repr__(self):
        return f'<UserThi {self.UserName}>'


class KhoiThi(db.Model):
    """Model cho khối thi (A, B, C, D)"""
    __tablename__ = 'KhoiThi'
    
    KhoiID = db.Column(db.Integer, primary_key=True)
    TenKhoi = db.Column(db.String(50), nullable=False, unique=True)
    MoTa = db.Column(db.String(500))
    
    def __repr__(self):
        return f'<KhoiThi {self.TenKhoi}>'


class MonTrongKhoiThi(db.Model):
    """Model cho các môn học trong khối thi"""
    __tablename__ = 'MonTrongKhoiThi'
    
    MonID = db.Column(db.Integer, primary_key=True)
    KhoiID = db.Column(db.Integer, db.ForeignKey('KhoiThi.KhoiID'))
    TenMon = db.Column(db.String(100), nullable=False)
    MaMon = db.Column(db.String(20), unique=True)
    HeSo = db.Column(db.Float, default=1.0)
    
    khoi = db.relationship('KhoiThi', backref='mon_trong_khoi')
    
    def __repr__(self):
        return f'<MonTrongKhoiThi {self.TenMon}>'


class MonHoc(db.Model):
    """Model cho các môn học"""
    __tablename__ = 'MonHoc'
    
    MonHocID = db.Column(db.Integer, primary_key=True)
    TenMonHoc = db.Column(db.String(100), nullable=False)
    MaMonHoc = db.Column(db.String(20), unique=True)
    MoTa = db.Column(db.String(500))
    
    def __repr__(self):
        return f'<MonHoc {self.TenMonHoc}>'


class Diem(db.Model):
    """Model cho điểm số của học sinh"""
    __tablename__ = 'Diem'
    
    DiemID = db.Column(db.Integer, primary_key=True)
    UserId = db.Column(db.Integer, db.ForeignKey('UserThi.UserId'))
    MonID = db.Column(db.Integer, db.ForeignKey('MonTrongKhoiThi.MonID'))
    DiemThi = db.Column(db.Float, nullable=False)
    DiemThuong = db.Column(db.Float, default=0)
    HeSo = db.Column(db.Float, default=1.0)
    NgayNhap = db.Column(db.DateTime, default=datetime.now)
    
    user = db.relationship('UserThi', backref='diem')
    mon = db.relationship('MonTrongKhoiThi', backref='diem')
    
    def __repr__(self):
        return f'<Diem User:{self.UserId} Mon:{self.MonID} = {self.DiemThi}>'


class TruongDH(db.Model):
    """Model cho đại học/trường cao đẳng"""
    __tablename__ = 'TruongDH'
    
    TruongID = db.Column(db.Integer, primary_key=True)
    TenTruong = db.Column(db.String(200), nullable=False)
    MaTruong = db.Column(db.String(50), unique=True)
    Website = db.Column(db.String(200))
    DiaChi = db.Column(db.String(300))
    SoDienThoai = db.Column(db.String(20))
    Email = db.Column(db.String(100))
    
    def __repr__(self):
        return f'<TruongDH {self.TenTruong}>'


class Nganh(db.Model):
    """Model cho các ngành học"""
    __tablename__ = 'Nganh'
    
    NganhID = db.Column(db.Integer, primary_key=True)
    TruongID = db.Column(db.Integer, db.ForeignKey('TruongDH.TruongID'))
    TenNganh = db.Column(db.String(200), nullable=False)
    MaNganh = db.Column(db.String(50))
    MoTa = db.Column(db.String(1000))
    ChiTieuTuyen = db.Column(db.Integer)
    DiemChuan = db.Column(db.Float)
    KhoiThi_YeuCau = db.Column(db.String(50))  # A, B, C, D
    
    truong = db.relationship('TruongDH', backref='nganh')
    
    def __repr__(self):
        return f'<Nganh {self.TenNganh}>'


class GiaoVien(db.Model):
    """Model cho giáo viên hướng dẫn"""
    __tablename__ = 'GiaoVien'
    
    GiaoVienID = db.Column(db.Integer, primary_key=True)
    TenGiaoVien = db.Column(db.String(150), nullable=False)
    MonDay = db.Column(db.String(100))
    Email = db.Column(db.String(100))
    SoDienThoai = db.Column(db.String(20))
    ChuyenMon = db.Column(db.String(200))
    
    def __repr__(self):
        return f'<GiaoVien {self.TenGiaoVien}>'


class ThongTinTuyenSinh(db.Model):
    """Model cho thông tin tuyển sinh"""
    __tablename__ = 'ThongTinTuyenSinh'
    
    ThongTinID = db.Column(db.Integer, primary_key=True)
    NganhID = db.Column(db.Integer, db.ForeignKey('Nganh.NganhID'))
    GiaoVienID = db.Column(db.Integer, db.ForeignKey('GiaoVien.GiaoVienID'))
    TenHinhThuc = db.Column(db.String(100))  # THPT, ĐGNL, ĐGDP
    NamTuyen = db.Column(db.Integer)
    DiemChuan = db.Column(db.Float)
    DuToanChiTieu = db.Column(db.Integer)
    
    nganh = db.relationship('Nganh', backref='thong_tin_tuyen_sinh')
    giao_vien = db.relationship('GiaoVien', backref='thong_tin_tuyen_sinh')
    
    def __repr__(self):
        return f'<ThongTinTuyenSinh {self.TenHinhThuc}>'


class DanhGia(db.Model):
    """Model cho đánh giá ngành học"""
    __tablename__ = 'DanhGia'
    
    DanhGiaID = db.Column(db.Integer, primary_key=True)
    NganhID = db.Column(db.Integer, db.ForeignKey('Nganh.NganhID'))
    UserId = db.Column(db.Integer, db.ForeignKey('UserThi.UserId'))
    DiemDanhGia = db.Column(db.Integer)  # 1-5 sao
    NhanXet = db.Column(db.String(500))
    NgayDanhGia = db.Column(db.DateTime, default=datetime.now)
    
    nganh = db.relationship('Nganh', backref='danh_gia')
    user = db.relationship('UserThi', backref='danh_gia')
    
    def __repr__(self):
        return f'<DanhGia Nganh:{self.NganhID} = {self.DiemDanhGia}>'


class HinhAnhGiaoVien(db.Model):
    """Model cho hình ảnh giáo viên"""
    __tablename__ = 'HinhAnhGiaoVien'
    
    HinhAnhID = db.Column(db.Integer, primary_key=True)
    GiaoVienID = db.Column(db.Integer, db.ForeignKey('GiaoVien.GiaoVienID'))
    DuongDan = db.Column(db.String(300), nullable=False)
    MoTa = db.Column(db.String(500))
    
    giao_vien = db.relationship('GiaoVien', backref='hinh_anh')
    
    def __repr__(self):
        return f'<HinhAnhGiaoVien {self.DuongDan}>'


class KetQuaDuDoan(db.Model):
    """Model cho kết quả dự đoán/gợi ý ngành"""
    __tablename__ = 'KetQuaDuDoan'
    
    KetQuaID = db.Column(db.Integer, primary_key=True)
    UserId = db.Column(db.Integer, db.ForeignKey('UserThi.UserId'))
    NganhID = db.Column(db.Integer, db.ForeignKey('Nganh.NganhID'))
    DiemTrungBinh = db.Column(db.Float)
    TiLePhuHop = db.Column(db.Float)  # Tỷ lệ phù hợp %
    NgayTinhToan = db.Column(db.DateTime, default=datetime.now)
    
    user = db.relationship('UserThi', backref='ket_qua_du_doan')
    nganh = db.relationship('Nganh', backref='ket_qua_du_doan')
    
    def __repr__(self):
        return f'<KetQuaDuDoan User:{self.UserId} Nganh:{self.NganhID} = {self.TiLePhuHop}%>'
