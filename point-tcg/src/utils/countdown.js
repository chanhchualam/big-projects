// src/utils/countdown.js
// Dòng thời gian của sản phẩm Open Drawing. Mỗi sản phẩm có MỘT mốc kết thúc (endsAt, ISO) chung cho mọi khách.
// countdownMode:
//   'timer'  — đếm ngược tới endsAt:            "Drawing ends in 02:14:33"
//   'fixed'  — hiện mốc cố định, không đếm giờ:  "Kết thúc lúc 20:00, 25/10/2026"
//   'custom' — chữ tự do do admin nhập
//   'none'   — không hẹn giờ, không hiện dòng thời gian
import { translate } from '../i18n';

export const DEFAULT_LABELS = {
  timer: 'Drawing ends in',
  fixed: 'Kết thúc lúc'
};

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DDTHH:mm' theo giờ máy, dùng cho <input type="datetime-local">
export function toLocalInputValue(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatFixedTime(date) {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function getCountdownMode(product) {
  if (product?.countdownMode) return product.countdownMode;
  return product?.customCountdownText ? 'custom' : 'timer';
}

// legacyEnd: mốc cũ (sản phẩm tạo trước khi có endsAt) — tính từ lúc khách mở web
export function getDrawingText(product, now = Date.now(), legacyEnd = null) {
  const mode = getCountdownMode(product);
  if (mode === 'none') return '';
  if (mode === 'custom' && product.customCountdownText?.trim()) {
    return product.customCountdownText.trim();
  }

  const end = product.endsAt ? new Date(product.endsAt).getTime() : legacyEnd;
  // Nhãn mặc định (hoặc admin giữ nguyên nhãn mặc định) được dịch theo ngôn ngữ khách chọn
  const label = translate(product.countdownLabel?.trim() || DEFAULT_LABELS[mode] || DEFAULT_LABELS.timer);
  if (!end) return label;

  if (mode === 'fixed') {
    return `${label} ${formatFixedTime(end)}`;
  }

  const diff = Math.max(0, Math.floor((end - now) / 1000));
  if (diff === 0) return product.countdownEndedText?.trim() || translate('Drawing Ended');
  const days = Math.floor(diff / 86400);
  const clock = `${pad(Math.floor((diff % 86400) / 3600))}:${pad(Math.floor((diff % 3600) / 60))}:${pad(diff % 60)}`;
  return `${label} ${days > 0 ? translate('{n} ngày ', { n: days }) : ''}${clock}`;
}
