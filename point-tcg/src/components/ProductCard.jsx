// src/components/ProductCard.jsx
import React from 'react';

// Star rating component with partial fill support
function StarRating({ rating = 0, count = 0 }) {
  const fullStars = Math.floor(rating);
  const remainder = rating - fullStars;

  return (
    <div className="card-rating-row" aria-label={`Rating: ${rating} out of 5 stars from ${count} reviews`}>
      <div className="stars-wrapper" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          let fillPercent = 0;
          if (starIndex <= fullStars) {
            fillPercent = 100;
          } else if (starIndex === fullStars + 1) {
            fillPercent = Math.round(remainder * 100);
          }

          return (
            <span key={starIndex} style={{ position: 'relative', display: 'inline-block', width: '13px', height: '13px' }}>
              <svg
                viewBox="0 0 24 24"
                fill="#d1d5db"
                style={{ width: '13px', height: '13px', position: 'absolute', top: 0, left: 0 }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {fillPercent > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${fillPercent}%`,
                    overflow: 'hidden',
                    display: 'inline-block',
                    height: '13px'
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="#ffc220"
                    style={{ width: '13px', height: '13px' }}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
              )}
            </span>
          );
        })}
      </div>
      <span className="rating-score">{rating.toFixed(1)}</span>
      {count > 0 && <span className="rating-count">({count.toLocaleString()})</span>}
    </div>
  );
}

function formatPrice(num) {
  const [dollars, cents] = Number(num).toFixed(2).split('.');
  return { dollars, cents };
}

export default function ProductCard({
  product,
  isSaved,
  onToggleSave,
  onAddToCart,
  onRequestJoin,
  onBuyNow,
  onOpenDetails,
  countdownString,
  isCarousel = false
}) {
  const {
    id,
    title,
    price,
    wasPrice,
    isSale,
    badge,
    optionsText,
    unitPrice,
    rating = 5,
    reviewsCount = 0,
    status,
    statusTime,
    image
  } = product;

  const currentPriceFormatted = formatPrice(price);
  const wasPriceFormatted = wasPrice ? Number(wasPrice).toFixed(2) : null;
  const stock = typeof product.stock === 'number' ? product.stock : 20;
  const isOutOfStock = stock <= 0;

  const handleCardClick = (e) => {
    if (e.target.closest('button')) return;
    if (onOpenDetails) onOpenDetails(product);
  };

  const handleActionClick = (e) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    if (status === 'open') {
      if (onRequestJoin) onRequestJoin(product);
    } else {
      if (onAddToCart) onAddToCart(product);
    }
  };

  const handleHeartClick = (e) => {
    e.stopPropagation();
    if (onToggleSave) onToggleSave(product);
  };

  return (
    <article
      className={`product-card ${isCarousel ? 'carousel-card' : ''} ${isOutOfStock ? 'card-out-of-stock' : ''}`}
      onClick={handleCardClick}
      aria-label={title}
    >
      {/* 1. Large Product Image on top */}
      <div className="card-image-box">
        {/* Heart icon button */}
        <button
          type="button"
          className={`card-heart-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleHeartClick}
          aria-label={isSaved ? `Remove ${title} from saved items` : `Save ${title} to My Items`}
          title={isSaved ? 'Saved in My Items' : 'Save to My Items'}
        >
          <svg
            viewBox="0 0 24 24"
            fill={isSaved ? '#ef4444' : 'none'}
            stroke={isSaved ? '#ef4444' : 'currentColor'}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Optional black circular badge at top-right */}
        {badge && (
          <div className="card-circle-badge" aria-label={`Badge: ${badge}`}>
            {badge}
          </div>
        )}

        <img
          src={image}
          alt={title}
          className="card-image"
          loading="lazy"
        />

        {/* Optional text "+ 5 options" centered under the image */}
        {optionsText && (
          <div className="card-options-text">
            {optionsText}
          </div>
        )}
      </div>

      {/* 2. Card Body */}
      <div className="card-body">
        {/* Price Row */}
        <div className="card-price-row">
          {isSale ? (
            <>
              <span className="price-sale-tag">
                <span className="price-prefix">Now</span>
                <span>${currentPriceFormatted.dollars}</span>
                <sup className="cents-sup">{currentPriceFormatted.cents}</sup>
              </span>
              {wasPriceFormatted && (
                <span className="price-was-tag">${wasPriceFormatted}</span>
              )}
            </>
          ) : (
            <span className="price-regular-tag">
              <span>${currentPriceFormatted.dollars}</span>
              <sup className="cents-sup">{currentPriceFormatted.cents}</sup>
            </span>
          )}

          {/* Optional unit price in gray */}
          {unitPrice && (
            <span className="unit-price-tag">{unitPrice}</span>
          )}
        </div>

        {/* Product Title (max 3 lines, ellipsis) */}
        <h3
          className="card-title"
          title={title}
          onClick={() => onOpenDetails && onOpenDetails(product)}
        >
          {title}
        </h3>

        {/* Star Rating with Review Count */}
        <StarRating rating={rating} count={reviewsCount} />

        {/* Status Line & Stock Indicator */}
        <div className="card-meta-indicators">
          <div className="card-status-line">
            {status === 'open' ? (
              <div className="countdown-status-badge">
                <svg
                  className="countdown-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{countdownString || 'Drawing ends in 02:14:33'}</span>
              </div>
            ) : (
              <span>
                Drawing ended today, <strong>{statusTime || '10:00am PDT'}</strong>
              </span>
            )}
          </div>

          <div className="card-stock-row">
            {isOutOfStock ? (
              <span className="card-stock-tag out-of-stock">
                🔴 Hết hàng
              </span>
            ) : stock <= 5 ? (
              <span className="card-stock-tag low-stock" title="Số lượng sản phẩm còn rất ít">
                ⚡ Chỉ còn {stock} sp!
              </span>
            ) : (
              <span className="card-stock-tag in-stock">
                📦 Còn {stock} sp
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons: Mua Ngay (QR) & Thêm Giỏ */}
        {isOutOfStock ? (
          <div className="card-actions-grid single-col">
            <button
              type="button"
              className="card-action-btn btn-out-of-stock"
              disabled
              title="Sản phẩm này tạm thời đã hết hàng"
            >
              <span>🔴 Đã Hết Hàng</span>
            </button>
          </div>
        ) : (
          <div className="card-actions-grid">
            <button
              type="button"
              className="card-action-btn btn-buynow"
              onClick={(e) => {
                e.stopPropagation();
                if (onBuyNow) {
                  onBuyNow(product);
                } else if (onAddToCart) {
                  onAddToCart(product);
                }
              }}
              title="Đặt mua và thanh toán mã QR ngay"
            >
              <span>⚡ Mua Ngay (QR)</span>
            </button>

            <button
              type="button"
              className="card-action-btn btn-cart"
              onClick={(e) => {
                e.stopPropagation();
                if (onAddToCart) onAddToCart(product);
              }}
              title="Thêm vào giỏ hàng"
            >
              <span>🛒 Thêm Giỏ</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
