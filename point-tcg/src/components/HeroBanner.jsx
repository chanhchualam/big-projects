// src/components/HeroBanner.jsx
// Banner đầu trang cửa hàng: chữ lớn phía sau, Pikachu (ảnh đã tách nền) đứng đè lên chữ
import React from 'react';
import pikachu from '../assets/hero-pikachu.webp';
import { useI18n } from '../i18n';

export default function HeroBanner({ onShopNow }) {
  const { t } = useI18n();
  return (
    <section className="pika-hero" aria-label="Point TCG">
      <div className="pika-hero-word" aria-hidden="true">POINT TCG</div>
      <div className="pika-hero-glow" aria-hidden="true" />
      <img className="pika-hero-img" src={pikachu} alt="Pikachu" width="612" height="560" />
      <div className="pika-hero-copy">
        <h1 className="pika-hero-tagline">{t('A Home for Pokémon Collectors')}</h1>
        <p className="pika-hero-sub">{t('Hàng Pokémon TCG chính hãng, nguyên seal, giao tận tay người sưu tầm.')}</p>
        <button type="button" className="pika-hero-cta" onClick={onShopNow}>
          {t('Xem sản phẩm')}
        </button>
      </div>
    </section>
  );
}
