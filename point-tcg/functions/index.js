// functions/index.js
// Cloud Functions cho Point TCG (cần gói Blaze):
//  1. checkNewOrder   — đơn mới: server tính lại giá + tiền cọc, kiểm tra giới hạn mỗi khách,
//                       gửi email xác nhận cho khách và báo đơn mới cho shop
//  2. notifyOrderStatus — đơn đổi trạng thái: gửi email cho khách; khách báo đã chuyển tiền thì báo shop
//  3. sepayWebhook    — SePay báo có tiền vào tài khoản: tự xác nhận đơn đã thanh toán + trừ tồn kho
// Secrets (đặt bằng `firebase functions:secrets:set <TÊN>`): GMAIL_USER, GMAIL_APP_PASSWORD, SEPAY_API_KEY
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import nodemailer from 'nodemailer';
import { computeOrderPrice, computeLimitIssues, parseOrderIdFromContent } from './pricing.js';
import { orderPlacedEmail, statusChangedEmail, paymentReportedEmail, canEmail } from './emails.js';

initializeApp();
const db = getFirestore();

const GMAIL_USER = defineSecret('GMAIL_USER');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const SEPAY_API_KEY = defineSecret('SEPAY_API_KEY');

const PAID_STATUS = 'Đã thanh toán (Chờ chuẩn bị hàng)';
const CUSTOMER_REPORTED_PAID = 'Khách báo đã chuyển khoản (Chờ xác nhận)';
const AWAITING_PAYMENT_STATUSES = ['Chờ thanh toán QR (Đơn mới)', CUSTOMER_REPORTED_PAID];
// Đặt trước (phải khớp src/utils/orderStatus.js)
const PRE_AWAIT_DEPOSIT = 'Chờ đặt cọc (Đặt trước)';
const PRE_DEPOSIT_REPORTED = 'Khách báo đã chuyển cọc (Chờ xác nhận)';
const PRE_DEPOSIT_PAID = 'Đã cọc (Chờ hàng về)';
const PRE_ARRIVED = 'Hàng đã về (Chờ thanh toán phần còn lại)';
const EMAIL_STATUSES = [
  CUSTOMER_REPORTED_PAID,
  PRE_DEPOSIT_REPORTED,
  PRE_DEPOSIT_PAID,
  PRE_ARRIVED,
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

    // Giới hạn mỗi khách: gộp các đơn cùng tài khoản và cùng SĐT (chống lập nhiều tài khoản để gom hàng)
    let limitIssues = [];
    if (productIds.some((id) => Number(productsById.get(id)?.maxPerCustomer) > 0)) {
      const [byUid, byPhone] = await Promise.all([
        order.uid ? db.collection('orders').where('uid', '==', order.uid).get() : null,
        order.customerPhone ? db.collection('orders').where('customerPhone', '==', order.customerPhone).get() : null
      ]);
      const related = new Map();
      [byUid, byPhone].forEach((snap) => snap?.forEach((d) => related.set(d.id, { ...d.data(), id: d.id })));
      limitIssues = computeLimitIssues(order, [...related.values()], productsById);
    }

    const verified = {
      serverTotal: price.total,
      serverAmountVnd: price.amountVnd,
      ...(price.depositVnd !== null && { serverDepositVnd: price.depositVnd }),
      priceVerified: price.issues.length === 0,
      priceIssues: price.issues,
      limitIssues
    };
    await event.data.ref.update(verified);
    if (price.issues.length) {
      logger.warn(`Đơn ${order.id} có giá không khớp`, price.issues);
    }
    if (limitIssues.length) {
      logger.warn(`Đơn ${order.id} vượt giới hạn mỗi khách`, limitIssues);
    }

    const full = { ...order, ...verified };
    try {
      if (canEmail(order.customerEmail)) {
        await sendMail(order.customerEmail, orderPlacedEmail(full));
      }
      const shopCopy = orderPlacedEmail(full);
      await sendMail(GMAIL_USER.value(), {
        subject: `🔔 ${order.isPreorder ? 'Đặt trước' : 'Đơn mới'} #${order.id} — ${order.customerName}`
          + `${price.issues.length ? ' ⚠️ GIÁ KHÔNG KHỚP' : ''}${limitIssues.length ? ' ⚠️ VƯỢT GIỚI HẠN' : ''}`,
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
    try {
      // Khách báo đã chuyển tiền → báo shop kiểm tra sao kê
      if (after.status === CUSTOMER_REPORTED_PAID || after.status === PRE_DEPOSIT_REPORTED) {
        await sendMail(GMAIL_USER.value(), paymentReportedEmail(after));
      }
      if (canEmail(after.customerEmail)) {
        await sendMail(after.customerEmail, statusChangedEmail(after));
      }
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
      const fullVnd = order.serverAmountVnd ?? order.amountVnd;
      const depositVnd = order.serverDepositVnd ?? order.depositVnd ?? 0;
      // Đặt trước: lần 1 trả cọc, lần 2 (khi hàng về) trả phần còn lại
      const isDepositPayment = order.isPreorder && [PRE_AWAIT_DEPOSIT, PRE_DEPOSIT_REPORTED].includes(order.status);
      const isRemainingPayment = order.isPreorder && [PRE_ARRIVED, CUSTOMER_REPORTED_PAID].includes(order.status);
      const required = isDepositPayment ? depositVnd : isRemainingPayment ? fullVnd - depositVnd : fullVnd;
      let outcome;
      if (isDepositPayment) {
        outcome = order.priceVerified === false ? 'price_mismatch' : record.amount < required ? 'underpaid' : 'deposit_paid';
      } else if (!isRemainingPayment && !AWAITING_PAYMENT_STATUSES.includes(order.status)) {
        outcome = 'not_awaiting';
      } else if (order.priceVerified === false) {
        outcome = 'price_mismatch'; // để admin tự kiểm tra
      } else if (record.amount < required) {
        outcome = 'underpaid';
      } else {
        outcome = 'paid';
      }

      if (outcome === 'deposit_paid') {
        t.update(orderSnap.ref, {
          status: PRE_DEPOSIT_PAID,
          statusHistory: FieldValue.arrayUnion({ status: PRE_DEPOSIT_PAID, at: new Date().toISOString() }),
          paidAmount: record.amount,
          paymentRef: paymentRef.id,
          updatedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        });
      } else if (outcome === 'paid') {
        const update = {
          status: PAID_STATUS,
          statusHistory: FieldValue.arrayUnion({ status: PAID_STATUS, at: new Date().toISOString() }),
          // Đặt trước: cộng dồn tiền cọc + phần còn lại
          paidAmount: order.isPreorder ? (Number(order.paidAmount) || 0) + record.amount : record.amount,
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
