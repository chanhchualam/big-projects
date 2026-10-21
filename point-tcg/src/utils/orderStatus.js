// src/utils/orderStatus.js
// Các mốc tiến trình đơn hàng (hiển thị cho khách) và danh sách đơn vị vận chuyển (admin chọn khi nhập mã vận đơn)

export const TIMELINE_STEPS = [
  { key: 'placed', label: 'Đặt hàng', statuses: ['Chờ thanh toán QR (Đơn mới)', 'Chờ xác nhận (Đơn mới)', 'Khách báo đã chuyển khoản (Chờ xác nhận)'] },
  { key: 'paid', label: 'Đã thanh toán / xác nhận', statuses: ['Đã thanh toán (Chờ chuẩn bị hàng)'] },
  { key: 'packing', label: 'Đóng gói', statuses: ['Đang chuẩn bị hàng'] },
  { key: 'shipping', label: 'Đang giao', statuses: ['Đang giao hàng'] },
  { key: 'delivered', label: 'Đã giao', statuses: ['Giao thành công', 'Đã giao'] }
];

export const CANCELLED_STATUS = 'Đã huỷ';

// Vị trí hiện tại của đơn trên thanh tiến trình (-1 nếu không nhận ra trạng thái)
export function getTimelineIndex(status) {
  return TIMELINE_STEPS.findIndex((step) => step.statuses.includes(status));
}

// Thời điểm gần nhất đơn chuyển sang một mốc (lấy từ statusHistory)
export function getStepTime(order, step) {
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const hit = [...history].reverse().find((h) => step.statuses.includes(h.status));
  return hit ? new Date(hit.at) : null;
}

export const CARRIERS = [
  { value: 'GHN', label: 'Giao Hàng Nhanh (GHN)', trackUrl: (code) => `https://donhang.ghn.vn/?order_code=${encodeURIComponent(code)}` },
  { value: 'GHTK', label: 'Giao Hàng Tiết Kiệm (GHTK)', trackUrl: (code) => `https://i.ghtk.vn/${encodeURIComponent(code)}` },
  { value: 'Viettel Post', label: 'Viettel Post', trackUrl: () => 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/' },
  { value: 'J&T Express', label: 'J&T Express', trackUrl: () => 'https://jtexpress.vn/vi/tracking' },
  { value: 'SPX Express', label: 'SPX Express (Shopee)', trackUrl: () => 'https://spx.vn/track' },
  { value: 'VNPost', label: 'VNPost', trackUrl: () => 'https://www.vnpost.vn/tra-cuu-hanh-trinh/buu-pham' },
  { value: 'Khác', label: 'Khác / Shop tự giao', trackUrl: () => null }
];

export function getTrackingUrl(carrier, code) {
  const c = CARRIERS.find((x) => x.value === carrier);
  return c && code ? c.trackUrl(code) : null;
}
