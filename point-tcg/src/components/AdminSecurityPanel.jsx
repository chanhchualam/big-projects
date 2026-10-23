// src/components/AdminSecurityPanel.jsx
// Trong tab "Tài Khoản Admin": đổi mã bảo mật, khoá ngay, xem nhật ký mở khoá gần đây.
import React, { useEffect, useState } from 'react';
import {
  changeAdminCode,
  fetchAdminLogs,
  getCodeStrengthError,
  IDLE_LOCK_MINUTES,
  SESSION_HOURS
} from '../utils/adminSecurity';

const LOG_LABELS = {
  unlock: { text: 'Mở khoá thành công', tone: 'ok' },
  unlock_failed: { text: 'Nhập sai mã bảo mật', tone: 'bad' },
  lock: { text: 'Khoá / đăng xuất', tone: 'muted' },
  auto_lock: { text: 'Tự khoá do không hoạt động', tone: 'muted' },
  code_set: { text: 'Tạo mã bảo mật', tone: 'ok' },
  code_changed: { text: 'Đổi mã bảo mật', tone: 'warn' }
};

export default function AdminSecurityPanel({ onLock }) {
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadLogs = () => fetchAdminLogs(30).then(setLogs);
  useEffect(() => {
    loadLogs();
  }, []);

  const failedRecently = logs.filter(
    (l) => l.type === 'unlock_failed' && l.at && Date.now() - l.at.getTime() < 7 * 24 * 3600 * 1000
  ).length;

  const handleChange = async (e) => {
    e.preventDefault();
    setMsg(null);
    const weak = getCodeStrengthError(form.next);
    if (weak) return setMsg({ ok: false, text: weak });
    if (form.next !== form.confirm) return setMsg({ ok: false, text: 'Hai lần nhập mã mới không khớp.' });
    if (form.next === form.current) return setMsg({ ok: false, text: 'Mã mới phải khác mã hiện tại.' });
    setBusy(true);
    const res = await changeAdminCode(form.current, form.next);
    setBusy(false);
    if (res.success) {
      setForm({ current: '', next: '', confirm: '' });
      setMsg({ ok: true, text: 'Đã đổi mã bảo mật.' });
      loadLogs();
    } else {
      setMsg({ ok: false, text: res.error });
    }
  };

  return (
    <section className="admin-security-panel">
      <div className="admin-security-head">
        <div>
          <h3>Bảo mật 2 lớp</h3>
          <p>
            Trang quản trị cần cả mật khẩu đăng nhập và mã bảo mật. Phiên mở khoá hết hạn sau {SESSION_HOURS} giờ
            và tự khoá khi không thao tác {IDLE_LOCK_MINUTES} phút.
          </p>
        </div>
        <button type="button" className="btn-admin-cancel" onClick={onLock}>
          Khoá ngay
        </button>
      </div>

      {failedRecently > 0 && (
        <div className="admin-security-alert" role="alert">
          Có {failedRecently} lần nhập sai mã bảo mật trong 7 ngày qua. Nếu không phải bạn, hãy đổi mật khẩu đăng nhập
          và mã bảo mật ngay.
        </div>
      )}

      <div className="admin-security-grid">
        <form className="admin-security-form" onSubmit={handleChange}>
          <h4>Đổi mã bảo mật</h4>
          {[
            ['current', 'Mã hiện tại', 'current-password'],
            ['next', 'Mã mới (tối thiểu 8 ký tự, có chữ và số)', 'new-password'],
            ['confirm', 'Nhập lại mã mới', 'new-password']
          ].map(([key, label, ac]) => (
            <label key={key} className="admin-security-field">
              <span>{label}</span>
              <input
                type="password"
                autoComplete={ac}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required
              />
            </label>
          ))}
          {msg && <div className={msg.ok ? 'acc-msg-ok' : 'acc-msg-err'}>{msg.text}</div>}
          <button type="submit" className="btn-admin-add" disabled={busy}>
            {busy ? 'Đang đổi...' : 'Đổi mã'}
          </button>
        </form>

        <div className="admin-security-log">
          <h4>Nhật ký bảo mật gần đây</h4>
          {logs.length === 0 ? (
            <p className="admin-security-empty">Chưa có hoạt động.</p>
          ) : (
            <ul>
              {logs.map((l) => {
                const info = LOG_LABELS[l.type] || { text: l.type, tone: 'muted' };
                return (
                  <li key={l.id} className={`tone-${info.tone}`}>
                    <span className="log-text">{info.text}</span>
                    <span className="log-meta">
                      {l.at ? l.at.toLocaleString('vi-VN') : ''} · {l.device || ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
