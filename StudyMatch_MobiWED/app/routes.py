from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from app import db
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
        
        # Xóa điểm cũ
        Diem.query.filter_by(UserId=user_id).delete()
        
        # Thêm điểm mới
        for mon_id, score in zip(mon_scores, scores):
            if score:
                new_diem = Diem(
                    UserId=user_id,
                    MonID=int(mon_id),
                    DiemThi=float(score)
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
    keyword = request.args.get('q', '')
    results = Nganh.query.filter(
        Nganh.TenNganh.contains(keyword)
    ).all()
    
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
    
    # Tính điểm trung bình
    diem_trung_binh = sum([d.DiemThi for d in diem]) / len(diem) if diem else 0
    
    # Lấy danh sách ngành học phù hợp
    # Sắp xếp dựa trên điểm chuan và phù hợp với khối thi
    nganh_list = Nganh.query.all()
    
    recommendations = []
    for nganh in nganh_list:
        # Tính tỷ lệ phù hợp (0-100%)
        if nganh.DiemChuan and nganh.DiemChuan > 0:
            ti_le = min(100, (diem_trung_binh / nganh.DiemChuan) * 100)
        else:
            ti_le = 50
        
        if ti_le >= 50:  # Chỉ gợi ý ngành có tỷ lệ >= 50%
            recommendations.append({
                'nganh': nganh,
                'ti_le': ti_le,
                'diem_trung_binh': diem_trung_binh
            })
    
    # Sắp xếp theo tỷ lệ phù hợp giảm dần
    recommendations.sort(key=lambda x: x['ti_le'], reverse=True)
    
    # Lưu kết quả vào database
    KetQuaDuDoan.query.filter_by(UserId=user_id).delete()
    for rec in recommendations:
        new_result = KetQuaDuDoan(
            UserId=user_id,
            NganhID=rec['nganh'].NganhID,
            DiemTrungBinh=diem_trung_binh,
            TiLePhuHop=rec['ti_le']
        )
        db.session.add(new_result)
    
    db.session.commit()
    
    return render_template('recommendation/results.html', 
                         recommendations=recommendations,
                         diem_trung_binh=diem_trung_binh)


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
    nganh = Nganh.query.filter_by(KhoiThi_YeuCau=str(khoi_id)).all()
    return jsonify([{
        'id': n.NganhID,
        'name': n.TenNganh,
        'diem_chuan': n.DiemChuan
    } for n in nganh])


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
