// src/components/OrderTransferInfo.jsx
// Trang Đơn hàng: bấm vào đơn chưa được shop xác nhận tiền → hiện mã VietQR, số tiền và nội dung chuyển khoản
// (tiền cọc đặt trước, phần còn lại khi hàng về, hoặc toàn bộ đơn chuyển khoản).
import React, { useEffect, useState } from 'react';
import { getQrConfig, loadQrConfig, generateQrUrl } from '../utils/qrConfig';
import { useI18n } from '../i18n';
import { PRE_AWAIT_DEPOSIT, PRE_ARRIVED, PRE_DEPOSIT_REPORTED, CUSTOMER_REPORTED_PAID } from '../utils/orderStatus';

const NEW_QR_STATUS = 'Chờ thanh toán QR (Đơn mới)';

// Đơn chuyển khoản shop chưa xác nhận nhận tiền → { kind, amountVnd }; không cần chuyển thì null
export function getPendingPayment(order) {
  if (!order) return null;
  const full = Number(order.amountVnd) || 0;
  const deposit = Number(order.depositVnd) || 0;
  if ([PRE_AWAIT_DEPOSIT, PRE_DEPOSIT_REPORTED].includes(order.status)) return { kind: 'deposit', amountVnd: deposit };
  if (order.status === PRE_ARRIVED || (order.isPreorder && order.status === CUSTOMER_REPORTED_PAID)) {
    return { kind: 'remaining', amountVnd: Math.max(0, full - deposit) };
  }
  if ([NEW_QR_STATUS, CUSTOMER_REPORTED_PAID].includes(order.status)) return { kind: 'full', amountVnd: full };
  return null;
}

export default function OrderTransferInfo({ order }) {
  const { t } = useI18n();
  const [qrConfig, setQrConfig] = useState(() => getQrConfig());
  const [copied, setCopied] = useState('');
  const payment = getPendingPayment(order);

  useEffect(() => {
    loadQrConfig().then(setQrConfig).catch(() => {});
  }, []);

  if (!payment) return null;
  const note = `${qrConfig.notePrefix || 'PTCG'} ${order.id}`;
  const vnd = `${payment.amountVnd.toLocaleString('vi-VN')}₫`;
  const title = payment.kind === 'deposit'
    ? t('Thanh toán tiền cọc')
    : payment.kind === 'remaining' ? t('Thanh toán phần còn lại') : t('Thanh toán đơn hàng');
  const reported = [CUSTOMER_REPORTED_PAID, PRE_DEPOSIT_REPORTED].includes(order.status);

  const copy = (text, key) => {
    navigator.clipboard?.writeText(String(text));
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="order-transfer-info">
      <h4>{title}</h4>
      <p className="order-transfer-note">
        {reported
          ? t('Shop đang kiểm tra tài khoản và sẽ xác nhận. Nếu bạn chưa chuyển, hãy quét mã QR bên dưới và giữ đúng nội dung chuyển khoản.')
          : t('Quét mã QR bằng ứng dụng ngân hàng và giữ đúng nội dung chuyển khoản để shop xác nhận đơn.')}
      </p>
      <div className="order-transfer-grid">
        <img className="order-pay-qr" src={generateQrUrl(qrConfig, payment.amountVnd, order.id)} alt="VietQR" />
        <div className="order-pay-rows">
          <div><span>{t('Ngân Hàng:')}</span><strong>{qrConfig.bankName}</strong></div>
          <div>
            <span>{t('Số Tài Khoản:')}</span>
            <strong>{qrConfig.accountNumber}</strong>
            <button type="button" onClick={() => copy(qrConfig.accountNumber, 'acc')}>{copied === 'acc' ? t('Đã chép') : t('Sao chép')}</button>
          </div>
          <div><span>{t('Chủ Tài Khoản:')}</span><strong>{qrConfig.accountName}</strong></div>
          <div>
            <span>{t('Số Tiền Cần Chuyển:')}</span>
            <strong className="order-pay-amount">{vnd}</strong>
            <button type="button" onClick={() => copy(payment.amountVnd, 'amt')}>{copied === 'amt' ? t('Đã chép') : t('Sao chép')}</button>
          </div>
          <div>
            <span>{t('Nội Dung Chuyển Khoản:')}</span>
            <strong className="order-pay-note">{note}</strong>
            <button type="button" onClick={() => copy(note, 'note')}>{copied === 'note' ? t('Đã chép') : t('Sao chép')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
