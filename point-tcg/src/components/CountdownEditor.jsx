// src/components/CountdownEditor.jsx
// Ô chỉnh thời gian kết thúc raffle (dùng trong form sản phẩm và hộp "Đổi giờ" nhanh của admin).
// value: { mode: 'timer' | 'fixed' | 'custom', label, endsAt: 'YYYY-MM-DDTHH:mm', customText }
import React from 'react';
import { DEFAULT_LABELS, getDrawingText, toLocalInputValue } from '../utils/countdown';

const MODES = [
  { value: 'timer', label: '⏳ Đếm ngược' },
  { value: 'fixed', label: '📅 Thời gian cố định' },
  { value: 'custom', label: '✍️ Chữ tự do' }
];

const LABEL_SUGGESTIONS = {
  timer: ['Drawing ends in', 'Kết thúc trong', 'Raffle closes in', 'Còn lại'],
  fixed: ['Kết thúc lúc', 'Drawing ends', 'Mở bán lúc', 'Quay thưởng lúc']
};

const QUICK_TIMES = [
  { label: '+30 phút', minutes: 30 },
  { label: '+1 giờ', minutes: 60 },
  { label: '+3 giờ', minutes: 180 },
  { label: '+12 giờ', minutes: 720 },
  { label: '+1 ngày', minutes: 1440 },
  { label: '+3 ngày', minutes: 4320 },
  { label: '+7 ngày', minutes: 10080 }
];

function todayAt(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (d < new Date()) d.setDate(d.getDate() + 1);
  return d;
}

export default function CountdownEditor({ value, onChange, idPrefix = 'cd' }) {
  const set = (patch) => onChange({ ...value, ...patch });

  const switchMode = (mode) => {
    // Đổi chế độ thì đổi luôn nhãn mặc định nếu admin chưa tự sửa nhãn
    const isDefaultLabel = !value.label || Object.values(DEFAULT_LABELS).includes(value.label);
    set({ mode, ...(isDefaultLabel && DEFAULT_LABELS[mode] ? { label: DEFAULT_LABELS[mode] } : {}) });
  };

  const preview = getDrawingText({
    countdownMode: value.mode,
    countdownLabel: value.label,
    customCountdownText: value.customText,
    endsAt: value.endsAt ? new Date(value.endsAt).toISOString() : null
  });
  const isPast = value.mode !== 'custom' && value.endsAt && new Date(value.endsAt) <= new Date();

  return (
    <div className="cde">
      <div className="countdown-mode-toggle" role="radiogroup" aria-label="Kiểu hiển thị thời gian">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={value.mode === m.value}
            className={`btn-mode-chip ${value.mode === m.value ? 'active' : ''}`}
            onClick={() => switchMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {value.mode === 'custom' ? (
        <div className="form-group">
          <label className="form-label" htmlFor={`${idPrefix}-custom`}>Chữ hiển thị (thay cho dòng thời gian)</label>
          <input
            id={`${idPrefix}-custom`}
            type="text"
            className="form-input"
            placeholder="VD: 🔥 Sắp kết thúc hôm nay"
            value={value.customText}
            onChange={(e) => set({ customText: e.target.value })}
          />
        </div>
      ) : (
        <>
          <div className="cde-row">
            <div className="form-group">
              <label className="form-label" htmlFor={`${idPrefix}-label`}>Dòng chữ phía trước</label>
              <input
                id={`${idPrefix}-label`}
                type="text"
                className="form-input"
                value={value.label}
                onChange={(e) => set({ label: e.target.value })}
              />
              <div className="countdown-preset-chips">
                {LABEL_SUGGESTIONS[value.mode].map((txt) => (
                  <button
                    key={txt}
                    type="button"
                    className={`preset-text-chip ${value.label === txt ? 'active' : ''}`}
                    onClick={() => set({ label: txt })}
                  >
                    {txt}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor={`${idPrefix}-ends`}>
                {value.mode === 'timer' ? 'Thời điểm kết thúc (đếm ngược tới lúc này)' : 'Thời gian hiển thị'}
              </label>
              <input
                id={`${idPrefix}-ends`}
                type="datetime-local"
                className="form-input"
                value={value.endsAt}
                onChange={(e) => set({ endsAt: e.target.value })}
                required
              />
              <div className="countdown-preset-chips">
                {QUICK_TIMES.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className="btn-time-chip"
                    onClick={() => set({ endsAt: toLocalInputValue(Date.now() + q.minutes * 60000) })}
                  >
                    {q.label}
                  </button>
                ))}
                <button type="button" className="btn-time-chip" onClick={() => set({ endsAt: toLocalInputValue(todayAt(20)) })}>
                  20:00 tối nay
                </button>
              </div>
            </div>
          </div>
          {isPast && (
            <div className="cde-warning">⚠️ Thời điểm này đã qua — khách sẽ thấy "Drawing Ended".</div>
          )}
        </>
      )}

      <div className="countdown-live-badge-preview">
        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Xem trước:</span>
        <div className="countdown-status-badge" style={{ display: 'inline-flex', margin: 0 }}>
          <svg className="countdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{preview}</span>
        </div>
      </div>
    </div>
  );
}
