// src/components/OrderPaymentModal.jsx
// Khách thanh toán lại từ trang Đơn hàng: tiền cọc đặt trước, phần còn lại khi hàng về,
// hoặc đơn QR chưa chuyển. Hiện mã VietQR đúng số tiền + nút "Tôi đã chuyển khoản".
import React, { useEffect, useRef, useState } from 'react';
import { getQrConfig, loadQrConfig, generateQrUrl, QR_SECONDS } from '../utils/qrConfig';
import { useI18n } from '../i18n';
import { PRE_AWAIT_DEPOSIT, PRE_ARRIVED, PRE_DEPOSIT_REPORTED, CUSTOMER_REPORTED_PAID } from '../utils/orderStatus';

const NEW_QR_STATUS = 'Chờ thanh toán QR (Đơn mới)';

// Đơn đang chờ khách chuyển tiền → { kind, amountVnd, nextStatus }; không cần trả thì null
export function getPendingPayment(order) {
  if (!order) return null;
  const full = Number(order.amountVnd) || 0;
  const deposit = Number(order.depositVnd) || 0;
  if (order.status === PRE_AWAIT_DEPOSIT) return { kind: 'deposit', amountVnd: deposit, nextStatus: PRE_DEPOSIT_REPORTED };
  if (order.status === PRE_ARRIVED) return { kind: 'remaining', amountVnd: Math.max(0, full - deposit), nextStatus: CUSTOMER_REPORTED_PAID };
  if (order.status === NEW_QR_STATUS) return { kind: 'full', amountVnd: full, nextStatus: CUSTOMER_REPORTED_PAID };
  return null;
}

export default function OrderPaymentModal({ order, onClose, onReported }) {
  const { t } = useI18n();
  const [qrConfig, setQrConfig] = useState(() => getQrConfig());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(QR_SECONDS);
  const reportedRef = useRef(false);
  const payment = getPendingPayment(order);

  useEffect(() => {
    loadQrConfig().then(setQrConfig).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Hết 1 phút giữ mã QR → chuyển đơn cho shop kiểm tra tiền và xác nhận
  const reportRef = useRef(null);
  useEffect(() => {
    if (secondsLeft === 0) reportRef.current?.();
  }, [secondsLeft]);

  if (!order || !payment) return null;
  const note = `${qrConfig.notePrefix || 'PTCG'} ${order.id}`;
  const vnd = `${payment.amountVnd.toLocaleString('vi-VN')}₫`;
  const title = payment.kind === 'deposit'
    ? t('Thanh toán tiền cọc')
    : payment.kind === 'remaining' ? t('Thanh toán phần còn lại') : t('Thanh toán đơn hàng');

  const copy = (text, key) => {
    navigator.clipboard?.writeText(String(text));
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const report = async () => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    setBusy(true);
    const ok = await onReported(order.id, payment.nextStatus);
    setBusy(false);
    if (ok) onClose();
    else reportedRef.current = false;
  };
  reportRef.current = report;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="order-pay-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-icon-btn" onClick={onClose} aria-label={t('Đóng')}>✕</button>
        <h3>{title}</h3>
        <p className="order-pay-sub">{t('Đơn #{id}', { id: order.id })}</p>
        <div className={`order-pay-timer ${secondsLeft <= 15 ? 'urgent' : ''}`}>
          {secondsLeft > 0
            ? t('Mã QR hết hạn sau {s} giây', { s: secondsLeft })
            : t('Mã QR đã hết hạn. Đơn đang được chuyển cho shop kiểm tra và xác nhận...')}
        </div>
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
            <strong>{note}</strong>
            <button type="button" onClick={() => copy(note, 'note')}>{copied === 'note' ? t('Đã chép') : t('Sao chép')}</button>
          </div>
        </div>
        <button type="button" className="cop-btn-edit-profile order-pay-confirm" onClick={report} disabled={busy}>
          {busy ? t('Đang gửi...') : t('Tôi Đã Chuyển Khoản Thành Công')}
        </button>
      </div>
    </div>
  );
}
