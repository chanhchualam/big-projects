// src/components/ProductModal.jsx
import React, { useEffect } from 'react';

export default function ProductModal({
  product,
  onClose,
  isSaved,
  onToggleSave,
  onAddToCart,
  onRequestJoin,
  onBuyNow,
  countdownString
}) {
  const [qty, setQty] = React.useState(1);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && product) {
        onClose();
      }
    }
    if (product) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [product, onClose]);

  useEffect(() => {
    setQty(1);
  }, [product?.id]);

  if (!product) return null;

  const {
    title,
    price,
    wasPrice,
    isSale,
    badge,
    unitPrice,
    rating = 5,
    reviewsCount = 0,
    status,
    statusTime,
    image,
    description,
    drawingDetails
  } = product;

  const stock = typeof product.stock === 'number' ? product.stock : 20;
  const isOutOfStock = stock <= 0;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close-icon-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="modal-product-grid">
          <div className="modal-img-area">
            {badge && (
              <div className="card-circle-badge" style={{ top: '16px', right: '16px' }}>
                {badge}
              </div>
            )}
            <img src={image} alt={title} className="modal-img" />
          </div>

          <div className="modal-details-area">
            <div>
              {status === 'open' ? (
                <span className="live-indicator">
                  <span className="live-pulse" />
                  {countdownString || 'Drawing Live — Ends Soon'}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#475569',
                    background: '#f1f5f9',
                    padding: '4px 10px',
                    borderRadius: '99px'
                  }}
                >
                  Drawing ended today, {statusTime || '10:00am PDT'}
                </span>
              )}
            </div>

            <h2 className="modal-title">{title}</h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem' }}>
              <span style={{ color: '#ffc220', fontSize: '1rem' }}>★★★★★</span>
              <span style={{ fontWeight: 700 }}>{rating}</span>
              <span style={{ color: '#64748b' }}>({reviewsCount.toLocaleString()} verified collector reviews)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              {isSale ? (
                <>
                  <span style={{ color: '#2a8703', fontSize: '1.65rem', fontWeight: 800 }}>
                    Now ${price.toFixed(2)}
                  </span>
                  {wasPrice && (
                    <span style={{ color: '#64748b', textDecoration: 'line-through', fontSize: '1.1rem' }}>
                      ${wasPrice.toFixed(2)}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: '#0f172a', fontSize: '1.65rem', fontWeight: 800 }}>
                  ${price.toFixed(2)}
                </span>
              )}
              {unitPrice && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{unitPrice}</span>}
            </div>

            <p className="modal-description">{description}</p>

            <div className="modal-specs-box">
              <div className="modal-spec-row">
                <span className="modal-spec-label">Tồn Kho Hiện Tại</span>
                <span className="modal-spec-value" style={{ fontWeight: 700, color: isOutOfStock ? '#ef4444' : stock <= 5 ? '#f59e0b' : '#059669' }}>
                  {isOutOfStock ? 'Hết Hàng' : stock <= 5 ? `Chỉ còn ${stock} sản phẩm!` : `Còn ${stock} sản phẩm`}
                </span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Drawing Status</span>
                <span className="modal-spec-value" style={{ color: status === 'open' ? '#16a34a' : '#64748b' }}>
                  {status === 'open' ? 'Open for Requests' : 'Closed'}
                </span>
              </div>
              {drawingDetails?.totalEntries && (
                <div className="modal-spec-row">
                  <span className="modal-spec-label">Total Verified Entries</span>
                  <span className="modal-spec-value">{drawingDetails.totalEntries.toLocaleString()} collectors</span>
                </div>
              )}
              {drawingDetails?.maxWinners && (
                <div className="modal-spec-row">
                  <span className="modal-spec-label">Allocated Winners</span>
                  <span className="modal-spec-value">{drawingDetails.maxWinners} boxes</span>
                </div>
              )}
              <div className="modal-spec-row">
                <span className="modal-spec-label">Item Condition</span>
                <span className="modal-spec-value">Brand New • Factory Sealed</span>
              </div>
              <div className="modal-spec-row">
                <span className="modal-spec-label">Point TCG Guarantee</span>
                <span className="modal-spec-value">100% Tamper & Reseal Free</span>
              </div>
            </div>

            {/* Quantity Picker for Mua Ngay & Thêm Giỏ */}
            {!isOutOfStock && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1.5px solid #e2e8f0',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                  Chọn số lượng mua:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      cursor: qty <= 1 ? 'not-allowed' : 'pointer',
                      opacity: qty <= 1 ? 0.4 : 1
                    }}
                  >
                    -
                  </button>
                  <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(q => Math.min(stock, q + 1))}
                    disabled={qty >= stock}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      cursor: qty >= stock ? 'not-allowed' : 'pointer',
                      opacity: qty >= stock ? 0.4 : 1
                    }}
                  >
                    +
                  </button>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Tổng: <strong style={{ color: '#0053e2' }}>${(price * qty).toFixed(2)}</strong>
                </span>
              </div>
            )}

            <div className="modal-actions-row">
              {isOutOfStock ? (
                <button
                  type="button"
                  className="card-action-btn btn-out-of-stock"
                  style={{ flex: 1, padding: '14px', fontSize: '0.98rem' }}
                  disabled
                >
                  Sản Phẩm Này Đã Hết Hàng
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="card-action-btn btn-buynow"
                    style={{ flex: 1.2, padding: '12px', fontSize: '0.94rem' }}
                    onClick={() => {
                      if (onBuyNow) {
                        onBuyNow(product, qty);
                      } else if (onAddToCart) {
                        onAddToCart(product, qty);
                      }
                      onClose();
                    }}
                  >
                    Mua Ngay (x{qty}) & Quét QR
                  </button>

                  <button
                    type="button"
                    className="card-action-btn btn-cart"
                    style={{ flex: 1, padding: '12px', fontSize: '0.94rem' }}
                    onClick={() => {
                      onAddToCart(product, qty);
                      onClose();
                    }}
                  >
                    Thêm Vào Giỏ (x{qty})
                  </button>
                </>
              )}

              <button
                type="button"
                className={`card-heart-btn ${isSaved ? 'saved' : ''}`}
                style={{ position: 'static', width: '44px', height: '44px' }}
                onClick={() => onToggleSave(product)}
                aria-label={isSaved ? 'Remove from saved' : 'Save item'}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill={isSaved ? '#ef4444' : 'none'}
                  stroke={isSaved ? '#ef4444' : 'currentColor'}
                  strokeWidth="2.2"
                  style={{ width: '22px', height: '22px' }}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
