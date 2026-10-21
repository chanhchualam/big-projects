// src/utils/currency.js
// Tỷ giá quy đổi giá USD của sản phẩm sang VNĐ — dùng chung cho trang sản phẩm, thanh toán, đơn hàng, thống kê.
// Đổi tỷ giá ở đây (và functions/pricing.js) là toàn bộ web đổi theo.
export const VND_RATE = 26500;

// Đơn cũ lưu tỷ giá lúc đặt; đơn trước khi có trường vndRate dùng 25.400
export const LEGACY_VND_RATE = 25400;
export const orderVndRate = (order) => Number(order?.vndRate) || LEGACY_VND_RATE;

// USD → VNĐ, làm tròn tới nghìn đồng
export function usdToVnd(usd) {
  return Math.round(((Number(usd) || 0) * VND_RATE) / 1000) * 1000;
}

export function formatVndAmount(vnd) {
  return `${Math.round(vnd || 0).toLocaleString('vi-VN')}₫`;
}
