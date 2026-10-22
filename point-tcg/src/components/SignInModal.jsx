// src/components/SignInModal.jsx
import React, { useState, useEffect } from 'react';
import {
  registerUser,
  authenticateUser,
  sendPasswordReset
} from '../utils/auth';
import { useI18n } from '../i18n';

export default function SignInModal({
  isOpen,
  onClose,
  onSignInSuccess,
  initialMode = 'login', // 'login' | 'register'
  notice = '' // lý do cần đăng nhập (VD: xem chi tiết / đặt hàng)
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'

  // Form State - Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginInfo, setLoginInfo] = useState('');

  // Form State - Register
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode === 'register' ? 'register' : 'login');
      setLoginError('');
      setLoginInfo('');
      setRegError('');
      setRegSuccess('');
      setLoginPassword('');
      setIsSubmitting(false);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // 1. HANDLER: USER LOGIN
  // -------------------------------------------------------------
  const handleUserLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginInfo('');

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError(t('Vui lòng điền đầy đủ email và mật khẩu!'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authenticateUser(loginEmail, loginPassword);
      if (res.success) {
        onSignInSuccess(res.user);
        setLoginPassword('');
        onClose();
      } else {
        setLoginError(t(res.error || 'Email hoặc mật khẩu không chính xác!'));
      }
    } catch (err) {
      setLoginError(t('Lỗi kết nối khi đăng nhập. Vui lòng thử lại!'));
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleForgotPassword = async () => {
    setLoginError('');
    setLoginInfo('');

    if (!loginEmail.trim()) {
      setLoginError(t('Vui lòng nhập email ở trên rồi bấm "Quên mật khẩu?"'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendPasswordReset(loginEmail);
      if (res.success) {
        setLoginInfo(t('Nếu {email} đã đăng ký, bạn sẽ nhận được email đặt lại mật khẩu trong vài phút (kiểm tra cả mục Spam).', { email: loginEmail.trim() }));
      } else {
        setLoginError(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 2. HANDLER: USER REGISTER
  // -------------------------------------------------------------
  const handleUserRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regName.trim()) {
      setRegError(t('Vui lòng nhập họ và tên của bạn!'));
      return;
    }
    if (!regEmail.trim()) {
      setRegError(t('Vui lòng nhập địa chỉ email hợp lệ!'));
      return;
    }
    if (!regPassword.trim() || regPassword.length < 6) {
      setRegError(t('Mật khẩu phải có tối thiểu 6 ký tự!'));
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError(t('Mật khẩu xác nhận không khớp! Vui lòng kiểm tra lại.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const regResult = await registerUser({
        name: regName,
        email: regEmail,
        password: regPassword,
        phone: regPhone,
        address: regAddress
      });

      if (regResult.success) {
        setRegSuccess(t('Đăng ký tài khoản thành công! Đang tự động lưu lên Firebase và đăng nhập...'));
        setTimeout(() => {
          onSignInSuccess(regResult.user);
          onClose();
        }, 900);
      } else {
        setRegError(t(regResult.error || 'Đăng ký không thành công. Vui lòng thử lại!'));
      }
    } catch (err) {
      setRegError(t('Lỗi kết nối khi đăng ký. Vui lòng thử lại!'));
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('Tài khoản Point TCG')}>
      <div className="signin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <button
          type="button"
          className="modal-close-icon-btn"
          onClick={onClose}
          aria-label={t('Đóng cửa sổ')}
        >
          ✕
        </button>

        {notice && <div className="signin-required-notice">{notice}</div>}

        {/* 3 Main Switcher Tabs */}
        <div className="signin-tabs">
          <button
            type="button"
            className={`signin-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('login');
              setLoginError('');
            }}
          >
            {t('Đăng Nhập')}
          </button>
          <button
            type="button"
            className={`signin-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('register');
              setRegError('');
            }}
          >
            {t('Đăng Ký')}
          </button>
        </div>

        {/* =========================================================================
            TAB 1: USER LOGIN (ĐĂNG NHẬP KHÁCH HÀNG)
           ========================================================================= */}
        {activeTab === 'login' && (
          <div>
            <div className="signin-header">
              <div className="signin-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h2 className="signin-title">{t('Đăng Nhập Khách Hàng')}</h2>
              <p className="signin-sub">{t('Đăng nhập tài khoản để đặt hàng, tham gia rút thăm Pokémon TCG và quản lý thanh toán.')}</p>
            </div>


            {loginError && (
              <div className="admin-error-box">
                {loginError}
              </div>
            )}

            {loginInfo && (
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '14px', textAlign: 'center' }}>
                {loginInfo}
              </div>
            )}

            <form className="signin-form" onSubmit={handleUserLogin}>
              <div className="form-group">
                <label className="form-label" htmlFor="user-login-email">
                  {t('Email')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="user-login-email"
                  type="email"
                  autoComplete="username"
                  className="form-input"
                  placeholder={t('email@vidu.com')}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="user-login-pass">
                  {t('Mật khẩu')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="user-login-pass"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <div style={{ textAlign: 'right', marginTop: '6px', fontSize: '0.8rem' }}>
                  <button
                    type="button"
                    style={{ color: '#0053e2', fontWeight: 600, cursor: isSubmitting ? 'wait' : 'pointer' }}
                    onClick={handleForgotPassword}
                    disabled={isSubmitting}
                  >
                    {t('Quên mật khẩu?')}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="signin-submit-btn"
                disabled={isSubmitting}
                style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}
              >
                {isSubmitting ? t('Đang kiểm tra đăng nhập...') : t('Đăng Nhập Ngay')}
              </button>


              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>{t('Chưa có tài khoản?')}</span>
                <button
                  type="button"
                  style={{ color: '#0053e2', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setActiveTab('register')}
                >
                  {t('Tạo tài khoản mới →')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =========================================================================
            TAB 2: USER REGISTER (ĐĂNG KÝ TÀI KHOẢN MỚI)
           ========================================================================= */}
        {activeTab === 'register' && (
          <div>
            <div className="signin-header">
              <div className="signin-icon" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <h2 className="signin-title">{t('Đăng Ký Thành Viên')}</h2>
              <p className="signin-sub">{t('Tạo tài khoản Point TCG miễn phí để nhận ưu đãi, lưu địa chỉ giao hàng và thanh toán nhanh chóng.')}</p>
            </div>

            {regError && (
              <div className="admin-error-box">
                {regError}
              </div>
            )}

            {regSuccess && (
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '14px', textAlign: 'center' }}>
                {regSuccess}
              </div>
            )}

            <form className="signin-form" onSubmit={handleUserRegister}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name-input">
                  {t('Họ và tên của bạn')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-name-input"
                  type="text"
                  className="form-input"
                  placeholder={t('ví dụ: Nguyễn Văn A')}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email-input">
                  {t('Địa chỉ Email')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-email-input"
                  type="email"
                  className="form-input"
                  placeholder={t('ví dụ: customer@gmail.com')}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-phone-input">
                    {t('Số điện thoại')}
                  </label>
                  <input
                    id="reg-phone-input"
                    type="tel"
                    className="form-input"
                    placeholder="0901234567"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-pass-input">
                    {t('Mật khẩu')} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="reg-pass-input"
                    type="password"
                    className="form-input"
                    placeholder={t('Tối thiểu 6 ký tự')}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm-pass">
                  {t('Xác nhận lại mật khẩu')} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-confirm-pass"
                  type="password"
                  className="form-input"
                  placeholder={t('Nhập lại mật khẩu...')}
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-address-input">
                  {t('Địa chỉ giao hàng mặc định (tiện khi thanh toán)')}
                </label>
                <input
                  id="reg-address-input"
                  type="text"
                  className="form-input"
                  placeholder={t('Số nhà, tên đường, quận/huyện, tỉnh/thành phố...')}
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="signin-submit-btn"
                disabled={isSubmitting}
                style={{ backgroundColor: '#059669', color: '#ffffff', opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}
              >
                {isSubmitting ? t('Đang lưu tài khoản lên Firebase...') : t('Hoàn Tất Đăng Ký Tài Khoản')}
              </button>

              <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.82rem', color: '#64748b' }}>
                {t('Đã có tài khoản?')}{' '}
                <button
                  type="button"
                  style={{ color: '#0053e2', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setActiveTab('login')}
                >
                  {t('Đăng nhập tại đây →')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
