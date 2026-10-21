// src/utils/orderCheck.js
// Đối chiếu giá trong đơn với giá sản phẩm hiện tại. Giá và tổng tiền do trình duyệt
// của khách gửi lên nên có thể bị sửa — admin xem cảnh báo này trước khi xác nhận đơn.
// Quy tắc phí ship / mã giảm giá phải khớp với CheckoutModal.
import { orderVndRate } from './currency';

const FREE_SHIPPING_THRESHOLD = 75;
const LEGACY_MAX_DISCOUNT_PERCENT = 10; // đơn cũ trước khi có bảng coupons
const TOLERANCE = 0.01;

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const differs = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) > TOLERANCE;

// Lý do mã giảm giá không dùng được (null nếu hợp lệ)
export function getCouponError(coupon, subtotal) {
  if (!coupon) return 'Mã giảm giá không tồn tại.';
  if (coupon.active === false) return 'Mã giảm giá đã bị tắt.';
  if (coupon.expiresAt && new Date(`${coupon.expiresAt}T23:59:59`) < new Date()) return 'Mã giảm giá đã hết hạn.';
  if (coupon.maxUses > 0 && (coupon.usedCount || 0) >= coupon.maxUses) return 'Mã giảm giá đã hết lượt sử dụng.';
  if (coupon.minOrder > 0 && subtotal < coupon.minOrder) return `Mã chỉ áp dụng cho đơn từ ${money(coupon.minOrder)}.`;
  return null;
}

export function checkOrderPricing(order, products = [], coupons = null) {
  const warnings = [];
  const byId = new Map(products.map((p) => [String(p.id), p]));

  // 1. Đơn giá từng món so với giá sản phẩm hiện tại
  let expectedSubtotal = 0;
  (order.items || []).forEach((item) => {
    const qty = Number(item.qty) || 0;
    const product = byId.get(String(item.id));
    if (!product) {
      warnings.push(`"${item.title}" không có trong danh sách sản phẩm — không đối chiếu được giá.`);
      expectedSubtotal += (Number(item.price) || 0) * qty;
      return;
    }
    if (differs(item.price, product.price)) {
      warnings.push(`"${item.title}": đơn giá trong đơn ${money(item.price)}, giá hiện tại ${money(product.price)}.`);
    }
    if (!(qty >= 1) || !Number.isInteger(qty)) {
      warnings.push(`"${item.title}": số lượng không hợp lệ (${item.qty}).`);
    }
    expectedSubtotal += (Number(product.price) || 0) * qty;
  });

  if (differs(order.subtotal, expectedSubtotal)) {
    warnings.push(`Tạm tính trong đơn ${money(order.subtotal)}, tính lại theo giá hiện tại ${money(expectedSubtotal)}.`);
  }

  // 2. Mã giảm giá: đơn mới có trường couponCode ('' = không dùng mã)
  let maxPercent = 0;
  let freeShip = false;
  if (order.couponCode === undefined) {
    maxPercent = LEGACY_MAX_DISCOUNT_PERCENT;
  } else if (order.couponCode) {
    const coupon = Array.isArray(coupons) ? coupons.find((c) => c.code === order.couponCode) : null;
    if (coupon) {
      maxPercent = Number(coupon.percent) || 0;
      freeShip = !!coupon.freeShip;
    } else if (Array.isArray(coupons)) {
      warnings.push(`Mã giảm giá "${order.couponCode}" không còn tồn tại.`);
    } else {
      // Chưa tải được danh sách mã → không đối chiếu phần giảm giá
      maxPercent = 100;
      freeShip = true;
    }
  }

  // 3. Phí ship
  const isExpress = (order.shippingMethod || '').includes('Hoả tốc');
  const expectedShipping = isExpress ? 15 : (expectedSubtotal >= FREE_SHIPPING_THRESHOLD || freeShip ? 0 : 8.5);
  if (differs(order.shippingFee, expectedShipping)) {
    warnings.push(`Phí ship trong đơn ${money(order.shippingFee)}, đúng ra là ${money(expectedShipping)}.`);
  }

  // 4. Giảm giá không vượt mức của mã
  const maxDiscount = expectedSubtotal * maxPercent / 100;
  if ((Number(order.discountAmount) || 0) > maxDiscount + TOLERANCE) {
    warnings.push(order.couponCode
      ? `Giảm giá ${money(order.discountAmount)} vượt mức của mã ${order.couponCode} (${maxPercent}% = ${money(maxDiscount)}).`
      : `Giảm giá ${money(order.discountAmount)} nhưng đơn không dùng mã giảm giá hợp lệ.`);
  }

  // 5. Tổng tiền phải khớp: tạm tính − giảm giá + ship, và số VNĐ trên mã QR
  const discount = Math.min(Number(order.discountAmount) || 0, maxDiscount);
  const expectedTotal = Math.max(0, expectedSubtotal - discount + expectedShipping);
  if (differs(order.total, expectedTotal)) {
    warnings.push(`Tổng tiền trong đơn ${money(order.total)}, tính lại ra ${money(expectedTotal)}.`);
  }
  // So với tỷ giá lúc đặt đơn; cho lệch tối đa 1.000đ do làm tròn tới nghìn
  const rate = orderVndRate(order);
  if (order.amountVnd && Math.abs(order.amountVnd - (Number(order.total) || 0) * rate) > 1000) {
    warnings.push(`Số tiền VNĐ (${order.amountVnd.toLocaleString('vi-VN')} đ) không khớp với tổng ${money(order.total)}.`);
  }

  return {
    warnings,
    expectedTotal,
    expectedVnd: order.vndRate ? Math.round((expectedTotal * rate) / 1000) * 1000 : Math.round(expectedTotal * rate)
  };
}
