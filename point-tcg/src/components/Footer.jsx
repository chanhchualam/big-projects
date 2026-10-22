// src/components/Footer.jsx
import React from 'react';
import { useI18n } from '../i18n';

export default function Footer({ onOpenAdminLogin, onOpenOrderHistory }) {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="footer-top">
        {/* Brand identity */}
        <div className="footer-brand">
          <img
            src="/logo.jpg"
            alt="Point TCG"
            className="footer-brand-logo-img"
          />
          <span className="footer-brand-title">Point TCG</span>
        </div>

        {/* Links */}
        <div className="footer-links-row">
          <a
            href="#orders"
            className="footer-link"
            style={{ color: '#ffc220', fontWeight: 600 }}
            onClick={(e) => {
              e.preventDefault();
              if (onOpenOrderHistory) onOpenOrderHistory();
            }}
          >
            {t('Track Orders')}
          </a>
          <a href="#about" className="footer-link" onClick={(e) => { e.preventDefault(); alert(t('About Point TCG: The premier limited-stock drawing destination for authentic sealed Pokémon trading cards.')); }}>
            {t('About Point TCG')}
          </a>
          <a href="#help" className="footer-link" onClick={(e) => { e.preventDefault(); alert(t('Help Center: Drawing entry limits are 1 per household. Selected winners receive an invoice link valid for 24 hours.')); }}>
            {t('Help')}
          </a>
          <a href="#terms" className="footer-link" onClick={(e) => { e.preventDefault(); alert(t('Terms of Service: All drawing selections are cryptographically randomized.')); }}>
            {t('Terms')}
          </a>
          <a href="#privacy" className="footer-link" onClick={(e) => { e.preventDefault(); alert(t('Privacy Policy: We never sell your personal information.')); }}>
            {t('Privacy')}
          </a>
        </div>

        {/* Collector reassurance badges */}
        <div className="footer-badges-row">
          <span className="footer-badge-pill">{t('PSA & Beckett Compatible Slabs')}</span>
          <span className="footer-badge-pill">{t('Verified Factory Heat Shrink')}</span>
          <span className="footer-badge-pill">{t('Tamper-Evident Packaging')}</span>
          <span className="footer-badge-pill">{t('Tracked & Insured Delivery')}</span>
        </div>
      </div>

      {/* Mandatory exact legal footer */}
      <div className="footer-bottom">
        <p className="footer-legal-text">
          {t('© 2026 Point TCG. Not affiliated with Nintendo, Creatures Inc., GAME FREAK inc., or The Pokémon Company.')}
        </p>
      </div>
    </footer>
  );
}
