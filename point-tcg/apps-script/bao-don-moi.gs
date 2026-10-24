/**
 * Point TCG — báo đơn mới qua Gmail (miễn phí, không cần Firebase Blaze).
 * Cách cài: xem hướng dẫn trong tin nhắn; tóm tắt:
 *   script.google.com → Dự án mới → dán toàn bộ file này → Triển khai → Tùy chọn triển khai mới
 *   → Loại: Ứng dụng web, Thực thi với tư cách: Tôi, Ai có quyền truy cập: Bất kỳ ai → Triển khai.
 * Email được gửi tới chính Gmail đang chạy script (Gmail của shop).
 */
var PROJECT_ID = 'point-tcg';
var MAX_ORDER_AGE_MINUTES = 30; // chỉ báo đơn vừa tạo / vừa báo chuyển khoản, không báo lại đơn cũ
// Khách báo đã chuyển khoản (hoặc hết 1 phút giữ mã QR) → shop kiểm tra tài khoản rồi xác nhận
var REPORTED_STATUSES = ['Khách báo đã chuyển khoản (Chờ xác nhận)', 'Khách báo đã chuyển cọc (Chờ xác nhận)'];

function doPost(e) {
  // SePay báo có tiền vào (link có ?key=...): xử lý trong sepay.gs
  if (e && e.parameter && e.parameter.key) return handleSepay(e);
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var orderId = String(body.orderId || '');
    if (!/^PTCG-[0-9]{6,10}$/.test(orderId) || !body.idToken) return reply('bad request');

    // event: 'created' = đơn mới (COD), 'reported' = khách báo đã chuyển khoản
    var event = body.event === 'reported' ? 'reported' : 'created';
    var props = PropertiesService.getScriptProperties();
    if (event === 'created' && props.getProperty('sent_' + orderId)) return reply('already sent');

    // Đọc đơn bằng phiên đăng nhập của khách: Firestore rules chỉ cho chủ đơn đọc,
    // nên đơn không có thật hoặc không phải của người gửi sẽ bị từ chối ở đây.
    var res = UrlFetchApp.fetch(
      'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
        '/databases/(default)/documents/orders/' + encodeURIComponent(orderId),
      { headers: { Authorization: 'Bearer ' + body.idToken }, muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return reply('not allowed');
    var order = fromFields(JSON.parse(res.getContentText()).fields || {});

    var history = order.statusHistory || [];
    var mark = (event === 'created' ? history[0] : history[history.length - 1]) || {};
    var at = new Date(mark.at || 0).getTime();
    if (!at || Date.now() - at > MAX_ORDER_AGE_MINUTES * 60 * 1000) return reply('too old');

    // Mỗi đơn chỉ báo một lần cho mỗi lần chuyển (đặt trước: lần cọc và lần trả phần còn lại)
    var sentKey = event === 'created' ? 'sent_' + orderId : 'sent_reported_' + orderId + '_' + order.status;
    if (event === 'reported') {
      if (REPORTED_STATUSES.indexOf(order.status) < 0) return reply('not reported');
      if (props.getProperty(sentKey)) return reply('already sent');
    }

    sendMail(order, event);
    props.setProperty(sentKey, String(Date.now()));
    return reply('ok');
  } catch (err) {
    return reply('error');
  }
}

function sendMail(o, event) {
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

  // Số tiền khách cần chuyển ở lần này (đặt trước: tiền cọc hoặc phần còn lại)
  var reported = event === 'reported';
  var isDepositReport = reported && o.status === REPORTED_STATUSES[1];
  var dueVnd = isDepositReport ? o.depositVnd
    : (reported && o.isPreorder ? Number(o.amountVnd || 0) - Number(o.depositVnd || 0) : o.amountVnd);
  var payBox = reported
    ? '<div style="background:#fef9c3;border:1px solid #fde047;padding:12px 14px;border-radius:10px;margin:8px 0 12px">' +
      '<b>Khách báo đã chuyển ' + vnd(dueVnd) + (isDepositReport ? ' (tiền cọc)' : '') + '</b><br>' +
      'Nội dung chuyển khoản: <b>PTCG ' + esc(o.id) + '</b><br>' +
      'Hãy kiểm tra tài khoản ngân hàng. Đã nhận đủ tiền thì vào trang quản trị bấm <b>' +
      (isDepositReport ? 'Xác Nhận Đã Nhận Cọc' : 'Xác Nhận Đã Nhận Đủ Tiền') +
      '</b>; không thấy tiền thì liên hệ khách hoặc huỷ đơn.</div>'
    : '';

  var html =
    '<div style="font-family:Arial,sans-serif;max-width:560px;color:#111827">' +
    '<h2 style="color:#2563eb;margin:0 0 8px">' + (reported ? 'Kiểm tra chuyển khoản ' : 'Đơn mới ') + esc(o.id) + '</h2>' + payBox + pre +
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
    subject: reported
      ? '💰 Khách báo đã chuyển ' + vnd(dueVnd) + ' — đơn ' + o.id + ' — kiểm tra tài khoản'
      : '🛒 Đơn mới ' + o.id + ' — ' + (o.customerName || '') + ' — ' + vnd(o.amountVnd) + (o.isPreorder ? ' (Đặt trước)' : ''),
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

// Chạy hàm này trong trình soạn thảo để cấp quyền gửi Gmail và nhận email thử (mẫu "khách báo đã chuyển khoản")
function guiThu() {
  sendMail({
    id: 'PTCG-THU', customerName: 'Khách thử', customerPhone: '0900000000', customerEmail: 'khach@example.com',
    shippingAddress: 'Địa chỉ thử', paymentMethod: 'Chuyển Khoản Ngân Hàng / VietQR', shippingMethod: 'Tiêu chuẩn',
    items: [{ title: 'Sản phẩm thử', qty: 1, price: 10 }], amountVnd: 265000, vndRate: 26500,
    status: 'Khách báo đã chuyển khoản (Chờ xác nhận)'
  }, 'reported');
}
