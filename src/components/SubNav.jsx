// src/components/SubNav.jsx
import React from 'react';

export default function SubNav({ onCategorySelect, activeCategory }) {
  return (
    <nav className="sub-nav-bar" aria-label="Secondary navigation">
      <div className="sub-nav-inner">
        {/* Quick navigation tags */}
        <div className="sub-nav-chips">
          <button
            type="button"
            className={`sub-chip ${activeCategory === 'all' ? 'highlight' : ''}`}
            onClick={() => onCategorySelect && onCategorySelect('all')}
          >
            All Products
          </button>
          <button
            type="button"
            className={`sub-chip ${activeCategory === 'open' ? 'highlight' : ''}`}
            onClick={() => onCategorySelect && onCategorySelect('open')}
          >
            ⚡ Open Drawings
          </button>
          <button
            type="button"
            className={`sub-chip ${activeCategory === 'closed' ? 'highlight' : ''}`}
            onClick={() => onCategorySelect && onCategorySelect('closed')}
          >
            📦 Closed Drawings Archive
          </button>
        </div>
      </div>
    </nav>
  );
}
