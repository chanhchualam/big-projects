// src/components/CartDrawer.jsx
import React, { useEffect } from 'react';
import { getProductCatalogImage } from '../products';
import { useI18n } from '../i18n';
import { countItems, shippingFeeUsd, FREE_SHIPPING_THRESHOLD } from '../utils/shipping';

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems = [],
  onUpdateQty,
  onRemoveItem,
  cartTotal = 0,
  onProceedCheckout
}) {
  const { t, money } = useI18n();
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const freeShippingThreshold = FREE_SHIPPING_THRESHOLD;
  const freeShippingMet = cartTotal >= freeShippingThreshold;
  // Ước tính theo giao tiêu chuẩn (đã gồm phụ thu khi từ 5 sản phẩm)
  const estimatedShipping = shippingFeeUsd('standard', countItems(cartItems), cartTotal, false);
  const progressPercent = Math.min(100, Math.round((cartTotal / freeShippingThreshold) * 100));

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('Shopping Cart')}>
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <h2 className="drawer-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>{t('Your Cart ({n})', { n: cartItems.reduce((acc, item) => acc + item.qty, 0) })}</span>
          </h2>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label={t('Close cart')}
          >
            ✕
          </button>
        </div>

        {/* Free Shipping Banner */}
        <div style={{ padding: '12px 20px', background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>
            {freeShippingMet
              ? t('You qualify for FREE Insured Courier Shipping!')
              : t('Add {amount} more for FREE Insured Shipping', { amount: money(freeShippingThreshold - cartTotal) })}
          </div>
          <div style={{ height: '6px', background: '#dcfce7', borderRadius: '99px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: '#22c55e',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>

        {/* Cart Items Body */}
        <div className="drawer-body">
          {cartItems.length === 0 ? (
            <div className="drawer-empty">
              <h3>{t('Your cart is empty')}</h3>
              <p>{t('Explore our open & closed Pokémon TCG drawings and add your favorite collectibles.')}</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="drawer-item-card">
                <img src={getProductCatalogImage(item) || item.image} alt={item.title} className="drawer-item-img" />
                <div className="drawer-item-info">
                  <div>
                    <h4 className="drawer-item-title">{item.title}</h4>
                    <div className="drawer-item-price">{money(item.price * item.qty)}</div>
                  </div>

                  <div className="drawer-item-controls">
                    <div className="qty-control">
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => onUpdateQty(item.id, item.qty - 1)}
                        aria-label={t('Decrease quantity')}
                      >
                        -
                      </button>
                      <span className="qty-val">{item.qty}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => onUpdateQty(item.id, item.qty + 1)}
                        disabled={typeof item.stock === 'number' && item.qty >= item.stock}
                        title={typeof item.stock === 'number' && item.qty >= item.stock ? t('Đã đạt giới hạn tồn kho ({n} sp)', { n: item.stock }) : t('Tăng số lượng')}
                        aria-label={t('Increase quantity')}
                      >
                        +
                      </button>
                    </div>

                    {typeof item.stock === 'number' && (
                      <span style={{ fontSize: '0.74rem', color: item.qty >= item.stock ? '#ef4444' : '#64748b', fontWeight: 600 }}>
                        {item.qty >= item.stock ? t('Tối đa {n} sp', { n: item.stock }) : t('Kho: {n}', { n: item.stock })}
                      </span>
                    )}

                    <button
                      type="button"
                      className="item-remove-btn"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      {t('Remove')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Summary */}
        {cartItems.length > 0 && (
          <div className="drawer-footer">
            <div className="drawer-summary-row">
              <span>{t('Subtotal')}</span>
              <span>{money(cartTotal)}</span>
            </div>
            <div className="drawer-summary-row">
              <span>{t('Tamper-Proof Packaging')}</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>{t('FREE')}</span>
            </div>
            <div className="drawer-summary-row">
              <span>{t('Estimated Shipping')}</span>
              <span>{freeShippingMet ? t('FREE') : money(estimatedShipping)}</span>
            </div>

            <div className="drawer-total-row">
              <span>{t('Total')}</span>
              <span>{money(cartTotal + estimatedShipping)}</span>
            </div>

            <button
              type="button"
              className="checkout-btn"
              onClick={() => {
                if (onProceedCheckout) {
                  onProceedCheckout();
                }
              }}
            >
              <span>{t('Thanh Toán An Toàn')}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
