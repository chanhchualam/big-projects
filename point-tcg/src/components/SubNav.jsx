// src/components/SubNav.jsx
import React from 'react';
import { useI18n } from '../i18n';

export default function SubNav({ onCategorySelect, activeCategory }) {
  const { t } = useI18n();
  return (
    <nav className="sub-nav-bar" aria-label={t('Secondary navigation')}>
      <div className="sub-nav-inner">
        {/* Quick navigation tags */}
        <div className="sub-nav-chips">
          <button
            type="button"
            className={`sub-chip ${activeCategory === 'all' ? 'highlight' : ''}`}
            onClick={() => onCategorySelect && onCategorySelect('all')}
          >
            {t('All Products')}
          </button>
          <button
            type="button"
            className={`sub-chip ${activeCategory === 'open' ? 'highlight' : ''}`}
            onClick={() => onCategorySelect && onCategorySelect('open')}
          >
            {t('Open Drawings')}
          </button>
          <button
            type="button"
            className={`sub-chip ${activeCategory === 'closed' ? 'highlight' : ''}`}
            onClick={() => onCategorySelect && onCategorySelect('closed')}
          >
            {t('Closed Drawings Archive')}
          </button>
        </div>
      </div>
    </nav>
  );
}
