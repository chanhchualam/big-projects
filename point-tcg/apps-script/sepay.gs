/**
 * Point TCG — tự xác nhận chuyển khoản qua SePay (miễn phí, không cần Firebase Blaze).
 * SePay báo có tiền vào tài khoản → script tìm đơn theo nội dung chuyển khoản "PTCG-xxxxxxxx",
 * tự tính lại giá đơn từ giá sản phẩm thật (khách không sửa số tiền được), đủ tiền thì chuyển trạng thái:
 *   Đơn thường : Chờ thanh toán / Khách báo đã CK  → Đã thanh toán (Chờ chuẩn bị hàng) + trừ tồn kho
 *   Đặt trước  : Chờ đặt cọc / Khách báo đã cọc     → Đã cọc (Chờ hàng về)
 *                Hàng đã về / Khách báo đã CK       → Đã thanh toán (Chờ chuẩn bị hàng)
 * Thiếu tiền / giá không khớp → không đổi trạng thái, ghi chú "cần admin kiểm tra" vào đơn.
 * Script ghi Firestore bằng quyền Google của chủ shop (tài khoản chạy script phải là Owner/Editor
 * của dự án Firebase point-tcg), nên cần tệp appsscript.json có quyền "datastore".
 */
// Hàm (không phải biến) vì PROJECT_ID nằm ở file khác, thứ tự nạp file không cố định
function fsBase() {
  return 'https://firestore.googleapis.com/v1/' + docRoot();
}
function docRoot() {
  return 'projects/' + PROJECT_ID + '/databases/(default)/documents';
}

var ST_PAID = 'Đã thanh toán (Chờ chuẩn bị hàng)';
var ST_REPORTED_PAID = 'Khách báo đã chuyển khoản (Chờ xác nhận)';
var ST_AWAITING = ['Chờ thanh toán QR (Đơn mới)', ST_REPORTED_PAID];
var ST_PRE_AWAIT_DEPOSIT = 'Chờ đặt cọc (Đặt trước)';
var ST_PRE_DEPOSIT_REPORTED = 'Khách báo đã chuyển cọc (Chờ xác nhận)';
var ST_PRE_DEPOSIT_PAID = 'Đã cọc (Chờ hàng về)';
var ST_PRE_ARRIVED = 'Hàng đã về (Chờ thanh toán phần còn lại)';

// Phải khớp với functions/pricing.js và src/utils/currency.js
var VND_RATE = 26500;
var FREE_SHIPPING_THRESHOLD = 75;
// Phí ship VNĐ, từ sản phẩm thứ 5 cứ mỗi 2 sản phẩm cộng một mức phụ thu (khớp src/utils/shipping.js)
var SHIPPING_VERSION = 2;
var SHIPPING_RATES = { standard: { baseVnd: 30000, surchargeVnd: 15000 }, express: { baseVnd: 50000, surchargeVnd: 25000 } };

function shippingFeeOf(order, subtotal, freeShip) {
  var isExpress = String(order.shippingMethod || '').indexOf('Hoả tốc') >= 0;
  var free = subtotal >= FREE_SHIPPING_THRESHOLD || freeShip;
  if (order.shippingVersion !== SHIPPING_VERSION) return isExpress ? 15 : (free ? 0 : 8.5); // đơn cũ
  if (!isExpress && free) return 0;
  var items = (order.items || []).reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
  var steps = items > 4 ? Math.ceil((items - 4) / 2) : 0;
  var rate = SHIPPING_RATES[isExpress ? 'express' : 'standard'];
  return (rate.baseVnd + steps * rate.surchargeVnd) / VND_RATE;
}
var TOLERANCE = 0.01;

// Chạy 1 lần trong trình soạn thảo: tạo khoá bí mật và in ra link webhook để dán vào SePay
function taoLinkSePay() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('SEPAY_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('SEPAY_KEY', key);
  }
  // Kiểm tra luôn quyền ghi Firestore
  fsGet('payments/kiem-tra-quyen');
  Logger.log('Dán link này vào SePay › Webhooks › URL nhận webhook:\n' + ScriptApp.getService().getUrl() + '?key=' + key);
}

