// src/components/AdminUnlock.jsx
// Bước 2 khi vào trang quản trị: nhập mã bảo mật admin (hoặc tạo mã lần đầu).
// Firestore rules mới là nơi chặn thật sự; màn hình này chỉ để admin mở khoá.
import React, { useState } from 'react';
import { unlockAdmin, setupAdminCode, getCodeStrengthError } from '../utils/adminSecurity';

export default function AdminUnlock({ adminUser, onUnlocked, onSignOut }) {
  const [mode, setMode] = useState('unlock'); // 'unlock' | 'setup'
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'setup') {
      const weak = getCodeStrengthError(code);
      if (weak) return setError(weak);
      if (code !== confirmCode) return setError('Hai lần nhập mã không khớp.');
    } else if (!code) {
      return setError('Vui lòng nhập mã bảo mật.');
    }
    setBusy(true);
    const res = mode === 'setup' ? await setupAdminCode(code) : await unlockAdmin(code);
    setBusy(false);
    if (res.success) {
      setCode('');
      setConfirmCode('');
      onUnlocked();
    } else {
      setError(res.error);
      setCode('');
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setCode('');
    setConfirmCode('');
  };

  return (
    <div className="admin-page-login-wrapper">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <div className="admin-portal-pill">BẢO MẬT 2 LỚP</div>
          <h1 className="admin-login-title">
            {mode === 'setup' ? 'Tạo Mã Bảo Mật Admin' : 'Nhập Mã Bảo Mật Admin'}
          </h1>
          <p className="admin-login-sub">
            Đã đăng nhập: <strong>{adminUser.email}</strong>.{' '}
            {mode === 'setup'
              ? 'Mã này khác mật khẩu đăng nhập. Từ nay mỗi lần vào trang quản trị đều phải nhập mã, nên người lấy được mật khẩu cũng không vào được.'
              : 'Nhập mã bảo mật (khác mật khẩu đăng nhập) để mở trang quản trị. Phiên mở khoá có hiệu lực tối đa 8 giờ.'}
          </p>
        </div>

        {error && (
          <div className="admin-login-error-alert" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="admin-login-form">
          <div className="admin-input-group">
            <label htmlFor="admin-sec-code">
              {mode === 'setup' ? 'Mã bảo mật mới' : 'Mã bảo mật'} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div className="admin-input-icon-wrap">
              <input
                id="admin-sec-code"
                type="password"
                autoComplete={mode === 'setup' ? 'new-password' : 'one-time-code'}
                placeholder={mode === 'setup' ? 'Tối thiểu 8 ký tự, có chữ và số' : '••••••••'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>

          {mode === 'setup' && (
            <div className="admin-input-group">
              <label htmlFor="admin-sec-code2">
                Nhập lại mã <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="admin-input-icon-wrap">
                <input
                  id="admin-sec-code2"
                  type="password"
                  autoComplete="new-password"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-admin-login-submit" disabled={busy}>
            {busy ? 'Đang kiểm tra...' : mode === 'setup' ? 'Tạo Mã & Mở Khoá' : 'Mở Khoá Trang Quản Trị'}
          </button>
        </form>

        <div className="admin-unlock-links">
          {mode === 'unlock' ? (
            <button type="button" className="admin-unlock-link" onClick={() => switchMode('setup')}>
              Lần đầu dùng? Tạo mã bảo mật
            </button>
          ) : (
            <button type="button" className="admin-unlock-link" onClick={() => switchMode('unlock')}>
              Đã có mã? Nhập mã để mở khoá
            </button>
          )}
          <button type="button" className="admin-unlock-link muted" onClick={onSignOut}>
            Đăng xuất
          </button>
        </div>

        <p className="admin-unlock-help">
          Quên mã bảo mật: chủ shop vào Firebase Console → Firestore → collection <code>admin_secrets</code>,
          xoá document trùng với UID tài khoản admin, rồi tạo mã mới tại đây.
        </p>
      </div>
    </div>
  );
}
