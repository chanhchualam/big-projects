from app import db
from datetime import datetime


# NOTE: Oracle folds unquoted identifiers to UPPERCASE. Using UPPERCASE table/column
# names here prevents SQLAlchemy from generating quoted identifiers like "KhoiThi",
# which would create/use a different (case-sensitive) object in Oracle.


class UserThi(db.Model):
    """Model cho người dùng hệ thống"""
    __tablename__ = 'USERTHI'
    
    UserId = db.Column('USERID', db.Integer, primary_key=True)
    UserName = db.Column('USERNAME', db.String(100), nullable=False, unique=True)
    MatKhau = db.Column('MATKHAU', db.String(255), nullable=False)
    HoTen = db.Column('HOTEN', db.String(150), nullable=False)
    Email = db.Column('EMAIL', db.String(100), unique=True)
    LoaiUser = db.Column('LOAIUSER', db.String(50))  # Student, Teacher, Admin
    NgayTao = db.Column('NGAYTAO', db.DateTime, default=datetime.now)
    
    def __repr__(self):
        return f'<UserThi {self.UserName}>'


class KhoiThi(db.Model):
    """Model cho khối thi (A, B, C, D)"""
    __tablename__ = 'KHOITHI'
    
    KhoiID = db.Column('KHOIID', db.Integer, primary_key=True)
    TenKhoi = db.Column('TENKHOI', db.String(50), nullable=False, unique=True)
    MoTa = db.Column('MOTA', db.String(500))
    
    def __repr__(self):
        return f'<KhoiThi {self.TenKhoi}>'


class MonTrongKhoiThi(db.Model):
    """Model cho các môn học trong khối thi"""
    __tablename__ = 'MONTRONGKHOITHI'
    
    MonID = db.Column('MONID', db.Integer, primary_key=True)
    KhoiID = db.Column('KHOIID', db.Integer, db.ForeignKey('KHOITHI.KHOIID'))
    TenMon = db.Column('TENMON', db.String(100), nullable=False)
    MaMon = db.Column('MAMON', db.String(20), unique=True)
    HeSo = db.Column('HESO', db.Float, default=1.0)
    
    khoi = db.relationship('KhoiThi', backref='mon_trong_khoi')
    
    def __repr__(self):
        return f'<MonTrongKhoiThi {self.TenMon}>'


class MonHoc(db.Model):
    """Model cho các môn học"""
    __tablename__ = 'MONHOC'
    
    MonHocID = db.Column('MONHOCID', db.Integer, primary_key=True)
    TenMonHoc = db.Column('TENMONHOC', db.String(100), nullable=False)
    MaMonHoc = db.Column('MAMONHOC', db.String(20), unique=True)
    MoTa = db.Column('MOTA', db.String(500))
    
    def __repr__(self):
        return f'<MonHoc {self.TenMonHoc}>'


class Diem(db.Model):
    """Model cho điểm số của học sinh"""
    __tablename__ = 'DIEM'
    
    DiemID = db.Column('DIEMID', db.Integer, primary_key=True)
    UserId = db.Column('USERID', db.Integer, db.ForeignKey('USERTHI.USERID'))
    MonID = db.Column('MONID', db.Integer, db.ForeignKey('MONTRONGKHOITHI.MONID'))
    DiemThi = db.Column('DIEMTHI', db.Float, nullable=False)
    DiemThuong = db.Column('DIEMTHUONG', db.Float, default=0)
    HeSo = db.Column('HESO', db.Float, default=1.0)
    NgayNhap = db.Column('NGAYNHAP', db.DateTime, default=datetime.now)
    
    user = db.relationship('UserThi', backref='diem')
    mon = db.relationship('MonTrongKhoiThi', backref='diem')
    
    def __repr__(self):
        return f'<Diem User:{self.UserId} Mon:{self.MonID} = {self.DiemThi}>'


class TruongDH(db.Model):
    """Model cho đại học/trường cao đẳng"""
    __tablename__ = 'TRUONGDH'
    
    TruongID = db.Column('TRUONGID', db.Integer, primary_key=True)
    TenTruong = db.Column('TENTRUONG', db.String(200), nullable=False)
    MaTruong = db.Column('MATRUONG', db.String(50), unique=True)
    Website = db.Column('WEBSITE', db.String(200))
    DiaChi = db.Column('DIACHI', db.String(300))
    SoDienThoai = db.Column('SODIENTHOAI', db.String(20))
    Email = db.Column('EMAIL', db.String(100))
    
    def __repr__(self):
        return f'<TruongDH {self.TenTruong}>'


class Nganh(db.Model):
    """Model cho các ngành học"""
    __tablename__ = 'NGANH'
    
    NganhID = db.Column('NGANHID', db.Integer, primary_key=True)
    TruongID = db.Column('TRUONGID', db.Integer, db.ForeignKey('TRUONGDH.TRUONGID'))
    TenNganh = db.Column('TENNGANH', db.String(200), nullable=False)
    MaNganh = db.Column('MANGANH', db.String(50))
    MoTa = db.Column('MOTA', db.String(1000))
    ChiTieuTuyen = db.Column('CHITIEUTUYEN', db.Integer)
    DiemChuan = db.Column('DIEMCHUAN', db.Float)
    KhoiThi_YeuCau = db.Column('KHOITHI_YEUCAU', db.String(50))  # A, B, C, D
    
    truong = db.relationship('TruongDH', backref='nganh')
    
    def __repr__(self):
        return f'<Nganh {self.TenNganh}>'


