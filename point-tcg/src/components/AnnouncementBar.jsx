// src/components/AnnouncementBar.jsx
// Thanh thông báo của shop trên đầu trang (admin soạn trong trang quản trị). Khách có thể ẩn từng thông báo.
import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n';

const DISMISSED_KEY = 'point-tcg-dismissed-announcements';

function readDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function AnnouncementBar({ announcements = [] }) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const visible = useMemo(
    // Ẩn theo id + thời điểm sửa: admin sửa nội dung thì thông báo hiện lại
    () => announcements.filter((a) => !dismissed.includes(`${a.id}@${a.updatedAt || a.createdAt}`)),
    [announcements, dismissed]
  );

  useEffect(() => {
    if (visible.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % visible.length), 7000);
    return () => clearInterval(timer);
  }, [visible.length]);

  if (visible.length === 0) return null;
  const a = visible[index % visible.length];

  const dismiss = () => {
    const next = [...dismissed, `${a.id}@${a.updatedAt || a.createdAt}`].slice(-50);
    setDismissed(next);
    setIndex(0);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // bỏ qua
    }
  };

  const isExternal = a.link && /^https?:\/\//.test(a.link);

  return (
    <div className={`announce-bar announce-${a.type || 'info'}`} role="region" aria-label="Thông báo của shop" aria-live="polite">
      <div className="announce-inner">
        <span className="announce-text">{a.text}</span>
        {a.couponCode && (
          <button
            type="button"
            className="announce-coupon"
            onClick={() => {
              navigator.clipboard?.writeText(a.couponCode).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            title={t('Sao chép mã giảm giá')}
          >
            {copied ? `✓ ${t('Đã chép')}` : t('Mã: {code}', { code: a.couponCode })}
          </button>
        )}
        {a.link && (
          <a
            className="announce-link"
            href={a.link}
            {...(isExternal ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {a.linkText || 'Xem ngay'} →
          </a>
        )}
        {visible.length > 1 && (
          <span className="announce-count">{(index % visible.length) + 1}/{visible.length}</span>
        )}
      </div>
      <button type="button" className="announce-close" onClick={dismiss} aria-label={t('Ẩn thông báo này')}>
        ✕
      </button>
    </div>
  );
}
