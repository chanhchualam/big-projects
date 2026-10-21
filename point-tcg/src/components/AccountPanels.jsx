// src/components/AccountPanels.jsx
// Các khối giao diện của trang Tài khoản: tiến trình đơn, mã vận đơn, sửa hồ sơ / đổi mật khẩu, đánh giá sản phẩm
import React, { useState, useMemo } from 'react';
import {
  TIMELINE_STEPS,
  CANCELLED_STATUS,
  getTimelineIndex,
  getStepTime,
  getTrackingUrl
} from '../utils/orderStatus';
import { updateUserProfile, changePassword } from '../utils/auth';
import { saveReviewToDb } from '../services/firestoreService';
import { getProductCatalogImage } from '../products';

const formatTime = (d) =>
  d ? d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

// =============================================================
// 1. THANH TIẾN TRÌNH ĐƠN HÀNG
// =============================================================
export function OrderTimeline({ order }) {
  if (order.status === CANCELLED_STATUS) {
    return <div className="otl-cancelled">✕ Đơn hàng đã huỷ</div>;
  }
  const current = getTimelineIndex(order.status);

  return (
    <ol className="otl" aria-label="Tiến trình đơn hàng">
      {TIMELINE_STEPS.map((step, i) => {
        const done = i <= current;
        const time = done ? getStepTime(order, step) : null;
        return (
          <li key={step.key} className={`otl-step ${done ? 'done' : ''} ${i === current ? 'current' : ''}`}>
            <span className="otl-dot">{done ? '✓' : i + 1}</span>
            <span className="otl-label">{step.label}</span>
            {time && <span className="otl-time">{formatTime(time)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// =============================================================
// 2. MÃ VẬN ĐƠN
// =============================================================
export function TrackingInfo({ order }) {
  const [copied, setCopied] = useState(false);
  if (!order.trackingCode) return null;
  const url = getTrackingUrl(order.carrier, order.trackingCode);

  return (
    <div className="tracking-box">
      <span>{order.carrier || 'Vận chuyển'}:</span>
      <strong className="tracking-code">{order.trackingCode}</strong>
      <button
        type="button"
        className="tracking-copy"
        onClick={() => {
          navigator.clipboard?.writeText(order.trackingCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? 'Đã chép' : 'Sao chép'}
      </button>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="tracking-link">
          Tra cứu hành trình ↗
        </a>
      )}
    </div>
  );
}

// =============================================================
// 3. SỬA HỒ SƠ & ĐỔI MẬT KHẨU
// =============================================================
export function ProfileEditor({ currentUser, onUpdateCurrentUser }) {
  const [form, setForm] = useState({
    name: currentUser.name || '',
    phone: currentUser.phone || '',
    address: currentUser.address || ''
  });
  const [profileMsg, setProfileMsg] = useState(null); // { ok, text }
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [savingPw, setSavingPw] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setProfileMsg({ ok: false, text: 'Họ tên không được để trống.' });
      return;
    }
    setSavingProfile(true);
    const res = await updateUserProfile(currentUser.id, form);
    setSavingProfile(false);
    if (res.success) {
      onUpdateCurrentUser?.(res.user);
      setProfileMsg({ ok: true, text: 'Đã lưu thông tin tài khoản.' });
    } else {
      setProfileMsg({ ok: false, text: res.error });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pw.next.length < 6) {
      setPwMsg({ ok: false, text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setSavingPw(true);
    const res = await changePassword(pw.current, pw.next);
    setSavingPw(false);
    if (res.success) {
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ ok: true, text: 'Đã đổi mật khẩu.' });
    } else {
      setPwMsg({ ok: false, text: res.error });
    }
  };

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="cop-form-group">
      <label htmlFor={`pf-${key}`}>{label}</label>
      <input
        id={`pf-${key}`}
        type={type}
        className="cop-input-editable"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  const msg = (m) =>
    m && <div className={m.ok ? 'acc-msg-ok' : 'acc-msg-err'}>{m.text}</div>;

  return (
    <>
      <form className="cop-profile-form" onSubmit={handleSaveProfile}>
        {field('name', 'Họ và tên')}
        <div className="cop-form-group">
          <label>Email đăng nhập</label>
          <input type="email" readOnly value={currentUser.email} className="cop-input-readonly" />
        </div>
        {field('phone', 'Số điện thoại', 'tel', '0901234567')}
        {field('address', 'Địa chỉ nhận hàng mặc định', 'text', 'Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành')}
        {msg(profileMsg)}
        <div className="cop-profile-actions">
          <button type="submit" className="cop-btn-edit-profile" disabled={savingProfile}>
            {savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>
      </form>

      <form className="cop-profile-form acc-password-form" onSubmit={handleChangePassword}>
        <h3 className="acc-subtitle">Đổi mật khẩu</h3>
        <div className="cop-form-group">
          <label htmlFor="pw-current">Mật khẩu hiện tại</label>
          <input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            className="cop-input-editable"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            required
          />
        </div>
        <div className="cop-form-group">
          <label htmlFor="pw-next">Mật khẩu mới</label>
          <input
            id="pw-next"
            type="password"
            autoComplete="new-password"
            className="cop-input-editable"
            placeholder="Tối thiểu 6 ký tự"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            required
          />
        </div>
        <div className="cop-form-group">
          <label htmlFor="pw-confirm">Nhập lại mật khẩu mới</label>
          <input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            className="cop-input-editable"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            required
          />
        </div>
        {msg(pwMsg)}
        <div className="cop-profile-actions">
          <button type="submit" className="cop-btn-edit-profile" disabled={savingPw}>
            {savingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </>
  );
}

// =============================================================
// 4. ĐÁNH GIÁ SẢN PHẨM ĐÃ NHẬN
// =============================================================
function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="Số sao">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sao`}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ item, order, existing, currentUser, onSaved }) {
  const [rating, setRating] = useState(existing?.rating || 5);
  const [comment, setComment] = useState(existing?.comment || '');
  const [state, setState] = useState(existing ? 'saved' : 'idle'); // idle | saving | saved | error | editing

  const handleSubmit = async (e) => {
    e.preventDefault();
    setState('saving');
    const saved = await saveReviewToDb({
      productId: String(item.id),
      productTitle: item.title,
      orderId: order.id,
      uid: currentUser.id,
      name: currentUser.name,
      rating,
      comment: comment.trim().slice(0, 1000),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    if (saved) {
      onSaved?.(saved);
      setState('saved');
    } else {
      setState('error');
    }
  };

  const img = getProductCatalogImage(item) || item.image;

  return (
    <div className="review-item-card">
      <div className="review-item-head">
        {img && <img src={img} alt="" className="review-item-thumb" />}
        <div>
          <div className="review-item-title">{item.title}</div>
          <div className="review-item-sub">Đơn #{order.id}</div>
        </div>
      </div>

      {state === 'saved' ? (
        <div className="review-saved">
          <span style={{ color: '#f59e0b' }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
          {comment && <p>{comment}</p>}
          <button type="button" className="cop-btn-small" onClick={() => setState('editing')}>
            Sửa đánh giá
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <StarPicker value={rating} onChange={setRating} />
          <textarea
            className="review-textarea"
            placeholder="Chia sẻ cảm nhận về sản phẩm (tình trạng seal, đóng gói, pull...)"
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {state === 'error' && <div className="acc-msg-err">Không gửi được đánh giá. Vui lòng thử lại.</div>}
          <button type="submit" className="cop-btn-edit-profile" disabled={state === 'saving'}>
            {state === 'saving' ? 'Đang gửi...' : 'Gửi đánh giá'}
          </button>
        </form>
      )}
    </div>
  );
}

export function ReviewsPanel({ currentUser, orders, reviews, onReviewSaved, onGoToOrders }) {
  // Mỗi sản phẩm chỉ đánh giá một lần, lấy từ đơn đã giao gần nhất
  const reviewable = useMemo(() => {
    const seen = new Set();
    const list = [];
    orders
      .filter((o) => o.status === 'Giao thành công' && Array.isArray(o.productIds))
      .forEach((order) => {
        (order.items || []).forEach((item) => {
          const pid = String(item.id);
          if (!item.id || seen.has(pid)) return;
          seen.add(pid);
          list.push({ item, order });
        });
      });
    return list;
  }, [orders]);

  if (!currentUser) {
    return <p className="cop-empty-text">Vui lòng đăng nhập để đánh giá sản phẩm.</p>;
  }

  if (reviewable.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#1e293b', fontWeight: 700 }}>Chưa có sản phẩm để đánh giá</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '460px', margin: '8px auto 20px' }}>
          Khi đơn hàng chuyển sang "Giao thành công", sản phẩm trong đơn sẽ xuất hiện ở đây để bạn chấm sao và nhận xét.
        </p>
        <button type="button" className="cop-btn-shop-now" onClick={onGoToOrders}>
          Xem đơn hàng
        </button>
      </div>
    );
  }

  return (
    <div className="review-items-list">
      {reviewable.map(({ item, order }) => (
        <ReviewForm
          key={item.id}
          item={item}
          order={order}
          currentUser={currentUser}
          existing={reviews.find((r) => r.productId === String(item.id) && r.uid === currentUser.id)}
          onSaved={onReviewSaved}
        />
      ))}
    </div>
  );
}
