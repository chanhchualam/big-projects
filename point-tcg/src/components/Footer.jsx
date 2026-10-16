// src/components/Footer.jsx
import React from 'react';

export default function Footer({ onOpenAdminLogin }) {
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
          <a href="#about" className="footer-link" onClick={(e) => { e.preventDefault(); alert('About Point TCG: The premier limited-stock drawing destination for authentic sealed Pokémon trading cards.'); }}>
            About Point TCG
          </a>
          <a href="#help" className="footer-link" onClick={(e) => { e.preventDefault(); alert('Help Center: Drawing entry limits are 1 per household. Selected winners receive an invoice link valid for 24 hours.'); }}>
            Help
          </a>
          <a href="#terms" className="footer-link" onClick={(e) => { e.preventDefault(); alert('Terms of Service: All drawing selections are cryptographically randomized.'); }}>
            Terms
          </a>
          <a href="#privacy" className="footer-link" onClick={(e) => { e.preventDefault(); alert('Privacy Policy: We never sell your personal information.'); }}>
            Privacy
          </a>
        </div>

        {/* Collector reassurance badges */}
        <div className="footer-badges-row">
          <span className="footer-badge-pill">🛡️ PSA & Beckett Compatible Slabs</span>
          <span className="footer-badge-pill">🔒 Verified Factory Heat Shrink</span>
          <span className="footer-badge-pill">⚡ Tamper-Evident Packaging</span>
          <span className="footer-badge-pill">📦 Tracked & Insured Delivery</span>
        </div>
      </div>

      {/* Mandatory exact legal footer */}
      <div className="footer-bottom">
        <p className="footer-legal-text">
          © 2026 Point TCG. Not affiliated with Nintendo, Creatures Inc., GAME FREAK inc., or The Pokémon Company.
        </p>
      </div>
    </footer>
  );
}
