// src/components/OrdersModal.jsx
import React, { useState, useEffect } from 'react';
import { getOrdersList } from '../utils/auth';
import { getProductCatalogImage } from '../products';

export default function OrdersModal({ isOpen, onClose, user }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (isOpen) {
      const all = getOrdersList();
      if (user && user.email) {
        // Show user's orders or all local orders if guest
        const userOrders = all.filter(o => o.customerEmail?.toLowerCase() === user.email.toLowerCase());
        setOrders(userOrders.length > 0 ? userOrders : all);
      } else {
        setOrders(all);
      }
    }
  }, [isOpen, user]);

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
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Lịch sử đơn hàng">
      <div className="orders-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close-icon-btn"
          onClick={onClose}
          aria-label="Đóng"
        >
          ✕
        </button>

        <div className="orders-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.8rem' }}>📦</span>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                Lịch Sử Đơn Hàng Point TCG
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                Theo dõi trạng thái các đơn hàng thẻ Pokémon TCG chính hãng bạn đã đặt mua.
              </p>
            </div>
          </div>
        </div>

        <div className="orders-modal-body">
          {orders.length === 0 ? (
            <div className="orders-empty-state">
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛍️</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
                Chưa có đơn hàng nào được ghi nhận
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '6px' }}>
                Hãy thêm sản phẩm Pokémon yêu thích vào giỏ hàng và tiến hành thanh toán nhé!
              </p>
              <button
                type="button"
                className="btn-start-shopping"
                onClick={onClose}
                style={{ marginTop: '16px' }}
              >
                Khám Phá Sản Phẩm Ngay
              </button>
            </div>
          ) : (
            <div className="orders-list-wrap">
              {orders.map((order) => (
                <div key={order.id} className="order-history-card">
                  <div className="order-card-top">
                    <div>
                      <div className="order-code-line">
                        <span>Đơn hàng:</span>
                        <strong className="order-id-tag">#{order.id}</strong>
                      </div>
                      <div className="order-date-line">{order.createdAt}</div>
                    </div>
                    <div className="order-status-badge">
                      <span className="status-dot" />
                      <span>{order.status || 'Đã xác nhận & Chuẩn bị giao'}</span>
                    </div>
                  </div>

                  <div className="order-card-customer-info">
                    <div>Người nhận: <strong>{order.customerName}</strong> ({order.customerPhone || order.customerEmail})</div>
                    <div>Địa chỉ giao: <strong>{order.shippingAddress}</strong></div>
                    <div>Thanh toán qua: <strong>{order.paymentMethod}</strong></div>
                  </div>

                  <div className="order-card-items-list">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="order-card-item-row">
                        <img src={getProductCatalogImage(item) || item.image} alt={item.title} className="order-item-thumb" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="order-item-title">{item.title}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Số lượng: x{item.qty}</div>
                        </div>
                        <div className="order-item-cost">
                          ${(item.price * item.qty).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="order-card-footer">
                    <div className="order-shipping-summary">
                      {order.shippingMethod}
                    </div>
                    <div className="order-total-highlight">
                      <span>Tổng tiền:</span>
                      <strong>${order.total?.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
