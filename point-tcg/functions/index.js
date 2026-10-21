// functions/index.js
// Cloud Functions cho Point TCG (cần gói Blaze):
//  1. checkNewOrder   — đơn mới: server tính lại giá, gửi email xác nhận cho khách và báo đơn mới cho shop
//  2. notifyOrderStatus — đơn đổi trạng thái: gửi email cho khách
//  3. sepayWebhook    — SePay báo có tiền vào tài khoản: tự xác nhận đơn đã thanh toán + trừ tồn kho
// Secrets (đặt bằng `firebase functions:secrets:set <TÊN>`): GMAIL_USER, GMAIL_APP_PASSWORD, SEPAY_API_KEY
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import nodemailer from 'nodemailer';
import { computeOrderPrice, parseOrderIdFromContent } from './pricing.js';
import { orderPlacedEmail, statusChangedEmail, canEmail } from './emails.js';

initializeApp();
const db = getFirestore();

const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const SEPAY_API_KEY = defineSecret('SEPAY_API_KEY');

const PAID_STATUS = 'Đã thanh toán (Chờ chuẩn bị hàng)';
const AWAITING_PAYMENT_STATUSES = ['Chờ thanh toán QR (Đơn mới)', 'Khách báo đã chuyển khoản (Chờ xác nhận)'];
const EMAIL_STATUSES = [
  'Khách báo đã chuyển khoản (Chờ xác nhận)',
  PAID_STATUS,
  'Đang chuẩn bị hàng',
  'Đang giao hàng',
  'Giao thành công',
  'Đã huỷ'
];

async function sendMail(to, { subject, html }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() }
  });
  await transporter.sendMail({ from: `Point TCG <${GMAIL_USER.value()}>`, to, subject, html });
}

// =============================================================
// 1. ĐƠN MỚI: TÍNH LẠI GIÁ + EMAIL
// =============================================================
export const checkNewOrder = onDocumentCreated(
  { document: 'orders/{orderId}', secrets: [GMAIL_USER, GMAIL_APP_PASSWORD] },
  async (event) => {
    const order = { ...event.data.data(), id: event.params.orderId };

    const productIds = [...new Set((order.items || []).map((i) => String(i.id)))];
    const productSnaps = productIds.length
      ? await db.getAll(...productIds.map((id) => db.collection('products').doc(id)))
      : [];
    const productsById = new Map(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()]));
    const coupon = order.couponCode
      ? (await db.collection('coupons').doc(order.couponCode).get()).data() || null
      : null;

    const price = computeOrderPrice(order, productsById, coupon);
    const verified = {
      serverTotal: price.total,
      serverAmountVnd: price.amountVnd,
      priceVerified: price.issues.length === 0,
      priceIssues: price.issues
    };
    await event.data.ref.update(verified);
    if (price.issues.length) {
      logger.warn(`Đơn ${order.id} có giá không khớp`, price.issues);
    }

    const full = { ...order, ...verified };
    try {
      if (canEmail(order.customerEmail)) {
        await sendMail(order.customerEmail, orderPlacedEmail(full));
      }
      const shopCopy = orderPlacedEmail(full);
      await sendMail(GMAIL_USER.value(), {
        subject: `🔔 Đơn mới #${order.id} — ${order.customerName}${price.issues.length ? ' ⚠️ GIÁ KHÔNG KHỚP' : ''}`,
        html: shopCopy.html
      });
    } catch (err) {
      logger.error('Không gửi được email đơn mới', err);
    }
  }
);

// =============================================================
// 2. ĐƠN ĐỔI TRẠNG THÁI: EMAIL CHO KHÁCH
// =============================================================
export const notifyOrderStatus = onDocumentUpdated(
  { document: 'orders/{orderId}', secrets: [GMAIL_USER, GMAIL_APP_PASSWORD] },
  async (event) => {
    const before = event.data.before.data();
    const after = { ...event.data.after.data(), id: event.params.orderId };
    if (before.status === after.status || !EMAIL_STATUSES.includes(after.status)) return;
    if (!canEmail(after.customerEmail)) return;
    try {
      await sendMail(after.customerEmail, statusChangedEmail(after));
    } catch (err) {
      logger.error(`Không gửi được email trạng thái đơn ${after.id}`, err);
    }
  }
);

