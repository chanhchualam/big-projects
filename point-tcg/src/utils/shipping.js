// src/utils/shipping.js
// Phí vận chuyển tính bằng VNĐ theo mức phổ biến của các đơn vị giao hàng (GHN, GHTK, Viettel Post)
// cho gói nhỏ. Đơn nhiều sản phẩm nặng hơn nên có phụ thu: 1–4 sản phẩm tính phí cơ bản,
// từ sản phẩm thứ 5 cứ mỗi 2 sản phẩm (5–6, 7–8, ...) cộng thêm một mức phụ thu.
// Phải khớp với functions/pricing.js và apps-script/sepay.gs (server tính lại giá đơn).
import { VND_RATE } from './currency';

export const SHIPPING_RATES = {
  standard: { baseVnd: 30000, surchargeVnd: 15000 },
  express: { baseVnd: 50000, surchargeVnd: 25000 }
};
export const BASE_ITEMS = 4;
export const SURCHARGE_STEP_ITEMS = 2;
// Đơn từ $75 được miễn phí giao tiêu chuẩn
export const FREE_SHIPPING_THRESHOLD = 75;
// Đơn tạo trước khi có bảng phí này (không có shippingVersion) tính theo phí cũ: $8.5 / $15
export const SHIPPING_VERSION = 2;

export const countItems = (items = []) => items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

export function surchargeSteps(itemCount) {
  return itemCount > BASE_ITEMS ? Math.ceil((itemCount - BASE_ITEMS) / SURCHARGE_STEP_ITEMS) : 0;
}

// Phí ship (VNĐ) trước khi xét miễn phí
export function shippingFeeVnd(method, itemCount) {
  const rate = SHIPPING_RATES[method] || SHIPPING_RATES.standard;
  return rate.baseVnd + surchargeSteps(itemCount) * rate.surchargeVnd;
}

export function isFreeStandardShipping(subtotalUsd, freeShipCoupon) {
  return subtotalUsd >= FREE_SHIPPING_THRESHOLD || !!freeShipCoupon;
}

// Phí ship tính bằng USD (đơn vị lưu giá trong đơn); quy đổi đúng ra số VNĐ ở trên
export function shippingFeeUsd(method, itemCount, subtotalUsd, freeShipCoupon) {
  if (method === 'standard' && isFreeStandardShipping(subtotalUsd, freeShipCoupon)) return 0;
  return shippingFeeVnd(method, itemCount) / VND_RATE;
}

// Phí ship đúng của một đơn đã lưu (đơn cũ dùng bảng phí cũ)
export function expectedOrderShippingUsd(order, subtotalUsd, freeShipCoupon) {
  const isExpress = (order.shippingMethod || '').includes('Hoả tốc');
  if (order.shippingVersion !== SHIPPING_VERSION) {
    return isExpress ? 15 : (isFreeStandardShipping(subtotalUsd, freeShipCoupon) ? 0 : 8.5);
  }
  return shippingFeeUsd(isExpress ? 'express' : 'standard', countItems(order.items), subtotalUsd, freeShipCoupon);
}
