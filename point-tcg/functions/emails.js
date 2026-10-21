// functions/emails.js
// Nội dung email gửi khách: đặt hàng thành công và đơn đổi trạng thái
import { VND_RATE } from './pricing.js';

const SITE_URL = 'https://point-tcg.web.app';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vnd = (n) => `${Math.round(n || 0).toLocaleString('vi-VN')} đ`;

const STATUS_MESSAGES = {
  'Khách báo đã chuyển khoản (Chờ xác nhận)': 'Shop đã nhận được thông báo chuyển khoản của bạn và đang kiểm tra sao kê.',
  'Đã thanh toán (Chờ chuẩn bị hàng)': 'Shop đã xác nhận thanh toán. Đơn hàng sẽ sớm được đóng gói.',
  'Đang chuẩn bị hàng': 'Đơn hàng đang được đóng gói cẩn thận.',
  'Đang giao hàng': 'Đơn hàng đã được giao cho đơn vị vận chuyển.',
  'Giao thành công': 'Đơn hàng đã giao thành công. Cảm ơn bạn đã mua hàng! Bạn có thể đánh giá sản phẩm trong mục Tài khoản.',
  'Đã huỷ': 'Đơn hàng đã bị huỷ. Nếu bạn đã chuyển khoản, shop sẽ liên hệ để hoàn tiền.'
};

function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0053e2;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px">Point TCG</div>
    <div style="background:#fff;padding:20px;border-radius:0 0 12px 12px">
      <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>
      ${body}
      <p style="margin-top:24px;font-size:13px;color:#64748b">Xem đơn hàng: <a href="${SITE_URL}/#orders">${SITE_URL}/#orders</a></p>
    </div>
  </div></body></html>`;
}

function itemsTable(order) {
  const rows = (order.items || []).map((i) => `<tr>
    <td style="padding:6px 0">${escapeHtml(i.title)} × ${Number(i.qty) || 1}</td>
    <td style="padding:6px 0;text-align:right">${vnd((Number(i.price) || 0) * (Number(i.qty) || 1) * VND_RATE)}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
    <tr><td style="padding-top:10px;border-top:1px solid #e2e8f0"><strong>Tổng thanh toán</strong></td>
    <td style="padding-top:10px;border-top:1px solid #e2e8f0;text-align:right"><strong>${vnd(order.serverAmountVnd || order.amountVnd)}</strong></td></tr></table>`;
}

export function orderPlacedEmail(order) {
  const isQr = (order.paymentMethod || '').includes('QR') || (order.paymentMethod || '').includes('Chuyển Khoản');
  const payment = isQr
    ? `<p>Vui lòng chuyển khoản <strong>${vnd(order.serverAmountVnd || order.amountVnd)}</strong> với nội dung
       <strong style="background:#eff6ff;padding:2px 6px;border-radius:4px">PTCG ${escapeHtml(order.id)}</strong>.
       Đơn sẽ tự động được xác nhận khi shop nhận được tiền.</p>`
    : '<p>Bạn sẽ thanh toán khi nhận hàng (COD). Shop sẽ liên hệ xác nhận đơn.</p>';
  return {
    subject: `[Point TCG] Đã nhận đơn hàng #${order.id}`,
    html: layout(`Cảm ơn ${order.customerName || 'bạn'} đã đặt hàng!`, `
      <p>Mã đơn: <strong>#${escapeHtml(order.id)}</strong></p>
      ${itemsTable(order)}
      ${payment}
      <p style="font-size:14px">Giao tới: ${escapeHtml(order.shippingAddress)}</p>`)
  };
}

export function statusChangedEmail(order) {
  const tracking = order.trackingCode
    ? `<p>Mã vận đơn: <strong>${escapeHtml(order.carrier || '')} ${escapeHtml(order.trackingCode)}</strong></p>`
    : '';
  return {
    subject: `[Point TCG] Đơn #${order.id}: ${order.status}`,
    html: layout(`Đơn hàng #${order.id}: ${order.status}`, `
      <p>${escapeHtml(STATUS_MESSAGES[order.status] || 'Trạng thái đơn hàng của bạn vừa được cập nhật.')}</p>
      ${tracking}
      ${itemsTable(order)}`)
  };
}

// Email khách vãng lai không nhập email được tạo dạng "<sđt>@guest.pointtcg.com" — không gửi
export function canEmail(address) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address || '') && !address.endsWith('@guest.pointtcg.com');
}
