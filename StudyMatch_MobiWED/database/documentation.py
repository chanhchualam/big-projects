"""
Model definition for tracking database table structure
and relationship documentation
"""

# Database Relationships Map
"""
UserThi (Users)
  ├─ 1:N → Diem (Scores)
  ├─ 1:N → DanhGia (Ratings)
  └─ 1:N → KetQuaDuDoan (Predictions)

Nganh (Majors)
  ├─ N:1 ← TruongDH (Universities)
  ├─ 1:N → DanhGia (Ratings)
  ├─ 1:N → KetQuaDuDoan (Predictions)
  └─ 1:N → ThongTinTuyenSinh (Admission Info)

Diem (Scores)
  ├─ N:1 ← UserThi (User)
  └─ N:1 ← MonTrongKhoiThi (Subject in Block)

MonTrongKhoiThi (Subjects in Block)
  └─ N:1 ← KhoiThi (Block)

TruongDH (Universities)
  └─ 1:N → Nganh (Majors)

GiaoVien (Teachers)
  ├─ 1:N → ThongTinTuyenSinh (Admission Info)
  └─ 1:N → HinhAnhGiaoVien (Images)

ThongTinTuyenSinh (Admission Info)
  ├─ N:1 ← Nganh (Major)
  └─ N:1 ← GiaoVien (Teacher)

DanhGia (Ratings)
  ├─ N:1 ← Nganh (Major)
  └─ N:1 ← UserThi (User)

KetQuaDuDoan (Predictions)
  ├─ N:1 ← UserThi (User)
  └─ N:1 ← Nganh (Major)

HinhAnhGiaoVien (Teacher Images)
  └─ N:1 ← GiaoVien (Teacher)
"""

# Table Descriptions
"""
1. UserThi
   - Lưu thông tin người dùng hệ thống
   - Gồm: ID, tên đăng nhập, mật khẩu, họ tên, email, loại user

2. KhoiThi
   - Các khối thi: A, B, C, D
   - Gồm: ID, tên khối, mô tả

3. MonTrongKhoiThi
   - Các môn học trong từng khối
   - Gồm: ID, khối, tên môn, mã môn, hệ số

4. MonHoc
   - Danh sách tất cả môn học

5. Diem
   - Điểm thi của học sinh
   - Gồm: ID, user, môn, điểm thi, điểm thưởng, hệ số

6. TruongDH
   - Thông tin trường đại học
   - Gồm: ID, tên, mã, website, địa chỉ, SĐT, email

7. Nganh
   - Các ngành học
   - Gồm: ID, trường, tên, mã, mô tả, chỉ tiêu, điểm chuan, khối

8. GiaoVien
   - Thông tin giáo viên
   - Gồm: ID, tên, môn dạy, email, SĐT, chuyên môn

9. ThongTinTuyenSinh
   - Thông tin tuyển sinh
   - Gồm: ID, ngành, giáo viên, hình thức, năm, điểm, chỉ tiêu

10. DanhGia
    - Đánh giá các ngành
    - Gồm: ID, ngành, user, điểm (1-5), nhận xét, ngày

11. HinhAnhGiaoVien
    - Hình ảnh giáo viên
    - Gồm: ID, giáo viên, đường dẫn, mô tả

12. KetQuaDuDoan
    - Kết quả dự đoán/gợi ý
    - Gồm: ID, user, ngành, điểm TB, tỷ lệ phù hợp, ngày
"""

class DatabaseDocumentation:
    """
    Tài liệu về cơ sở dữ liệu StudyMatch
    """
    
    TABLES = {
        'UserThi': {
            'description': 'Quản lý người dùng hệ thống',
            'primary_key': 'UserId',
            'important_fields': ['UserName', 'MatKhau', 'HoTen', 'Email', 'LoaiUser']
        },
        'KhoiThi': {
            'description': 'Danh sách khối thi',
            'primary_key': 'KhoiID',
            'values': ['A', 'B', 'C', 'D']
        },
        'Nganh': {
            'description': 'Danh sách ngành học',
            'primary_key': 'NganhID',
            'foreign_keys': ['TruongID']
        },
        'Diem': {
            'description': 'Điểm thi của học sinh',
            'primary_key': 'DiemID',
            'foreign_keys': ['UserId', 'MonID'],
            'constraints': 'DiemThi BETWEEN 0 AND 10'
        }
    }
    
    VIEWS = [
        'V_DIEM_TRUNG_BINH',
        'V_NGANH_PHU_HOP',
        'V_TUYEN_SINH_THEO_NAM',
        'V_GIAO_VIEN_INFO',
        'V_KET_QUA_CHI_TIET'
    ]
    
    PROCEDURES = [
        'P_TINH_DIEM_TRUNG_BINH',
        'P_DE_XUAT_NGANH',
        'P_CAP_NHAT_KET_QUA',
        'P_THONG_KE_HOC_SINH',
        'P_XOA_DU_LIEU_CU'
    ]
    
    FUNCTIONS = [
        'F_KT_DA_DANG_KY',
        'F_TINH_TI_LE_PHU_HOP',
        'F_XEP_HANG_NGANH',
        'F_DEM_DANH_GIA',
        'F_DANH_GIA_TRUNG_BINH',
        'F_KT_DIEM_HOP_LE',
        'F_MO_TA_MUC_DO_PHU_HOP'
    ]
    
    SEQUENCES = {
        'seq_userid': 'User IDs',
        'seq_khoiid': 'Block IDs',
        'seq_monid': 'Subject IDs',
        'seq_diemid': 'Score IDs',
        'seq_truongid': 'University IDs',
        'seq_nganhid': 'Major IDs',
        'seq_ketquaid': 'Prediction IDs'
    }
