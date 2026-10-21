// src/components/CustomerOrdersPage.jsx
// Trang Tài Khoản & Lịch Sử Đơn Hàng Dành Cho Khách Hàng (Customer Orders & Account Portal)
import React, { useState, useMemo, useEffect } from 'react';
import { getProductCatalogImage } from '../products';
import { usdToVnd } from '../utils/currency';
import { OrderTimeline, TrackingInfo, ProfileEditor, ReviewsPanel } from './AccountPanels';

// Must match customerCancellableStatuses() in firestore.rules
const CUSTOMER_CANCELLABLE_STATUSES = [
  'Chờ thanh toán QR (Đơn mới)',
  'Chờ xác nhận (Đơn mới)',
  'Khách báo đã chuyển khoản (Chờ xác nhận)'
];

// Helper format VND
function formatVndPrice(usdPrice) {
  if (typeof usdPrice !== 'number') {
    usdPrice = parseFloat(usdPrice) || 0;
  }
  const vnd = usdToVnd(usdPrice);
  return vnd.toLocaleString('vi-VN') + '₫';
}

export default function CustomerOrdersPage({
  currentUser,
  initialTab = 'orders',
  onUpdateCurrentUser,
  reviews = [],
  onReviewSaved,
  orders = [],
  onUpdateOrderStatus,
  onAddToCart,
  onBackToStore,
  onOpenSignIn,
  onOpenProductDetail
}) {
  // Navigation sidebar tab: 'orders' | 'profile' | 'addresses' | 'reviews'
  const [activeMenuTab, setActiveMenuTab] = useState(initialTab || 'orders');
  useEffect(() => {
    setActiveMenuTab(initialTab || 'orders');
  }, [initialTab]);

  // Order status filter tabs:
  // 'pending_confirm' (Chờ xác nhận) | 'pending_pickup' (Chờ lấy hàng) | 'shipping' (Đang giao hàng) | 'delivered' (Đã giao) | 'returned' (Trả hàng) | 'cancelled' (Đã huỷ)
  const [activeStatusTab, setActiveStatusTab] = useState('pending_confirm');

  // Search query within orders
  const [searchQuery, setSearchQuery] = useState('');

  // Selected order for detailed modal view
  const [viewingOrderDetail, setViewingOrderDetail] = useState(null);

  // User profile state
  const displayName = currentUser?.name || 'Khách';
  const displayEmail = currentUser?.email || 'Chưa đăng nhập';
  const displayPhone = currentUser?.phone || 'Chưa cập nhật';
  const displayAddress = currentUser?.address || 'Chưa cập nhật';

  // Get avatar initial
  const avatarLetter = useMemo(() => {
    if (displayName) {
      const parts = displayName.replace(/^\d+_/, '').trim();
      return parts.charAt(0).toUpperCase() || 'T';
    }
    return 'T';
  }, [displayName]);

  // Only this user's own orders. App.jsx already loads just the viewer's orders for
  // customers/guests; admins receive every order, so always filter by owner here.
  const userOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    if (!currentUser) return orders;
    const email = currentUser.email?.toLowerCase();
    return orders.filter((o) =>
      o.uid ? o.uid === currentUser.id : !!email && o.customerEmail?.toLowerCase() === email
    );
  }, [orders, currentUser]);

  // Tab mapping helper
  const matchesStatusTab = (order, tab) => {
    const s = (order.status || '').toLowerCase();
    switch (tab) {
      case 'pending_confirm':
        // Chờ xác nhận / Chờ thanh toán QR / Đã thanh toán chờ xác nhận
        return s.includes('chờ thanh toán') || s.includes('chờ xác nhận') || s.includes('đơn mới') || s.includes('đã thanh toán');
      case 'pending_pickup':
        // Chờ lấy hàng / Đang chuẩn bị hàng
        return s.includes('chuẩn bị') || s.includes('lấy hàng') || s.includes('đóng gói');
      case 'shipping':
        // Đang giao hàng / Đang vận chuyển
        return (s.includes('giao hàng') && !s.includes('giao thành công')) || s.includes('vận chuyển');
      case 'delivered':
        // Đã giao / Giao thành công / Hoàn tất
        return s.includes('giao thành công') || s.includes('đã giao') || s.includes('hoàn tất');
      case 'returned':
        // Trả hàng / Hoàn trả
        return s.includes('trả hàng') || s.includes('hoàn');
      case 'cancelled':
        // Đã huỷ
        return s.includes('huỷ') || s.includes('hủy');
      default:
        return true;
    }
  };

  // Calculate counts for each tab
  const tabCounts = useMemo(() => {
    const counts = {
      pending_confirm: 0,
      pending_pickup: 0,
      shipping: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0
    };
    userOrders.forEach((o) => {
      Object.keys(counts).forEach((tab) => {
        if (matchesStatusTab(o, tab)) {
          counts[tab]++;
        }
      });
    });
    return counts;
  }, [userOrders]);

  // Filtered orders for the current active tab and search query
  const displayedOrders = useMemo(() => {
    let list = userOrders.filter((o) => matchesStatusTab(o, activeStatusTab));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        const matchId = (o.id || '').toLowerCase().includes(q);
        const matchItems = (o.items || []).some((item) =>
          (item.title || '').toLowerCase().includes(q)
        );
        const matchCustomer = (o.customerName || '').toLowerCase().includes(q);
        return matchId || matchItems || matchCustomer;
      });
    }
    return list;
  }, [userOrders, activeStatusTab, searchQuery]);

  // Handler for cancelling pending order
  const handleCancelOrder = (orderId) => {
    if (window.confirm(`Bạn có chắc chắn muốn huỷ đơn hàng #${orderId} không?`)) {
      if (onUpdateOrderStatus) {
        onUpdateOrderStatus(orderId, 'Đã huỷ');
      }
    }
  };

  // Handler for re-ordering
  const handleReorder = (order) => {
    if (!order.items || order.items.length === 0) return;
    if (onAddToCart) {
      order.items.forEach((item) => {
        onAddToCart(item, item.qty || 1);
      });
      alert(`Đã thêm ${order.items.length} sản phẩm của đơn hàng #${order.id} vào giỏ hàng!`);
    }
  };

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeMenuTab, activeStatusTab]);

  return (
    <div className="cop-page-wrapper">
      {/* 1. Top Green Announcement Bar (Matching Screenshot) */}
      <div className="cop-top-announcement">
        POINT TCG | Cắn Game Chất, Nhai Đam Mê!
      </div>

      {/* 2. Top Navigation Bar */}
      <nav className="cop-navbar">
        <div className="cop-navbar-content">
          <div className="cop-brand-group" onClick={onBackToStore} style={{ cursor: 'pointer' }}>
            <img src="/logo.jpg" alt="Point TCG" className="cop-brand-logo" />
            <div className="cop-brand-texts">
              <span className="cop-brand-title">Point TCG</span>
              <span className="cop-brand-sub">Trung tâm thẻ bài Pokémon Chính Hãng</span>
            </div>
          </div>

          <div className="cop-breadcrumbs">
            <span onClick={onBackToStore} className="cop-crumb-link">Trang chủ</span>
            <span className="cop-crumb-sep">/</span>
            <span className="cop-crumb-current">Tài khoản & Đơn hàng</span>
          </div>

          <div className="cop-nav-actions">
            <button type="button" className="cop-btn-back-home" onClick={onBackToStore}>
              ← Quay lại cửa hàng
            </button>
            {!currentUser && onOpenSignIn && (
              <button
                type="button"
                className="cop-btn-signin"
                onClick={() => onOpenSignIn('login')}
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 3. Main Two-Column Layout */}
      <div className="cop-main-container">
        {/* LEFT COLUMN: User Info Card & Menu Sidebar */}
        <aside className="cop-sidebar">
          {/* User Profile Card */}
          <div className="cop-user-card">
            <div className="cop-user-info-row">
              <div className="cop-user-meta">
                <span className="cop-user-name" title={displayName}>
                  {displayName}
                </span>
                <span className="cop-user-role-badge">
                  {currentUser?.role === 'admin' ? 'Quản trị viên' : 'Thành viên thân thiết'}
                </span>
              </div>
              <div className="cop-avatar-circle" aria-label="Avatar">
                {avatarLetter}
              </div>
            </div>
          </div>

          {/* Menu Items List */}
          <div className="cop-menu-list">
            <button
              type="button"
              className={`cop-menu-item ${activeMenuTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveMenuTab('profile')}
            >
              <span className="cop-menu-text">Thông tin tài khoản</span>
              <span className="cop-menu-arrow">›</span>
            </button>

            <button
              type="button"
              className={`cop-menu-item ${activeMenuTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveMenuTab('orders')}
            >
              <span className="cop-menu-text">Lịch sử đơn hàng</span>
              <span className="cop-menu-arrow">›</span>
            </button>

            <button
              type="button"
              className={`cop-menu-item ${activeMenuTab === 'addresses' ? 'active' : ''}`}
              onClick={() => setActiveMenuTab('addresses')}
            >
              <span className="cop-menu-text">Địa chỉ đã lưu</span>
              <span className="cop-menu-arrow">›</span>
            </button>

            <button
              type="button"
              className={`cop-menu-item ${activeMenuTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveMenuTab('reviews')}
            >
              <span className="cop-menu-text">Đánh giá đơn hàng</span>
              <span className="cop-menu-arrow">›</span>
            </button>

            {/* Email Liên hệ */}
            <div className="cop-info-item">
              <div className="cop-info-content">
                <span className="cop-info-label">Email liên hệ</span>
                <span className="cop-info-value" title="banhmigamestore@gmail.com">
                  banhmigamestore@gmail.c...
                </span>
              </div>
            </div>

            {/* Website */}
            <div className="cop-info-item">
              <div className="cop-info-content">
                <span className="cop-info-label">Website</span>
                <a
                  href="https://point-tcg.web.app"
                  target="_blank"
                  rel="noreferrer"
                  className="cop-info-value cop-link"
                >
                  https://banhmigames.vn
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Button: Trở lại trang chủ */}
          <div className="cop-sidebar-footer">
            <button
              type="button"
              className="cop-btn-return-home"
              onClick={onBackToStore}
            >
              Trở lại trang chủ
            </button>
          </div>
        </aside>

        {/* RIGHT COLUMN: Content Panel */}
        <main className="cop-content-panel">
          {/* ======================================================== */}
          {/* TAB 1: LỊCH SỬ ĐƠN HÀNG (MATCHING THE SCREENSHOT)       */}
          {/* ======================================================== */}
          {activeMenuTab === 'orders' && (
            <div className="cop-orders-section">
              <h1 className="cop-section-title">Lịch sử đơn hàng</h1>

              {/* Search Bar: Tìm theo mã đơn hàng hoặc tên sản phẩm */}
              <div className="cop-search-bar">
                <input
                  type="text"
                  className="cop-search-input"
                  placeholder="Tìm theo mã đơn hàng hoặc tên sản phẩm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="cop-clear-search-btn"
                    onClick={() => setSearchQuery('')}
                    title="Xoá tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Horizontal Tabs */}
              <div className="cop-status-tabs-row" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStatusTab === 'pending_confirm'}
                  className={`cop-status-tab ${activeStatusTab === 'pending_confirm' ? 'active' : ''}`}
                  onClick={() => setActiveStatusTab('pending_confirm')}
                >
                  Chờ xác nhận {tabCounts.pending_confirm > 0 && `(${tabCounts.pending_confirm})`}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStatusTab === 'pending_pickup'}
                  className={`cop-status-tab ${activeStatusTab === 'pending_pickup' ? 'active' : ''}`}
                  onClick={() => setActiveStatusTab('pending_pickup')}
                >
                  Chờ lấy hàng {tabCounts.pending_pickup > 0 && `(${tabCounts.pending_pickup})`}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStatusTab === 'shipping'}
                  className={`cop-status-tab ${activeStatusTab === 'shipping' ? 'active' : ''}`}
                  onClick={() => setActiveStatusTab('shipping')}
                >
                  Đang giao hàng {tabCounts.shipping > 0 && `(${tabCounts.shipping})`}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStatusTab === 'delivered'}
                  className={`cop-status-tab ${activeStatusTab === 'delivered' ? 'active' : ''}`}
                  onClick={() => setActiveStatusTab('delivered')}
                >
                  Đã giao {tabCounts.delivered > 0 && `(${tabCounts.delivered})`}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStatusTab === 'returned'}
                  className={`cop-status-tab ${activeStatusTab === 'returned' ? 'active' : ''}`}
                  onClick={() => setActiveStatusTab('returned')}
                >
                  Trả hàng {tabCounts.returned > 0 && `(${tabCounts.returned})`}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeStatusTab === 'cancelled'}
                  className={`cop-status-tab ${activeStatusTab === 'cancelled' ? 'active' : ''}`}
                  onClick={() => setActiveStatusTab('cancelled')}
                >
                  Đã huỷ {tabCounts.cancelled > 0 && `(${tabCounts.cancelled})`}
                </button>
              </div>

              {/* Tab Content: Empty State vs Order List */}
              <div className="cop-orders-content-box">
                {displayedOrders.length === 0 ? (
                  /* Matching the screenshot's empty state box */
                  <div className="cop-empty-state-card">
                    <div className="cop-empty-icon-wrap">
                      <svg
                        className="cop-empty-box-svg"
                        viewBox="0 0 64 64"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect x="10" y="24" width="44" height="30" rx="3" fill="#cbd5e1" />
                        <path d="M8 24L32 10L56 24H8Z" fill="#94a3b8" />
                        <rect x="22" y="30" width="20" height="8" rx="2" fill="#f1f5f9" />
                      </svg>
                    </div>
                    <p className="cop-empty-text">Bạn chưa có đơn hàng nào</p>
                    <button
                      type="button"
                      className="cop-btn-shop-now"
                      onClick={onBackToStore}
                    >
                      Khám phá sản phẩm Pokémon
                    </button>
                  </div>
                ) : (
                  /* Order List */
                  <div className="cop-order-cards-list">
                    {displayedOrders.map((order) => {
                      const isPending =
                        order.status?.includes('Chờ') ||
                        order.status?.includes('Đã xác nhận') ||
                        order.status?.includes('Đã thanh toán');
                      const isPreparing = order.status === 'Đang chuẩn bị hàng';
                      const isShipping = order.status === 'Đang giao hàng';
                      const isDelivered =
                        order.status === 'Giao thành công' || order.status === 'Đã giao';
                      const isCancelled = order.status === 'Đã huỷ';

                      return (
                        <div key={order.id} className="cop-order-card">
                          {/* Card Header */}
                          <div className="cop-card-header">
                            <div className="cop-card-header-left">
                              <span className="cop-order-id-label">Mã đơn:</span>
                              <strong className="cop-order-id-val">#{order.id}</strong>
                              <span className="cop-order-date">{order.createdAt}</span>
                            </div>

                            <div className="cop-card-header-right">
                              <span
                                className={`cop-status-badge ${isPending
                                  ? 'status-pending'
                                  : isPreparing
                                    ? 'status-preparing'
                                    : isShipping
                                      ? 'status-shipping'
                                      : isDelivered
                                        ? 'status-delivered'
                                        : isCancelled
                                          ? 'status-cancelled'
                                          : 'status-default'
                                  }`}
                              >
                                {order.status}
                              </span>
                            </div>
                          </div>

                          <OrderTimeline order={order} />
                          <TrackingInfo order={order} />

                          {/* Items List */}
                          <div className="cop-card-items-list">
                            {(order.items || []).map((item, idx) => {
                              const catalogImg = getProductCatalogImage(item);
                              const imgSrc = catalogImg || item.image;
                              return (
                                <div key={idx} className="cop-order-item-row">
                                  <div className="cop-item-img-wrap" style={{ width: '64px', height: '64px', maxWidth: '64px', maxHeight: '64px', minWidth: '64px', overflow: 'hidden' }}>
                                    {imgSrc ? (
                                      <img
                                        src={imgSrc}
                                        alt={item.title}
                                        className="cop-item-thumb"
                                        style={{ width: '100%', height: '100%', maxWidth: '60px', maxHeight: '60px', objectFit: 'contain', display: 'block' }}
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                    ) : null}
                                  </div>

                                  <div className="cop-item-info">
                                    <h3
                                      className="cop-item-title"
                                      onClick={() => {
                                        if (onOpenProductDetail) {
                                          onOpenProductDetail(item);
                                        }
                                      }}
                                    >
                                      {item.title}
                                    </h3>
                                    <div className="cop-item-sub">
                                      <span className="cop-item-qty">Số lượng: x{item.qty || 1}</span>
                                      <span className="cop-item-price">
                                        ${Number(item.price || 0).toFixed(2)} ({formatVndPrice(item.price)})
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Order Summary & Actions */}
                          <div className="cop-card-footer">
                            <div className="cop-footer-info">
                              <div className="cop-recipient-line">
                                <strong>Người nhận:</strong> {order.customerName || displayName} -{' '}
                                {order.customerPhone || displayPhone}
                              </div>
                              <div className="cop-address-line">
                                <strong>Địa chỉ:</strong> {order.shippingAddress || displayAddress}
                              </div>
                              <div className="cop-payment-method-line">
                                <strong>Phương thức:</strong> {order.paymentMethod || 'Chuyển khoản QR'}
                              </div>
                            </div>

                            <div className="cop-footer-pricing">
                              <div className="cop-total-label">Tổng thanh toán:</div>
                              <div className="cop-total-amount">
                                ${Number(order.total || 0).toFixed(2)}
                                <span className="cop-total-vnd">
                                  ({order.amountVnd ? order.amountVnd.toLocaleString('vi-VN') + '₫' : formatVndPrice(order.total)})
                                </span>
                              </div>

                              <div className="cop-action-buttons">
                                {CUSTOMER_CANCELLABLE_STATUSES.includes(order.status) && (
                                  <button
                                    type="button"
                                    className="cop-btn-cancel-order"
                                    onClick={() => handleCancelOrder(order.id)}
                                  >
                                    Huỷ đơn hàng
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="cop-btn-reorder"
                                  onClick={() => handleReorder(order)}
                                >
                                  Mua lại
                                </button>
                                <button
                                  type="button"
                                  className="cop-btn-view-detail"
                                  onClick={() => setViewingOrderDetail(order)}
                                >
                                  Xem chi tiết
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: THÔNG TIN TÀI KHOẢN (ACCOUNT INFO)               */}
          {/* ======================================================== */}
          {activeMenuTab === 'profile' && (
            <div className="cop-profile-section">
              <h1 className="cop-section-title">Thông tin tài khoản</h1>
              <div className="cop-profile-card">
                <div className="cop-profile-header">
                  <div className="cop-profile-avatar-large">{avatarLetter}</div>
                  <div>
                    <h2 className="cop-profile-name">{displayName}</h2>
                    <p className="cop-profile-email">{displayEmail}</p>
                    <span className="cop-badge-tag">Tài khoản mua hàng chính thức</span>
                  </div>
                </div>

                {currentUser ? (
                  <ProfileEditor
                    key={currentUser.id}
                    currentUser={currentUser}
                    onUpdateCurrentUser={onUpdateCurrentUser}
                  />
                ) : (
                  <div className="cop-profile-actions">
                    <button type="button" className="cop-btn-edit-profile" onClick={() => onOpenSignIn?.('login')}>
                      Đăng nhập để sửa thông tin
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: ĐỊA CHỈ ĐÃ LƯU (SAVED ADDRESSES)                 */}
          {/* ======================================================== */}
          {activeMenuTab === 'addresses' && (
            <div className="cop-addresses-section">
              <h1 className="cop-section-title">Địa chỉ đã lưu</h1>
              <div className="cop-address-card">
                <div className="cop-address-badge">MẶC ĐỊNH</div>
                <h3 className="cop-address-recipient">{displayName} — {displayPhone}</h3>
                <p className="cop-address-text">{displayAddress}</p>
                <div className="cop-address-actions">
                  <button
                    type="button"
                    className="cop-btn-small"
                    onClick={() => setActiveMenuTab('profile')}
                  >
                    Thay đổi
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: ĐÁNH GIÁ ĐƠN HÀNG (ORDER REVIEWS)                */}
          {/* ======================================================== */}
          {activeMenuTab === 'reviews' && (
            <div className="cop-reviews-section">
              <h1 className="cop-section-title">Đánh giá đơn hàng</h1>
              <div className="cop-reviews-card">
                <ReviewsPanel
                  currentUser={currentUser}
                  orders={userOrders}
                  reviews={reviews}
                  onReviewSaved={onReviewSaved}
                  onGoToOrders={() => setActiveMenuTab('orders')}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Detail Modal when customer clicks "Xem chi tiết" */}
      {viewingOrderDetail && (
        <div className="modal-overlay" onClick={() => setViewingOrderDetail(null)}>
          <div className="cop-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cop-detail-modal-header">
              <h3>Chi Tiết Đơn Hàng #{viewingOrderDetail.id}</h3>
              <button
                type="button"
                className="cop-detail-close-btn"
                onClick={() => setViewingOrderDetail(null)}
              >
                ✕
              </button>
            </div>

            <div className="cop-detail-modal-body">
              <div className="cop-detail-status-bar">
                <span>Trạng thái hiện tại:</span>
                <strong style={{ color: '#2563eb' }}>{viewingOrderDetail.status}</strong>
              </div>
              <OrderTimeline order={viewingOrderDetail} />
              <TrackingInfo order={viewingOrderDetail} />

              <div className="cop-detail-section">
                <h4>Thông tin người nhận:</h4>
                <p><strong>Khách hàng:</strong> {viewingOrderDetail.customerName}</p>
                <p><strong>Số điện thoại:</strong> {viewingOrderDetail.customerPhone}</p>
                <p><strong>Email:</strong> {viewingOrderDetail.customerEmail}</p>
                <p><strong>Địa chỉ nhận hàng:</strong> {viewingOrderDetail.shippingAddress}</p>
                <p><strong>Phương thức giao hàng:</strong> {viewingOrderDetail.shippingMethod || 'Giao hàng niêm phong an toàn'}</p>
                <p><strong>Phương thức thanh toán:</strong> {viewingOrderDetail.paymentMethod}</p>
                {viewingOrderDetail.orderNotes && (
                  <p><strong>Ghi chú đơn hàng:</strong> {viewingOrderDetail.orderNotes}</p>
                )}
              </div>

              <div className="cop-detail-section">
                <h4>Danh sách sản phẩm ({viewingOrderDetail.items?.length || 0}):</h4>
                <div className="cop-detail-items">
                  {(viewingOrderDetail.items || []).map((item, idx) => (
                    <div key={idx} className="cop-detail-item-line">
                      <span>{item.title} (x{item.qty || 1})</span>
                      <strong>${(Number(item.price || 0) * (item.qty || 1)).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cop-detail-total-row">
                <span>Tổng cộng:</span>
                <strong>
                  ${Number(viewingOrderDetail.total || 0).toFixed(2)} (
                  {viewingOrderDetail.amountVnd
                    ? viewingOrderDetail.amountVnd.toLocaleString('vi-VN') + '₫'
                    : formatVndPrice(viewingOrderDetail.total)}
                  )
                </strong>
              </div>
            </div>

            <div className="cop-detail-modal-footer">
              <button
                type="button"
                className="cop-btn-small"
                onClick={() => setViewingOrderDetail(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
