/**
 * Point TCG — báo đơn mới qua Gmail (miễn phí, không cần Firebase Blaze).
 * Cách cài: xem hướng dẫn trong tin nhắn; tóm tắt:
 *   script.google.com → Dự án mới → dán toàn bộ file này → Triển khai → Tùy chọn triển khai mới
 *   → Loại: Ứng dụng web, Thực thi với tư cách: Tôi, Ai có quyền truy cập: Bất kỳ ai → Triển khai.
 * Email được gửi tới chính Gmail đang chạy script (Gmail của shop).
 */
var PROJECT_ID = 'point-tcg';
var MAX_ORDER_AGE_MINUTES = 30; // chỉ báo đơn vừa tạo, không báo lại đơn cũ

function doPost(e) {
  // SePay báo có tiền vào (link có ?key=...): xử lý trong sepay.gs
  if (e && e.parameter && e.parameter.key) return handleSepay(e);
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var orderId = String(body.orderId || '');
    if (!/^PTCG-[0-9]{6,10}$/.test(orderId) || !body.idToken) return reply('bad request');

    // Mỗi đơn chỉ báo một lần
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('sent_' + orderId)) return reply('already sent');

    // Đọc đơn bằng phiên đăng nhập của khách: Firestore rules chỉ cho chủ đơn đọc,
    // nên đơn không có thật hoặc không phải của người gửi sẽ bị từ chối ở đây.
    var res = UrlFetchApp.fetch(
      'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
        '/databases/(default)/documents/orders/' + encodeURIComponent(orderId),
      { headers: { Authorization: 'Bearer ' + body.idToken }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return reply('not allowed');
    var order = fromFields(JSON.parse(res.getContentText()).fields || {});

    var first = (order.statusHistory && order.statusHistory[0]) || {};
    var createdAt = new Date(first.at || 0).getTime();
    if (!createdAt || Date.now() - createdAt > MAX_ORDER_AGE_MINUTES * 60 * 1000) return reply('too old');

    sendMail(order);
    props.setProperty('sent_' + orderId, String(Date.now()));
    return reply('ok');
  } catch (err) {
    return reply('error');
  }
}

function sendMail(o) {
  var vnd = function (n) { return Number(n || 0).toLocaleString('vi-VN') + '₫'; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var rate = Number(o.vndRate) || 26500;
  var rows = (o.items || []).map(function (it) {
    var line = Math.round((Number(it.price) || 0) * (Number(it.qty) || 1) * rate / 1000) * 1000;
    return '<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">' + esc(it.title) +
      '</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">' + esc(it.qty) +
      '</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">' + vnd(line) + '</td></tr>';
  }).join('');

  var pre = o.isPreorder
    ? '<p style="background:#f3e8ff;padding:8px 12px;border-radius:8px"><b>ĐẶT TRƯỚC</b> — tiền cọc ' +
      vnd(o.depositVnd) + ' (' + esc(o.depositPercent) + '%), phát hành ' + esc(o.releaseDate) + '</p>'
    : '';

  var html =
    '<div style="font-family:Arial,sans-serif;max-width:560px;color:#111827">' +
    '<h2 style="color:#2563eb;margin:0 0 8px">Đơn mới ' + esc(o.id) + '</h2>' + pre +
    '<p><b>Khách:</b> ' + esc(o.customerName) + ' — ' + esc(o.customerPhone) + '<br>' +
    '<b>Email:</b> ' + esc(o.customerEmail) + '<br>' +
    '<b>Địa chỉ:</b> ' + esc(o.shippingAddress) + '<br>' +
    '<b>Thanh toán:</b> ' + esc(o.paymentMethod) + '<br>' +
    '<b>Giao hàng:</b> ' + esc(o.shippingMethod) +
    (o.couponCode ? '<br><b>Mã giảm giá:</b> ' + esc(o.couponCode) : '') +
    (o.orderNotes ? '<br><b>Ghi chú:</b> ' + esc(o.orderNotes) : '') + '</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
    '<tr style="background:#eff6ff"><th style="padding:6px 8px;text-align:left">Sản phẩm</th><th style="padding:6px 8px">SL</th><th style="padding:6px 8px;text-align:right">Tiền</th></tr>' +
    rows + '</table>' +
    '<p style="font-size:16px;text-align:right"><b>Tổng: ' + vnd(o.amountVnd) + '</b></p>' +
    '<p><a href="https://point-tcg.web.app/#admin" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Mở trang quản trị</a></p>' +
    '</div>';

  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: '🛒 Đơn mới ' + o.id + ' — ' + (o.customerName || '') + ' — ' + vnd(o.amountVnd) + (o.isPreorder ? ' (Đặt trước)' : ''),
    htmlBody: html
  });
}

// Chuyển dữ liệu Firestore REST sang object thường
function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}
function fromFields(fields) {
  var out = {};
  for (var k in fields) out[k] = fromValue(fields[k]);
  return out;
}

function reply(text) {
  return ContentService.createTextOutput(text);
}

// Chạy hàm này 1 lần trong trình soạn thảo để cấp quyền gửi Gmail và nhận email thử
function guiThu() {
  sendMail({
    id: 'PTCG-THU', customerName: 'Khách thử', customerPhone: '0900000000', customerEmail: 'khach@example.com',
    shippingAddress: 'Địa chỉ thử', paymentMethod: 'Chuyển Khoản Ngân Hàng / VietQR', shippingMethod: 'Tiêu chuẩn',
    items: [{ title: 'Sản phẩm thử', qty: 1, price: 10 }], amountVnd: 265000, vndRate: 26500
  });
}
