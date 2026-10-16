// src/components/AdminPage.jsx
import React, { useState, useEffect } from 'react';
import AdminModal from './AdminModal';
import {
  getAdminSession,
  setAdminSession,
  authenticateAdmin,
  getAdminCredentials
} from '../utils/auth';

export default function AdminPage({
  currentUser = null,
  openDrawings = [],
  closedDrawings = [],
  orders = [],
  onUpdateOrderStatus,
  onDeleteOrder,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onResetDefaults,
  onNavigateToStore,
  onAdminLoginSuccess = null,
  onSignOut = null,
  initialProductToEdit = null
}) {
  const [adminUser, setAdminUser] = useState(() => {
    // If the active user in the app is a customer, they can NEVER access admin
    if (currentUser && currentUser.role === 'customer') {
      return null;
    }
    if (currentUser && currentUser.role === 'admin') {
      return currentUser;
    }
    return getAdminSession();
  });
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync admin session if changes happen in other tabs or currentUser changes
  useEffect(() => {
    if (currentUser && currentUser.role === 'customer') {
      setAdminUser(null);
      setAdminSession(null);
    } else if (currentUser && currentUser.role === 'admin') {
      setAdminUser(currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'point-tcg-admin-session') {
        if (currentUser && currentUser.role === 'customer') {
          setAdminUser(null);
        } else {
          setAdminUser(getAdminSession());
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser]);

  // Handle Admin Login submission
  const handleAdminLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');

    if (!adminUsername.trim() || !adminPassword.trim()) {
      setLoginError('Vui lòng nhập đầy đủ tài khoản và mật khẩu quản trị!');
      return;
    }

    setIsSubmitting(true);
    const result = authenticateAdmin(adminUsername.trim(), adminPassword.trim());
    setIsSubmitting(false);

    if (result.success) {
      setAdminUser(result.user);
      setAdminPassword('');
      setLoginError('');
      if (onAdminLoginSuccess) {
        onAdminLoginSuccess(result.user);
      }
    } else {
      setLoginError(result.error || 'Tài khoản hoặc mật khẩu quản trị không chính xác!');
    }
  };

  // Handle Admin Logout
  const handleAdminLogout = () => {
    if (confirm('Bạn có chắc muốn đăng xuất khỏi trang Quản Trị?')) {
      setAdminSession(null);
      setAdminUser(null);
      setAdminUsername('');
      setAdminPassword('');
      if (onSignOut) onSignOut();
      if (onNavigateToStore) onNavigateToStore();
      else window.location.hash = '';
    }
  };

  // -------------------------------------------------------------
  // VIEW 0: ACCESS DENIED (WHEN LOGGED IN AS CUSTOMER)
  // -------------------------------------------------------------
  if (currentUser && currentUser.role === 'customer') {
    return (
      <div className="admin-page-login-wrapper">
        <div className="admin-login-card" style={{ maxWidth: '500px', textAlign: 'center', padding: '38px 28px' }}>
          <div style={{ fontSize: '3.6rem', marginBottom: '10px' }}>⛔</div>
          <div className="admin-portal-pill" style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}>
            KHÔNG CÓ QUYỀN TRUY CẬP
          </div>
          <h1 className="admin-login-title" style={{ color: '#dc2626', marginTop: '14px', fontSize: '1.45rem' }}>
            Tài Khoản Không Phải Quản Trị Viên
          </h1>
          <p className="admin-login-sub" style={{ fontSize: '0.94rem', lineHeight: 1.6, color: '#475569', marginBottom: '24px' }}>
            Bạn đang đăng nhập bằng tài khoản Khách hàng (<strong>{currentUser.name}</strong> • <em>{currentUser.email}</em>).
            <br />
            Khu vực này được bảo mật và chỉ dành riêng cho tài khoản Quản trị viên (Admin) của Point TCG.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              className="btn-admin-submit-login"
              style={{ background: '#0053e2', width: '100%', padding: '12px' }}
              onClick={() => {
                if (onNavigateToStore) onNavigateToStore();
                else window.location.hash = '';
              }}
            >
              ← Quay Lại Cửa Hàng Mua Sắm
            </button>
            <button
              type="button"
              className="btn-admin-cancel"
              style={{ width: '100%', padding: '11px', fontWeight: 600 }}
              onClick={() => {
                if (onSignOut) onSignOut();
                setAdminSession(null);
                setAdminUser(null);
              }}
            >
              🚪 Đăng Xuất Tài Khoản Này Để Đăng Nhập Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: DEDICATED ADMIN LOGIN SCREEN (WHEN NOT AUTHENTICATED)
  // -------------------------------------------------------------
  if (!adminUser) {
    return (
      <div className="admin-page-login-wrapper">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <div className="admin-login-logo-badge">
              <img
                src="/logo.jpg"
                alt="Point TCG Admin"
                style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div className="admin-portal-pill">🛡️ CỔNG QUẢN TRỊ RIÊNG BIỆT</div>
            <h1 className="admin-login-title">Đăng Nhập Quản Trị Point TCG</h1>
            <p className="admin-login-sub">
              Trang quản trị độc lập dành cho chủ cửa hàng Point TCG. Nhập đúng tài khoản admin đã cấp để truy cập bảng điều khiển.
            </p>
          </div>

          {loginError && (
            <div className="admin-login-error-alert" role="alert">
              <span>⚠️</span>
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLoginSubmit} className="admin-login-form">
            <div className="admin-input-group">
              <label htmlFor="admin-page-username">
                Tài Khoản Quản Trị <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="admin-input-icon-wrap">
                <span className="input-icon">👤</span>
                <input
                  id="admin-page-username"
                  type="text"
                  placeholder="Nhập tài khoản admin..."
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="admin-input-group">
              <label htmlFor="admin-page-password">
                Mật Khẩu Quản Trị <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="admin-input-icon-wrap">
                <span className="input-icon">🔑</span>
                <input
                  id="admin-page-password"
                  type="password"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-admin-login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳ Đang Xác Thực...' : '🔐 Đăng Nhập Vào Trang Quản Trị'}
            </button>
          </form>

          <div className="admin-login-footer-actions">
            <button
              type="button"
              className="btn-back-to-store"
              onClick={() => {
                if (onNavigateToStore) {
                  onNavigateToStore();
                } else {
                try {
                  window.history.replaceState(null, '', window.location.pathname + window.location.search);
                } catch (e) {
                  window.location.hash = '';
                }
                }
              }}
            >
              ← Quay Lại Cửa Hàng Point TCG
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: DEDICATED ADMIN DASHBOARD FULL PAGE
  // -------------------------------------------------------------
  return (
    <div className="admin-page-layout">
      {/* Top Standalone Admin Navigation Bar */}
      <header className="admin-page-navbar">
        <div className="admin-navbar-brand">
          <a
            href="#admin"
            className="admin-brand-link"
            onClick={(e) => e.preventDefault()}
          >
            <img
              src="/logo.jpg"
              alt="Point TCG"
              style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover' }}
            />
            <span className="admin-brand-title">Point TCG</span>
            <span className="admin-system-chip">ADMIN SYSTEM</span>
          </a>
          <span className="admin-status-indicator">
            <span className="pulse-dot"></span>
            Đang Trực Tuyến
          </span>
        </div>

        <div className="admin-navbar-actions">
          <button
            type="button"
            className="btn-nav-view-store"
            onClick={() => window.open('./#', '_blank')}
            title="Mở tab khách hàng để xem cửa hàng"
          >
            🌐 Mở Tab Cửa Hàng ↗
          </button>

          <button
            type="button"
            className="btn-nav-back-store"
            onClick={() => {
              if (onNavigateToStore) {
                onNavigateToStore();
              } else {
                try {
                  window.history.replaceState(null, '', window.location.pathname + window.location.search);
                } catch (e) {
                  window.location.hash = '';
                }
              }
            }}
            title="Quay lại giao diện cửa hàng"
          >
            ← Về Shop
          </button>

          <div className="admin-profile-badge">
            <span className="admin-avatar">👑</span>
            <div className="admin-info-text">
              <span className="admin-name">{adminUser.name || 'Quản Trị Viên'}</span>
              <span className="admin-email">{adminUser.email || 'admin@pointtcg.com'}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-admin-logout"
            onClick={handleAdminLogout}
            title="Đăng xuất khỏi tài khoản admin"
          >
            🚪 Đăng Xuất
          </button>
        </div>
      </header>

      {/* Main Admin Dashboard Body */}
      <main className="admin-page-main">
        <AdminModal
          isOpen={true}
          isFullPage={true}
          onClose={() => {
            if (onNavigateToStore) onNavigateToStore();
            else window.location.hash = '';
          }}
          onNavigateToStore={onNavigateToStore}
          openDrawings={openDrawings}
          closedDrawings={closedDrawings}
          orders={orders}
          onUpdateOrderStatus={onUpdateOrderStatus}
          onDeleteOrder={onDeleteOrder}
          onAddProduct={onAddProduct}
          onUpdateProduct={onUpdateProduct}
          onDeleteProduct={onDeleteProduct}
          onResetDefaults={onResetDefaults}
          initialProductToEdit={initialProductToEdit}
        />
      </main>
    </div>
  );
}