function handleSepay(e) {
  var key = PropertiesService.getScriptProperties().getProperty('SEPAY_KEY');
  if (!key || e.parameter.key !== key) return json({ success: false, message: 'Unauthorized' });

  var tx = JSON.parse((e.postData && e.postData.contents) || '{}');
  if (tx.transferType !== 'in' || !tx.id) return json({ success: true, message: 'ignored' });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var result = processSepayTransaction(tx);
    return json({ success: true, result: result });
  } catch (err) {
    console.error('SePay ' + tx.id + ': ' + err);
    return json({ success: false });
  } finally {
    lock.releaseLock();
  }
}

function processSepayTransaction(tx) {
  var paymentPath = 'payments/' + String(tx.id);
  for (var attempt = 0; attempt < 3; attempt++) {
    // Mỗi giao dịch SePay chỉ xử lý một lần (SePay có thể gửi lại)
    if (fsGet(paymentPath)) return 'duplicate';

    var record = {
      amount: Number(tx.transferAmount) || 0,
      content: tx.content || '',
      gateway: tx.gateway || '',
      referenceCode: tx.referenceCode || '',
      transactionDate: tx.transactionDate || '',
      receivedAt: new Date().toISOString(),
      orderId: null
    };

    var orderDoc = null;
    var ids = parseOrderIdFromContent(tx.content || tx.description);
    for (var i = 0; i < ids.length && !orderDoc; i++) orderDoc = fsGet('orders/' + ids[i]);

    if (!orderDoc) {
      record.result = 'no_order';
      if (fsCommit([createOnly(paymentPath, record)])) return 'no_order';
      continue;
    }

    var order = orderDoc.data;
    record.orderId = order.id || orderDoc.id;
    var plan = planOrderUpdate(order, record.amount);
    record.result = plan.outcome;

    var writes = [createOnly(paymentPath, record)];
    var orderWrite = {
      update: { name: docName('orders/' + orderDoc.id), fields: toFields(plan.fields) },
      updateMask: { fieldPaths: Object.keys(plan.fields).map(quotePath) },
      currentDocument: { updateTime: orderDoc.updateTime }
    };
    if (plan.status) {
      orderWrite.updateTransforms = [{
        fieldPath: 'statusHistory',
        appendMissingElements: { values: [toValue({ status: plan.status, at: new Date().toISOString() })] }
      }];
    }
    writes.push(orderWrite);
    (plan.stock || []).forEach(function (s) {
      writes.push({
        transform: {
          document: docName('products/' + s.id),
          fieldTransforms: [{ fieldPath: 'stock', increment: { integerValue: String(-s.qty) } }]
        },
        currentDocument: { exists: true }
      });
    });

    if (fsCommit(writes)) {
      console.log('SePay ' + tx.id + ' → ' + record.orderId + ': ' + plan.outcome);
      return plan.outcome;
    }
    // Đơn vừa bị sửa cùng lúc (admin thao tác) → đọc lại và thử lại
  }
  throw new Error('commit failed');
}