// =============================================================
// 3. WEBHOOK SEPAY: TỰ XÁC NHẬN CHUYỂN KHOẢN
// =============================================================
// Cấu hình trên my.sepay.vn: Webhooks › URL = <URL của function này>, Kiểu chứng thực = API Key
export const sepayWebhook = onRequest({ secrets: [SEPAY_API_KEY], cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false });
    return;
  }
  if (req.get('Authorization') !== `Apikey ${SEPAY_API_KEY.value()}`) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const tx = req.body || {};
  if (tx.transferType !== 'in' || !tx.id) {
    res.json({ success: true, message: 'ignored' });
    return;
  }

  const paymentRef = db.collection('payments').doc(String(tx.id));
  const candidates = parseOrderIdFromContent(tx.content || tx.description);

  try {
    const result = await db.runTransaction(async (t) => {
      // Mỗi giao dịch SePay chỉ xử lý một lần (SePay có thể gửi lại)
      if ((await t.get(paymentRef)).exists) return 'duplicate';

      let orderSnap = null;
      for (const id of candidates) {
        const snap = await t.get(db.collection('orders').doc(id));
        if (snap.exists) {
          orderSnap = snap;
          break;
        }
      }

      const record = {
        amount: Number(tx.transferAmount) || 0,
        content: tx.content || '',
        gateway: tx.gateway || '',
        referenceCode: tx.referenceCode || '',
        transactionDate: tx.transactionDate || '',
        receivedAt: new Date().toISOString(),
        orderId: orderSnap?.id || null
      };

      if (!orderSnap) {
        t.set(paymentRef, { ...record, result: 'no_order' });
        return 'no_order';
      }

      const order = orderSnap.data();
      const required = order.serverAmountVnd ?? order.amountVnd;
      let outcome;
      if (!AWAITING_PAYMENT_STATUSES.includes(order.status)) {
        outcome = 'not_awaiting';
      } else if (order.priceVerified === false) {
        outcome = 'price_mismatch'; // để admin tự kiểm tra
      } else if (record.amount < required) {
        outcome = 'underpaid';
      } else {
        outcome = 'paid';
      }

      if (outcome === 'paid') {
        const update = {
          status: PAID_STATUS,
          statusHistory: FieldValue.arrayUnion({ status: PAID_STATUS, at: new Date().toISOString() }),
          paidAmount: record.amount,
          paymentRef: paymentRef.id,
          updatedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        };
        // Trừ tồn kho như khi admin xác nhận (đơn cũ không có cờ = đã trừ lúc đặt)
        if (order.stockDeducted === false) {
          const itemRefs = (order.items || [])
            .filter((item) => item.id)
            .map((item) => ({ item, ref: db.collection('products').doc(String(item.id)) }));
          // Trong transaction phải đọc hết trước khi ghi; bỏ qua sản phẩm đã bị xoá
          const snaps = await Promise.all(itemRefs.map(({ ref }) => t.get(ref)));
          itemRefs.forEach(({ item, ref }, i) => {
            if (snaps[i].exists) {
              t.update(ref, { stock: FieldValue.increment(-(Number(item.qty) || 1)) });
            }
          });
          update.stockDeducted = true;
        }
        t.update(orderSnap.ref, update);
      } else {
        t.update(orderSnap.ref, {
          paymentNote: `SePay ${record.amount.toLocaleString('vi-VN')} đ (${outcome}) — cần admin kiểm tra`
        });
      }
      t.set(paymentRef, { ...record, result: outcome });
      return outcome;
    });

    logger.info(`SePay ${tx.id}: ${result}`, { candidates });
    res.json({ success: true, result });
  } catch (err) {
    logger.error('Lỗi xử lý webhook SePay', err);
    res.status(500).json({ success: false });
  }
});
