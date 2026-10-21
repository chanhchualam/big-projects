// functions/pricing.js
// Tính lại giá đơn phía server từ giá sản phẩm + mã giảm giá trong Firestore.
// Quy tắc phải khớp với CheckoutModal.jsx và src/utils/orderCheck.js.
// Phải khớp với src/utils/currency.js
export const VND_RATE = 26500;
const FREE_SHIPPING_THRESHOLD = 75;
const EXPRESS_FEE = 15;
const STANDARD_FEE = 8.5;
const TOLERANCE = 0.01;

const round2 = (n) => Math.round(n * 100) / 100;

// productsById: Map(id -> { price }) ; coupon: dữ liệu coupons/{code} hoặc null
export function computeOrderPrice(order, productsById, coupon) {
  const issues = [];

  let subtotal = 0;
  for (const item of order.items || []) {
    const qty = Number(item.qty);
    const product = productsById.get(String(item.id));
    if (!product) {
      issues.push(`Sản phẩm "${item.title}" (${item.id}) không tồn tại`);
      continue;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      issues.push(`Số lượng không hợp lệ cho "${item.title}": ${item.qty}`);
      continue;
    }
    if (Math.abs((Number(item.price) || 0) - product.price) > TOLERANCE) {
      issues.push(`Đơn giá "${item.title}" trong đơn ${item.price}, giá thật ${product.price}`);
    }
    subtotal += product.price * qty;
  }

  let percent = 0;
  let freeShip = false;
  if (order.couponCode) {
    if (coupon && coupon.active !== false) {
      percent = Math.min(100, Math.max(0, Number(coupon.percent) || 0));
      freeShip = !!coupon.freeShip;
    } else {
      issues.push(`Mã giảm giá "${order.couponCode}" không hợp lệ`);
    }
  }

  const isExpress = (order.shippingMethod || '').includes('Hoả tốc');
  const shippingFee = isExpress ? EXPRESS_FEE : (subtotal >= FREE_SHIPPING_THRESHOLD || freeShip ? 0 : STANDARD_FEE);
  const discount = subtotal * percent / 100;
  const total = round2(Math.max(0, subtotal - discount + shippingFee));
  const amountVnd = Math.round((total * VND_RATE) / 1000) * 1000;

  if (Math.abs((Number(order.total) || 0) - total) > TOLERANCE) {
    issues.push(`Tổng tiền trong đơn ${order.total}, server tính ra ${total}`);
  }

  return { subtotal: round2(subtotal), shippingFee, discount: round2(discount), total, amountVnd, issues };
}

// Lấy mã đơn từ nội dung chuyển khoản, VD "PTCG PTCG-12345678" hoặc "PTCG PTCG12345678" (ngân hàng hay bỏ dấu "-")
export function parseOrderIdFromContent(content) {
  const matches = [...String(content || '').toUpperCase().matchAll(/PTCG-?(\d{6,8})/g)];
  return matches.map((m) => `PTCG-${m[1]}`);
}