// Quyết định cập nhật đơn: trả về { outcome, status, fields, stock }
function planOrderUpdate(order, amount) {
  var now = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'HH:mm:ss d/M/yyyy');
  var isDeposit = order.isPreorder && [ST_PRE_AWAIT_DEPOSIT, ST_PRE_DEPOSIT_REPORTED].indexOf(order.status) >= 0;
  var isRemaining = order.isPreorder && [ST_PRE_ARRIVED, ST_REPORTED_PAID].indexOf(order.status) >= 0;
  var isNormal = !order.isPreorder && ST_AWAITING.indexOf(order.status) >= 0;
  var note = function (outcome, extra) {
    return {
      outcome: outcome,
      fields: { paymentNote: 'SePay ' + amount.toLocaleString('vi-VN') + ' đ (' + outcome + ')' + (extra ? ': ' + extra : '') + ' — cần admin kiểm tra' }
    };
  };
  if (!isDeposit && !isRemaining && !isNormal) return note('not_awaiting');

  // Giá do server tính: lần đầu tính từ giá sản phẩm thật rồi lưu lại vào đơn
  // (đặt trước trả phần còn lại sau khi hàng về dùng lại giá đã chốt lúc cọc)
  var verified = {};
  var products = null;
  if (order.serverAmountVnd == null || order.priceVerified !== true) {
    var priced = priceOrder(order, isDeposit);
    products = priced.products;
    verified = {
      serverTotal: priced.total,
      serverAmountVnd: priced.amountVnd,
      priceVerified: priced.issues.length === 0,
      priceIssues: priced.issues
    };
    if (priced.depositVnd !== null) verified.serverDepositVnd = priced.depositVnd;
    if (priced.issues.length) {
      var bad = note('price_mismatch', priced.issues.join('; '));
      bad.fields = merge(bad.fields, verified);
      return bad;
    }
  }
  var fullVnd = verified.serverAmountVnd != null ? verified.serverAmountVnd : order.serverAmountVnd;
  var depositVnd = verified.serverDepositVnd != null ? verified.serverDepositVnd
    : (order.serverDepositVnd != null ? order.serverDepositVnd : 0);
  var required = isDeposit ? depositVnd : isRemaining ? fullVnd - depositVnd : fullVnd;
  if (amount < required) {
    var under = note('underpaid', 'cần ' + required.toLocaleString('vi-VN') + ' đ');
    under.fields = merge(under.fields, verified);
    return under;
  }

  if (isDeposit) {
    return {
      outcome: 'deposit_paid',
      status: ST_PRE_DEPOSIT_PAID,
      fields: merge(verified, { status: ST_PRE_DEPOSIT_PAID, paidAmount: amount, paymentRef: 'sepay', updatedAt: now })
    };
  }

  var fields = merge(verified, {
    status: ST_PAID,
    // Đặt trước: cộng dồn tiền cọc + phần còn lại
    paidAmount: order.isPreorder ? (Number(order.paidAmount) || 0) + amount : amount,
    paymentRef: 'sepay',
    updatedAt: now
  });
  // Trừ tồn kho như khi admin xác nhận (đơn cũ không có cờ = đã trừ lúc đặt; đặt trước đã trừ khi hàng về)
  var stock = [];
  if (order.stockDeducted === false && !order.isPreorder) {
    products = products || loadProducts(order);
    (order.items || []).forEach(function (item) {
      if (item.id && products[String(item.id)]) stock.push({ id: String(item.id), qty: Number(item.qty) || 1 });
    });
    fields.stockDeducted = true;
  }
  return { outcome: 'paid', status: ST_PAID, fields: fields, stock: stock };
}

function loadProducts(order) {
  var out = {};
  (order.items || []).concat(order.preorderProductId ? [{ id: order.preorderProductId }] : []).forEach(function (item) {
    var id = String(item.id);
    if (!(id in out)) {
      var d = fsGet('products/' + id);
      out[id] = d ? d.data : null;
    }
  });
  return out;
}

