// src/components/SavedModal.jsx
import React, { useEffect } from 'react';

export default function SavedModal({
  isOpen,
  onClose,
  savedProducts = [],
  onRemoveSaved,
  onAddToCart,
  onRequestJoin
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="My Saved Items">
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2 className="drawer-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>My Items ({savedProducts.length})</span>
          </h2>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close saved items"
          >
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {savedProducts.length === 0 ? (
            <div className="drawer-empty">
              <div className="drawer-empty-icon">🤍</div>
              <h3>No saved items yet</h3>
              <p>Click the heart icon on any Pokémon card drawing to bookmark items you want to track or reorder.</p>
            </div>
          ) : (
            savedProducts.map((product) => (
              <div key={product.id} className="drawer-item-card">
                <img src={product.image} alt={product.title} className="drawer-item-img" />
                <div className="drawer-item-info">
                  <div>
                    <h4 className="drawer-item-title">{product.title}</h4>
                    <div className="drawer-item-price">${product.price.toFixed(2)}</div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                      {product.status === 'open' ? '⚡ Drawing Open' : '📦 Drawing Closed'}
                    </div>
                  </div>

                  <div className="drawer-item-controls" style={{ marginTop: '10px' }}>
                    {product.status === 'open' ? (
                      <button
                        type="button"
                        className="sub-chip highlight"
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => {
                          onRequestJoin(product);
                        }}
                      >
                        Request to join
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="sub-chip"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', backgroundColor: '#e0f2fe', color: '#0369a1' }}
                        onClick={() => {
                          onAddToCart(product);
                        }}
                      >
                        Add to Cart
                      </button>
                    )}

                    <button
                      type="button"
                      className="item-remove-btn"
                      onClick={() => onRemoveSaved(product.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
