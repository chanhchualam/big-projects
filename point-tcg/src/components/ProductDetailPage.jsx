// src/components/ProductDetailPage.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import RestockNotify from './RestockNotify';
import { getProductImages } from '../utils/productImages';

function stars(n) {
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

// Price helpers matching Vietnamese e-commerce stores
export function toVnd(price) {
  if (typeof price !== 'number') {
    price = parseFloat(price) || 0;
  }
  if (price >= 1000) {
    return price;
  }
  // Convert standard USD price to VND (approx 25,000 VND / USD, rounded to 10k)
  return Math.round((price * 25000) / 10000) * 10000;
}

export function formatVnd(price) {
  const vnd = toVnd(price);
  return vnd.toLocaleString('vi-VN') + '₫';
}

export function getDiscountPercent(price, wasPrice) {
  if (!wasPrice || wasPrice <= price) return 16;
  const p = toVnd(price);
  const wp = toVnd(wasPrice);
  return Math.max(5, Math.round(((wp - p) / wp) * 100));
}

export default function ProductDetailPage({
  product,
  allProducts = [],
  onBackToStore,
  onSelectProduct,
  onAddToCart,
  onBuyNow,
  isSaved,
  onToggleSave,
  user,
  onOpenAdminEdit,
  reviews = [],
  onRequestRestock
}) {
  const [qty, setQty] = useState(1);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('desc'); // 'desc' | 'reviews'
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  // Reset state when product changes
  useEffect(() => {
    setQty(1);
    setActiveImgIndex(0);
    setIsDescExpanded(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Track recently viewed products in localStorage
    if (product && product.id) {
      try {
        const stored = JSON.parse(localStorage.getItem('point-tcg-recently-viewed') || '[]');
        const updated = [product.id, ...stored.filter((id) => id !== product.id)].slice(0, 10);
        localStorage.setItem('point-tcg-recently-viewed', JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not save recently viewed:', e);
      }
    }
  }, [product?.id]);

  if (!product) return null;

  const stock = typeof product.stock === 'number' ? product.stock : 25;
  const isOutOfStock = stock <= 0;
  const discountPercent = getDiscountPercent(product.price, product.wasPrice);
  const vndPrice = formatVnd(product.price);
  const vndWasPrice = product.wasPrice ? formatVnd(product.wasPrice) : formatVnd(product.price * 1.19);
  const productIdCode = `SP${(product.id || '').replace(/\D/g, '').padStart(6, '0') || '001305'}`;

  // Ảnh thật của sản phẩm: ảnh chính + ảnh phụ admin tải lên
  const galleryImages = useMemo(
    () => getProductImages(product).map((src, i) => ({ id: i, label: `Ảnh ${i + 1}`, src })),
    [product.image, product.gallery]
  );

  // Tự đổi ảnh chính khi có nhiều ảnh; dừng khi rê chuột vào khung ảnh
  const [galleryPaused, setGalleryPaused] = useState(false);
  const swipeStartX = useRef(null);
  useEffect(() => {
    if (galleryImages.length < 2 || galleryPaused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setTimeout(() => setActiveImgIndex((i) => (i + 1) % galleryImages.length), 4000);
    return () => clearTimeout(timer);
  }, [activeImgIndex, galleryImages.length, galleryPaused]);

  // Related products from same store catalog (excluding current product)
  const relatedProducts = useMemo(() => {
    return allProducts
      .filter((p) => p.id !== product.id)
      .slice(0, 6);
  }, [allProducts, product.id]);

  // Recently viewed products
  const recentlyViewedProducts = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('point-tcg-recently-viewed') || '[]');
      return stored
        .filter((id) => id !== product.id)
        .map((id) => allProducts.find((p) => p.id === id))
        .filter(Boolean)
        .slice(0, 6);
    } catch {
      return [];
    }
  }, [allProducts, product.id]);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopyNotice(true);
      setTimeout(() => setCopyNotice(false), 2500);
    } catch (e) {
      alert('Đã sao chép liên kết sản phẩm!');
    }
  };

  const handlePrevImg = () => {
    setActiveImgIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };

  const handleNextImg = () => {
    setActiveImgIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  const handleAddToCartClick = () => {
    if (isOutOfStock) return;
    onAddToCart && onAddToCart(product, qty);
  };

  const handleBuyNowClick = () => {
    if (isOutOfStock) return;
    onBuyNow && onBuyNow(product, qty);
  };

  return (
    <div className="product-detail-page-wrapper">
      {/* 1. Breadcrumbs */}
      <nav className="pdp-breadcrumbs" aria-label="Breadcrumb">
        <div className="pdp-container">
          <button type="button" className="breadcrumb-link" onClick={onBackToStore}>
            Trang chủ
          </button>
          <span className="breadcrumb-separator">/</span>
          <button type="button" className="breadcrumb-link" onClick={onBackToStore}>
            TCG Products
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{product.title}</span>
        </div>
      </nav>

      <div className="pdp-container">
        {/* 2. Top Product Grid: Left Gallery + Right Purchase Actions */}
        <div className="pdp-main-grid">
          {/* LEFT: Image Gallery & Social Share */}
          <div className="pdp-gallery-column">
            <div className="pdp-gallery-layout">
              {/* Vertical Thumbnail Strip (chỉ khi có nhiều ảnh) */}
              {galleryImages.length > 1 && (
              <div className="pdp-thumbnails-strip">
                {galleryImages.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    className={`pdp-thumb-btn ${activeImgIndex === idx ? 'active' : ''}`}
                    onClick={() => setActiveImgIndex(idx)}
                    onMouseEnter={() => setActiveImgIndex(idx)}
                    title={img.label}
                  >
                    <img src={img.src} alt={img.label} className="pdp-thumb-img" />
                  </button>
                ))}
              </div>
              )}

              {/* Main Showcase Showcase Box */}
              <div
                className="pdp-main-image-frame"
                onMouseEnter={() => setGalleryPaused(true)}
                onMouseLeave={() => setGalleryPaused(false)}
                onPointerDown={(e) => { swipeStartX.current = e.clientX; }}
                onPointerUp={(e) => {
                  if (swipeStartX.current === null) return;
                  const dx = e.clientX - swipeStartX.current;
                  swipeStartX.current = null;
                  if (Math.abs(dx) > 40 && galleryImages.length > 1) (dx < 0 ? handleNextImg : handlePrevImg)();
                }}
              >
                {/* Top Banner Tag */}
                <div className="pdp-frame-header-banner">
                  <span>CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG</span>
                </div>

                {/* Top-left Discount Tag */}
                <div className="pdp-frame-discount-tag">
                  <span className="discount-val">-{discountPercent}%</span>
                  <span className="discount-lbl">OFF</span>
                </div>

                {/* Center Image */}
                <div className="pdp-image-viewport">
                  <img
                    src={galleryImages[activeImgIndex]?.src || product.image}
                    alt={product.title}
                    className="pdp-active-main-img"
                    draggable="false"
                  />
                </div>

                {/* Left / Right Carousel Arrows */}
                {galleryImages.length > 1 && (
                <>
                <button
                  type="button"
                  className="pdp-arrow-btn prev"
                  onClick={handlePrevImg}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="pdp-arrow-btn next"
                  onClick={handleNextImg}
                  aria-label="Next image"
                >
                  ›
                </button>
                <div className="pdp-img-counter">{activeImgIndex + 1}/{galleryImages.length}</div>
                </>
                )}

                {/* Bottom Authenticity Strip */}
                <div className="pdp-frame-footer-badges">
                  <div className="pdp-console-badges">
                    <span className="console-pill playstation">PS</span>
                    <span className="console-pill switch">Nintendo</span>
                    <span className="console-pill poke">Pokéball Seal</span>
                  </div>
                  <div className="pdp-store-mark">Point TCG Gamestore</div>
                </div>
              </div>
            </div>

            {/* Social Share Bar */}
            <div className="pdp-social-share-row">
              <span className="share-title">Chia sẻ:</span>
              <button
                type="button"
                className="social-btn facebook"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
                title="Chia sẻ Facebook"
              >
                f
              </button>
              <button
                type="button"
                className="social-btn messenger"
                onClick={() => window.open(`https://www.messenger.com/t/?link=${encodeURIComponent(window.location.href)}`, '_blank')}
                title="Gửi Messenger"
              >
                💬
              </button>
              <button
                type="button"
                className="social-btn twitter"
                onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(product.title)}&url=${encodeURIComponent(window.location.href)}`, '_blank')}
                title="Đăng lên X"
              >
                𝕏
              </button>
              <button
                type="button"
                className="social-btn pinterest"
                onClick={() => window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.href)}&description=${encodeURIComponent(product.title)}`, '_blank')}
                title="Ghim Pinterest"
              >
                P
              </button>
              <button
                type="button"
                className="social-btn copylink"
                onClick={handleCopyLink}
                title="Sao chép liên kết"
              >
                🔗
              </button>
              {copyNotice && <span className="copy-notice-toast">✓ Đã sao chép liên kết!</span>}
            </div>
          </div>

          {/* RIGHT: Product Details & Purchase Controls */}
          <div className="pdp-details-column">
            {/* Title */}
            <h1 className="pdp-product-title">{product.title}</h1>

            {/* Meta row: SKU, Status, Brand */}
            <div className="pdp-meta-row">
              <span className="pdp-meta-item">
                Mã sản phẩm: <strong className="sku-code">{productIdCode}</strong>
              </span>
              <span className="pdp-meta-divider">|</span>
              <span className="pdp-meta-item">
                Tình trạng:{' '}
                {isOutOfStock ? (
                  <strong className="status-out">Hết hàng</strong>
                ) : (
                  <strong className="status-in">Còn hàng ({stock} sản phẩm)</strong>
                )}
              </span>
              <span className="pdp-meta-divider">|</span>
              <span className="pdp-meta-item">
                Thương hiệu: <strong className="brand-name-tag">Pokémon</strong>
              </span>
            </div>

            {/* Price Box */}
            <div className="pdp-price-box">
              <span className="pdp-price-label">Giá:</span>
              <span className="pdp-current-price">{vndPrice}</span>
              {vndWasPrice && (
                <span className="pdp-was-price">{vndWasPrice}</span>
              )}
              {discountPercent > 0 && (
                <span className="pdp-discount-badge">-{discountPercent}%</span>
              )}
              <span className="pdp-usd-sub">(${product.price.toFixed(2)} USD)</span>
            </div>

            {/* Quantity Stepper */}
            <div className="pdp-quantity-row">
              <label htmlFor="pdp-qty-input" className="pdp-qty-label">
                Số lượng:
              </label>
              <div className="pdp-qty-stepper">
                <button
                  type="button"
                  className="pdp-qty-btn"
                  onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                  disabled={qty <= 1 || isOutOfStock}
                >
                  −
                </button>
                <input
                  id="pdp-qty-input"
                  type="number"
                  min="1"
                  max={stock}
                  value={qty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setQty(Math.min(stock, Math.max(1, val)));
                    }
                  }}
                  className="pdp-qty-input"
                  disabled={isOutOfStock}
                />
                <button
                  type="button"
                  className="pdp-qty-btn"
                  onClick={() => setQty((prev) => Math.min(stock, prev + 1))}
                  disabled={qty >= stock || isOutOfStock}
                >
                  +
                </button>
              </div>
            </div>

            {isOutOfStock && onRequestRestock && (
              <div className="pdp-restock-box">
                <p>Sản phẩm tạm hết hàng. Để lại email, shop sẽ báo ngay khi có hàng lại.</p>
                <RestockNotify product={product} defaultEmail={user?.email} onRequestRestock={onRequestRestock} />
              </div>
            )}

            {/* Large Primary Red CTA: MUA NGAY */}
            <button
              type="button"
              className="pdp-big-buy-now-btn"
              onClick={handleBuyNowClick}
              disabled={isOutOfStock}
            >
              <div className="big-buy-title">MUA NGAY</div>
              <div className="big-buy-sub">Giao Tận Nơi Hoặc Nhận Tại Cửa Hàng</div>
            </button>

            {/* Secondary Action Buttons (Add to cart & Buy now) */}
            <div className="pdp-dual-actions">
              <button
                type="button"
                className="pdp-secondary-btn add-to-cart"
                onClick={handleAddToCartClick}
                disabled={isOutOfStock}
              >
                THÊM VÀO GIỎ
              </button>
              <button
                type="button"
                className="pdp-secondary-btn buy-now"
                onClick={handleBuyNowClick}
                disabled={isOutOfStock}
              >
                MUA NGAY
              </button>
            </div>

            {/* 6 Guarantee & Trust Badges */}
            <div className="pdp-trust-grid">
              <div className="pdp-trust-item">
                <span className="trust-icon">🛡️</span>
                <span className="trust-label">Cam kết 100% chính hãng</span>
              </div>
              <div className="pdp-trust-item">
                <span className="trust-icon">🚚</span>
                <span className="trust-label">Miễn phí giao hàng</span>
              </div>
              <div className="pdp-trust-item">
                <span className="trust-icon">📞</span>
                <span className="trust-label">Hỗ trợ 24/7</span>
              </div>
              <div className="pdp-trust-item">
                <span className="trust-icon">💎</span>
                <span className="trust-label">Hoàn tiền 111% nếu hàng giả</span>
              </div>
              <div className="pdp-trust-item">
                <span className="trust-icon">📦</span>
                <span className="trust-label">Mở hộp kiểm tra nhận hàng</span>
              </div>
              <div className="pdp-trust-item">
                <span className="trust-icon">🔄</span>
                <span className="trust-label">Đổi trả trong 7 ngày</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Product Tabs Section: MÔ TẢ SẢN PHẨM / ĐÁNH GIÁ SẢN PHẨM */}
        <section className="pdp-tabs-section">
          <div className="pdp-tabs-header">
            <button
              type="button"
              className={`pdp-tab-nav-btn ${activeTab === 'desc' ? 'active' : ''}`}
              onClick={() => setActiveTab('desc')}
            >
              MÔ TẢ SẢN PHẨM
            </button>
            <button
              type="button"
              className={`pdp-tab-nav-btn ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              ĐÁNH GIÁ SẢN PHẨM ({reviews.length})
            </button>
          </div>

          <div className="pdp-tab-content">
            {activeTab === 'desc' ? (
              <div className="pdp-description-body">
                <h2 className="pdp-desc-heading">{product.title}</h2>


                {/* Description details */}
                <div className={`pdp-desc-text-wrapper ${isDescExpanded ? 'expanded' : 'collapsed'}`}>
                  {product.description ? (
                    <div style={{ whiteSpace: 'pre-line', fontSize: '1rem', lineHeight: '1.8', color: '#334155', marginBottom: '20px' }}>
                      {product.description}
                    </div>
                  ) : (
                    <p>
                      <strong>{product.title}</strong> là bộ sưu tập cao cấp chính hãng từ The Pokémon Company,
                      được nhập khẩu nguyên seal 100% với tem niêm phong tiêu chuẩn quốc tế.
                    </p>
                  )}

                  <h3 className="pdp-subheading">Đặc điểm nổi bật & Cam kết từ Point TCG:</h3>
                  <ul className="pdp-features-list">
                    <li>✓ <strong>Nguyên Seal 100%:</strong> Hộp mới chưa qua khui mở, đảm bảo tỷ lệ kéo bài (pull rate) chuẩn quốc tế.</li>
                    <li>✓ <strong>Cam Kết Chính Hãng:</strong> Hoàn tiền 111% nếu phát hiện sản phẩm re-seal hoặc hàng giả mạo.</li>
                    <li>✓ <strong>Đóng Gói Chuyên Nghiệp:</strong> Quấn 3 lớp màng bóng khí chống sốc, bọc góc carton bảo vệ tuyệt đối khi vận chuyển.</li>
                    <li>✓ <strong>Kiểm Tra Khi Nhận Hàng:</strong> Cho phép mở hộp kiểm tra ngoại quan trước khi thanh toán, đổi trả trong 7 ngày.</li>
                  </ul>
                </div>

                <div className="pdp-expand-button-wrapper">
                  <button
                    type="button"
                    className="pdp-toggle-expand-btn"
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                  >
                    {isDescExpanded ? '− Thu gọn nội dung' : '+ Xem thêm nội dung'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pdp-reviews-body">
                {reviews.length === 0 ? (
                  <div className="pdp-reviews-summary">
                    <div className="pdp-score-total">
                      Chưa có đánh giá nào. Khách đã nhận hàng có thể đánh giá trong mục "Tài khoản › Đánh giá đơn hàng".
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="pdp-reviews-summary">
                      <div className="pdp-score-big">{(product.rating || 0).toFixed(1)}</div>
                      <div className="pdp-score-stars" style={{ color: '#f59e0b' }}>{stars(Math.round(product.rating || 0))}</div>
                      <div className="pdp-score-total">Dựa trên {reviews.length} đánh giá từ người mua đã xác thực</div>
                    </div>

                    <div className="pdp-reviews-list">
                      {[...reviews]
                        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                        .map((r) => (
                          <div key={r.id} className="pdp-review-card">
                            <div className="pdp-reviewer-header">
                              <strong>{r.name || 'Khách hàng'}</strong>
                              <span className="verified-badge">✓ Đã mua hàng tại Point TCG</span>
                              <span className="review-date">
                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : ''}
                              </span>
                            </div>
                            <div className="review-stars" style={{ color: '#f59e0b' }}>{stars(r.rating)}</div>
                            {r.comment && <p className="review-text">{r.comment}</p>}
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 4. Section: Sản phẩm liên quan */}
        {relatedProducts.length > 0 && (
          <section className="pdp-related-section">
            <div className="pdp-section-header">
              <h2 className="pdp-section-heading">Sản phẩm liên quan</h2>
              <div className="pdp-carousel-nav-arrows">
                <button
                  type="button"
                  className="carousel-mini-arrow"
                  onClick={() => {
                    const el = document.getElementById('pdp-related-scroll');
                    if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
                  }}
                  aria-label="Scroll related left"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="carousel-mini-arrow"
                  onClick={() => {
                    const el = document.getElementById('pdp-related-scroll');
                    if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
                  }}
                  aria-label="Scroll related right"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="pdp-products-carousel" id="pdp-related-scroll">
              {relatedProducts.map((item) => {
                const itemDisc = getDiscountPercent(item.price, item.wasPrice);
                const itemVnd = formatVnd(item.price);
                const itemWasVnd = item.wasPrice ? formatVnd(item.wasPrice) : null;

                return (
                  <div
                    key={item.id}
                    className="pdp-showcase-card"
                    onClick={() => onSelectProduct && onSelectProduct(item)}
                  >
                    {/* Image frame */}
                    <div className="card-frame-visual">
                      <div className="card-top-red-band">CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG</div>
                      {itemDisc > 0 && <span className="card-discount-tag">-{itemDisc}%</span>}
                      <img src={item.image} alt={item.title} className="card-product-img" />
                      <div className="card-bottom-cert">
                        <span>PS</span>
                        <span>Switch</span>
                        <span>Point TCG</span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="card-content-area">
                      <div className="card-brand-label">POKÉMON</div>
                      <h3 className="card-title-text" title={item.title}>
                        {item.title}
                      </h3>

                      <div className="card-prices-line">
                        <span className="card-current-price">{itemVnd}</span>
                        {itemWasVnd && <span className="card-was-price">{itemWasVnd}</span>}
                      </div>

                      <button
                        type="button"
                        className="card-quick-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCart && onAddToCart(item, 1);
                        }}
                      >
                        <span>THÊM VÀO GIỎ</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. Section: Sản phẩm đã xem */}
        {recentlyViewedProducts.length > 0 && (
          <section className="pdp-viewed-section">
            <div className="pdp-section-header">
              <h2 className="pdp-section-heading">Sản phẩm đã xem</h2>
            </div>

            <div className="pdp-products-carousel">
              {recentlyViewedProducts.map((item) => {
                const itemDisc = getDiscountPercent(item.price, item.wasPrice);
                const itemVnd = formatVnd(item.price);
                const itemWasVnd = item.wasPrice ? formatVnd(item.wasPrice) : null;

                return (
                  <div
                    key={item.id}
                    className="pdp-showcase-card"
                    onClick={() => onSelectProduct && onSelectProduct(item)}
                  >
                    <div className="card-frame-visual">
                      <div className="card-top-red-band">CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG</div>
                      {itemDisc > 0 && <span className="card-discount-tag">-{itemDisc}%</span>}
                      <img src={item.image} alt={item.title} className="card-product-img" />
                    </div>

                    <div className="card-content-area">
                      <div className="card-brand-label">POKÉMON</div>
                      <h3 className="card-title-text" title={item.title}>
                        {item.title}
                      </h3>

                      <div className="card-prices-line">
                        <span className="card-current-price">{itemVnd}</span>
                        {itemWasVnd && <span className="card-was-price">{itemWasVnd}</span>}
                      </div>

                      <button
                        type="button"
                        className="card-quick-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCart && onAddToCart(item, 1);
                        }}
                      >
                        <span>THÊM VÀO GIỎ</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* 6. Newsletter Subscription Bar */}
      <section className="pdp-newsletter-section">
        <div className="pdp-container pdp-newsletter-inner">
          <div className="pdp-newsletter-left">
            <span className="newsletter-title">Đăng ký nhận tin</span>
            <form
              className="newsletter-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (newsletterEmail.trim()) {
                  setNewsletterSubscribed(true);
                  setNewsletterEmail('');
                }
              }}
            >
              <div className="newsletter-input-wrap">
                <span className="newsletter-icon">✉</span>
                <input
                  type="email"
                  required
                  placeholder="Nhập email của bạn"
                  className="newsletter-input"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="newsletter-submit-btn">
                {newsletterSubscribed ? 'ĐÃ ĐĂNG KÝ!' : 'ĐĂNG KÝ'}
              </button>
            </form>
          </div>

          <div className="pdp-newsletter-right">
            <span className="social-connect-title">Kết nối với chúng tôi</span>
            <div className="social-icons-row">
              <span className="social-circle-icon">f</span>
              <span className="social-circle-icon">♪</span>
              <span className="social-circle-icon">📷</span>
              <span className="social-circle-icon">💬</span>
              <span className="social-circle-icon">▶</span>
              <span className="social-circle-icon">𝕏</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
