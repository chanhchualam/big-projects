// src/utils/preorder.js
// Đặt trước (pre-order) và giới hạn số lượng mỗi khách.
// Sản phẩm: preorder (bool), releaseDate ('YYYY-MM-DD'), depositPercent (10–100), preorderSlots (tổng suất),
//           maxPerCustomer (0 = không giới hạn; áp dụng cả hàng thường lẫn đặt trước).
// Số suất đã giữ nằm ở preorder_counts/{productId}.reserved (rules không cho vượt preorderSlots).
import { CANCELLED_STATUS } from './orderStatus';

export const isPreorderProduct = (p) => p?.preorder === true;

export const getMaxPerCustomer = (p) => Math.max(0, Number(p?.maxPerCustomer) || 0);

export function getDepositPercent(p) {
  const pct = Number(p?.depositPercent);
  return Number.isFinite(pct) ? Math.min(100, Math.max(10, Math.round(pct))) : 30;
}

export function getPreorderSlotsLeft(p) {
  const slots = Number(p?.preorderSlots) || 0;
  if (slots <= 0) return Infinity;
  return Math.max(0, slots - (Number(p?.preorderReserved) || 0));
}

const round2 = (n) => Math.round(n * 100) / 100;
export const depositUsdFor = (totalUsd, pct) => round2((Number(totalUsd) || 0) * pct / 100);

// Số lượng khách đã đặt sản phẩm này trong các đơn chưa huỷ
export function getOrderedQty(orders, productId) {
  return (orders || [])
    .filter((o) => o.status !== CANCELLED_STATUS)
    .reduce((sum, o) => sum + (o.items || [])
      .filter((i) => String(i.id) === String(productId))
      .reduce((s, i) => s + (Number(i.qty) || 0), 0), 0);
}

// Còn được mua thêm bao nhiêu (Infinity nếu không giới hạn); extraQty: đang nằm trong giỏ
export function getRemainingAllowance(product, orders, extraQty = 0) {
  const max = getMaxPerCustomer(product);
  if (!max) return Infinity;
  return Math.max(0, max - getOrderedQty(orders, product.id) - extraQty);
}

const normPhone = (s) => String(s || '').replace(/\D/g, '').replace(/^84/, '0');

// Admin: đơn này làm khách (cùng tài khoản hoặc cùng SĐT) vượt giới hạn mỗi khách không
export function checkPurchaseLimits(order, allOrders, products) {
  const warnings = [];
  if (!order || order.status === CANCELLED_STATUS) return { warnings };
  const phone = normPhone(order.customerPhone);
  const sameCustomer = (allOrders || []).filter((o) => o.status !== CANCELLED_STATUS
    && ((order.uid && o.uid === order.uid) || (phone && normPhone(o.customerPhone) === phone)));
  const seen = new Set();
  (order.items || []).forEach((item) => {
    const id = String(item.id);
    if (seen.has(id)) return;
    seen.add(id);
    const product = (products || []).find((p) => String(p.id) === id);
    const max = getMaxPerCustomer(product);
    if (!max) return;
    const total = getOrderedQty(sameCustomer, id);
    if (total > max) {
      warnings.push(`"${item.title}": khách này (cùng tài khoản hoặc SĐT) đã đặt ${total}, giới hạn ${max}/khách.`);
    }
  });
  return { warnings };
}

// 'YYYY-MM-DD' → ngày theo ngôn ngữ đang chọn (25/12/2026 hoặc 12/25/2026)
export function formatReleaseDate(dateStr, locale) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Admin: số suất thật đang giữ = tổng số lượng trong các đơn đặt trước chưa huỷ của sản phẩm
export function getPreorderReservedFromOrders(orders, productId) {
  return (orders || [])
    .filter((o) => o.isPreorder && String(o.preorderProductId) === String(productId) && o.status !== CANCELLED_STATUS)
    .reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0), 0);
}
