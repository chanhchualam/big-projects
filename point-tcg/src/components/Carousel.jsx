// src/components/Carousel.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import ProductCard from './ProductCard';

export default function Carousel({
  products = [],
  savedIds = [],
  onToggleSave,
  onAddToCart,
  onRequestJoin,
  onBuyNow,
  onOpenDetails
}) {
  const containerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const atStart = el.scrollLeft <= 4;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 6;

    setCanScrollLeft(!atStart);
    setCanScrollRight(!atEnd);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);

    const timer = setTimeout(updateScrollButtons, 150);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
      clearTimeout(timer);
    };
  }, [products, updateScrollButtons]);

  const handleScroll = (direction) => {
    const el = containerRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.75;
    const targetScroll = direction === 'left' ? el.scrollLeft - scrollAmount : el.scrollLeft + scrollAmount;

    el.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  if (!products.length) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
        No closed drawings match your search criteria.
      </div>
    );
  }

  return (
    <div className="carousel-wrapper">
      <button
        type="button"
        className="carousel-arrow carousel-arrow-prev"
        onClick={() => handleScroll('left')}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        title="Scroll left"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="carousel-container" ref={containerRef}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isSaved={savedIds.includes(product.id)}
            onToggleSave={onToggleSave}
            onAddToCart={onAddToCart}
            onRequestJoin={onRequestJoin}
            onBuyNow={onBuyNow}
            onOpenDetails={onOpenDetails}
            isCarousel={true}
          />
        ))}
      </div>

      <button
        type="button"
        className="carousel-arrow carousel-arrow-next"
        onClick={() => handleScroll('right')}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        title="Scroll right"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
