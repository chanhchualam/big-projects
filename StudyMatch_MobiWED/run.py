import os
from app import create_app, db
from models.models import *

app = create_app()

@app.shell_context_processor
def make_shell_context():
    """Tạo context cho Flask shell"""
    return {'db': db, 'UserThi': UserThi, 'KhoiThi': KhoiThi, 
            'MonTrongKhoiThi': MonTrongKhoiThi, 'Diem': Diem,
            'Nganh': Nganh, 'TruongDH': TruongDH}

@app.before_request
def before_request():
    """Chạy trước mỗi request"""
    pass

@app.teardown_appcontext
def shutdown_session(exception=None):
    """Đóng session sau mỗi request"""
    db.session.remove()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='localhost', port=5000)
