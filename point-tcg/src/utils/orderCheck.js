// src/utils/orderCheck.js
// Đối chiếu giá trong đơn với giá sản phẩm hiện tại. Giá và tổng tiền do trình duyệt
// của khách gửi lên nên có thể bị sửa — admin xem cảnh báo này trước khi xác nhận đơn.
// Quy tắc phí ship / mã giảm giá phải khớp với CheckoutModal.
const VND_RATE = 25400;
const FREE_SHIPPING_THRESHOLD = 75;
const MAX_DISCOUNT_PERCENT = 10;
const TOLERANCE = 0.01;

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const differs = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) > TOLERANCE;

export function checkOrderPricing(order, products = []) {
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

  // 2. Phí ship
  const isExpress = (order.shippingMethod || '').includes('Hoả tốc');
  const expectedShipping = isExpress ? 15 : (expectedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 8.5);
  if (differs(order.shippingFee, expectedShipping)) {
    warnings.push(`Phí ship trong đơn ${money(order.shippingFee)}, đúng ra là ${money(expectedShipping)}.`);
  }

  // 3. Giảm giá tối đa 10% tạm tính
  const maxDiscount = expectedSubtotal * MAX_DISCOUNT_PERCENT / 100;
  if ((Number(order.discountAmount) || 0) > maxDiscount + TOLERANCE) {
    warnings.push(`Giảm giá ${money(order.discountAmount)} vượt mức tối đa ${MAX_DISCOUNT_PERCENT}% (${money(maxDiscount)}).`);
  }

  // 4. Tổng tiền phải khớp: tạm tính − giảm giá + ship, và số VNĐ trên mã QR
  const discount = Math.min(Number(order.discountAmount) || 0, maxDiscount);
  const expectedTotal = Math.max(0, expectedSubtotal - discount + expectedShipping);
  if (differs(order.total, expectedTotal)) {
    warnings.push(`Tổng tiền trong đơn ${money(order.total)}, tính lại ra ${money(expectedTotal)}.`);
  }
  if (order.amountVnd && Math.abs(order.amountVnd - Math.round((Number(order.total) || 0) * VND_RATE)) > VND_RATE * TOLERANCE) {
    warnings.push(`Số tiền VNĐ (${order.amountVnd.toLocaleString('vi-VN')} đ) không khớp với tổng ${money(order.total)}.`);
  }

  return {
    warnings,
    expectedTotal,
    expectedVnd: Math.round(expectedTotal * VND_RATE)
  };
}