class GiaoVien(db.Model):
    """Model cho giáo viên hướng dẫn"""
    __tablename__ = 'GIAOVIEN'
    
    GiaoVienID = db.Column('GIAOVIENID', db.Integer, primary_key=True)
    TenGiaoVien = db.Column('TENGIAOVIEN', db.String(150), nullable=False)
    MonDay = db.Column('MONDAY', db.String(100))
    Email = db.Column('EMAIL', db.String(100))
    SoDienThoai = db.Column('SODIENTHOAI', db.String(20))
    ChuyenMon = db.Column('CHUYENMON', db.String(200))
    
    def __repr__(self):
        return f'<GiaoVien {self.TenGiaoVien}>'


class ThongTinTuyenSinh(db.Model):
    """Model cho thông tin tuyển sinh"""
    __tablename__ = 'THONGTINTUYENSINH'
    
    ThongTinID = db.Column('THONGTINID', db.Integer, primary_key=True)
    NganhID = db.Column('NGANHID', db.Integer, db.ForeignKey('NGANH.NGANHID'))
    GiaoVienID = db.Column('GIAOVIENID', db.Integer, db.ForeignKey('GIAOVIEN.GIAOVIENID'))
    TenHinhThuc = db.Column('TENHINHTHUC', db.String(100))  # THPT, ĐGNL, ĐGDP
    NamTuyen = db.Column('NAMTUYEN', db.Integer)
    DiemChuan = db.Column('DIEMCHUAN', db.Float)
    DuToanChiTieu = db.Column('DUTOANCHITIEU', db.Integer)
    
    nganh = db.relationship('Nganh', backref='thong_tin_tuyen_sinh')
    giao_vien = db.relationship('GiaoVien', backref='thong_tin_tuyen_sinh')
    
    def __repr__(self):
        return f'<ThongTinTuyenSinh {self.TenHinhThuc}>'


class DanhGia(db.Model):
    """Model cho đánh giá ngành học"""
    __tablename__ = 'DANHGIA'
    
    DanhGiaID = db.Column('DANHGIAID', db.Integer, primary_key=True)
    NganhID = db.Column('NGANHID', db.Integer, db.ForeignKey('NGANH.NGANHID'))
    UserId = db.Column('USERID', db.Integer, db.ForeignKey('USERTHI.USERID'))
    DiemDanhGia = db.Column('DIEMDANHGIA', db.Integer)  # 1-5 sao
    NhanXet = db.Column('NHANXET', db.String(500))
    NgayDanhGia = db.Column('NGAYDANHGIA', db.DateTime, default=datetime.now)
    
    nganh = db.relationship('Nganh', backref='danh_gia')
    user = db.relationship('UserThi', backref='danh_gia')
    
    def __repr__(self):
        return f'<DanhGia Nganh:{self.NganhID} = {self.DiemDanhGia}>'


class HinhAnhGiaoVien(db.Model):
    """Model cho hình ảnh giáo viên"""
    __tablename__ = 'HINHANHGIAOVIEN'
    
    HinhAnhID = db.Column('HINHANHID', db.Integer, primary_key=True)
    GiaoVienID = db.Column('GIAOVIENID', db.Integer, db.ForeignKey('GIAOVIEN.GIAOVIENID'))
    DuongDan = db.Column('DUONGDAN', db.String(300), nullable=False)
    MoTa = db.Column('MOTA', db.String(500))
    
    giao_vien = db.relationship('GiaoVien', backref='hinh_anh')
    
    def __repr__(self):
        return f'<HinhAnhGiaoVien {self.DuongDan}>'


class KetQuaDuDoan(db.Model):
    """Model cho kết quả dự đoán/gợi ý ngành"""
    __tablename__ = 'KETQUADUDOAN'
    
    KetQuaID = db.Column('KETQUAID', db.Integer, primary_key=True)
    UserId = db.Column('USERID', db.Integer, db.ForeignKey('USERTHI.USERID'))
    NganhID = db.Column('NGANHID', db.Integer, db.ForeignKey('NGANH.NGANHID'))
    DiemTrungBinh = db.Column('DIEMTRUNGBINH', db.Float)
    TiLePhuHop = db.Column('TILEPHUHOP', db.Float)  # Tỷ lệ phù hợp %
    NgayTinhToan = db.Column('NGAYTINHTOAN', db.DateTime, default=datetime.now)
    
    user = db.relationship('UserThi', backref='ket_qua_du_doan')
    nganh = db.relationship('Nganh', backref='ket_qua_du_doan')
    
    def __repr__(self):
        return f'<KetQuaDuDoan User:{self.UserId} Nganh:{self.NganhID} = {self.TiLePhuHop}%>'
