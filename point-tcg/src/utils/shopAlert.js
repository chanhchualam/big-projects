// src/utils/shopAlert.js
// Báo đơn mới cho shop qua email, miễn phí (Google Apps Script, không cần gói Blaze).
// Web chỉ gửi mã đơn + phiên đăng nhập của khách; script tự đọc lại đơn trên Firestore
// bằng phiên đó, nên không ai gửi được email giả. Mã script: apps-script/bao-don-moi.gs
import { auth } from '../firebase';

// Dán link "Ứng dụng web" của Apps Script vào đây (để trống = tắt báo đơn)
export const SHOP_ALERT_URL = 'https://script.google.com/macros/s/AKfycbzrel9fwwtUVzapALeDYUQIOtUzro8URLxP_QzkaHbin33F-aVIRoLRY2pP3rUJA31roQ/exec';

export async function notifyShopNewOrder(order) {
  if (!SHOP_ALERT_URL || !order?.id || !auth.currentUser) return;
  if (import.meta.env?.VITE_USE_EMULATORS === 'true') return;
  try {
    const idToken = await auth.currentUser.getIdToken();
    // text/plain + no-cors: Apps Script không trả header CORS, chỉ cần gửi đi là đủ
    await fetch(SHOP_ALERT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ orderId: order.id, idToken })
    });
  } catch {
    // Báo đơn chỉ để tiện theo dõi, không ảnh hưởng việc đặt hàng
  }
}
