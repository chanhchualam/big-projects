// src/components/NotificationBell.jsx
// Nút 🔔 trên thanh đầu trang: danh sách thông báo về đơn hàng, sản phẩm yêu thích và tin của shop
import React, { useState, useEffect, useRef } from 'react';
import { timeAgo } from '../utils/notifications';

export default function NotificationBell({ notifications = [], readAt = 0, onMarkAllRead, onOpenItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = notifications.filter((n) => new Date(n.at).getTime() > readAt).length;

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div className="notif-wrapper" ref={ref}>
      <button
        type="button"
        className="header-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
      >
        <svg className="header-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="header-badge notif-badge">{unread > 9 ? '9+' : unread}</span>}
        <div className="header-btn-label">
          <span className="header-btn-sub">Tin mới</span>
          <span>Thông báo</span>
        </div>
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="Thông báo">
          <div className="notif-head">
            <strong>Thông báo</strong>
            {unread > 0 && (
              <button type="button" className="notif-mark-read" onClick={onMarkAllRead}>
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">
              Chưa có thông báo nào. Khi đơn hàng đổi trạng thái hoặc sản phẩm yêu thích có hàng lại, bạn sẽ thấy ở đây.
            </div>
          ) : (
            <ul className="notif-list">
              {notifications.map((n) => {
                const isUnread = new Date(n.at).getTime() > readAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`notif-item ${isUnread ? 'unread' : ''}`}
                      onClick={() => {
                        setOpen(false);
                        onOpenItem?.(n);
                      }}
                    >
                      <span className="notif-icon" aria-hidden="true">{n.icon}</span>
                      <span className="notif-body">
                        <span className="notif-title">{n.title}</span>
                        <span className="notif-time">{timeAgo(n.at)}</span>
                      </span>
                      {isUnread && <span className="notif-dot" aria-label="Chưa đọc" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