// Tính lại giá đơn từ giá sản phẩm + mã giảm giá trong Firestore (giống functions/pricing.js)
// checkPreorderOpen: chỉ khi trả cọc; trả phần còn lại sau khi hàng về thì sản phẩm có thể đã thôi đặt trước
function priceOrder(order, checkPreorderOpen) {
  var products = loadProducts(order);
  var issues = [];
  var subtotal = 0;
  (order.items || []).forEach(function (item) {
    var qty = Number(item.qty);
    var product = products[String(item.id)];
    if (!product) return issues.push('Sản phẩm "' + item.title + '" không tồn tại');
    if (!(qty >= 1 && qty % 1 === 0)) return issues.push('Số lượng không hợp lệ cho "' + item.title + '"');
    var price = Number(product.price) || 0;
    if (Math.abs((Number(item.price) || 0) - price) > TOLERANCE) {
      issues.push('Đơn giá "' + item.title + '" trong đơn ' + item.price + ', giá thật ' + price);
    }
    subtotal += price * qty;
  });

  var percent = 0;
  var freeShip = false;
  if (order.couponCode) {
    var c = fsGet('coupons/' + String(order.couponCode).trim().toUpperCase());
    if (c && c.data.active !== false) {
      percent = Math.min(100, Math.max(0, Number(c.data.percent) || 0));
      freeShip = !!c.data.freeShip;
    } else {
      issues.push('Mã giảm giá "' + order.couponCode + '" không hợp lệ');
    }
  }

  var shippingFee = shippingFeeOf(order, subtotal, freeShip);
  var total = round2(Math.max(0, subtotal - subtotal * percent / 100 + shippingFee));
  var amountVnd = Math.round(total * VND_RATE / 1000) * 1000;
  if (Math.abs((Number(order.total) || 0) - total) > TOLERANCE) {
    issues.push('Tổng tiền trong đơn ' + order.total + ', tính lại được ' + total);
  }

  var depositVnd = null;
  if (order.isPreorder) {
    var p = products[String(order.preorderProductId)];
    if (!p || (checkPreorderOpen && p.preorder !== true)) issues.push('Sản phẩm không còn nhận đặt trước');
    // Phải khớp với depositPercentOf trong functions/pricing.js
    var pct = Number(p ? p.depositPercent : undefined);
    pct = isFinite(pct) ? Math.min(100, Math.max(10, Math.round(pct))) : 30;
    depositVnd = Math.min(amountVnd, Math.round(round2(total * pct / 100) * VND_RATE / 1000) * 1000);
    if (Number(order.depositPercent) !== pct) issues.push('Tỷ lệ cọc trong đơn ' + order.depositPercent + '%, sản phẩm đặt ' + pct + '%');
  }
  return { total: total, amountVnd: amountVnd, depositVnd: depositVnd, issues: issues, products: products };
}

// "PTCG PTCG-12345678" hoặc "PTCG PTCG12345678" (ngân hàng hay bỏ dấu "-")
function parseOrderIdFromContent(content) {
  var re = /PTCG-?(\d{6,8})/g;
  var text = String(content || '').toUpperCase();
  var out = [];
  var m;
  while ((m = re.exec(text))) out.push('PTCG-' + m[1]);
  return out;
}

// ---------------- Firestore REST ----------------
function fsRequest(method, url, payload) {
  var options = {
    method: method,
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      // Tính lượt gọi API vào dự án Firebase (Apps Script mặc định không bật Firestore API)
      'x-goog-user-project': PROJECT_ID
    }
  };
  if (payload) options.payload = JSON.stringify(payload);
  return UrlFetchApp.fetch(url, options);
}

function fsGet(path) {
  var res = fsRequest('get', fsBase() + '/' + path.split('/').map(encodeURIComponent).join('/'));
  var code = res.getResponseCode();
  if (code === 404) return null;
  if (code !== 200) throw new Error('Firestore ' + code + ': ' + res.getContentText().slice(0, 300));
  var body = JSON.parse(res.getContentText());
  return { id: path.split('/').pop(), data: fromFields(body.fields || {}), updateTime: body.updateTime };
}

// true = ghi thành công; false = điều kiện không còn đúng (dữ liệu vừa đổi) → thử lại
function fsCommit(writes) {
  var res = fsRequest('post', fsBase() + ':commit', { writes: writes });
  var code = res.getResponseCode();
  if (code === 200) return true;
  if (code === 400 || code === 404 || code === 409) {
    console.warn('Firestore commit ' + code + ': ' + res.getContentText().slice(0, 300));
    return false;
  }
  throw new Error('Firestore commit ' + code + ': ' + res.getContentText().slice(0, 300));
}

function docName(path) {
  return docRoot() + '/' + path;
}
function createOnly(path, data) {
  return { update: { name: docName(path), fields: toFields(data) }, currentDocument: { exists: false } };
}
function quotePath(key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : '`' + key.replace(/`/g, '\\`') + '`';
}
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return v % 1 === 0 ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
function toFields(obj) {
  var out = {};
  for (var k in obj) out[k] = toValue(obj[k]);
  return out;
}
function merge(a, b) {
  var out = {};
  for (var k in a) out[k] = a[k];
  for (var j in b) out[j] = b[j];
  return out;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
