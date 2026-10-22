// src/components/Header.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n, LANGUAGES, CURRENCIES } from '../i18n';

// Helper to normalize search text: lowercase, remove accents/diacritics, trim
export const normalizeSearchText = (str) => {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();
};

export default function Header({
  searchQuery,
  setSearchQuery,
  savedCount,
  onOpenSaved,
  cartTotal,
  cartCount,
  onOpenCart,
  user,
  onOpenSignIn,
  onSignOut,
  onOpenAdmin,
  onOpenOrders,
  pendingOrdersCount,
  products = [],
  onSelectProduct,
  onLogoClick,
  notificationBell = null
}) {
  const { t, lang, setLang, currency, setCurrency, money } = useI18n();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const dropdownRef = useRef(null);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-word accent-insensitive product search for autocomplete suggestions
  const searchResults = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return [];
    const normalized = normalizeSearchText(searchQuery);
    const keywords = normalized.split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return [];

    return (products || []).filter((item) => {
      const target = normalizeSearchText([
        item.title,
        item.description,
        item.badge,
        item.category,
        item.optionsText,
        item.details
      ].filter(Boolean).join(' '));
      return keywords.every((kw) => target.includes(kw));
    });
  }, [products, searchQuery]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setIsSearchFocused(false);

    // If on product page, return to store catalog to show search results
    if (onLogoClick) {
      onLogoClick();
    }

    // Smoothly scroll down to product catalog section
    setTimeout(() => {
      const catalogEl = document.getElementById('products-catalog-section') || document.querySelector('.section-toolbar');
      if (catalogEl) {
        const yOffset = -90; // account for sticky header height
        const y = catalogEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSelectSuggestion = (product) => {
    setIsSearchFocused(false);
    if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  return (
    <header className="site-header">
      <div className="header-top">
        {/* Left: Original Point TCG Logo & Wordmark */}
        <a
          href="#"
          className="brand-logo-link"
          aria-label="Point TCG Home"
          onClick={(e) => {
            e.preventDefault();
            if (onLogoClick) onLogoClick();
          }}
        >
          {/* New 3D Charizard Point TCG Logo */}
          <img
            src="/logo.jpg"
            alt="Point TCG"
            className="brand-logo-img"
          />
          <span className="brand-name">Point TCG</span>
        </a>

        {/* Center: Large rounded pill search bar with instant autocomplete */}
        <div className="header-search-container" ref={searchContainerRef}>
          <form className="header-search-form" onSubmit={handleSearchSubmit} role="search">
            <input
              type="text"
              inputMode="search"
              role="searchbox"
              className="search-input"
              placeholder={t('Search everything at Point TCG (Booster, 151, Pikachu...)')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isSearchFocused) setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsSearchFocused(false);
                }
              }}
              aria-label={t('Search everything at Point TCG')}
              autoComplete="off"
              spellCheck="false"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchFocused(false);
                }}
                title={t('Clear search')}
                aria-label={t('Clear search')}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              className="search-submit-btn"
              aria-label={t('Search')}
              title={t('Search')}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.0" y2="16.0" />
              </svg>
            </button>
          </form>

          {/* Instant Dropdown Suggestions */}
          {isSearchFocused && searchQuery.trim().length > 0 && (
            <div className="search-suggestions-dropdown" role="listbox">
              <div className="search-suggestions-header">
                <span className="suggestions-count-text">
                  {searchResults.length > 0 ? (
                    <>{t('Tìm thấy')} <strong>{searchResults.length}</strong> {t('sản phẩm phù hợp')}</>
                  ) : (
                    <>{t('Không có sản phẩm phù hợp')}</>
                  )}
                </span>
                <span className="search-esc-hint">{t('Nhấn Enter để xem kết quả')}</span>
              </div>

              {searchResults.length > 0 ? (
                <div className="search-suggestions-list">
                  {searchResults.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="search-suggestion-item"
                      onClick={() => handleSelectSuggestion(item)}
                      role="option"
                    >
                      <div className="suggestion-thumb-wrap">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="suggestion-thumb-img"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="suggestion-thumb-fallback"></div>
                        )}
                      </div>
                      <div className="suggestion-info">
                        <div className="suggestion-title">{item.title}</div>
                        <div className="suggestion-meta">
                          <span className="suggestion-price">
                            {money(item.price)}
                          </span>
                          {item.wasPrice && (
                            <span className="suggestion-was-price">
                              {money(item.wasPrice)}
                            </span>
                          )}
                          {item.badge && <span className="suggestion-badge">{item.badge}</span>}
                          <span className="suggestion-stock-tag">
                            {typeof item.stock === 'number' ? (item.stock > 0 ? t('Còn {n}', { n: item.stock }) : t('Hết hàng')) : t('Còn hàng')}
                          </span>
                        </div>
                      </div>
                      <div className="suggestion-action-hint">
                        <span>{t('Chi tiết')}</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="search-no-suggestions">
                  <p className="no-sugg-title">{t('Không tìm thấy sản phẩm nào khớp với')} <strong>"{searchQuery}"</strong></p>
                  <p className="no-sugg-sub">{t('Gợi ý từ khóa tìm nhanh:')}</p>
                  <div className="search-quick-tags">
                    {['Booster Box', '151', 'Charizard', 'Pikachu', 'Crown Zenith', 'Elite Trainer'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="search-quick-tag-btn"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchQuery(tag);
                          setIsSearchFocused(false);
                          setTimeout(() => {
                            const catalogEl = document.getElementById('products-catalog-section') || document.querySelector('.section-toolbar');
                            if (catalogEl) {
                              const y = catalogEl.getBoundingClientRect().top + window.pageYOffset - 90;
                              window.scrollTo({ top: y, behavior: 'smooth' });
                            }
                          }, 50);
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div
                  className="search-suggestions-footer"
                  onClick={handleSearchSubmit}
                  role="button"
                  tabIndex={0}
                >
                  <span>{t('Xem tất cả')} <strong>{searchResults.length}</strong> {t('sản phẩm cho')} "{searchQuery}"</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>        {/* Right: Actions */}
        <div className="header-actions">
          {/* Reorder / My Items with heart icon */}
          <button
            type="button"
            className="header-btn"
            onClick={onOpenSaved}
            aria-label={t('My Items, {n} saved items', { n: savedCount })}
          >
            <svg
              className="header-btn-icon"
              viewBox="0 0 24 24"
              fill={savedCount > 0 ? '#ffc220' : 'none'}
              stroke={savedCount > 0 ? '#ffc220' : 'currentColor'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {savedCount > 0 && <span className="header-badge">{savedCount}</span>}
            <div className="header-btn-label">
              <span className="header-btn-sub">{t('Reorder')}</span>
              <span>{t('My Items')}</span>
            </div>
          </button>

          {notificationBell}

          {/* Order History button */}
          <button
            type="button"
            className="header-btn"
            onClick={onOpenOrders}
            aria-label={t('Track Orders')}
            title={t('Track Orders')}
          >
            <svg className="header-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            {pendingOrdersCount > 0 && <span className="header-badge">{pendingOrdersCount}</span>}
            <div className="header-btn-label">
              <span className="header-btn-sub">{t('Track')}</span>
              <span>{t('Orders')}</span>
            </div>
          </button>

          {/* Sign In / Account */}
          {user ? (
            <div className="user-menu-wrapper" ref={dropdownRef}>
              <button
                type="button"
                className="header-btn"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                aria-expanded={userDropdownOpen}
                aria-label={t('Account menu for {name}', { name: user.name })}
              >
                <svg
                  className="header-btn-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <div className="header-btn-label">
                  <span className="header-btn-sub">{t('Account')}</span>
                  <span>{t('Hi, {name}', { name: user.name })}</span>
                </div>
              </button>

              {userDropdownOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown-header">
                    <p className="user-dropdown-name">{user.name}</p>
                    <p className="user-dropdown-email">{user.email || 'collector@pointtcg.com'}</p>
                  </div>

                  <button
                    type="button"
                    className="user-dropdown-item"
                    style={{ fontWeight: 700, color: '#0f172a', background: '#f8fafc' }}
                    onClick={() => {
                      setUserDropdownOpen(false);
                      if (onOpenOrders) onOpenOrders('profile');
                    }}
                  >
                    {t('Thông tin tài khoản của tôi')}
                  </button>

                  {user.role === 'admin' && (
                    <button
                      type="button"
                      className="user-dropdown-item"
                      style={{ color: '#0053e2', fontWeight: 700, backgroundColor: '#f0f5ff' }}
                      onClick={() => {
                        setUserDropdownOpen(false);
                        if (onOpenAdmin) onOpenAdmin();
                      }}
                    >
                      {t('Vào trang quản trị')}
                    </button>
                  )}

                  <button
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenSaved();
                    }}
                  >
                    {t('My Saved Drawings ({n})', { n: savedCount })}
                  </button>

                  <button
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      if (onOpenOrders) onOpenOrders();
                    }}
                  >
                    {user.role === 'customer' ? t('Đơn hàng của tôi') : t('Tất cả đơn hàng')}
                  </button>

                  <button
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      alert(t('Bạn đang có lượt tham gia rút thăm Pokémon TCG chờ kết quả mở giải!'));
                    }}
                  >
                    {t('My Drawing Entries')}
                  </button>

                  <button
                    type="button"
                    className="user-dropdown-item"
                    style={{ color: '#dc2626' }}
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onSignOut();
                    }}
                  >
                    {t('Đăng xuất')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="header-btn"
              onClick={() => onOpenSignIn('login')}
              aria-label={t('Sign In or Create Account')}
            >
              <svg
                className="header-btn-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div className="header-btn-label">
                <span className="header-btn-sub">{t('Sign In')}</span>
                <span>{t('Account')}</span>
              </div>
            </button>
          )}

          {/* Chọn ngôn ngữ giao diện */}
          <div className="lang-switch" role="group" aria-label={t('Ngôn ngữ')}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className={lang === l.code ? 'active' : ''}
                onClick={() => setLang(l.code)}
                aria-pressed={lang === l.code}
                title={l.name}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Chọn tiền tệ hiển thị giá */}
          <div className="lang-switch currency-switch" role="group" aria-label={t('Tiền tệ')}>
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                type="button"
                className={currency === c.code ? 'active' : ''}
                onClick={() => setCurrency(c.code)}
                aria-pressed={currency === c.code}
                title={c.name}
              >
                {c.code === 'vnd' ? '₫' : '$'}
              </button>
            ))}
          </div>

          {/* Cart Icon showing total price */}
          <button
            type="button"
            className="header-btn cart-btn"
            onClick={onOpenCart}
            aria-label={t('Shopping Cart, total {total}, {n} items', { total: money(cartTotal), n: cartCount })}
          >
            <svg
              className="header-btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && <span className="header-badge">{cartCount}</span>}
            <span className="cart-price-tag">{money(cartTotal)}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
