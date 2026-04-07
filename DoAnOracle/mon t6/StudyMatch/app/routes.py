from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from app import db
from sqlalchemy import func
import re
from models.models import (UserThi, KhoiThi, MonTrongKhoiThi, MonHoc, Diem, 
                           TruongDH, Nganh, GiaoVien, ThongTinTuyenSinh, 
                           DanhGia, HinhAnhGiaoVien, KetQuaDuDoan)
from datetime import datetime

# Tạo các blueprint
main_bp = Blueprint('main', __name__)
student_bp = Blueprint('student', __name__, url_prefix='/student')
major_bp = Blueprint('major', __name__, url_prefix='/major')
recommendation_bp = Blueprint('recommendation', __name__, url_prefix='/recommendation')


# ==================== MAIN ROUTES ====================
@main_bp.route('/')
def index():
    """Trang chủ của ứng dụng"""
    return render_template('index.html')


@main_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Đăng nhập hệ thống"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = UserThi.query.filter_by(UserName=username).first()
        
        if user and user.MatKhau == password:
            session['user_id'] = user.UserId
            session['username'] = user.UserName
            session['loai_user'] = user.LoaiUser
            return redirect(url_for('main.dashboard'))
        else:
            return render_template('login.html', error='Tên đăng nhập hoặc mật khẩu không đúng')
    
    return render_template('login.html')


