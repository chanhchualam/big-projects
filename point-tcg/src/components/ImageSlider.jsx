// src/components/ImageSlider.jsx
// Trình chiếu ảnh sản phẩm: tự đổi ảnh, vuốt (cảm ứng / chuột), mũi tên và chấm chỉ vị trí.
// Tự dừng khi rê chuột vào hoặc khi người dùng bật "giảm chuyển động" trong hệ điều hành.
import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function ImageSlider({
  images = [],
  alt = '',
  interval = 3500,
  className = '',
  imgClassName = '',
  index: controlledIndex,
  onIndexChange,
  showArrows = true,
  showDots = true
}) {
  const { t } = useI18n();
  const [innerIndex, setInnerIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStartX = useRef(null);
  const dragged = useRef(false);

  const count = images.length;
  const index = controlledIndex ?? innerIndex;
  const setIndex = (next) => {
    const i = ((next % count) + count) % count;
    if (onIndexChange) onIndexChange(i);
    else setInnerIndex(i);
  };

  // Chỉ phụ thuộc vào ảnh đang hiện — thẻ sản phẩm render lại mỗi giây (đồng hồ) không được làm reset hẹn giờ
  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion()) return;
    const timer = setTimeout(() => setIndex(index + 1), interval);
    return () => clearTimeout(timer);
  }, [index, paused, count, interval]);

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count]);

  if (count === 0) return null;
  if (count === 1) {
    return <img src={images[0]} alt={alt} className={imgClassName} loading="lazy" />;
  }

  const onPointerDown = (e) => {
    dragStartX.current = e.clientX;
    dragged.current = false;
  };
  const onPointerUp = (e) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(dx) > 40) {
      dragged.current = true;
      setIndex(index + (dx < 0 ? 1 : -1));
    }
  };

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className={`img-slider ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragStartX.current = null; }}
      // Vuốt xong thì không tính là bấm mở sản phẩm
      onClickCapture={(e) => {
        if (dragged.current) {
          e.stopPropagation();
          e.preventDefault();
          dragged.current = false;
        }
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${alt} — ${t('ảnh {i}/{n}', { i: index + 1, n: count })}`}
    >
      <div className="img-slider-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((src, i) => (
          <div className="img-slider-slide" key={i} aria-hidden={i !== index}>
            <img src={src} alt={`${alt} (${i + 1}/${count})`} className={imgClassName} loading="lazy" draggable="false" />
          </div>
        ))}
      </div>

      {showArrows && (
        <>
          <button type="button" className="img-slider-arrow prev" aria-label={t('Ảnh trước')}
            onClick={(e) => { stop(e); setIndex(index - 1); }}>‹</button>
          <button type="button" className="img-slider-arrow next" aria-label={t('Ảnh tiếp theo')}
            onClick={(e) => { stop(e); setIndex(index + 1); }}>›</button>
        </>
      )}

      {showDots && (
        <div className="img-slider-dots">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={i === index ? 'active' : ''}
              aria-label={t('Xem ảnh {n}', { n: i + 1 })}
              aria-current={i === index}
              onClick={(e) => { stop(e); setIndex(i); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
