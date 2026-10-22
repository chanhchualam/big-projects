// src/utils/notifications.js
// Thông báo trong web cho khách, tạo ra từ dữ liệu sẵn có (không cần server):
//  - Đơn hàng: mỗi lần admin đổi trạng thái (statusHistory) và khi có mã vận đơn (trackingAt)
//  - Sản phẩm yêu thích: có hàng lại hoặc giảm giá (so với lần xem trước, lưu trong trình duyệt)
//  - Thông báo của shop (announcements)
// Trạng thái "đã đọc" lưu trong trình duyệt theo từng tài khoản.
import { translate as t, getLocale, formatMoney } from '../i18n';

const WINDOW_DAYS = 30;
const MAX_ITEMS = 40;
const SNAPSHOT_KEY = 'point-tcg-wishlist-snapshot';
const EVENTS_KEY = 'point-tcg-wishlist-events';
const readKey = (viewerId) => `point-tcg-notif-read-at:${viewerId || 'guest'}`;

// Trạng thái do shop đổi — trạng thái khách tự đặt / tự báo thì không thông báo lại cho khách
const ORDER_STATUS_TEXT = {
  'Đã thanh toán (Chờ chuẩn bị hàng)': { text: 'đã được xác nhận thanh toán' },
  'Đang chuẩn bị hàng': { text: 'đang được đóng gói' },
  'Đang giao hàng': { text: 'đã được giao cho đơn vị vận chuyển' },
  'Giao thành công': { text: 'đã giao thành công — hãy đánh giá sản phẩm nhé!' },
  'Đã huỷ': { text: 'đã bị huỷ' }
};

function readJson(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage không khả dụng — bỏ qua
  }
}

export function getReadAt(viewerId) {
  return Number(readJson(readKey(viewerId), 0)) || 0;
}

export function markAllRead(viewerId) {
  writeJson(readKey(viewerId), Date.now());
}

// So sánh sản phẩm yêu thích với lần xem trước → ghi lại sự kiện có hàng lại / giảm giá
export function trackWishlistChanges(wishlistProducts) {
  const snapshot = readJson(SNAPSHOT_KEY, {});
  const events = readJson(EVENTS_KEY, []);
  const now = new Date().toISOString();
  let changed = false;

  wishlistProducts.forEach((p) => {
    const id = String(p.id);
    const stock = typeof p.stock === 'number' ? p.stock : 20;
    const prev = snapshot[id];
    if (prev) {
      if (prev.stock <= 0 && stock > 0) {
        events.push({ id: `restock-${id}-${now}`, kind: 'restock', productId: id, title: p.title, at: now });
        changed = true;
      }
      if (prev.price > p.price + 0.001) {
        events.push({ id: `price-${id}-${now}`, kind: 'price', productId: id, title: p.title, from: prev.price, to: p.price, at: now });
        changed = true;
      }
    }
    if (!prev || prev.stock !== stock || prev.price !== p.price) {
      snapshot[id] = { stock, price: p.price };
      changed = true;
    }
  });

  if (changed) {
    writeJson(SNAPSHOT_KEY, snapshot);
    writeJson(EVENTS_KEY, events.slice(-MAX_ITEMS));
  }
  return events;
}

export function buildNotifications({ orders = [], wishlistEvents = [], announcements = [] }) {
  const since = Date.now() - WINDOW_DAYS * 24 * 3600 * 1000;
  const list = [];

  orders.forEach((order) => {
    (order.statusHistory || []).forEach((h) => {
      const info = ORDER_STATUS_TEXT[h.status];
      if (!info) return;
      list.push({
        id: `order-${order.id}-${h.status}-${h.at}`,
        title: t('Đơn #{id} ' + info.text, { id: order.id }),
        at: h.at,
        action: { type: 'orders' }
      });
    });
    if (order.trackingCode && order.trackingAt) {
      list.push({
        id: `tracking-${order.id}-${order.trackingCode}`,
        title: t('Đơn #{id} có mã vận đơn {carrier} {code}', { id: order.id, carrier: order.carrier || '', code: order.trackingCode }).replace(/\s+/g, ' '),
        at: order.trackingAt,
        action: { type: 'orders' }
      });
    }
  });

  wishlistEvents.forEach((e) => {
    list.push({
      id: e.id,
      title: e.kind === 'restock'
        ? t('"{title}" trong danh sách yêu thích đã có hàng lại', { title: e.title })
        : t('"{title}" giảm giá từ {from} còn {to}', { title: e.title, from: formatMoney(e.from), to: formatMoney(e.to) }),
      at: e.at,
      action: { type: 'product', productId: e.productId }
    });
  });

  announcements.forEach((a) => {
    list.push({
      id: `announcement-${a.id}`,
      title: a.text,
      at: a.createdAt,
      action: a.couponCode ? { type: 'coupon', code: a.couponCode } : null
    });
  });

  return list
    .filter((n) => n.at && new Date(n.at).getTime() >= since)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, MAX_ITEMS);
}

// Thông báo của shop đang hiển thị: bật, chưa hết hạn
export function isAnnouncementLive(a, now = new Date()) {
  if (!a || a.active === false || !a.text) return false;
  if (a.endsAt && new Date(`${a.endsAt}T23:59:59`) < now) return false;
  return true;
}

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t('vừa xong');
  if (diff < 3600) return t('{n} phút trước', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('{n} giờ trước', { n: Math.floor(diff / 3600) });
  if (diff < 86400 * 7) return t('{n} ngày trước', { n: Math.floor(diff / 86400) });
  return new Date(iso).toLocaleDateString(getLocale());
}