@main_bp.route('/register', methods=['GET', 'POST'])
def register():
    """Đăng ký tài khoản mới"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        ho_ten = request.form.get('ho_ten')
        email = request.form.get('email')
        
        if UserThi.query.filter_by(UserName=username).first():
            return render_template('register.html', error='Tên đăng nhập đã tồn tại')
        
        new_user = UserThi(
            UserName=username,
            MatKhau=password,
            HoTen=ho_ten,
            Email=email,
            LoaiUser='Student'
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        return redirect(url_for('main.login'))
    
    return render_template('register.html')


@main_bp.route('/dashboard')
def dashboard():
    """Dashboard của người dùng"""
    if 'user_id' not in session:
        return redirect(url_for('main.login'))
    
    user = UserThi.query.get(session['user_id'])
    diem = Diem.query.filter_by(UserId=session['user_id']).all()
    recommendations = KetQuaDuDoan.query.filter_by(UserId=session['user_id']).all()
    
    return render_template('dashboard.html', 
                         user=user, 
                         diem=diem, 
                         recommendations=recommendations)


@main_bp.route('/logout')
def logout():
    """Đăng xuất khỏi hệ thống"""
    session.clear()
    return redirect(url_for('main.index'))


# ==================== STUDENT ROUTES ====================
@student_bp.route('/profile')
def profile():
    """Xem hồ sơ học sinh"""
    if 'user_id' not in session:
        return redirect(url_for('main.login'))
    
    user = UserThi.query.get(session['user_id'])
    return render_template('student/profile.html', user=user)


@student_bp.route('/enter-scores', methods=['GET', 'POST'])
def enter_scores():
    """Nhập điểm số"""
    if 'user_id' not in session:
        return redirect(url_for('main.login'))
    
    khoi_list = KhoiThi.query.all()
    user_id = session['user_id']
    
    if request.method == 'POST':
        khoi_id = request.form.get('khoi_id')
        mon_scores = request.form.getlist('mon_id')
        scores = request.form.getlist('score')
        bonuses = request.form.getlist('bonus')

        # Persist selected khối for later recommendation
        try:
            session['khoi_id'] = int(khoi_id) if khoi_id else None
        except ValueError:
            session['khoi_id'] = None
        
        # Xóa điểm cũ
        Diem.query.filter_by(UserId=user_id).delete()
        
        # Thêm điểm mới
        for mon_id, score, bonus in zip(mon_scores, scores, bonuses):
            if score:
                mon = MonTrongKhoiThi.query.get(int(mon_id))
                he_so = mon.HeSo if mon and mon.HeSo else 1.0
                bonus_val = 0.0
                if bonus is not None and str(bonus).strip() != '':
                    try:
                        bonus_val = float(bonus)
                    except ValueError:
                        bonus_val = 0.0

                new_diem = Diem(
                    UserId=user_id,
                    MonID=int(mon_id),
                    DiemThi=float(score),
                    DiemThuong=bonus_val,
                    HeSo=he_so
                )
                db.session.add(new_diem)
        
        db.session.commit()
        return redirect(url_for('student.view_scores'))
    
    return render_template('student/enter_scores.html', khoi_list=khoi_list)


@student_bp.route('/view-scores')
def view_scores():
    """Xem điểm số đã nhập"""
    if 'user_id' not in session:
        return redirect(url_for('main.login'))
    
    user_id = session['user_id']
    diem = Diem.query.filter_by(UserId=user_id).all()
    
    return render_template('student/view_scores.html', diem=diem)


# ==================== MAJOR ROUTES ====================
@major_bp.route('/list')
def list_majors():
    """Danh sách các ngành học"""
    page = request.args.get('page', 1, type=int)
    nganh = Nganh.query.paginate(page=page, per_page=12)
    
    return render_template('major/list.html', nganh=nganh)


@major_bp.route('/<int:nganh_id>')
def major_detail(nganh_id):
    """Chi tiết ngành học"""
    nganh = Nganh.query.get_or_404(nganh_id)
    truong = nganh.truong
    danh_gia = DanhGia.query.filter_by(NganhID=nganh_id).all()
    thong_tin = ThongTinTuyenSinh.query.filter_by(NganhID=nganh_id).all()
    
    avg_rating = sum([d.DiemDanhGia for d in danh_gia]) / len(danh_gia) if danh_gia else 0
    
    return render_template('major/detail.html', 
                         nganh=nganh, 
                         truong=truong, 
                         danh_gia=danh_gia,
                         thong_tin=thong_tin,
                         avg_rating=avg_rating)


@major_bp.route('/search')
def search_majors():
    """Tìm kiếm ngành học"""
    keyword = (request.args.get('q', '') or '').strip()

    if not keyword:
        return render_template('major/search.html', results=[], keyword='')

    keyword_lower = keyword.lower()
    results = (
        Nganh.query.filter(func.lower(Nganh.TenNganh).like(f"%{keyword_lower}%"))
        .all()
    )
    
    return render_template('major/search.html', results=results, keyword=keyword)


# ==================== RECOMMENDATION ROUTES ====================
@recommendation_bp.route('/get-recommendation', methods=['GET', 'POST'])
def get_recommendation():
    """Lấy gợi ý ngành học dựa trên điểm số"""
    if 'user_id' not in session:
        return redirect(url_for('main.login'))
    
    user_id = session['user_id']
    
    # Lấy điểm của học sinh
    diem = Diem.query.filter_by(UserId=user_id).all()
    
    if not diem:
        return render_template('recommendation/no_scores.html')

    # Xác định khối thi dựa trên điểm đã nhập (MonTrongKhoiThi.KhoiID)
    khoi_counts = {}
    for d in diem:
        try:
            if d.mon and d.mon.KhoiID is not None:
                khoi_counts[d.mon.KhoiID] = khoi_counts.get(d.mon.KhoiID, 0) + 1
        except Exception:
            continue

    khoi_id = session.get('khoi_id')
    if not khoi_id and khoi_counts:
        khoi_id = max(khoi_counts.items(), key=lambda kv: kv[1])[0]

    khoi = KhoiThi.query.get(khoi_id) if khoi_id else None
    khoi_name = khoi.TenKhoi if khoi else None

    def norm_khoi(s: str) -> str:
        return re.sub(r'\s+', '', (s or '').upper())

    def match_khoi(requirement: str, khoi_label: str) -> bool:
        req = norm_khoi(requirement)
        label = norm_khoi(khoi_label)
        if not label:
            return True
        if not req:
            return True
        # Fast path: substring
        if label in req or req in label:
            return True
        # Tokenize common separators (A00;A01|D01)
        tokens = [t for t in re.split(r'[^A-Z0-9]+', req) if t]
        for t in tokens:
            if t == label or label in t or t in label:
                return True
        return False
    
    # Tính tổng điểm (có trọng số) và điểm trung bình theo hệ số
    tong_heso = 0.0
    tong_diem = 0.0
    for d in diem:
        he_so = d.HeSo if d.HeSo else (d.mon.HeSo if d.mon and d.mon.HeSo else 1.0)
        diem_mon = float(d.DiemThi) + float(d.DiemThuong or 0)
        tong_heso += float(he_so)
        tong_diem += diem_mon * float(he_so)

    diem_tong = tong_diem
    diem_trung_binh = (tong_diem / tong_heso) if tong_heso > 0 else 0
    
    # Lấy danh sách ngành học phù hợp (ưu tiên khối thi vừa nhập)
    nganh_list = Nganh.query.all()
    
    recommendations = []
    for nganh in nganh_list:
        # Lọc theo khối thi yêu cầu (nếu xác định được)
        if khoi_name and not match_khoi(nganh.KhoiThi_YeuCau, khoi_name):
            continue

        # Tính tỷ lệ phù hợp (0-100%) dựa trên chênh lệch so với điểm chuẩn
        diem_chuan = float(nganh.DiemChuan) if nganh.DiemChuan else 0.0

        if diem_chuan > 0:
            # Lưu ý: DiemChuan thường là tổng điểm theo khối (≈ 24-30),
            # nên cần so sánh với tổng điểm (không phải điểm TB từng môn).
            diff = diem_tong - diem_chuan
            if diff >= 0:
                # Vượt điểm chuẩn: tiệm cận 100
                ti_le = 90 + min(10, diff * 5)
            else:
                # Thiếu điểm chuẩn: trừ điểm khá mạnh
                ti_le = 90 + (diff * 10)
        else:
            # No cutoff known => neutral baseline
            ti_le = 60

        # Clamp 0..100
        ti_le = max(0, min(100, float(ti_le)))

        # Include near-miss as well; we'll sort later
        if ti_le >= 40:
            recommendations.append({
                'nganh': nganh,
                'ti_le': ti_le,
                'diem_trung_binh': diem_trung_binh,
                'diem_tong': diem_tong
            })
    
    # Sắp xếp theo tỷ lệ phù hợp giảm dần
    recommendations.sort(key=lambda x: x['ti_le'], reverse=True)

    # Nếu kết quả quá ít (dữ liệu điểm chuẩn thiếu hoặc khối thi hiếm), fallback thêm ngành
    if len(recommendations) < 8:
        for nganh in nganh_list:
            if any(r['nganh'].NganhID == nganh.NganhID for r in recommendations):
                continue
            if khoi_name and not match_khoi(nganh.KhoiThi_YeuCau, khoi_name):
                continue
            recommendations.append({
                'nganh': nganh,
                'ti_le': 55,
                'diem_trung_binh': diem_trung_binh,
                'diem_tong': diem_tong
            })
            if len(recommendations) >= 12:
                break
    
    # Lưu kết quả vào database
    KetQuaDuDoan.query.filter_by(UserId=user_id).delete()
    for rec in recommendations:
        new_result = KetQuaDuDoan(
            UserId=user_id,
            NganhID=rec['nganh'].NganhID,
            # Trường này đang được dùng để hiển thị điểm của bạn trong lịch sử.
            # Với DiemChuan là tổng điểm, lưu tổng điểm sẽ trực quan hơn.
            DiemTrungBinh=diem_tong,
            TiLePhuHop=rec['ti_le']
        )
        db.session.add(new_result)
    
    db.session.commit()
    
    return render_template('recommendation/results.html', 
                         recommendations=recommendations,
                         diem_trung_binh=diem_trung_binh,
                         diem_tong=diem_tong,
                         khoi_name=khoi_name)


@recommendation_bp.route('/results')
def view_results():
    """Xem kết quả gợi ý"""
    if 'user_id' not in session:
        return redirect(url_for('main.login'))
    
    user_id = session['user_id']
    results = KetQuaDuDoan.query.filter_by(UserId=user_id).all()
    
    return render_template('recommendation/saved_results.html', results=results)


# ==================== API ROUTES ====================
@major_bp.route('/api/subjects-by-khoi/<int:khoi_id>')
def get_subjects_by_khoi(khoi_id):
    """API lấy môn học theo khối thi"""
    subjects = MonTrongKhoiThi.query.filter_by(KhoiID=khoi_id).all()
    return jsonify([{
        'id': s.MonID,
        'name': s.TenMon,
        'he_so': s.HeSo
    } for s in subjects])


@major_bp.route('/api/by-khoi/<int:khoi_id>')
def get_majors_by_khoi(khoi_id):
    """API lấy ngành học theo khối thi"""
    khoi = KhoiThi.query.get(khoi_id)
    khoi_label = khoi.TenKhoi if khoi else None

    if khoi_label:
        nganh = (
            Nganh.query.filter(func.upper(Nganh.KhoiThi_YeuCau).like(f"%{khoi_label.upper()}%"))
            .all()
        )
    else:
        nganh = []
    return jsonify([{
        'id': n.NganhID,
        'name': n.TenNganh,
        'diem_chuan': n.DiemChuan
    } for n in nganh])


@major_bp.route('/api/search')
def api_search_majors():
    """API tìm kiếm ngành học (live search)"""
    keyword = (request.args.get('q', '') or '').strip()
    if not keyword:
        return jsonify([])

    keyword_lower = keyword.lower()

    results = (
        Nganh.query.filter(func.lower(Nganh.TenNganh).like(f"%{keyword_lower}%"))
        .order_by(Nganh.TenNganh.asc())
        .limit(30)
        .all()
    )

    payload = []
    for n in results:
        payload.append({
            'id': n.NganhID,
            'name': n.TenNganh,
            'school_name': n.truong.TenTruong if getattr(n, 'truong', None) else None,
            'diem_chuan': n.DiemChuan,
            'khoi_thi': n.KhoiThi_YeuCau,
            'chi_tieu': n.ChiTieuTuyen,
            'mo_ta': (n.MoTa[:160] + '...') if n.MoTa and len(n.MoTa) > 160 else (n.MoTa or None),
        })

    return jsonify(payload)


@major_bp.route('/api/rating/<int:nganh_id>', methods=['POST'])
def rate_major(nganh_id):
    """API đánh giá ngành học"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.get_json()
    rating = data.get('rating')
    review = data.get('review', '')
    
    new_rating = DanhGia(
        NganhID=nganh_id,
        UserId=session['user_id'],
        DiemDanhGia=rating,
        NhanXet=review
    )
    
    db.session.add(new_rating)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Đánh giá đã được lưu'})


@student_bp.route('/api/scores')
def get_user_scores():
    """API lấy điểm số của người dùng"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    diem = Diem.query.filter_by(UserId=session['user_id']).all()
    return jsonify([{
        'mon_id': d.MonID,
        'mon_name': d.mon.TenMon if d.mon else 'Unknown',
        'score': d.DiemThi
    } for d in diem])
