// src/components/RestockNotify.jsx
// Nút "Báo khi có hàng" cho sản phẩm hết hàng: khách để lại email, admin xem danh sách trong trang quản trị
import React, { useState } from 'react';

export default function RestockNotify({ product, defaultEmail = '', onRequestRestock, compact = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail || '');
  const [state, setState] = useState('idle'); // 'idle' | 'sending' | 'done' | 'error'

  const stop = (e) => e.stopPropagation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setState('error');
      return;
    }
    setState('sending');
    const ok = onRequestRestock ? await onRequestRestock(product, email) : false;
    setState(ok ? 'done' : 'error');
  };

  if (state === 'done') {
    return (
      <div className="restock-done" onClick={stop}>
        Đã ghi nhận! Shop sẽ báo cho <strong>{email.trim()}</strong> khi có hàng.
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className={`card-action-btn restock-btn ${compact ? '' : 'restock-btn-large'}`}
        onClick={(e) => {
          stop(e);
          setIsOpen(true);
        }}
      >
        Báo khi có hàng
      </button>
    );
  }

  return (
    <form className="restock-form" onSubmit={handleSubmit} onClick={stop}>
      <input
        type="email"
        className="restock-input"
        placeholder="Email của bạn"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === 'error') setState('idle');
        }}
        autoFocus
        required
      />
      <button type="submit" className="restock-submit" disabled={state === 'sending'}>
        {state === 'sending' ? '...' : 'Gửi'}
      </button>
      {state === 'error' && (
        <div className="restock-error">Email không hợp lệ hoặc lỗi kết nối, vui lòng thử lại.</div>
      )}
    </form>
  );
}
