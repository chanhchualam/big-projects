import React, { useState, useEffect } from 'react';
import { saveNewOrder, ensureSignedIn, getAuthErrorMessage } from '../utils/auth';
import { getProductCatalogImage } from '../products';
import { getQrConfig, loadQrConfig, generateQrUrl } from '../utils/qrConfig';
import { fetchCoupon, redeemCoupon } from '../services/firestoreService';
import { getCouponError } from '../utils/orderCheck';
import { usdToVnd, VND_RATE } from '../utils/currency';
import { useI18n } from '../i18n';

// Khách chỉ được báo đã chuyển khoản; admin kiểm tra sao kê rồi mới chuyển sang "Đã thanh toán"
const CUSTOMER_REPORTED_PAID_STATUS = 'Khách báo đã chuyển khoản (Chờ xác nhận)';

export default function CheckoutModal({
  isOpen,
  onClose,
  cartItems = [],
  cartTotal = 0,
  user = null,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOpenOrderHistory,
  onOrderPlaced,
  onUpdateOrderStatus
}) {
  const { t } = useI18n();
  // Step State: 'form' | 'processing' | 'qr_payment' | 'success'
  const [checkoutStep, setCheckoutStep] = useState('form');
  const [completedOrder, setCompletedOrder] = useState(null);

  // QR Countdown Timer (15 minutes = 900 seconds)
  const [secondsLeft, setSecondsLeft] = useState(900);
  const [copiedField, setCopiedField] = useState(null);
  const [useFallbackQr, setUseFallbackQr] = useState(false);
  const [qrConfig, setQrConfig] = useState(() => getQrConfig());

  // Listen for admin changes to QR configuration
  useEffect(() => {
    const handleQrUpdate = (e) => {
      setQrConfig(e.detail || getQrConfig());
    };
    window.addEventListener('qr-config-updated', handleQrUpdate);
    window.addEventListener('storage', handleQrUpdate);
    return () => {
      window.removeEventListener('qr-config-updated', handleQrUpdate);
      window.removeEventListener('storage', handleQrUpdate);
    };
  }, []);

  // Form Fields - Shipping Information (Empty by default for user to enter)
  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    note: ''
  });

  // Shipping Method: 'standard' | 'express'
  const [shippingMethod, setShippingMethod] = useState('standard');

  // Payment Method: 'qr' | 'cod'
  // Default to QR Transfer as requested
  const [paymentMethod, setPaymentMethod] = useState('qr');

  // Discount code
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, percent, freeShip, ... } từ Firestore
  const appliedDiscount = appliedCoupon?.percent || 0;
  const [couponMessage, setCouponMessage] = useState('');

  // Reset modal state when opening
  useEffect(() => {
    if (isOpen) {
      // Always show the bank account the admin saved in Firestore
      loadQrConfig().then(setQrConfig).catch(() => {});
      setCheckoutStep('form');
      setCompletedOrder(null);
      setCouponMessage('');
      setAppliedCoupon(null);
      setSecondsLeft(900);
      setCopiedField(null);
      setUseFallbackQr(false);
      // Điền sẵn thông tin đã lưu trong tài khoản
      setShippingInfo({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        address: user?.address || '',
        note: ''
      });
    }
  }, [isOpen]);

  // Live 15-minute countdown timer for QR Payment step
  useEffect(() => {
    if (checkoutStep !== 'qr_payment') return;

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [checkoutStep]);

  // Keyboard navigation & lock body scroll
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen && checkoutStep !== 'processing') {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, checkoutStep]);

  if (!isOpen) return null;

  // Shipping Fee Calculation
  const freeShippingThreshold = 75;
  const isFreeStandard = cartTotal >= freeShippingThreshold;
  const shippingFee = shippingMethod === 'standard'
    ? (isFreeStandard || appliedCoupon?.freeShip ? 0 : 8.5)
    : 15.0;

  // Total Calculation
  const discountAmount = appliedDiscount > 0 ? (cartTotal * (appliedDiscount / 100)) : 0;
  const finalTotal = Math.max(0, cartTotal - discountAmount + shippingFee);
  const amountVnd = usdToVnd(finalTotal);

  // Formatting helpers
  const formatVndText = (num) => {
    return (num || 0).toLocaleString('vi-VN') + ' đ';
  };

  const minutesRemaining = Math.floor(secondsLeft / 60);
  const secondsRemaining = secondsLeft % 60;
  const countdownFormatted = `${String(minutesRemaining).padStart(2, '0')}:${String(secondsRemaining).padStart(2, '0')}`;
  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / 900) * 100));

  // Copy to clipboard helper
  const handleCopyText = (text, fieldName) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(text));
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = String(text);
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Apply Coupon — mã do admin tạo trong trang quản trị (collection 'coupons')
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponMessage(t('Đang kiểm tra mã...'));
    const coupon = await fetchCoupon(code);
    const error = getCouponError(coupon, cartTotal);
    if (error) {
      setAppliedCoupon(null);
      setCouponMessage(t(error));
      return;
    }
    setAppliedCoupon(coupon);
    const parts = [];
    if (coupon.percent > 0) parts.push(t('giảm {n}% tạm tính', { n: coupon.percent }));
    if (coupon.freeShip) parts.push(t('miễn phí ship tiêu chuẩn'));
    setCouponMessage(t('Áp dụng mã {code} thành công: {parts}.', { code: coupon.code, parts: parts.join(' + ') }));
  };

  // Submit Order Handler
  const handlePlaceOrder = (e) => {
    e.preventDefault();

    if (!shippingInfo.name.trim() || !shippingInfo.phone.trim() || !shippingInfo.address.trim()) {
      alert('Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ nhận hàng!');
      return;
    }

    // Step 2: Processing visual state briefly
    setCheckoutStep('processing');

    setTimeout(async () => {
      // Every order is tied to a Firebase uid (anonymous for guests) so only its owner can read it
      let uid;
      try {
        uid = await ensureSignedIn();
      } catch (err) {
        alert(t(getAuthErrorMessage(err, 'Không thể khởi tạo phiên đặt hàng. Vui lòng thử lại!')));
        setCheckoutStep('form');
        return;
      }

      // Giữ lượt dùng mã giảm giá trước khi tạo đơn
      if (appliedCoupon) {
        const couponError = getCouponError(appliedCoupon, cartTotal);
        if (couponError) {
          setAppliedCoupon(null);
          setCouponMessage(t(couponError));
          setCheckoutStep('form');
          return;
        }
        const redeemed = await redeemCoupon(appliedCoupon.code);
        if (!redeemed) {
          setAppliedCoupon(null);
          setCouponMessage(t('Mã giảm giá vừa hết lượt sử dụng. Vui lòng đặt lại đơn.'));
          setCheckoutStep('form');
          return;
        }
      }

      // 8 chữ số (6 số cuối thời gian + 2 số ngẫu nhiên) để hạn chế trùng mã đơn
      const generatedOrderId = `PTCG-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
      const orderPayload = {
        id: generatedOrderId,
        uid,
        customerName: shippingInfo.name.trim(),
        customerEmail: shippingInfo.email.trim() || `${shippingInfo.phone.trim()}@guest.pointtcg.com`,
        customerPhone: shippingInfo.phone.trim(),
        shippingAddress: shippingInfo.address.trim(),
        orderNotes: shippingInfo.note.trim(),
        shippingMethod: shippingMethod === 'standard' ? 'Tiêu chuẩn (Tamper-Proof Box)' : 'Hoả tốc bảo hiểm Vault Express',
        paymentMethod:
          paymentMethod === 'qr'
            ? 'Chuyển Khoản Ngân Hàng / VietQR'
            : 'Thanh Toán Khi Nhận Hàng (COD)',
        items: cartItems.map(item => ({
          id: item.id,
          title: item.title,
          price: item.price,
          qty: item.qty,
          image: getProductCatalogImage(item) || item.image
        })),
        subtotal: cartTotal,
        shippingFee,
        discountAmount,
        couponCode: appliedCoupon?.code || '',
        total: finalTotal,
        amountVnd,
        vndRate: VND_RATE,
        status: paymentMethod === 'cod' ? 'Chờ xác nhận (Đơn mới)' : 'Chờ thanh toán QR (Đơn mới)',
        createdAt: new Date().toLocaleString('vi-VN')
      };

      // 1. Normalize the order record
      const finalOrder = saveNewOrder(orderPayload);

      // 2. Persist to Firestore via App.jsx — stop here if it was rejected
      let persisted = false;
      try {
        persisted = onOrderPlaced ? await onOrderPlaced(finalOrder) : false;
      } catch (err) {
        console.error('Error in onOrderPlaced:', err);
      }
      if (!persisted) {
        alert('Không thể lưu đơn hàng lên hệ thống. Vui lòng thử lại!');
        setCheckoutStep('form');
        return;
      }
      setCompletedOrder(finalOrder);

      // 3. Clear cart
      if (onClearCart) {
        try {
          onClearCart();
        } catch (err) {}
      }

      // 4. Branch based on payment method
      if (paymentMethod === 'cod') {
        // COD goes directly to success
        setCheckoutStep('success');
      } else {
        // VietQR / Bank Transfer (or card) shows dynamic QR code with countdown timer
        setSecondsLeft(900); // 15 minutes
        setCheckoutStep('qr_payment');
      }
    }, 600);
  };

  // Customer clicks "I have transferred successfully"
  const handleConfirmTransfer = async () => {
    const target = completedOrder;
    if (!target) return;
    const newStatus = CUSTOMER_REPORTED_PAID_STATUS;
    const ok = onUpdateOrderStatus ? await onUpdateOrderStatus(target.id, newStatus) : false;
    if (!ok) return;
    setCompletedOrder({
      ...target,
      status: newStatus
    });
    setCheckoutStep('success');
  };

  // VietQR / Bank Transfer Dynamic URL
  const currentOrderId = completedOrder?.id || `PTCG-${Date.now().toString().slice(-6)}`;
  const currentTotalVnd = completedOrder?.amountVnd || amountVnd;
  const vietQrUrl = generateQrUrl(qrConfig, currentTotalVnd, currentOrderId);

  // Bulletproof Active Order object: guarantees the UI never renders an empty modal card
  const activeOrder = completedOrder || {
    id: currentOrderId,
    customerName: shippingInfo.name || 'Khách hàng Point TCG',
    customerEmail: shippingInfo.email || '',
    customerPhone: shippingInfo.phone || '',
    shippingAddress: shippingInfo.address || '',
    orderNotes: shippingInfo.note || '',
    paymentMethod: paymentMethod === 'cod' ? 'Thanh Toán Khi Nhận Hàng (COD)' : 'Chuyển Khoản Ngân Hàng / VietQR',
    items: cartItems && cartItems.length > 0 ? cartItems : [],
    subtotal: cartTotal,
    total: finalTotal,
    amountVnd: currentTotalVnd,
    status: paymentMethod === 'cod' ? 'Chờ xác nhận (Đơn mới)' : 'Chờ thanh toán QR (Đơn mới)',
    createdAt: new Date().toLocaleString('vi-VN')
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('Thanh toán đơn hàng')}>
      <div
        className="checkout-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: checkoutStep === 'success' ? '640px' : checkoutStep === 'qr_payment' ? '780px' : '980px'
        }}
      >
        <button
          type="button"
          className="modal-close-icon-btn"
          onClick={onClose}
          aria-label={t('Đóng thanh toán')}
        >
          ✕
        </button>

        {/* =========================================================================
            STATE 1: PROCESSING SECURE TRANSACTION
           ========================================================================= */}
        {checkoutStep === 'processing' && (
          <div className="checkout-processing-view">
            <div className="checkout-spinner" />
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '20px', color: '#0f172a' }}>
              {t('Đang Khởi Tạo Đơn Hàng...')}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '6px' }}>
              {t('Hệ thống đang lưu trữ đơn hàng và tạo mã VietQR thanh toán cho bạn. Vui lòng chờ giây lát...')}
            </p>
          </div>
        )}

        {/* =========================================================================
            STATE 2: QR PAYMENT SCREEN WITH LIVE COUNTDOWN TIMER
           ========================================================================= */}
        {checkoutStep === 'qr_payment' && (
          <div className="qr-payment-screen">
            {/* Header */}
            <div className="qr-screen-header">
              <div className="qr-badge-pill">
                <span className="live-pulse-dot" />
                <span>{t('VIETQR 24/7 TỰ ĐỘNG')}</span>
              </div>
              <h2 className="qr-screen-title">{t('Quét Mã QR Để Thanh Toán')}</h2>
              <p className="qr-screen-subtitle">
                Đơn hàng <strong>#{activeOrder.id}</strong> đã được tạo thành công và đang chờ xác nhận thanh toán.
              </p>
            </div>

            {/* Countdown Timer Widget */}
            <div className={`qr-countdown-container ${secondsLeft <= 180 ? 'timer-urgent' : ''}`}>
              <div className="qr-timer-top">
                <div className="qr-timer-icon-wrap">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{t('Mã QR sẽ hết hạn sau:')}</span>
                </div>
                <div className="qr-timer-clock-digits">
                  {countdownFormatted}
                </div>
              </div>

              {/* Animated Progress Bar */}
              <div className="qr-timer-progress-track">
                <div
                  className="qr-timer-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {secondsLeft === 0 ? (
                <div className="qr-expired-alert">
                  <span>{t('Mã QR đã hết hạn! Vui lòng gia hạn thêm thời gian để tiếp tục.')}</span>
                  <button
                    type="button"
                    className="btn-renew-timer"
                    onClick={() => setSecondsLeft(900)}
                  >
                    {t('Gia hạn thêm 15 phút')}
                  </button>
                </div>
              ) : (
                <div className="qr-timer-instruction">
                  {secondsLeft <= 180 ? (
                    <strong style={{ color: '#ef4444' }}>{t('Sắp hết thời gian giữ hàng! Vui lòng chuyển khoản nhanh chóng.')}</strong>
                  ) : (
                    <span>{t('Hệ thống tự động kích hoạt đơn hàng ngay khi nhận được chuyển khoản.')}</span>
                  )}
                </div>
              )}
            </div>

            {/* Main QR Content Grid */}
            <div className="qr-main-grid">
              {/* QR Image Column */}
              <div className="qr-code-column">
                <div className="qr-frame-box">
                  <div className="qr-corner corner-tl" />
                  <div className="qr-corner corner-tr" />
                  <div className="qr-corner corner-bl" />
                  <div className="qr-corner corner-br" />

                  {!useFallbackQr ? (
                    <img
                      src={vietQrUrl}
                      alt="VietQR Point TCG"
                      className="vietqr-live-img"
                      onError={() => setUseFallbackQr(true)}
                    />
                  ) : (
                    /* High-fidelity Fallback SVG QR */
                    <div className="qr-svg-fallback">
                      <svg viewBox="0 0 220 220" width="200" height="200">
                        <rect width="220" height="220" fill="#ffffff" rx="12" />
                        {/* Finder Top Left */}
                        <rect x="20" y="20" width="50" height="50" fill="#0053e2" rx="6" />
                        <rect x="27" y="27" width="36" height="36" fill="#ffffff" rx="3" />
                        <rect x="34" y="34" width="22" height="22" fill="#0053e2" rx="2" />
                        {/* Finder Top Right */}
                        <rect x="150" y="20" width="50" height="50" fill="#0053e2" rx="6" />
                        <rect x="157" y="27" width="36" height="36" fill="#ffffff" rx="3" />
                        <rect x="164" y="34" width="22" height="22" fill="#0053e2" rx="2" />
                        {/* Finder Bottom Left */}
                        <rect x="20" y="150" width="50" height="50" fill="#0053e2" rx="6" />
                        <rect x="27" y="157" width="36" height="36" fill="#ffffff" rx="3" />
                        <rect x="34" y="164" width="22" height="22" fill="#0053e2" rx="2" />
                        {/* Grid Dots */}
                        <rect x="80" y="25" width="10" height="10" fill="#0f172a" />
                        <rect x="95" y="25" width="10" height="10" fill="#0f172a" />
                        <rect x="110" y="25" width="10" height="10" fill="#0f172a" />
                        <rect x="125" y="25" width="10" height="10" fill="#0f172a" />
                        <rect x="80" y="45" width="10" height="10" fill="#0f172a" />
                        <rect x="110" y="45" width="10" height="10" fill="#0f172a" />
                        <rect x="80" y="65" width="10" height="10" fill="#0f172a" />
                        <rect x="95" y="65" width="10" height="10" fill="#0f172a" />
                        <rect x="125" y="65" width="10" height="10" fill="#0f172a" />
                        {/* Middle Poke Center */}
                        <circle cx="110" cy="110" r="22" fill="#ffcc00" stroke="#0053e2" strokeWidth="4" />
                        <path d="M107 98 L114 108 L108 108 L112 122 L103 111 L108 111 Z" fill="#0053e2" />
                        {/* Data dots bottom */}
                        <rect x="80" y="145" width="10" height="10" fill="#0f172a" />
                        <rect x="95" y="145" width="10" height="10" fill="#0f172a" />
                        <rect x="125" y="145" width="10" height="10" fill="#0f172a" />
                        <rect x="145" y="145" width="10" height="10" fill="#0f172a" />
                        <rect x="165" y="145" width="10" height="10" fill="#0f172a" />
                        <rect x="180" y="145" width="10" height="10" fill="#0f172a" />
                        <rect x="80" y="165" width="10" height="10" fill="#0f172a" />
                        <rect x="110" y="165" width="10" height="10" fill="#0f172a" />
                        <rect x="145" y="165" width="10" height="10" fill="#0f172a" />
                        <rect x="165" y="165" width="10" height="10" fill="#0f172a" />
                        <rect x="80" y="185" width="10" height="10" fill="#0f172a" />
                        <rect x="125" y="185" width="10" height="10" fill="#0f172a" />
                        <rect x="145" y="185" width="10" height="10" fill="#0f172a" />
                      </svg>
                      <div className="fallback-text">{qrConfig.bankName} - {qrConfig.accountNumber}</div>
                    </div>
                  )}
                </div>

                <div className="qr-scan-hint">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.4">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>{t('Mở ứng dụng ngân hàng hoặc MoMo để quét mã thanh toán')}</span>
                </div>
              </div>

              {/* Bank Details Column with 1-Click Copy */}
              <div className="qr-details-column">
                <div className="bank-info-card">
                  {/* Bank Name */}
                  <div className="bank-data-row">
                    <div className="bank-data-label">{t('Ngân Hàng:')}</div>
                    <div className="bank-data-val-group">
                      <strong className="bank-name-text">{qrConfig.bankName}</strong>
                      <button
                        type="button"
                        className="copy-btn-action"
                        onClick={() => handleCopyText(qrConfig.bankName, 'bank')}
                      >
                        {copiedField === 'bank' ? `✓ ${t('Đã chép')}` : t('Sao chép')}
                      </button>
                    </div>
                  </div>

                  {/* Account Number */}
                  <div className="bank-data-row">
                    <div className="bank-data-label">{t('Số Tài Khoản:')}</div>
                    <div className="bank-data-val-group">
                      <strong className="bank-acc-number">{qrConfig.accountNumber}</strong>
                      <button
                        type="button"
                        className="copy-btn-action highlight-btn"
                        onClick={() => handleCopyText((qrConfig.accountNumber || '').replace(/\s+/g, ''), 'acc')}
                      >
                        {copiedField === 'acc' ? `✓ ${t('Đã chép')}` : t('Sao chép STK')}
                      </button>
                    </div>
                  </div>

                  {/* Account Owner */}
                  <div className="bank-data-row">
                    <div className="bank-data-label">{t('Chủ Tài Khoản:')}</div>
                    <div className="bank-data-val-group">
                      <strong className="bank-owner-name">{qrConfig.accountName}</strong>
                    </div>
                  </div>

                  {/* Exact Amount */}
                  <div className="bank-data-row amount-row-highlight">
                    <div className="bank-data-label">{t('Số Tiền Cần Chuyển:')}</div>
                    <div className="bank-data-val-group">
                      <div>
                        <div className="amount-vnd-text">{formatVndText(currentTotalVnd)}</div>
                        <div className="amount-usd-text">~ ${activeOrder.total.toFixed(2)} USD</div>
                      </div>
                      <button
                        type="button"
                        className="copy-btn-action highlight-btn"
                        onClick={() => handleCopyText(currentTotalVnd, 'amount')}
                      >
                        {copiedField === 'amount' ? `✓ ${t('Đã chép')}` : t('Sao chép số tiền')}
                      </button>
                    </div>
                  </div>

                  {/* Transfer Syntax */}
                  <div className="bank-data-row syntax-row-highlight">
                    <div className="bank-data-label">{t('Nội Dung Chuyển Khoản:')}</div>
                    <div className="bank-data-val-group">
                      <strong className="transfer-syntax-code">{(qrConfig.notePrefix || 'PTCG')} {activeOrder.id}</strong>
                      <button
                        type="button"
                        className="copy-btn-action highlight-btn"
                        onClick={() => handleCopyText(`${qrConfig.notePrefix || 'PTCG'} ${activeOrder.id}`, 'syntax')}
                      >
                        {copiedField === 'syntax' ? `✓ ${t('Đã chép')}` : t('Sao chép cú pháp')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="syntax-warning-note">
                  <strong>{t('Quan trọng:')}</strong> {t('Vui lòng giữ nguyên nội dung chuyển khoản')} <code>{(qrConfig.notePrefix || 'PTCG')} {activeOrder.id}</code> {t('để nhân viên Point TCG lập tức nhận biết và chuẩn bị hàng cho bạn.')}
                </div>

                {/* Primary CTA Buttons */}
                <div className="qr-actions-wrap">
                  <button
                    type="button"
                    className="btn-confirm-transfer-paid"
                    onClick={handleConfirmTransfer}
                  >
                    <span>{t('Tôi Đã Chuyển Khoản Thành Công')}</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="qr-secondary-btns">
                    <button
                      type="button"
                      className="btn-pay-later"
                      onClick={() => {
                        onClose();
                        if (onOpenOrderHistory) onOpenOrderHistory();
                      }}
                    >
                      {t('Xem Đơn Trong Lịch Sử')}
                    </button>
                    <button
                      type="button"
                      className="btn-close-simple"
                      onClick={onClose}
                    >
                      {t('✕ Đóng')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE 3: ORDER PLACED SUCCESSFULLY (INVOICE & RECEIPT)
           ========================================================================= */}
        {checkoutStep === 'success' && (
          <div className="checkout-success-view">
            <div className="success-badge-icon">✓</div>
            <h2 className="success-title">{t('Đặt Hàng Thành Công!')}</h2>
            <p className="success-sub">
              {t('Cảm ơn bạn đã mua sắm tại Point TCG. Đơn hàng của bạn đã được chuyển tới shop để chuẩn bị đóng gói nguyên seal chính hãng.')}
            </p>

            <div className="order-receipt-card">
              <div className="receipt-row">
                <span className="receipt-label">{t('Mã Đơn Hàng:')}</span>
                <span className="receipt-val code-highlight">#{activeOrder.id}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">{t('Thời Gian Tạo:')}</span>
                <span className="receipt-val">{activeOrder.createdAt}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">{t('Trạng Thái Đơn:')}</span>
                <span className="receipt-val" style={{ color: '#16a34a', fontWeight: 800 }}>
                  {t(activeOrder.status)}
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">{t('Người Nhận:')}</span>
                <span className="receipt-val">{activeOrder.customerName} ({activeOrder.customerPhone})</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">{t('Địa Chỉ Nhận Hàng:')}</span>
                <span className="receipt-val">{activeOrder.shippingAddress}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">{t('Phương Thức:')}</span>
                <span className="receipt-val">{t(activeOrder.paymentMethod)}</span>
              </div>
              <div className="receipt-row total-highlight">
                <span className="receipt-label">{t('Tổng Tiền:')}</span>
                <span className="receipt-val">
                  ${activeOrder.total.toFixed(2)} USD ({formatVndText(activeOrder.amountVnd)})
                </span>
              </div>
            </div>

            <div className="order-items-receipt">
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569', marginBottom: '8px' }}>
                {t('Sản phẩm trong đơn ({n}):', { n: activeOrder.items?.length || 0 })}
              </div>
              {(activeOrder.items || []).map((item, idx) => (
                <div key={idx} className="receipt-item-line">
                  <img src={item.image} alt={item.title} className="receipt-thumb" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="receipt-item-name">{item.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('Số lượng:')} x{item.qty}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: '#0053e2' }}>
                    ${(item.price * item.qty).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-success-actions">
              <button
                type="button"
                className="btn-continue-shopping"
                onClick={onClose}
              >
                {t('Tiếp Tục Mua Sắm')}
              </button>
              {onOpenOrderHistory && (
                <button
                  type="button"
                  className="btn-view-orders"
                  onClick={() => {
                    onClose();
                    onOpenOrderHistory();
                  }}
                >
                  {t('Xem Lịch Sử Đơn Hàng')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE 4: CHECKOUT FORM & ORDER SUMMARY
           ========================================================================= */}
        {(checkoutStep === 'form' || !['processing', 'qr_payment', 'success'].includes(checkoutStep)) && (
          <div>
            <div className="checkout-header">
              <div className="checkout-title-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0053e2" strokeWidth="2.4">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <h2 className="checkout-title">{t('Point TCG Secure Checkout')}</h2>
              </div>
              <div className="ssl-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 0 1 6 0v3H9V7z" />
                </svg>
                <span>{t('SSL 256-Bit Encrypted')}</span>
              </div>
            </div>

            <form onSubmit={handlePlaceOrder} className="checkout-grid-layout">
              {/* LEFT COLUMN: SHIPPING & PAYMENT FORMS */}
              <div className="checkout-col-left">
                {/* 1. SHIPPING ADDRESS */}
                <div className="checkout-section-block">
                  <h3 className="section-block-title">
                    <span className="step-circle">1</span>
                    <span>{t('Thông Tin Nhận Hàng')}</span>
                  </h3>

                  <div className="form-group">
                    <label className="form-label">{t('Họ và tên người nhận')} <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('Nhập họ và tên người nhận...')}
                      value={shippingInfo.name}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">{t('Số điện thoại liên hệ')} <span style={{ color: '#ef4444' }}>*</span></label>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder={t('Nhập số điện thoại liên hệ (ví dụ: 0912 345 678)...')}
                        value={shippingInfo.phone}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('Email nhận vận đơn')}</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder={t('Nhập địa chỉ email của bạn...')}
                        value={shippingInfo.email}
                        onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Địa chỉ giao hàng chi tiết')} <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('Nhập địa chỉ nhận hàng (Số nhà, tên đường, Phường/Xã, Quận/Huyện...)')}
                      value={shippingInfo.address}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, address: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Ghi chú cho shipper (tuỳ chọn)')}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('Ví dụ: Gọi trước khi giao, bọc thêm túi chống nước...')}
                      value={shippingInfo.note}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, note: e.target.value })}
                    />
                  </div>
                </div>

                {/* 2. SHIPPING METHOD */}
                <div className="checkout-section-block">
                  <h3 className="section-block-title">
                    <span className="step-circle">2</span>
                    <span>{t('Phương Thức Vận Chuyển')}</span>
                  </h3>

                  <div className="shipping-options-list">
                    <label
                      className={`shipping-option-card ${shippingMethod === 'standard' ? 'active' : ''}`}
                      onClick={() => setShippingMethod('standard')}
                    >
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethod === 'standard'}
                        onChange={() => setShippingMethod('standard')}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{t('Giao Tiêu Chuẩn (Standard Tamper-Proof Box)')}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('Hộp chống sốc niêm phong (3-5 ngày làm việc)')}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: isFreeStandard ? '#16a34a' : '#0053e2' }}>
                        {isFreeStandard ? t('MIỄN PHÍ') : '$8.50'}
                      </div>
                    </label>

                    <label
                      className={`shipping-option-card ${shippingMethod === 'express' ? 'active' : ''}`}
                      onClick={() => setShippingMethod('express')}
                    >
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethod === 'express'}
                        onChange={() => setShippingMethod('express')}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{t('Hoả Tốc Bảo Hiểm Vault Express')}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('Bảo hiểm 100% giá trị thẻ hiếm, giao trong 24h')}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: '#0053e2' }}>
                        $15.00
                      </div>
                    </label>
                  </div>
                </div>

                {/* 3. PAYMENT METHOD */}
                <div className="checkout-section-block">
                  <h3 className="section-block-title">
                    <span className="step-circle">3</span>
                    <span>{t('Phương Thức Thanh Toán')}</span>
                  </h3>

                  <div className="payment-method-selector">
                    <button
                      type="button"
                      className={`pay-tab-btn ${paymentMethod === 'qr' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('qr')}
                    >
                      {t('Chuyển Khoản / VietQR')}
                    </button>
                    <button
                      type="button"
                      className={`pay-tab-btn ${paymentMethod === 'cod' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('cod')}
                    >
                      {t('Thanh Toán Tiền Mặt Khi Nhận Hàng (COD)')}
                    </button>
                  </div>

                  {/* Payment Details Sub-forms */}
                  {paymentMethod === 'qr' && (
                    <div className="payment-details-box qr-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                        <span>{t('Quét mã VietQR chuyển khoản (Có đồng hồ đếm ngược 15:00)')}</span>
                      </div>
                      <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                        {t('Khi bấm "Đặt Hàng & Thanh Toán" bên dưới, đơn hàng sẽ ngay lập tức được gửi đến shop và màn hình sẽ hiển thị mã QR VietQR kèm thời gian đếm ngược 15 phút để bạn quét thanh toán nhanh chóng.')}
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'cod' && (
                    <div className="payment-details-box">
                      <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6 }}>
                        {t('Thanh toán tiền mặt trực tiếp cho shipper khi nhận gói hàng Pokémon TCG. Quý khách được đồng kiểm bao bì niêm phong trước khi thanh toán.')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: ORDER SUMMARY & VOUCHER */}
              <div className="checkout-col-right">
                <div className="order-summary-card">
                  <h3 className="order-summary-title">{t('Tóm Tắt Đơn Hàng')} ({cartItems.length})</h3>

                  {/* Mini item list with quantity adjustment controls */}
                  <div className="checkout-items-list">
                    {cartItems.map((item) => {
                      const itemStock = typeof item.stock === 'number' ? item.stock : 99;
                      return (
                        <div key={item.id} className="checkout-mini-item">
                          <img src={getProductCatalogImage(item) || item.image} alt={item.title} className="checkout-item-thumb" />
                          <div className="checkout-item-details">
                            <div className="checkout-item-name" title={item.title}>{item.title}</div>
                            
                            {/* Quantity buttons & stock notice */}
                            <div className="checkout-qty-container">
                              <span className="checkout-qty-label">{t('Số lượng:')}</span>
                              <div className="checkout-qty-picker">
                                <button
                                  type="button"
                                  className="btn-checkout-qty"
                                  onClick={() => {
                                    if (onUpdateQty) {
                                      onUpdateQty(item.id, Math.max(1, item.qty - 1));
                                    }
                                  }}
                                  disabled={item.qty <= 1}
                                  title={t('Giảm 1 sản phẩm')}
                                >
                                  -
                                </button>
                                <span className="checkout-qty-number">{item.qty}</span>
                                <button
                                  type="button"
                                  className="btn-checkout-qty"
                                  onClick={() => {
                                    if (onUpdateQty) {
                                      if (item.qty >= itemStock) {
                                        alert(t('Sản phẩm này chỉ còn tối đa {n} cái trong kho!', { n: itemStock }));
                                        return;
                                      }
                                      onUpdateQty(item.id, item.qty + 1);
                                    }
                                  }}
                                  disabled={item.qty >= itemStock}
                                  title={item.qty >= itemStock ? t('Đã đạt giới hạn tồn kho ({n} sp)', { n: itemStock }) : t('Tăng thêm 1 sản phẩm')}
                                >
                                  +
                                </button>
                              </div>

                              <span className={`checkout-stock-hint ${item.qty >= itemStock ? 'stock-max' : ''}`}>
                                {item.qty >= itemStock ? `(${t('Tối đa {n} sp', { n: itemStock })})` : `(${t('Còn {n} sp', { n: itemStock })})`}
                              </span>
                            </div>
                          </div>

                          <div className="checkout-price-block">
                            <div className="checkout-item-price">
                              ${(item.price * item.qty).toFixed(2)}
                            </div>
                            {item.qty > 1 && (
                              <div className="checkout-unit-subprice">
                                ${item.price.toFixed(2)}/sp
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add more products button */}
                  <div className="checkout-add-more-row">
                    <button
                      type="button"
                      className="btn-checkout-add-more"
                      onClick={onClose}
                      title={t('Chọn thêm sản phẩm khác từ cửa hàng')}
                    >
                      <span>{t('+ Chọn thêm sản phẩm khác')}</span>
                    </button>
                  </div>

                  {/* Coupon section */}
                  <div className="coupon-input-wrap">
                    <input
                      type="text"
                      className="coupon-input"
                      placeholder={t('Mã voucher (ví dụ: POINTTCG)')}
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                    <button
                      type="button"
                      className="coupon-apply-btn"
                      onClick={handleApplyCoupon}
                    >
                      {t('Áp dụng')}
                    </button>
                  </div>
                  {couponMessage && (
                    <div className="coupon-feedback-msg">
                      {couponMessage}
                    </div>
                  )}

                  {/* Calculations breakdown */}
                  <div className="summary-calculation-lines">
                    <div className="calc-row">
                      <span>{t('Tạm tính (Subtotal)')}</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>

                    <div className="calc-row">
                      <span>{t('Đóng gói bảo vệ Pokémon Seal')}</span>
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>{t('MIỄN PHÍ')}</span>
                    </div>

                    <div className="calc-row">
                      <span>{t('Phí vận chuyển')}</span>
                      <span>{shippingFee === 0 ? t('MIỄN PHÍ') : `$${shippingFee.toFixed(2)}`}</span>
                    </div>

                    {appliedDiscount > 0 && (
                      <div className="calc-row discount-row">
                        <span>{t('Giảm giá')} ({appliedDiscount}%)</span>
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>-${discountAmount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="calc-total-row">
                      <span>{t('Tổng Thanh Toán:')}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div className="final-price-tag">${finalTotal.toFixed(2)}</div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                          ~ {formatVndText(amountVnd)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="btn-confirm-checkout">
                    <span>{t('Đặt Hàng & Thanh Toán Ngay')}</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="checkout-guarantee-note">
                    {t('Cam kết 100% hàng chính hãng niêm phong factory sealed • Đơn hàng đồng bộ tức thì sang Admin Shopper')}
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
