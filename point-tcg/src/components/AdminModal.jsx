// src/components/AdminModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createCardSvg, PRESET_CARD_STYLES, allProducts, getProductCatalogImage, embedImageInStoreFrame } from '../products';
import { saveNewOrder, changePassword } from '../utils/auth';
import { checkOrderPricing } from '../utils/orderCheck';
import { auth } from '../firebase';
import {
  getQrConfig,
  loadQrConfig,
  saveQrConfig,
  resetQrConfig,
  POPULAR_BANKS,
  generateQrUrl
} from '../utils/qrConfig';
import {
  fetchProductsFromDb,
  fetchOrdersFromDb,
  fetchUsersFromDb,
  fetchSettingsFromDb,
  deleteUserFromDb,
  syncAllLocalDataToFirebase
} from '../services/firestoreService';

export default function AdminModal({
  isOpen,
  isFullPage = false,
  onNavigateToStore,
  onClose,
  openDrawings = [],
  closedDrawings = [],
  orders: propOrders = null,
  onUpdateOrderStatus: propUpdateStatus = null,
  onDeleteOrder: propDeleteOrder = null,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onResetDefaults,
  initialProductToEdit = null
}) {
  // activeTab: 'open' | 'closed' | 'orders' | 'customers' | 'account'
  const [activeTab, setActiveTab] = useState('orders'); // Default to orders when opening admin for quick shopper fulfillment
  const [editingProduct, setEditingProduct] = useState(null); // null when not editing/adding
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Orders State (Shopper / Shopee fulfillment)
  const [localOrders, setLocalOrders] = useState([]);
  const orders = propOrders || localOrders;
  const [orderFilter, setOrderFilter] = useState('all'); // 'all' | 'Chờ thanh toán QR' | 'Chờ xác nhận' | 'Đang chuẩn bị hàng' | 'Đang giao hàng' | 'Giao thành công' | 'Đã huỷ'
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedSlipOrder, setSelectedSlipOrder] = useState(null); // For Shopee packing slip preview
  const [newOrderAlert, setNewOrderAlert] = useState(null);

  // File Upload State & References
  const fileInputRef = useRef(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadToast, setUploadToast] = useState('');

  // Quick Timer State (for fast countdown editing)
  const [quickTimerProduct, setQuickTimerProduct] = useState(null);
  const [quickTimerData, setQuickTimerData] = useState({
    label: 'Drawing ends in',
    hours: 2,
    minutes: 14,
    seconds: 0,
    customText: '',
    mode: 'timer'
  });

  // Customers State
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');

  // Auto-sync registered customers from Firebase Firestore (Supports registrations from other laptops)
  useEffect(() => {
    let isMounted = true;
    const syncCustomers = async () => {
      try {
        const cloudUsers = await fetchUsersFromDb();
        if (!isMounted) return;
        if (Array.isArray(cloudUsers)) {
          setCustomers(cloudUsers);
        }
      } catch (e) {}
    };

    if (activeTab === 'customers' || activeTab === 'firebase_db') {
      syncCustomers();
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Admin Account State (password is managed by Firebase Authentication)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [accountSuccessMsg, setAccountSuccessMsg] = useState('');
  const [accountErrorMsg, setAccountErrorMsg] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // QR Code & Bank Transfer Settings State
  const [qrSettings, setQrSettings] = useState(() => getQrConfig());
  const [qrSaveToast, setQrSaveToast] = useState('');
  const qrImageFileInputRef = useRef(null);

  // Firebase Database State & Handlers
  const [firebaseActiveSubTab, setFirebaseActiveSubTab] = useState('overview'); // 'overview' | 'products' | 'orders' | 'users' | 'settings'
  const [firebaseSyncing, setFirebaseSyncing] = useState(false);
  const [firebaseToast, setFirebaseToast] = useState(null);
  const [firebaseDbData, setFirebaseDbData] = useState({
    products: null,
    orders: null,
    users: null,
    settings: null
  });
  const [loadingFirebaseTable, setLoadingFirebaseTable] = useState(false);

  const handleLoadFirebaseCollection = async (collName) => {
    setLoadingFirebaseTable(true);
    try {
      if (collName === 'products') {
        const data = await fetchProductsFromDb();
        setFirebaseDbData(prev => ({ ...prev, products: data || [] }));
      } else if (collName === 'orders') {
        const data = await fetchOrdersFromDb();
        setFirebaseDbData(prev => ({ ...prev, orders: data || [] }));
      } else if (collName === 'users') {
        const data = await fetchUsersFromDb();
        setFirebaseDbData(prev => ({ ...prev, users: data || [] }));
      } else if (collName === 'settings') {
        const [qr, store] = await Promise.all([
          fetchSettingsFromDb('bank_qr_config'),
          fetchSettingsFromDb('store_info')
        ]);
        setFirebaseDbData(prev => ({
          ...prev,
          settings: { bank_qr_config: qr, store_info: store }
        }));
      }
    } catch (err) {
      console.error('Error loading Firebase collection:', err);
    } finally {
      setLoadingFirebaseTable(false);
    }
  };

  const handleSyncToFirebase = async () => {
    setFirebaseSyncing(true);
    setFirebaseToast({ type: 'info', message: 'Đang đẩy dữ liệu lên Firebase Cloud Firestore...' });
    try {
      const allProds = [...openDrawings, ...closedDrawings];
      const res = await syncAllLocalDataToFirebase({
        products: allProds,
        orders: orders,
        users: customers,
        bankQrConfig: qrSettings
      });

      if (res.success) {
        setFirebaseToast({
          type: 'success',
          message: `Đã đẩy thành công lên Firebase! (${res.productsCount} sản phẩm, ${res.ordersCount} đơn hàng, ${res.usersCount} tài khoản, cài đặt cấu hình).`
        });
        if (firebaseActiveSubTab !== 'overview') {
          handleLoadFirebaseCollection(firebaseActiveSubTab);
        }
      } else {
        setFirebaseToast({
          type: 'error',
          message: `Có lỗi khi đồng bộ: ${res.error || 'Vui lòng thử lại'}`
        });
      }
    } catch (err) {
      setFirebaseToast({
        type: 'error',
        message: `Lỗi kết nối Firebase: ${err.message}`
      });
    } finally {
      setFirebaseSyncing(false);
    }
  };

  const handlePullFromFirebase = async () => {
    setFirebaseSyncing(true);
    setFirebaseToast({ type: 'info', message: 'Đang nạp dữ liệu từ Firebase Firestore về máy...' });
    try {
      const [remoteProducts, remoteOrders, remoteUsers, remoteQr] = await Promise.all([
        fetchProductsFromDb(),
        fetchOrdersFromDb(),
        fetchUsersFromDb(),
        fetchSettingsFromDb('bank_qr_config')
      ]);

      let pulledCount = 0;
      if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
        pulledCount += remoteProducts.length;
      }
      if (Array.isArray(remoteOrders) && remoteOrders.length > 0) {
        setLocalOrders(remoteOrders);
        pulledCount += remoteOrders.length;
      }
      if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
        setCustomers(remoteUsers);
        pulledCount += remoteUsers.length;
      }
      if (remoteQr) {
        setQrSettings(remoteQr);
        localStorage.setItem('point-tcg-qr-config', JSON.stringify(remoteQr));
      }

      setFirebaseToast({
        type: 'success',
        message: `Đã nạp thành công ${pulledCount} bản ghi từ Firebase Firestore về máy!`
      });
    } catch (err) {
      setFirebaseToast({
        type: 'error',
        message: `Lỗi khi tải từ Firebase: ${err.message}`
      });
    } finally {
      setFirebaseSyncing(false);
    }
  };

  // Product Form State
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    section: 'open',
    price: '',
    wasPrice: '',
    stock: 20,
    badge: '',
    optionsText: '',
    unitPrice: '',
    rating: 4.8,
    reviewsCount: 120,
    countdownLabel: 'Drawing ends in',
    countdownHours: 2,
    countdownMinutes: 14,
    countdownSeconds: 0,
    customCountdownText: '',
    countdownMode: 'timer',
    statusTime: '10:00am PDT',
    description: '',
    imageType: 'upload',
    imageUrl: '',
    rawUploadedImage: '',
    uploadedFileName: '',
    uploadedFileSize: '',
    applyStoreFrame: true,
    selectedPresetIdx: 0
  });

  // Load the live QR / bank settings from Firestore when the panel opens
  useEffect(() => {
    if (isOpen || isFullPage) {
      loadQrConfig().then(setQrSettings).catch(() => {});
    }
  }, [isOpen, isFullPage]);

  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  };

  // Listen for real-time new orders placed by shoppers
  useEffect(() => {
    const handleIncomingOrder = (e) => {
      const newOrder = e.detail;
      if (newOrder) {
        setLocalOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
        playNotificationSound();
        const priceInfo = newOrder.amountVnd
          ? `${newOrder.amountVnd.toLocaleString('vi-VN')} đ`
          : `$${newOrder.total?.toFixed(2)}`;
        setNewOrderAlert(`🔔 ĐƠN HÀNG MỚI! Khách ${newOrder.customerName} vừa đặt đơn #${newOrder.id} (${priceInfo})`);
        setTimeout(() => setNewOrderAlert(null), 8000);
      }
    };

    window.addEventListener('point-tcg-new-order', handleIncomingOrder);
    return () => window.removeEventListener('point-tcg-new-order', handleIncomingOrder);
  }, []);

  if (!isOpen && !isFullPage) return null;

  // -------------------------------------------------------------
  // ORDER STATS & METRICS
  // -------------------------------------------------------------
  const qrWaitingCount = orders.filter(o => o.status?.includes('Chờ thanh toán QR')).length;
  const pendingCount = orders.filter(o => o.status?.includes('Chờ') || o.status?.includes('Đã xác nhận') || o.status?.includes('Đã thanh toán')).length;
  const preparingCount = orders.filter(o => o.status === 'Đang chuẩn bị hàng').length;
  const shippingCount = orders.filter(o => o.status === 'Đang giao hàng').length;
  const completedCount = orders.filter(o => o.status === 'Giao thành công').length;
  const totalRevenue = orders.reduce((sum, o) => (o.status !== 'Đã huỷ' ? sum + (o.total || 0) : sum), 0);

  // Filtered Orders
  const filteredOrders = orders.filter((order) => {
    // Status filter
    if (orderFilter !== 'all') {
      if (orderFilter === 'Chờ thanh toán QR') {
        if (!order.status?.includes('Chờ thanh toán QR')) return false;
      } else if (orderFilter === 'Chờ xác nhận') {
        if (!order.status?.includes('Chờ') && !order.status?.includes('Đã xác nhận') && !order.status?.includes('Đã thanh toán')) {
          return false;
        }
      } else if (orderFilter !== 'Chờ xác nhận' && order.status !== orderFilter) {
        return false;
      }
    }
    // Search query
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase().trim();
      const matchId = order.id?.toLowerCase().includes(q);
      const matchName = order.customerName?.toLowerCase().includes(q);
      const matchPhone = order.customerPhone?.toLowerCase().includes(q);
      return matchId || matchName || matchPhone;
    }
    return true;
  });

  // -------------------------------------------------------------
  // ORDER ACTIONS (SHOPPER WORKFLOW)
  // -------------------------------------------------------------
  const handleUpdateStatus = (orderId, newStatus) => {
    if (propUpdateStatus) {
      propUpdateStatus(orderId, newStatus);
    } else {
      setLocalOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: newStatus } : o)));
    }
  };

  const handleNextStep = (order) => {
    if (order.status?.includes('Chờ thanh toán QR')) {
      handleUpdateStatus(order.id, 'Đang chuẩn bị hàng');
    } else if (order.status?.includes('Chờ') || order.status?.includes('Đã xác nhận') || order.status?.includes('Đã thanh toán')) {
      handleUpdateStatus(order.id, 'Đang chuẩn bị hàng');
    } else if (order.status === 'Đang chuẩn bị hàng') {
      handleUpdateStatus(order.id, 'Đang giao hàng');
    } else if (order.status === 'Đang giao hàng') {
      handleUpdateStatus(order.id, 'Giao thành công');
    }
  };

  const handleDeleteOrderClick = (orderId) => {
    if (confirm(`Bạn có chắc muốn xoá đơn hàng #${orderId}?`)) {
      if (propDeleteOrder) {
        propDeleteOrder(orderId);
      } else {
        setLocalOrders(prev => prev.filter(o => o.id !== orderId));
      }
    }
  };

  // Helper to ensure item images in Admin are ALWAYS 100% synchronized with the active customer store
  const getProductImage = (item) => {
    if (!item) return '';
    // Priority 1: Check master catalog image
    const catalogImg = getProductCatalogImage(item);
    if (catalogImg) return catalogImg;

    // Priority 2: Check store active products from props
    const allStoreProducts = [...openDrawings, ...closedDrawings, ...allProducts];
    const match = allStoreProducts.find(
      p => p.id === item.id || p.title?.toLowerCase().trim() === item.title?.toLowerCase().trim()
    );
    if (match && match.image && !match.image.includes('pokemontcg.io')) {
      return match.image;
    }

    // Priority 3: Item's own image if valid and not legacy placeholder
    if (item.image && !item.image.includes('pokemontcg.io')) {
      return item.image;
    }
    return '';
  };

  const handleCreateTestOrder = () => {
    // Pick the first active product, ensuring image is 100% synchronized with customer store
    const sourceProd = openDrawings[0] || allProducts[0];
    const sampleProduct = {
      ...sourceProd,
      image: getProductImage(sourceProd)
    };

    const testPayload = {
      id: `PTCG-${Date.now().toString().slice(-6)}`,
      customerName: 'Nguyễn Văn Pikachu',
      customerEmail: 'pikachu@pokemon.com',
      customerPhone: '0988776655',
      shippingAddress: 'Số 789 Đường Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      orderNotes: 'Khách vừa đặt trên web, đang chờ chuyển khoản MB Bank.',
      shippingMethod: 'Tiêu chuẩn (Tamper-Proof Box)',
      paymentMethod: 'Chuyển Khoản Ngân Hàng / VietQR',
      items: [
        {
          id: sampleProduct.id,
          title: sampleProduct.title,
          price: sampleProduct.price,
          qty: 1,
          image: sampleProduct.image
        }
      ],
      subtotal: sampleProduct.price,
      shippingFee: 0,
      discountAmount: 0,
      total: sampleProduct.price,
      amountVnd: Math.round(sampleProduct.price * 25400),
      status: 'Chờ thanh toán QR (Đơn mới)',
      createdAt: new Date().toLocaleString('vi-VN')
    };
    const saved = saveNewOrder(testPayload);
    if (saved) {
      setLocalOrders(prev => [saved, ...prev.filter(o => o.id !== saved.id)]);
      setNewOrderAlert(`🔔 ĐÃ TẠO ĐƠN TEST! Khách hàng ${saved.customerName} đặt đơn #${saved.id} (${(saved.amountVnd || 0).toLocaleString('vi-VN')} đ)`);
      setTimeout(() => setNewOrderAlert(null), 5000);
    }
  };

  const handleRestoreSampleOrders = () => {
    if (confirm('Khôi phục danh sách các đơn hàng mẫu với hình ảnh đồng bộ 100% cửa hàng?')) {
      const src1 = openDrawings[0] || allProducts[0];
      const src2 = openDrawings[1] || closedDrawings[0] || allProducts[1];
      const prod1 = {
        ...src1,
        image: getProductImage(src1)
      };
      const prod2 = {
        ...src2,
        image: getProductImage(src2)
      };

      const sampleOrders = [
        {
          id: `PTCG-${Date.now().toString().slice(-6)}`,
          customerName: 'Ash Ketchum',
          customerEmail: 'collector@pointtcg.com',
          customerPhone: '0901234567',
          shippingAddress: 'Số 123 Đường Pallet, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
          orderNotes: 'Bọc kỹ chống va đập giúp em, quà sinh nhật.',
          shippingMethod: 'Tiêu chuẩn (Tamper-Proof Box)',
          paymentMethod: 'Chuyển Khoản Ngân Hàng / VietQR',
          items: [
            {
              id: prod1.id,
              title: prod1.title,
              price: prod1.price,
              qty: 1,
              image: prod1.image
            }
          ],
          subtotal: prod1.price,
          shippingFee: 0,
          discountAmount: 0,
          total: prod1.price,
          amountVnd: Math.round(prod1.price * 25400),
          status: 'Chờ thanh toán QR (Đơn mới)',
          createdAt: new Date().toLocaleString('vi-VN')
        },
        {
          id: 'PTCG-881023',
          customerName: 'Misty Waterflower',
          customerEmail: 'misty@cerulean.com',
          customerPhone: '0912345678',
          shippingAddress: 'Tòa nhà Cerulean Gym, Số 88 Đường Ven Hồ, Quận Ba Đình, Hà Nội',
          orderNotes: 'Giao giờ hành chính nhé shop.',
          shippingMethod: 'Hoả tốc bảo hiểm Vault Express',
          paymentMethod: 'Thẻ Tín Dụng / Visa/Mastercard',
          items: [
            {
              id: prod2.id,
              title: prod2.title,
              price: prod2.price,
              qty: 2,
              image: prod2.image
            }
          ],
          subtotal: prod2.price * 2,
          shippingFee: 15.0,
          discountAmount: 9.99,
          total: prod2.price * 2 + 15.0 - 9.99,
          amountVnd: Math.round((prod2.price * 2 + 15.0 - 9.99) * 25400),
          status: 'Đang chuẩn bị hàng',
          createdAt: '09/10/2026, 16:45:22'
        }
      ];
      window.dispatchEvent(new CustomEvent('point-tcg-order-updated', { detail: { updated: sampleOrders } }));
      setLocalOrders(sampleOrders);
    }
  };

  // -------------------------------------------------------------
  // CUSTOMER ACTIONS
  // -------------------------------------------------------------
  // Removes the customer's Firestore profile. The Firebase Auth login itself must be
  // disabled/deleted from Firebase Console > Authentication.
  const handleDeleteCustomerClick = async (customerId, name) => {
    if (confirm(`Bạn có chắc muốn xoá hồ sơ khách hàng "${name}"?`)) {
      const ok = await deleteUserFromDb(customerId);
      if (ok) {
        setCustomers(prev => prev.filter(c => c.id !== customerId));
      } else {
        alert('Không thể xoá hồ sơ khách hàng. Vui lòng thử lại!');
      }
    }
  };

  // -------------------------------------------------------------
  // IMAGE COMPRESSION & UPLOAD UTILITIES
  // -------------------------------------------------------------
  const processImageFile = (file, callback) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Vui lòng chọn một file hình ảnh hợp lệ (PNG, JPG, WEBP, SVG)!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      // If SVG or small file (< 500KB), keep as is
      if (file.type === 'image/svg+xml' || file.size < 500 * 1024) {
        callback(rawDataUrl, file.name, `${Math.max(1, Math.round(file.size / 1024))} KB`);
        return;
      }

      // Large raster file: resize via canvas to max 1200x1200 to protect localStorage capacity
      try {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          const estimatedSize = Math.round((compressedDataUrl.length * 3) / 4 / 1024);
          callback(compressedDataUrl, file.name, `${estimatedSize} KB (Đã tối ưu)`);
        };
        img.onerror = () => {
          callback(rawDataUrl, file.name, `${Math.round(file.size / 1024)} KB`);
        };
        img.src = rawDataUrl;
      } catch (err) {
        callback(rawDataUrl, file.name, `${Math.round(file.size / 1024)} KB`);
      }
    };
    reader.readAsDataURL(file);
  };

  // -------------------------------------------------------------
  // PRODUCT MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  const startAddNew = () => {
    setIsCreatingNew(true);
    setEditingProduct(null);
    setFormData({
      id: `custom-${Date.now()}`,
      title: '',
      section: activeTab === 'closed' ? 'closed' : 'open',
      price: '',
      wasPrice: '',
      stock: 20,
      badge: '',
      optionsText: '',
      unitPrice: '',
      rating: 4.9,
      reviewsCount: 88,
      countdownLabel: 'Drawing ends in',
      countdownHours: 2,
      countdownMinutes: 14,
      countdownSeconds: 0,
      customCountdownText: '',
      countdownMode: 'timer',
      statusTime: '10:00am PDT',
      description: 'Factory sealed, 100% authentic Pokémon TCG product verified by Point TCG.',
      imageType: 'upload',
      imageUrl: '',
      rawUploadedImage: '',
      uploadedFileName: '',
      uploadedFileSize: '',
      applyStoreFrame: true,
      selectedPresetIdx: 0
    });
  };

  const startEdit = (product, section) => {
    setIsCreatingNew(false);
    setEditingProduct(product);
    const totalSec = product.secondsRemaining || 7200;
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const isUrl = product.image && (product.image.startsWith('http://') || product.image.startsWith('https://'));

    setFormData({
      id: product.id,
      title: product.title || '',
      section: section || product.status || 'open',
      price: product.price || '',
      wasPrice: product.wasPrice || '',
      stock: typeof product.stock === 'number' ? product.stock : 20,
      badge: product.badge || '',
      optionsText: product.optionsText || '',
      unitPrice: product.unitPrice || '',
      rating: product.rating || 5,
      reviewsCount: product.reviewsCount || 0,
      countdownLabel: product.countdownLabel || 'Drawing ends in',
      countdownHours: hours,
      countdownMinutes: minutes,
      countdownSeconds: seconds,
      customCountdownText: product.customCountdownText || '',
      countdownMode: product.customCountdownText ? 'custom' : 'timer',
      statusTime: product.statusTime || '10:00am PDT',
      description: product.description || '',
      imageType: isUrl ? 'url' : 'upload',
      imageUrl: product.image || '',
      rawUploadedImage: product.image || '',
      uploadedFileName: product.image ? 'Ảnh sản phẩm hiện tại' : '',
      uploadedFileSize: '',
      applyStoreFrame: true,
      selectedPresetIdx: 0
    });
  };

  // Auto-open product edit when requested from product detail page
  useEffect(() => {
    if (initialProductToEdit) {
      const section = initialProductToEdit.status || 'open';
      setActiveTab(section === 'closed' ? 'closed' : 'open');
      startEdit(initialProductToEdit, section);
    }
  }, [initialProductToEdit]);

  const handleQuickAdjustStock = (product, delta, section) => {
    const currentStock = typeof product.stock === 'number' ? product.stock : 20;
    const nextStock = Math.max(0, currentStock + delta);
    const updated = {
      ...product,
      stock: nextStock
    };
    onUpdateProduct(updated, section);
    setUploadToast(`Đã cập nhật kho cho "${product.title}": ${nextStock} sp`);
    setTimeout(() => setUploadToast(''), 3000);
  };

  const handleOpenQuickTimer = (product) => {
    const totalSec = product.secondsRemaining || 7200;
    setQuickTimerProduct(product);
    setQuickTimerData({
      label: product.countdownLabel || 'Drawing ends in',
      hours: Math.floor(totalSec / 3600),
      minutes: Math.floor((totalSec % 3600) / 60),
      seconds: totalSec % 60,
      customText: product.customCountdownText || '',
      mode: product.customCountdownText ? 'custom' : 'timer'
    });
  };

  const handleSaveQuickTimer = () => {
    if (!quickTimerProduct) return;
    const totalSec = (parseInt(quickTimerData.hours) || 0) * 3600 +
                     (parseInt(quickTimerData.minutes) || 0) * 60 +
                     (parseInt(quickTimerData.seconds) || 0);
    const updated = {
      ...quickTimerProduct,
      countdownLabel: quickTimerData.label?.trim() || 'Drawing ends in',
      customCountdownText: quickTimerData.mode === 'custom' ? quickTimerData.customText.trim() : '',
      secondsRemaining: totalSec > 0 ? totalSec : 7200
    };
    onUpdateProduct(updated, activeTab);
    setUploadToast(`Đã cập nhật thời gian đếm ngược cho "${quickTimerProduct.title}" thành công!`);
    setQuickTimerProduct(null);
    setTimeout(() => setUploadToast(''), 3500);
  };

  const getPreviewCountdownText = () => {
    if (formData.countdownMode === 'custom' && formData.customCountdownText.trim()) {
      return formData.customCountdownText.trim();
    }
    const prefix = formData.countdownLabel?.trim() || 'Drawing ends in';
    const h = String(Math.max(0, parseInt(formData.countdownHours) || 0)).padStart(2, '0');
    const m = String(Math.max(0, Math.min(59, parseInt(formData.countdownMinutes) || 0))).padStart(2, '0');
    const s = String(Math.max(0, Math.min(59, parseInt(formData.countdownSeconds) || 0))).padStart(2, '0');
    return `${prefix} ${h}:${m}:${s}`;
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    processImageFile(file, (dataUrl, fileName, fileSize) => {
      setFormData(prev => {
        const finalImg = prev.applyStoreFrame
          ? embedImageInStoreFrame(dataUrl, {
              badgeText: prev.badge || '-35%',
              badgeSubText: 'OFF'
            })
          : dataUrl;
        return {
          ...prev,
          imageType: 'upload',
          imageUrl: finalImg,
          rawUploadedImage: dataUrl,
          uploadedFileName: fileName,
          uploadedFileSize: fileSize
        };
      });
    });
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleToggleFrame = (newApplyFrame) => {
    setFormData(prev => {
      let newImageUrl = prev.imageUrl;
      const base = prev.rawUploadedImage || prev.imageUrl;
      if (base) {
        newImageUrl = newApplyFrame
          ? embedImageInStoreFrame(base, { badgeText: prev.badge || '-35%', badgeSubText: 'OFF' })
          : base;
      }
      return {
        ...prev,
        applyStoreFrame: newApplyFrame,
        imageUrl: newImageUrl
      };
    });
  };

  const handleClearUploadedImage = () => {
    setFormData(prev => ({
      ...prev,
      imageUrl: '',
      rawUploadedImage: '',
      uploadedFileName: '',
      uploadedFileSize: ''
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleQuickUpload = (product, section, file) => {
    processImageFile(file, (dataUrl, fileName, fileSize) => {
      const framedImage = embedImageInStoreFrame(dataUrl, {
        badgeText: product.badge || '-35%',
        badgeSubText: 'OFF'
      });
      const updatedProduct = {
        ...product,
        image: framedImage
      };
      onUpdateProduct(updatedProduct, section);
      setUploadToast(`Đã tải lên và đổi ảnh cho "${product.title}" thành công! (${fileSize})`);
      setTimeout(() => setUploadToast(''), 4000);
    });
  };

  const getComputedImage = () => {
    if (formData.imageType === 'preset') {
      const preset = PRESET_CARD_STYLES[formData.selectedPresetIdx] || PRESET_CARD_STYLES[0];
      return createCardSvg(preset.emoji, formData.title.trim().toUpperCase() || 'POKÉMON CARD', preset.gradient);
    }
    if (formData.imageUrl && formData.imageUrl.trim()) {
      return formData.imageUrl.trim();
    }
    if (formData.rawUploadedImage && formData.rawUploadedImage.trim()) {
      return formData.rawUploadedImage.trim();
    }
    const defaultPreset = PRESET_CARD_STYLES[0];
    return createCardSvg(defaultPreset.emoji, formData.title.trim().toUpperCase() || 'POKÉMON CARD', defaultPreset.gradient);
  };

  const handleProductSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Vui lòng nhập tên sản phẩm!');
      return;
    }
    const parsedPrice = parseFloat(formData.price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      alert('Vui lòng nhập giá hợp lệ (> 0)!');
      return;
    }

    const finalImage = getComputedImage();
    const isSale = !!formData.wasPrice && parseFloat(formData.wasPrice) > parsedPrice;
    const parsedStock = parseInt(formData.stock, 10);
    const validStock = isNaN(parsedStock) ? 20 : Math.max(0, parsedStock);
    const totalSeconds = (parseInt(formData.countdownHours) || 0) * 3600 +
                         (parseInt(formData.countdownMinutes) || 0) * 60 +
                         (parseInt(formData.countdownSeconds) || 0);

    const productPayload = {
      id: formData.id || `custom-${Date.now()}`,
      title: formData.title.trim(),
      price: parsedPrice,
      wasPrice: formData.wasPrice ? parseFloat(formData.wasPrice) : null,
      stock: validStock,
      isSale,
      badge: formData.badge.trim() || null,
      optionsText: formData.optionsText.trim() || null,
      unitPrice: formData.unitPrice.trim() || null,
      rating: parseFloat(formData.rating) || 5.0,
      reviewsCount: parseInt(formData.reviewsCount) || 1,
      status: formData.section,
      statusTime: formData.statusTime || '10:00am PDT',
      countdownLabel: formData.countdownLabel?.trim() || 'Drawing ends in',
      customCountdownText: formData.countdownMode === 'custom' ? formData.customCountdownText.trim() : '',
      secondsRemaining: totalSeconds > 0 ? totalSeconds : 7200,
      image: finalImage,
      description: formData.description.trim() || 'Verified authentic factory sealed Pokémon TCG collectible.',
      drawingDetails: {
        totalEntries: Math.floor(Math.random() * 3000) + 1000,
        maxWinners: 50,
        entryFee: 'Free Request',
        status: formData.section === 'open' ? 'Active in raffle queue' : 'Closed & Winners Selected',
        drawingDate: formData.section === 'open' ? 'Ends today' : formData.statusTime
      }
    };

    if (isCreatingNew) {
      onAddProduct(productPayload, formData.section);
    } else {
      onUpdateProduct(productPayload, formData.section);
    }

    setEditingProduct(null);
    setIsCreatingNew(false);
  };

  // -------------------------------------------------------------
  // ADMIN CREDENTIALS HANDLERS
  // -------------------------------------------------------------
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setAccountSuccessMsg('');
    setAccountErrorMsg('');
    if (passwordForm.next.length < 8) {
      setAccountErrorMsg('Mật khẩu mới phải có tối thiểu 8 ký tự!');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setAccountErrorMsg('Mật khẩu xác nhận không khớp!');
      return;
    }

    setIsChangingPassword(true);
    const res = await changePassword(passwordForm.current, passwordForm.next);
    setIsChangingPassword(false);

    if (res.success) {
      setPasswordForm({ current: '', next: '', confirm: '' });
      setAccountSuccessMsg('✅ Đã đổi mật khẩu quản trị thành công!');
      setTimeout(() => setAccountSuccessMsg(''), 4000);
    } else {
      setAccountErrorMsg(res.error);
    }
  };

  // -------------------------------------------------------------
  // QR & BANK TRANSFER HANDLERS
  // -------------------------------------------------------------
  const handleSaveQrSettings = async (e) => {
    e.preventDefault();
    if (!qrSettings.accountNumber.trim()) {
      alert('Vui lòng nhập số tài khoản ngân hàng!');
      return;
    }
    if (!qrSettings.accountName.trim()) {
      alert('Vui lòng nhập tên chủ tài khoản!');
      return;
    }
    const saved = await saveQrConfig(qrSettings);
    if (saved) {
      setQrSaveToast('🎉 Đã lưu cài đặt mã QR & thông tin ngân hàng thành công! Khách mua hàng sẽ thấy mã QR mới này.');
      setTimeout(() => setQrSaveToast(''), 4500);
    } else {
      alert('Không thể lưu cài đặt QR lên Firestore (không có quyền hoặc ảnh QR quá lớn).');
    }
  };

  const handleResetQrSettings = async () => {
    if (confirm('Khôi phục mã QR về tài khoản mặc định MB Bank ban đầu?')) {
      const def = await resetQrConfig();
      if (!def) {
        alert('Không thể khôi phục cài đặt QR trên Firestore.');
        return;
      }
      setQrSettings(def);
      setQrSaveToast('🔄 Đã khôi phục mã QR về mặc định.');
      setTimeout(() => setQrSaveToast(''), 3000);
    }
  };

  const handleQrImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Firestore documents are capped at 1MB, and base64 adds ~33%
    if (file.size > 700 * 1024) {
      alert('Dung lượng ảnh QR tối đa là 700KB!');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setQrSettings(prev => ({
        ...prev,
        mode: 'custom_image',
        customQrImage: event.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const currentProductList = activeTab === 'closed' ? closedDrawings : openDrawings;

  const modalInner = (
    <div className={isFullPage ? "admin-fullpage-card" : "admin-modal-card admin-modal-wide"} onClick={(e) => e.stopPropagation()}>
        {/* Live Order Alert Banner */}
        {newOrderAlert && (
          <div className="admin-live-alert-toast">
            <span>{newOrderAlert}</span>
            <button
              type="button"
              className="btn-alert-view"
              onClick={() => {
                setActiveTab('orders');
                setOrderFilter('all');
                setNewOrderAlert(null);
              }}
            >
              Xem & Chuẩn Bị Hàng Ngay →
            </button>
          </div>
        )}

        {/* Live Upload Toast Alert */}
        {uploadToast && (
          <div className="admin-upload-toast">
            <span>✅ {uploadToast}</span>
            <button
              type="button"
              className="btn-toast-dismiss"
              onClick={() => setUploadToast('')}
              title="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Top Header */}
        <div className="admin-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="admin-badge">ADMIN PORTAL</span>
              <h2 className="admin-title">Quản Trị Cửa Hàng & Chuẩn Bị Đơn Hàng Point TCG</h2>
            </div>
            <p className="admin-sub">
              Xử lý đơn hàng của khách như Shopper/Shopee, chuẩn bị đóng gói, in vận đơn, và quản lý sản phẩm.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {(activeTab === 'open' || activeTab === 'closed') && !editingProduct && !isCreatingNew && (
              <button
                type="button"
                className="btn-admin-add"
                onClick={startAddNew}
              >
                + Thêm Sản Phẩm Mới
              </button>
            )}
            {isFullPage ? (
              <button
                type="button"
                className="btn-admin-nav-store"
                onClick={onNavigateToStore || (() => window.open('./#', '_blank'))}
                title="Mở tab khách hàng để xem cửa hàng"
              >
                🌐 Xem Shop ↗
              </button>
            ) : (
              <button
                type="button"
                className="drawer-close-btn"
                onClick={onClose}
                aria-label="Đóng"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Form View (When Adding or Editing a Product) */}
        {(isCreatingNew || editingProduct) ? (
          <div className="admin-form-container">
            <div className="admin-form-header">
              <h3>{isCreatingNew ? '✨ Thêm Sản Phẩm Mới Vào Cửa Hàng' : `✏️ Chỉnh Sửa Sản Phẩm: ${formData.title}`}</h3>
              <button
                type="button"
                className="btn-admin-back"
                onClick={() => {
                  setEditingProduct(null);
                  setIsCreatingNew(false);
                }}
              >
                ← Quay lại danh sách
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="admin-grid-form">
              {/* Form columns */}
              <div className="admin-form-col">
                <div className="form-group">
                  <label className="form-label">Tên sản phẩm Pokémon <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ví dụ: Pokémon TCG: 151 Ultra-Premium Collection Box"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Khu vực hiển thị <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      className="form-input"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    >
                      <option value="open">⚡ Open Drawings (Đang mở raffle)</option>
                      <option value="closed">📦 Closed Drawings (Băng chuyền đã đóng)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Huy hiệu góc thẻ (Badge)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ví dụ: -35% OFF, HOT, GRAIL, x2..."
                      value={formData.badge}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => {
                          let nextImg = prev.imageUrl;
                          if (prev.imageType === 'upload' && prev.applyStoreFrame && prev.rawUploadedImage) {
                            nextImg = embedImageInStoreFrame(prev.rawUploadedImage, {
                              badgeText: val || '-35%',
                              badgeSubText: 'OFF'
                            });
                          }
                          return {
                            ...prev,
                            badge: val,
                            imageUrl: nextImg
                          };
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label className="form-label">Giá bán hiện tại ($ USD) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="119.99"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Giá gốc trước khi giảm ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="169.99"
                      value={formData.wasPrice}
                      onChange={(e) => setFormData({ ...formData, wasPrice: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Số lượng tồn kho (Stock) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      placeholder="20"
                      value={formData.stock ?? ''}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* PRODUCT DESCRIPTION EDITING CARD */}
                <div className="admin-desc-setting-card" style={{
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '18px',
                  marginBottom: '18px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '0.95rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>📝</span>
                      <span>Mô Tả Sản Phẩm (Hiển thị tại tab "MÔ TẢ SẢN PHẨM")</span>
                    </label>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, background: '#e2e8f0', padding: '3px 8px', borderRadius: '12px' }}>
                      Xuống dòng tự do (Enter)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                    Admin có thể tự do cập nhật thông tin giới thiệu, nguồn gốc, các thẻ Chase hiếm hoặc cam kết seal. Nội dung sẽ được hiển thị trực tiếp cho khách hàng xem ở trang chi tiết sản phẩm.
                  </p>

                  <textarea
                    className="form-input"
                    rows={6}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      lineHeight: '1.65',
                      fontFamily: 'inherit',
                      padding: '12px 14px',
                      fontSize: '0.92rem',
                      background: '#ffffff',
                      border: '1.5px solid #94a3b8',
                      borderRadius: '8px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Nhập mô tả sản phẩm chi tiết tại đây (ví dụ: Hộp nguyên seal 100%, nhập khẩu trực tiếp từ Mỹ, có cơ hội bốc trúng thẻ bài siêu hiếm...)"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />

                  {/* Preset Quick Fill Templates */}
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 700 }}>💡 Mẫu gợi ý nhanh:</span>
                    <button
                      type="button"
                      className="preset-text-chip"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        description: `${prev.title || 'Sản phẩm'} là bộ sưu tập cao cấp chính hãng từ The Pokémon Company, được nhập khẩu nguyên seal 100% với tem niêm phong tiêu chuẩn quốc tế.\n\nSản phẩm được bảo quản cẩn thận trong phòng nhiệt độ và độ ẩm chuẩn collectors, đảm bảo góc cạnh hộp và lớp seal hoàn hảo không tì vết.`
                      }))}
                    >
                      📦 Mẫu Booster Box Nguyên Seal
                    </button>
                    <button
                      type="button"
                      className="preset-text-chip"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        description: `${prev.title || 'Sản phẩm'} - Phiên bản giới hạn dành riêng cho nhà sưu tập thẻ bài Pokémon TCG chuyên nghiệp.\n\n• Tình trạng: Mới 100% Factory Sealed nguyên seal màng co chính hãng.\n• Xuất xứ: The Pokémon Company International (USA / Japan).\n• Cam kết: Hoàn tiền 111% nếu phát hiện hàng giả mạo hoặc khui bóc seal trước khi nhận.`
                      }))}
                    >
                      💎 Mẫu Cam Kết Chính Hãng & Seal
                    </button>
                    <button
                      type="button"
                      className="preset-text-chip"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        description: `${prev.title || 'Sản phẩm'} - Thẻ bài đơn (Single Card) tình trạng Near Mint (NM), được bọc sleeve bảo vệ và để trong toploader cứng cáp.\n\nCam kết thẻ bài chính hãng 100%, bảo quản không cong vênh, góc cạnh sắc nét.`
                      }))}
                    >
                      🃏 Mẫu Thẻ Bài Lẻ (Single Card)
                    </button>
                  </div>
                </div>

                {/* COUNTDOWN SETTINGS CARD: "Drawing ends in" CUSTOMIZER */}
                <div className="admin-countdown-setting-card">
                  <div className="countdown-card-header">
                    <div className="countdown-card-title">
                      <span style={{ fontSize: '1.25rem' }}>⏱️</span>
                      <div>
                        <strong>Tuỳ Chỉnh Thời Gian & Dòng Chữ "Drawing ends in"</strong>
                        <p className="countdown-card-sub">
                          Tuỳ biến nhãn hiển thị và thời gian đếm ngược còn lại cho sản phẩm trên trang chủ và modal chi tiết.
                        </p>
                      </div>
                    </div>
                    <div className="countdown-mode-toggle">
                      <button
                        type="button"
                        className={`btn-mode-chip ${formData.countdownMode === 'timer' ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, countdownMode: 'timer' })}
                      >
                        ⏳ Đếm Ngược Giờ : Phút : Giây
                      </button>
                      <button
                        type="button"
                        className={`btn-mode-chip ${formData.countdownMode === 'custom' ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, countdownMode: 'custom' })}
                      >
                        ✍️ Chữ Tự Do (Cố Định)
                      </button>
                    </div>
                  </div>

                  {formData.countdownMode === 'timer' ? (
                    <div className="countdown-mode-body">
                      {/* 1. Countdown Label / Prefix */}
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label" style={{ fontSize: '0.82rem' }}>
                          Tiêu đề / Tiền tố đếm ngược (Prefix)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Drawing ends in"
                          value={formData.countdownLabel}
                          onChange={(e) => setFormData({ ...formData, countdownLabel: e.target.value })}
                        />
                        <div className="countdown-preset-chips">
                          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Gợi ý nhanh:</span>
                          {['Drawing ends in', 'Kết thúc trong', 'Sắp hết hạn sau', 'Raffle closes in', 'Thời gian còn lại:'].map((txt) => (
                            <button
                              key={txt}
                              type="button"
                              className={`preset-text-chip ${formData.countdownLabel === txt ? 'active' : ''}`}
                              onClick={() => setFormData({ ...formData, countdownLabel: txt })}
                            >
                              {txt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Duration inputs: Hours, Minutes, Seconds */}
                      <div className="countdown-inputs-grid">
                        <div className="countdown-input-unit">
                          <label className="unit-label">Số Giờ (Hours)</label>
                          <input
                            type="number"
                            min="0"
                            max="999"
                            className="form-input unit-input"
                            value={formData.countdownHours}
                            onChange={(e) => setFormData({ ...formData, countdownHours: Math.max(0, parseInt(e.target.value) || 0) })}
                          />
                        </div>
                        <div className="countdown-separator">:</div>
                        <div className="countdown-input-unit">
                          <label className="unit-label">Số Phút (Minutes)</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            className="form-input unit-input"
                            value={formData.countdownMinutes}
                            onChange={(e) => setFormData({ ...formData, countdownMinutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                          />
                        </div>
                        <div className="countdown-separator">:</div>
                        <div className="countdown-input-unit">
                          <label className="unit-label">Số Giây (Seconds)</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            className="form-input unit-input"
                            value={formData.countdownSeconds}
                            onChange={(e) => setFormData({ ...formData, countdownSeconds: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                          />
                        </div>
                      </div>

                      {/* 3. Quick preset duration buttons */}
                      <div className="countdown-duration-presets">
                        <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Cài nhanh thời gian:</span>
                        <div className="presets-list">
                          {[
                            { label: '⚡ 30 phút', h: 0, m: 30, s: 0 },
                            { label: '🔥 1 giờ', h: 1, m: 0, s: 0 },
                            { label: '🕒 2 giờ 14p (Mặc định)', h: 2, m: 14, s: 4 },
                            { label: '🕒 3 giờ', h: 3, m: 0, s: 0 },
                            { label: '⭐ 6 giờ', h: 6, m: 0, s: 0 },
                            { label: '🌙 12 giờ', h: 12, m: 0, s: 0 },
                            { label: '📅 24 giờ (1 ngày)', h: 24, m: 0, s: 0 },
                            { label: '🗓️ 3 ngày', h: 72, m: 0, s: 0 },
                            { label: '✨ 7 ngày', h: 168, m: 0, s: 0 },
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className={`btn-time-chip ${formData.countdownHours === preset.h && formData.countdownMinutes === preset.m ? 'selected' : ''}`}
                              onClick={() => setFormData({
                                ...formData,
                                countdownHours: preset.h,
                                countdownMinutes: preset.m,
                                countdownSeconds: preset.s
                              })}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="countdown-mode-body">
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.82rem' }}>
                          Nhập chuỗi hiển thị tuỳ ý (Thay thế toàn bộ dòng đếm ngược)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="ví dụ: Drawing ends in 02:59:31, Sắp kết thúc hôm nay, v.v..."
                          value={formData.customCountdownText}
                          onChange={(e) => setFormData({ ...formData, customCountdownText: e.target.value })}
                        />
                        <div className="countdown-preset-chips" style={{ marginTop: '8px' }}>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Mẫu có sẵn:</span>
                          {[
                            'Drawing ends in 02:59:31',
                            'Drawing ends in 02:14:04',
                            'Drawing ends in 05:07:01',
                            'Drawing ends in 23:59:59',
                            '🔥 Sắp kết thúc hôm nay',
                            '⚡ Kết thúc lúc 20:00 tối nay'
                          ].map((sample) => (
                            <button
                              key={sample}
                              type="button"
                              className="preset-text-chip"
                              onClick={() => setFormData({ ...formData, customCountdownText: sample })}
                            >
                              {sample}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="countdown-live-badge-preview">
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Xem trước hiển thị:</span>
                    <div className="countdown-status-badge" style={{ display: 'inline-flex', margin: 0 }}>
                      <svg className="countdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{getPreviewCountdownText()}</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Hình ảnh sản phẩm <span style={{ color: '#ef4444' }}>*</span></span>
                    {formData.imageType === 'upload' && formData.uploadedFileName && (
                      <span className="admin-file-meta-tag">
                        📁 {formData.uploadedFileName} {formData.uploadedFileSize ? `(${formData.uploadedFileSize})` : ''}
                      </span>
                    )}
                  </label>
                  <div className="admin-img-tabs" style={{ marginBottom: '10px' }}>
                    <button
                      type="button"
                      className={`admin-tab-chip ${formData.imageType === 'upload' ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, imageType: 'upload' })}
                    >
                      📁 Tải ảnh từ máy tính (Khuyên dùng)
                    </button>
                    <button
                      type="button"
                      className={`admin-tab-chip ${formData.imageType === 'url' ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, imageType: 'url' })}
                    >
                      🔗 Link ảnh Online
                    </button>
                    <button
                      type="button"
                      className={`admin-tab-chip ${formData.imageType === 'preset' ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, imageType: 'preset' })}
                    >
                      🎨 Mẫu Pokémon có sẵn
                    </button>
                  </div>

                  {formData.imageType === 'upload' && (
                    <div className="admin-upload-zone-wrapper">
                      <div
                        className={`admin-dropzone ${isDraggingOver ? 'dragging-over' : ''} ${formData.rawUploadedImage ? 'has-file' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                          style={{ display: 'none' }}
                          onChange={handleFileInputChange}
                        />

                        {!formData.rawUploadedImage ? (
                          <div className="dropzone-empty-state">
                            <div className="dropzone-icon">☁️</div>
                            <div className="dropzone-primary-text">
                              Kéo thả file ảnh vào đây hoặc <span>bấm để chọn từ máy tính</span>
                            </div>
                            <div className="dropzone-sub-text">
                              Hỗ trợ PNG, JPG, JPEG, WEBP, SVG • Tối ưu hóa dung lượng tự động
                            </div>
                            <button
                              type="button"
                              className="btn-dropzone-browse"
                              onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                              }}
                            >
                              📂 Chọn File Ảnh Từ Máy
                            </button>
                          </div>
                        ) : (
                          <div className="dropzone-content-active">
                            <div className="dropzone-thumb-box">
                              <img src={getComputedImage()} alt="Uploaded thumbnail" className="dropzone-thumb-img" />
                            </div>
                            <div className="dropzone-file-details">
                              <div className="dropzone-filename">{formData.uploadedFileName || 'Ảnh đã tải lên'}</div>
                              <div className="dropzone-filesize">
                                {formData.uploadedFileSize ? `Dung lượng: ${formData.uploadedFileSize}` : 'Đã sẵn sàng hiển thị'}
                              </div>
                              <div className="dropzone-actions-row">
                                <button
                                  type="button"
                                  className="btn-dropzone-replace"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                  }}
                                >
                                  🔄 Đổi file khác
                                </button>
                                <button
                                  type="button"
                                  className="btn-dropzone-clear"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearUploadedImage();
                                  }}
                                >
                                  🗑️ Xoá ảnh
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Store Showcase Red Frame Toggle */}
                      <div className="admin-frame-toggle-box">
                        <label className="admin-frame-toggle-label">
                          <input
                            type="checkbox"
                            checked={formData.applyStoreFrame}
                            onChange={(e) => handleToggleFrame(e.target.checked)}
                          />
                          <div className="admin-frame-toggle-text">
                            <div className="admin-frame-toggle-title">
                              🖼️ Đóng khung đỏ trưng bày chuẩn Shop Point TCG (Khuyên dùng)
                            </div>
                            <div className="admin-frame-toggle-desc">
                              Tự động bọc ảnh trong khung viền đỏ #d32f2f, tiêu đề <strong>CHÍNH HÃNG - UY TÍN - CHẤT LƯỢNG</strong>, tag giảm giá và logo chứng nhận TCG chuẩn POINT TCG.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {formData.imageType === 'url' && (
                    <div>
                      <input
                        type="url"
                        className="form-input"
                        placeholder="https://images.pokemontcg.io/... hoặc link ảnh bất kỳ"
                        value={formData.imageUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            imageUrl: val,
                            rawUploadedImage: val
                          }));
                        }}
                      />
                      <div className="admin-frame-toggle-box" style={{ marginTop: '10px' }}>
                        <label className="admin-frame-toggle-label">
                          <input
                            type="checkbox"
                            checked={formData.applyStoreFrame}
                            onChange={(e) => handleToggleFrame(e.target.checked)}
                          />
                          <div className="admin-frame-toggle-text">
                            <div className="admin-frame-toggle-title">
                              🖼️ Đóng khung đỏ trưng bày cho link ảnh này
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {formData.imageType === 'preset' && (
                    <select
                      className="form-input"
                      value={formData.selectedPresetIdx}
                      onChange={(e) => setFormData({ ...formData, selectedPresetIdx: parseInt(e.target.value) })}
                    >
                      {PRESET_CARD_STYLES.map((style, idx) => (
                        <option key={idx} value={idx}>{style.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="admin-form-actions">
                  <button type="submit" className="btn-admin-save">
                    {isCreatingNew ? '➕ Đăng Sản Phẩm Mới' : '💾 Lưu Cập Nhật'}
                  </button>
                  <button
                    type="button"
                    className="btn-admin-cancel"
                    onClick={() => {
                      setEditingProduct(null);
                      setIsCreatingNew(false);
                    }}
                  >
                    Huỷ
                  </button>
                </div>
              </div>

              {/* Preview Col */}
              <div className="admin-preview-col">
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                  👁️ Xem trước Card:
                </div>
                <div className="product-card" style={{ maxWidth: '280px', margin: '0 auto' }}>
                  <div className="card-image-box">
                    {formData.badge && !formData.applyStoreFrame && (
                      <div className="card-circle-badge">{formData.badge}</div>
                    )}
                    <img src={getComputedImage()} alt="Preview" className="card-image" />
                  </div>
                  <div className="card-body">
                    <div className="card-price-row">
                      <span className="price-regular-tag">
                        <span>${parseFloat(formData.price || 0).toFixed(0)}</span>
                        <sup className="cents-sup">{Number(formData.price || 0).toFixed(2).split('.')[1]}</sup>
                      </span>
                      {formData.wasPrice && (
                        <span className="price-strike-tag" style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'line-through' }}>
                          Was ${parseFloat(formData.wasPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <h4 className="card-title">{formData.title || 'Tên sản phẩm'}</h4>
                    <div className="card-status-line" style={{ marginTop: '8px' }}>
                      <div className="countdown-status-badge">
                        <svg
                          className="countdown-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{getPreviewCountdownText()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        ) : (
          /* =========================================================================
             MAIN TABS VIEW
             ========================================================================= */
          <div className="admin-body">
            {/* Top Navigation Tabs */}
            <div className="admin-tabs-row">
              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'orders' ? 'active shopper-tab' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                🛍️ Đơn Hàng Shopper ({orders.length})
                {pendingCount > 0 && <span className="admin-badge-count-red">{pendingCount} mới</span>}
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
                onClick={() => setActiveTab('customers')}
              >
                👥 Khách Hàng ({customers.length})
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'open' ? 'active' : ''}`}
                onClick={() => setActiveTab('open')}
              >
                ⚡ Open Drawings ({openDrawings.length})
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'closed' ? 'active' : ''}`}
                onClick={() => setActiveTab('closed')}
              >
                📦 Closed Drawings ({closedDrawings.length})
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => setActiveTab('account')}
              >
                👤 Tài Khoản Admin
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'qr_settings' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('qr_settings');
                  setEditingProduct(null);
                  setIsCreatingNew(false);
                }}
              >
                💳 Cài Đặt Mã QR & Ngân Hàng
              </button>

              <button
                type="button"
                className={`admin-tab-btn ${activeTab === 'firebase_db' ? 'active' : ''}`}
                style={{
                  background: activeTab === 'firebase_db' ? '#fff7ed' : '',
                  borderColor: activeTab === 'firebase_db' ? '#f97316' : '',
                  color: activeTab === 'firebase_db' ? '#ea580c' : '',
                  fontWeight: 800
                }}
                onClick={() => {
                  setActiveTab('firebase_db');
                  setEditingProduct(null);
                  setIsCreatingNew(false);
                  if (!firebaseDbData.products) {
                    handleLoadFirebaseCollection('products');
                  }
                }}
              >
                🔥 Firebase Database
              </button>

              <button
                type="button"
                className="btn-admin-reset"
                onClick={() => {
                  if (confirm('Khôi phục danh sách sản phẩm mẫu ban đầu?')) {
                    onResetDefaults();
                  }
                }}
              >
                🔄 Khôi phục sản phẩm mẫu
              </button>
            </div>

            {/* =========================================================================
                TAB 1: SHOPPER ORDERS MANAGEMENT (CHUẨN BỊ HÀNG SHOPEE STYLE)
               ========================================================================= */}
            {activeTab === 'orders' && (
              <div className="admin-orders-manager">
                {/* Metrics Summary Strip */}
                <div className="shopper-metrics-grid">
                  <div className="metric-box">
                    <div className="metric-label">Tổng Đơn Hàng</div>
                    <div className="metric-val">{orders.length}</div>
                  </div>
                  <div className="metric-box highlight-pending" style={{ borderColor: '#eab308' }}>
                    <div className="metric-label">🟡 Chờ Quét QR</div>
                    <div className="metric-val">{qrWaitingCount}</div>
                  </div>
                  <div className="metric-box highlight-pending">
                    <div className="metric-label">🟢 Chờ Xác Nhận / Chuẩn Bị</div>
                    <div className="metric-val">{pendingCount}</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">🟠 Đang Chuẩn Bị Hàng</div>
                    <div className="metric-val">{preparingCount}</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-label">🔵 Đang Giao Hàng</div>
                    <div className="metric-val">{shippingCount}</div>
                  </div>
                  <div className="metric-box highlight-revenue">
                    <div className="metric-label">💰 Doanh Thu Thực Nhận</div>
                    <div className="metric-val">${totalRevenue.toFixed(2)}</div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="orders-toolbar">
                  <div className="status-filter-pills">
                    {[
                      { key: 'all', label: `Tất cả (${orders.length})` },
                      { key: 'Chờ thanh toán QR', label: `🟡 Chờ quét QR (${qrWaitingCount})` },
                      { key: 'Chờ xác nhận', label: `Chờ chuẩn bị (${pendingCount})` },
                      { key: 'Đang chuẩn bị hàng', label: `Đang chuẩn bị (${preparingCount})` },
                      { key: 'Đang giao hàng', label: `Đang giao (${shippingCount})` },
                      { key: 'Giao thành công', label: `Hoàn thành (${completedCount})` },
                      { key: 'Đã huỷ', label: 'Đã huỷ' }
                    ].map(f => (
                      <button
                        key={f.key}
                        type="button"
                        className={`filter-pill-btn ${orderFilter === f.key ? 'active' : ''}`}
                        onClick={() => setOrderFilter(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="order-toolbar-right">
                    <button
                      type="button"
                      className="btn-toolbar-test-order"
                      onClick={handleCreateTestOrder}
                      title="Giả lập một đơn hàng mới thanh toán bằng mã QR để test tức thì"
                    >
                      ⚡ + Tạo Đơn Mới (QR Test)
                    </button>
                    <button
                      type="button"
                      className="btn-toolbar-restore"
                      onClick={handleRestoreSampleOrders}
                      title="Khôi phục danh sách các đơn hàng mẫu ban đầu"
                    >
                      🔄 Khôi Phục Đơn Mẫu
                    </button>

                    <div className="order-search-box">
                      <input
                        type="text"
                        className="form-input search-orders-input"
                        placeholder="🔍 Tìm mã đơn (#PTCG...), tên khách, SĐT..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Orders List for Fulfillment */}
                {filteredOrders.length === 0 ? (
                  <div className="empty-orders-view">
                    <div style={{ fontSize: '2.5rem' }}>📭</div>
                    <h4>Không tìm thấy đơn hàng nào phù hợp</h4>
                    <p>Khi khách hàng đặt mua qua Giỏ hàng, đơn hàng sẽ ngay lập tức xuất hiện tại đây để bạn chuẩn bị đóng gói!</p>
                  </div>
                ) : (
                  <div className="shopper-orders-list">
                    {filteredOrders.map((order) => {
                      const isQrWaiting = order.status?.includes('Chờ thanh toán QR');
                      const isPending = order.status?.includes('Chờ') || order.status?.includes('Đã xác nhận') || order.status?.includes('Đã thanh toán');
                      const isPreparing = order.status === 'Đang chuẩn bị hàng';
                      const isShipping = order.status === 'Đang giao hàng';
                      const isCompleted = order.status === 'Giao thành công';
                      const isCancelled = order.status === 'Đã huỷ';
                      const pricing = checkOrderPricing(order, [...openDrawings, ...closedDrawings]);

                      return (
                        <div key={order.id} className={`shopper-order-card ${isQrWaiting ? 'card-qr-waiting' : isPending ? 'card-pending-new' : ''}`}>
                          {/* Order Top Bar */}
                          <div className="shopper-card-header">
                            <div className="shopper-header-left">
                              <span className="order-id-badge">#{order.id}</span>
                              <span className="order-time-text">{order.createdAt}</span>
                              <span className={`order-status-chip status-${isQrWaiting ? 'qr-waiting' : isPending ? 'pending' : isPreparing ? 'preparing' : isShipping ? 'shipping' : isCompleted ? 'completed' : 'cancelled'}`}>
                                {order.status}
                              </span>
                            </div>

                            <div className="shopper-header-actions">
                              <button
                                type="button"
                                className="btn-print-slip"
                                onClick={() => setSelectedSlipOrder(order)}
                                title="In phiếu đóng gói / Vận đơn Shopee"
                              >
                                🖨️ In Phiếu Đóng Gói
                              </button>
                              <button
                                type="button"
                                className="btn-delete-order"
                                onClick={() => handleDeleteOrderClick(order.id)}
                                title="Xoá đơn hàng này"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Customer & Shipping Summary */}
                          <div className="shopper-customer-grid">
                            <div className="shopper-cust-col">
                              <div className="cust-row-title">👤 Thông tin khách hàng:</div>
                              <div>Họ tên: <strong>{order.customerName}</strong></div>
                              <div>Điện thoại: <strong>{order.customerPhone || 'Chưa cập nhật'}</strong></div>
                              <div>Email: <span>{order.customerEmail}</span></div>
                            </div>

                            <div className="shopper-cust-col">
                              <div className="cust-row-title">📍 Địa chỉ nhận hàng:</div>
                              <div className="address-highlight-text">{order.shippingAddress}</div>
                              {order.orderNotes && (
                                <div className="note-bubble">
                                  <strong>Ghi chú:</strong> {order.orderNotes}
                                </div>
                              )}
                            </div>

                            <div className="shopper-cust-col">
                              <div className="cust-row-title">💳 Thanh toán & Vận chuyển:</div>
                              <div>Hình thức: <strong>{order.paymentMethod}</strong></div>
                              {order.amountVnd && (
                                <div>Quy đổi VNĐ: <strong style={{ color: '#0053e2' }}>{order.amountVnd.toLocaleString('vi-VN')} đ</strong></div>
                              )}
                              <div>Cú pháp chuyển khoản: <strong style={{ color: '#0053e2', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>PTCG {order.id}</strong></div>
                              <div>Gói giao: <strong>{order.shippingMethod}</strong></div>
                              <div className="order-price-total">
                                Tổng thu: <strong>${order.total?.toFixed(2)}</strong> {order.amountVnd ? `(~${order.amountVnd.toLocaleString('vi-VN')} đ)` : ''}
                              </div>
                            </div>
                          </div>

                          {/* Cảnh báo giá: giá trong đơn do khách gửi lên, có thể đã bị sửa */}
                          {pricing.warnings.length > 0 && (
                            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', margin: '10px 0' }}>
                              <div style={{ fontWeight: 800, marginBottom: '4px' }}>
                                ⚠️ Giá trong đơn không khớp — kiểm tra số tiền thực nhận trước khi xác nhận
                              </div>
                              <ul style={{ margin: '0 0 6px 18px', padding: 0 }}>
                                {pricing.warnings.map((w, i) => <li key={i}>{w}</li>)}
                              </ul>
                              <div>
                                Số tiền đúng theo giá hiện tại: <strong>${pricing.expectedTotal.toFixed(2)} (~{pricing.expectedVnd.toLocaleString('vi-VN')} đ)</strong>
                              </div>
                            </div>
                          )}

                          {/* Items Checklist for Packing */}
                          <div className="shopper-items-checklist">
                            <div className="checklist-heading">
                              <span>📦 Danh sách hàng cần nhặt vào hộp đóng gói ({order.items?.length || 0} món):</span>
                            </div>
                            <div className="checklist-items-table">
                              {order.items?.map((item, idx) => (
                                <div key={idx} className="checklist-row">
                                  <input type="checkbox" id={`chk-${order.id}-${idx}`} className="pack-checkbox" />
                                  <label htmlFor={`chk-${order.id}-${idx}`} className="checklist-label">
                                    <div className="checklist-thumb-wrapper" title="Ảnh thẻ bài chuẩn từ cửa hàng">
                                      <img src={getProductImage(item)} alt={item.title} className="checklist-thumb" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="checklist-item-title">{item.title}</div>
                                      <div className="checklist-item-qty">Số lượng: <strong>x{item.qty} hộp/thẻ</strong> • Đơn giá: ${item.price?.toFixed(2)}</div>
                                    </div>
                                    <div className="checklist-item-total">
                                      ${(item.price * item.qty).toFixed(2)}
                                    </div>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Shopper Workflow Action Footer */}
                          <div className="shopper-workflow-footer">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Đổi trạng thái:</span>
                              <select
                                className="status-select-dropdown"
                                value={order.status}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  const confirming = ['Đã thanh toán (Chờ chuẩn bị hàng)', 'Đang chuẩn bị hàng', 'Đang giao hàng', 'Giao thành công'].includes(next);
                                  if (confirming && pricing.warnings.length > 0
                                    && !window.confirm(`Đơn #${order.id} có giá không khớp:\n- ${pricing.warnings.join('\n- ')}\n\nBạn đã kiểm tra số tiền thực nhận và vẫn muốn đổi trạng thái?`)) {
                                    return;
                                  }
                                  handleUpdateStatus(order.id, next);
                                }}
                              >
                                <option value="Chờ thanh toán QR (Đơn mới)">🟡 Chờ thanh toán QR (Đơn mới)</option>
                                <option value="Khách báo đã chuyển khoản (Chờ xác nhận)">🟠 Khách báo đã chuyển khoản (kiểm tra sao kê)</option>
                                <option value="Đã thanh toán (Chờ chuẩn bị hàng)">🟢 Đã thanh toán (Chờ chuẩn bị hàng)</option>
                                <option value="Chờ xác nhận (Đơn mới)">Chờ xác nhận (Đơn mới)</option>
                                <option value="Đang chuẩn bị hàng">Đang chuẩn bị hàng</option>
                                <option value="Đang giao hàng">Đang giao hàng</option>
                                <option value="Giao thành công">Giao thành công</option>
                                <option value="Đã huỷ">Đã huỷ</option>
                              </select>
                            </div>

                            <div className="workflow-quick-buttons">
                              {isQrWaiting && (
                                <button
                                  type="button"
                                  className="btn-flow-action btn-flow-confirm-qr"
                                  onClick={() => handleUpdateStatus(order.id, 'Đang chuẩn bị hàng')}
                                  title="Xác nhận tài khoản đã nhận tiền chuyển khoản và bắt đầu chuẩn bị hàng"
                                >
                                  ✅ Xác Nhận Đã Nhận Tiền QR (Duyệt Đơn)
                                </button>
                              )}

                              {!isQrWaiting && isPending && (
                                <button
                                  type="button"
                                  className="btn-flow-action btn-flow-prepare"
                                  onClick={() => handleNextStep(order)}
                                >
                                  📦 Bắt Đầu Chuẩn Bị Hàng
                                </button>
                              )}

                              {isPreparing && (
                                <button
                                  type="button"
                                  className="btn-flow-action btn-flow-ship"
                                  onClick={() => handleNextStep(order)}
                                >
                                  🚚 Đã Đóng Gói - Giao Vận Chuyển
                                </button>
                              )}

                              {isShipping && (
                                <button
                                  type="button"
                                  className="btn-flow-action btn-flow-complete"
                                  onClick={() => handleNextStep(order)}
                                >
                                  ✅ Xác Nhận Đã Giao Thành Công
                                </button>
                              )}

                              {!isCancelled && !isCompleted && (
                                <button
                                  type="button"
                                  className="btn-flow-cancel"
                                  onClick={() => handleUpdateStatus(order.id, 'Đã huỷ')}
                                >
                                  Huỷ đơn
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* =========================================================================
                TAB 2: CUSTOMERS ACCOUNTS MANAGEMENT
               ========================================================================= */}
            {activeTab === 'customers' && (
              <div className="admin-customers-manager">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      Danh Sách Tài Khoản Khách Hàng Đã Đăng Ký ({customers.length})
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.84rem' }}>
                      Quản lý tài khoản khách hàng, thông tin liên lạc và lịch sử mua sắm.
                    </p>
                  </div>

                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '280px' }}
                    placeholder="🔍 Tìm khách hàng theo tên, email..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>

                <div className="customers-table-wrap">
                  <table className="customers-table">
                    <thead>
                      <tr>
                        <th>Khách Hàng</th>
                        <th>Email & Số Điện Thoại</th>
                        <th>Địa Chỉ Mặc Định</th>
                        <th>Đơn Hàng</th>
                        <th>Ngày Tạo</th>
                        <th>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers
                        .filter(c => {
                          if (!customerSearch.trim()) return true;
                          const q = customerSearch.toLowerCase();
                          return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
                        })
                        .map(cust => {
                          const customerOrdersCount = orders.filter(o => o.customerEmail?.toLowerCase() === cust.email?.toLowerCase()).length;
                          return (
                            <tr key={cust.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div className="cust-avatar-badge">{cust.name?.charAt(0) || 'C'}</div>
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{cust.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {cust.id}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{cust.email}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{cust.phone || 'Chưa cập nhật'}</div>
                              </td>
                              <td style={{ maxWidth: '240px', fontSize: '0.85rem' }}>
                                {cust.address || 'Chưa điền địa chỉ'}
                              </td>
                              <td>
                                <span className="cust-orders-badge">
                                  {customerOrdersCount} đơn
                                </span>
                              </td>
                              <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                {cust.createdAt || 'Mới đây'}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-action-delete"
                                  onClick={() => handleDeleteCustomerClick(cust.id, cust.name)}
                                  title="Xoá tài khoản khách hàng này"
                                >
                                  🗑️ Xoá
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* =========================================================================
                TAB 3: PRODUCT CATALOG (OPEN DRAWINGS & CLOSED DRAWINGS)
               ========================================================================= */}
            {(activeTab === 'open' || activeTab === 'closed') && (
              <div className="admin-table-container">
                {currentProductList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Chưa có sản phẩm nào trong mục này. Bấm <strong>+ Thêm Sản Phẩm Mới</strong> để tạo!
                  </div>
                ) : (
                  <div className="admin-product-cards-list">
                    {currentProductList.map((product) => (
                      <div key={product.id} className="admin-item-row">
                        <img src={product.image} alt={product.title} className="admin-item-thumb" />

                        <div className="admin-item-info">
                          <div className="admin-item-title">{product.title}</div>
                          <div className="admin-item-meta">
                            <span style={{ fontWeight: 800, color: '#0053e2' }}>${product.price?.toFixed(2)}</span>
                            {product.wasPrice && (
                              <span style={{ textDecoration: 'line-through', color: '#64748b' }}>
                                Was ${product.wasPrice?.toFixed(2)}
                              </span>
                            )}
                            {product.badge && <span className="admin-pill-badge">{product.badge}</span>}
                            <span style={{ color: '#64748b' }}>
                              {product.status === 'open' ? '🟢 Đang mở raffle' : '🔴 Đã kết thúc'}
                            </span>
                            <span className={`admin-stock-badge ${Number(product.stock ?? 20) <= 0 ? 'out' : Number(product.stock ?? 20) <= 5 ? 'low' : 'ok'}`}>
                              📦 Kho: <strong>{typeof product.stock === 'number' ? product.stock : 20}</strong>
                              {Number(product.stock ?? 20) <= 0 && (
                                <span style={{ marginLeft: '4px', fontStyle: 'italic', color: '#b91c1c' }}>
                                  (Hết hàng — Đang ẩn khỏi khách)
                                </span>
                              )}
                            </span>
                            <span style={{ color: '#d97706', fontWeight: 700, background: '#fffbeb', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a', fontSize: '0.74rem' }}>
                              ⏱️ {product.customCountdownText || `${product.countdownLabel || 'Drawing ends in'} ${Math.floor((product.secondsRemaining || 7200) / 3600)}h ${Math.floor(((product.secondsRemaining || 7200) % 3600) / 60)}m`}
                            </span>
                          </div>
                        </div>

                        <div className="admin-item-actions">
                          <div className="admin-stock-controls" title="Chỉnh nhanh số lượng trong kho">
                            <span className="stock-ctrl-label">Kho:</span>
                            <button
                              type="button"
                              className="btn-stock-quick"
                              onClick={() => handleQuickAdjustStock(product, -1, activeTab)}
                              disabled={(product.stock ?? 20) <= 0}
                              title="Giảm 1 sp"
                            >
                              -1
                            </button>
                            <span className="stock-count-display">{product.stock ?? 20}</span>
                            <button
                              type="button"
                              className="btn-stock-quick"
                              onClick={() => handleQuickAdjustStock(product, 1, activeTab)}
                              title="Tăng 1 sp"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              className="btn-stock-quick btn-stock-plus10"
                              onClick={() => handleQuickAdjustStock(product, 10, activeTab)}
                              title="Thêm 10 sp"
                            >
                              +10
                            </button>
                          </div>
                          <button
                            type="button"
                            className="btn-action-timer"
                            onClick={() => handleOpenQuickTimer(product)}
                            title="Tuỳ chỉnh thời gian đếm ngược (Drawing ends in)"
                          >
                            ⏱️ Đổi giờ
                          </button>
                          <label className="btn-action-upload-img" title="Tải ảnh mới từ máy tính cho sản phẩm này">
                            📷 Up ảnh
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleQuickUpload(product, activeTab, file);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => startEdit(product, activeTab)}
                            title="Chỉnh sửa sản phẩm"
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xoá sản phẩm "${product.title}"?`)) {
                                onDeleteProduct(product.id, activeTab);
                              }
                            }}
                            title="Xoá sản phẩm"
                          >
                            🗑️ Xoá
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* =========================================================================
                TAB 4: ADMIN ACCOUNT SETTINGS
               ========================================================================= */}
            {activeTab === 'account' && (
              <div className="admin-account-panel">
                <div className="admin-account-header">
                  <div style={{ fontSize: '2rem' }}>🛡️</div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                      Thiết Lập Tài Khoản Quản Trị Viên (Admin)
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                      Đổi mật khẩu đăng nhập quản trị. Mật khẩu được Firebase Authentication quản lý, không lưu trong website.
                    </p>
                  </div>
                </div>

                {accountSuccessMsg && (
                  <div className="admin-account-success">
                    {accountSuccessMsg}
                  </div>
                )}
                {accountErrorMsg && (
                  <div className="admin-login-error-alert" role="alert">
                    <span>⚠️</span>
                    <span>{accountErrorMsg}</span>
                  </div>
                )}

                <div className="admin-account-current-badge">
                  <span>Đăng nhập với: <strong>{auth.currentUser?.email || '—'}</strong></span>
                </div>

                <form onSubmit={handleChangePassword} className="admin-account-form">
                  <div className="form-group">
                    <label className="form-label">Mật Khẩu Hiện Tại <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      className="form-input"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mật Khẩu Mới (tối thiểu 8 ký tự) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="form-input"
                      value={passwordForm.next}
                      onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nhập Lại Mật Khẩu Mới <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="form-input"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                      required
                    />
                  </div>

                  <div className="admin-account-actions">
                    <button type="submit" className="btn-admin-save-account" disabled={isChangingPassword}>
                      {isChangingPassword ? '⏳ Đang đổi mật khẩu...' : '🔐 Đổi Mật Khẩu'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* =========================================================================
                TAB 5: QR CODE & BANK TRANSFER SETTINGS
               ========================================================================= */}
            {activeTab === 'qr_settings' && (
              <div className="admin-account-panel">
                <div className="admin-account-header">
                  <div style={{ fontSize: '2.2rem' }}>💳</div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                      Thiết Lập Mã QR Thanh Toán & Tài Khoản Ngân Hàng
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                      Tự động tạo mã VietQR theo tài khoản ngân hàng của bạn hoặc tải lên hình ảnh mã QR riêng. Khi khách mua hàng chọn Chuyển khoản, hệ thống sẽ hiển thị đúng mã QR này.
                    </p>
                  </div>
                </div>

                {qrSaveToast && (
                  <div className="admin-account-success" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                    {qrSaveToast}
                  </div>
                )}

                <div className="admin-qr-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) 340px', gap: '24px', marginTop: '20px' }}>
                  {/* LEFT: SETTINGS FORM */}
                  <form onSubmit={handleSaveQrSettings} className="admin-account-form" style={{ marginTop: 0 }}>
                    {/* Mode selector */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Chế độ tạo mã QR</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                          type="button"
                          className={`btn-mode-chip ${qrSettings.mode === 'vietqr' ? 'active' : ''}`}
                          style={{
                            padding: '10px 12px',
                            textAlign: 'center',
                            fontWeight: 700,
                            border: qrSettings.mode === 'vietqr' ? '2px solid #0053e2' : '1.5px solid #cbd5e1',
                            background: qrSettings.mode === 'vietqr' ? '#eff6ff' : '#ffffff',
                            color: qrSettings.mode === 'vietqr' ? '#0053e2' : '#475569',
                            borderRadius: '10px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setQrSettings({ ...qrSettings, mode: 'vietqr' })}
                        >
                          ⚡ VietQR Tự Động (Khuyên Dùng)
                        </button>
                        <button
                          type="button"
                          className={`btn-mode-chip ${qrSettings.mode === 'custom_image' ? 'active' : ''}`}
                          style={{
                            padding: '10px 12px',
                            textAlign: 'center',
                            fontWeight: 700,
                            border: qrSettings.mode === 'custom_image' ? '2px solid #0053e2' : '1.5px solid #cbd5e1',
                            background: qrSettings.mode === 'custom_image' ? '#eff6ff' : '#ffffff',
                            color: qrSettings.mode === 'custom_image' ? '#0053e2' : '#475569',
                            borderRadius: '10px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setQrSettings({ ...qrSettings, mode: 'custom_image' })}
                        >
                          🖼️ Tải Ảnh QR Riêng Của Bạn
                        </button>
                      </div>
                    </div>

                    {qrSettings.mode === 'vietqr' ? (
                      <>
                        <div className="form-group">
                          <label className="form-label">Chọn Ngân Hàng Thụ Hưởng <span style={{ color: '#ef4444' }}>*</span></label>
                          <select
                            className="form-input"
                            value={qrSettings.bankCode}
                            onChange={(e) => {
                              const selectedCode = e.target.value;
                              const bank = POPULAR_BANKS.find(b => b.code === selectedCode);
                              setQrSettings({
                                ...qrSettings,
                                bankCode: selectedCode,
                                bankName: bank ? bank.name : selectedCode
                              });
                            }}
                          >
                            {POPULAR_BANKS.map((b) => (
                              <option key={b.code} value={b.code}>
                                {b.name} ({b.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Số Tài Khoản Ngân Hàng <span style={{ color: '#ef4444' }}>*</span></label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ví dụ: 888866889999 hoặc 1903..."
                            value={qrSettings.accountNumber}
                            onChange={(e) => setQrSettings({ ...qrSettings, accountNumber: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Tên Chủ Tài Khoản (In hoa không dấu) <span style={{ color: '#ef4444' }}>*</span></label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ví dụ: NGUYEN VAN A hoặc POINT TCG STORE"
                            value={qrSettings.accountName}
                            onChange={(e) => setQrSettings({ ...qrSettings, accountName: e.target.value.toUpperCase() })}
                            required
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label className="form-label">Tiền tố cú pháp chuyển khoản</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Mặc định: PTCG"
                              value={qrSettings.notePrefix}
                              onChange={(e) => setQrSettings({ ...qrSettings, notePrefix: e.target.value.toUpperCase().trim() })}
                            />
                            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Ví dụ: PTCG 123456</span>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Mẫu hiển thị VietQR</label>
                            <select
                              className="form-input"
                              value={qrSettings.qrTemplate}
                              onChange={(e) => setQrSettings({ ...qrSettings, qrTemplate: e.target.value })}
                            >
                              <option value="compact2">Compact 2 (Đầy đủ logo & số tiền - Khuyên dùng)</option>
                              <option value="compact">Compact (Gọn gàng)</option>
                              <option value="qr_only">QR Only (Chỉ khung mã QR)</option>
                            </select>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-group">
                          <label className="form-label">Tải Lên Ảnh Mã QR Ngân Hàng / Ví Điện Tử Của Bạn</label>
                          <div
                            style={{
                              border: '2px dashed #94a3b8',
                              borderRadius: '10px',
                              padding: '20px',
                              textAlign: 'center',
                              background: '#f8fafc',
                              cursor: 'pointer'
                            }}
                            onClick={() => qrImageFileInputRef.current?.click()}
                          >
                            <input
                              ref={qrImageFileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/jpg"
                              style={{ display: 'none' }}
                              onChange={handleQrImageUpload}
                            />
                            <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📷</div>
                            <strong style={{ color: '#0053e2', fontSize: '0.9rem' }}>
                              Bấm vào đây để chọn ảnh mã QR từ máy tính
                            </strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                              Hỗ trợ định dạng PNG, JPG, WebP (Tối đa 2MB)
                            </p>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Hoặc nhập link URL ảnh mã QR trực tuyến</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="https://...link-anh-qr.png"
                            value={qrSettings.customQrImage?.startsWith('data:') ? '' : qrSettings.customQrImage}
                            onChange={(e) => setQrSettings({ ...qrSettings, customQrImage: e.target.value })}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label className="form-label">Tên Ngân Hàng / Ví hiển thị</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ví dụ: MB Bank hoặc Ví MoMo"
                              value={qrSettings.bankName}
                              onChange={(e) => setQrSettings({ ...qrSettings, bankName: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Số Tài Khoản / SĐT hiển thị</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Số tài khoản để khách copy"
                              value={qrSettings.accountNumber}
                              onChange={(e) => setQrSettings({ ...qrSettings, accountNumber: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Tên Chủ Tài Khoản</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Tên chủ tài khoản in hoa"
                            value={qrSettings.accountName}
                            onChange={(e) => setQrSettings({ ...qrSettings, accountName: e.target.value.toUpperCase() })}
                          />
                        </div>
                      </>
                    )}

                    <div className="admin-account-actions" style={{ marginTop: '20px' }}>
                      <button type="submit" className="btn-admin-save-account" style={{ padding: '12px 24px', fontSize: '0.95rem' }}>
                        💾 Lưu Cài Đặt Mã QR Mới
                      </button>
                      <button
                        type="button"
                        className="btn-admin-reset-account"
                        onClick={handleResetQrSettings}
                      >
                        ↺ Khôi phục mặc định MB Bank
                      </button>
                    </div>
                  </form>

                  {/* RIGHT: LIVE PREVIEW OF HOW CUSTOMERS WILL SEE IT */}
                  <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '18px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, color: '#0f172a', fontSize: '0.92rem', marginBottom: '12px' }}>
                      <span>👁️</span>
                      <span>Xem Trước Mã QR Khách Sẽ Quét</span>
                    </div>

                    <div style={{
                      background: '#ffffff',
                      border: '2px solid #0053e2',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'inline-block',
                      boxShadow: '0 8px 24px rgba(0,83,226,0.12)',
                      maxWidth: '260px'
                    }}>
                      <img
                        src={generateQrUrl(qrSettings, 500000, 'PTCG-123456')}
                        alt="Preview QR Code"
                        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '6px' }}
                      />
                    </div>

                    <div style={{ marginTop: '14px', textAlign: 'left', background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', lineHeight: 1.6 }}>
                      <div>🏦 <strong>Ngân hàng:</strong> {qrSettings.bankName || 'MB Bank'}</div>
                      <div>🔢 <strong>STK:</strong> <code style={{ color: '#0053e2', fontWeight: 700 }}>{qrSettings.accountNumber || '888866889999'}</code></div>
                      <div>👤 <strong>Chủ TK:</strong> {qrSettings.accountName || 'POINT TCG STORE'}</div>
                      <div>💵 <strong>Số tiền mẫu:</strong> 500.000₫</div>
                      <div>📝 <strong>Cú pháp mẫu:</strong> <code>{qrSettings.notePrefix || 'PTCG'} PTCG-123456</code></div>
                    </div>

                    <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
                      ✓ Bạn có thể dùng điện thoại quét thử mã QR này ngay bây giờ!
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                TAB 6: FIREBASE CLOUD FIRESTORE DATABASE
               ========================================================================= */}
            {activeTab === 'firebase_db' && (
              <div className="admin-account-panel" style={{ maxWidth: '980px' }}>
                {/* Header Card */}
                <div className="admin-account-header" style={{
                  background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                  border: '1.5px solid #fed7aa',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '2.5rem' }}>🔥</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#9a3412', margin: 0 }}>
                          Firebase Cloud Firestore Database
                        </h3>
                        <span style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          borderRadius: '20px',
                          padding: '3px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                          ONLINE (Live)
                        </span>
                      </div>
                      <p style={{ color: '#c2410c', fontSize: '0.88rem', margin: '4px 0 0 0', fontWeight: 500 }}>
                        Dự án: <strong>point-tcg</strong> | Cơ sở dữ liệu: <strong>(default)</strong> | 4 Bảng: <code>products</code>, <code>orders</code>, <code>users</code>, <code>settings</code>
                      </p>
                    </div>
                  </div>

                  <a
                    href="https://console.firebase.google.com/project/point-tcg/firestore"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#ea580c',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontWeight: 800,
                      fontSize: '0.86rem',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>Mở Firebase Console</span>
                    <span>↗</span>
                  </a>
                </div>

                {/* Toast Notification */}
                {firebaseToast && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    background: firebaseToast.type === 'error' ? '#fef2f2' : firebaseToast.type === 'info' ? '#eff6ff' : '#ecfdf5',
                    color: firebaseToast.type === 'error' ? '#991b1b' : firebaseToast.type === 'info' ? '#1d4ed8' : '#065f46',
                    border: `1.5px solid ${firebaseToast.type === 'error' ? '#fecaca' : firebaseToast.type === 'info' ? '#bfdbfe' : '#a7f3d0'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{firebaseToast.type === 'error' ? '❌' : firebaseToast.type === 'info' ? '⏳' : '✅'}</span>
                      <span>{firebaseToast.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFirebaseToast(null)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: 'inherit' }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Primary Actions Row */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginTop: '20px',
                  padding: '16px',
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '14px'
                }}>
                  <button
                    type="button"
                    disabled={firebaseSyncing}
                    onClick={handleSyncToFirebase}
                    style={{
                      flex: '1 1 240px',
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      cursor: firebaseSyncing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(234, 88, 12, 0.3)',
                      opacity: firebaseSyncing ? 0.7 : 1
                    }}
                  >
                    <span>{firebaseSyncing ? '⏳' : '🚀'}</span>
                    <span>Đẩy Dữ Liệu Hiện Tại Lên Firebase</span>
                  </button>

                  <button
                    type="button"
                    disabled={firebaseSyncing}
                    onClick={handlePullFromFirebase}
                    style={{
                      flex: '1 1 220px',
                      padding: '12px 20px',
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      cursor: firebaseSyncing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>⬇️</span>
                    <span>Nạp Dữ Liệu Từ Firebase Về Máy</span>
                  </button>

                  <button
                    type="button"
                    disabled={loadingFirebaseTable}
                    onClick={() => handleLoadFirebaseCollection(firebaseActiveSubTab === 'overview' ? 'products' : firebaseActiveSubTab)}
                    style={{
                      padding: '12px 18px',
                      background: '#ffffff',
                      color: '#475569',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>🔄</span>
                    <span>Làm Mới</span>
                  </button>
                </div>

                {/* 4 Collections Overview Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '16px',
                  marginTop: '20px'
                }}>
                  {/* Table 1: Products */}
                  <div
                    onClick={() => {
                      setFirebaseActiveSubTab('products');
                      handleLoadFirebaseCollection('products');
                    }}
                    style={{
                      background: firebaseActiveSubTab === 'products' ? '#fff7ed' : '#ffffff',
                      border: firebaseActiveSubTab === 'products' ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '18px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: firebaseActiveSubTab === 'products' ? '0 6px 20px rgba(234,88,12,0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.8rem' }}>📦</span>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                        collection
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>products</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>Sản phẩm thẻ Pokémon</div>
                    <div style={{ marginTop: '12px', fontSize: '1.25rem', fontWeight: 900, color: '#ea580c' }}>
                      {openDrawings.length + closedDrawings.length} mục
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>
                      ✓ Đã đồng bộ với Cloud
                    </div>
                  </div>

                  {/* Table 2: Orders */}
                  <div
                    onClick={() => {
                      setFirebaseActiveSubTab('orders');
                      handleLoadFirebaseCollection('orders');
                    }}
                    style={{
                      background: firebaseActiveSubTab === 'orders' ? '#fff7ed' : '#ffffff',
                      border: firebaseActiveSubTab === 'orders' ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '18px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: firebaseActiveSubTab === 'orders' ? '0 6px 20px rgba(234,88,12,0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.8rem' }}>🛍️</span>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                        collection
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>orders</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>Đơn đặt hàng Shopper</div>
                    <div style={{ marginTop: '12px', fontSize: '1.25rem', fontWeight: 900, color: '#ea580c' }}>
                      {orders.length} đơn
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>
                      ✓ Tự động lưu khi khách đặt
                    </div>
                  </div>

                  {/* Table 3: Users */}
                  <div
                    onClick={() => {
                      setFirebaseActiveSubTab('users');
                      handleLoadFirebaseCollection('users');
                    }}
                    style={{
                      background: firebaseActiveSubTab === 'users' ? '#fff7ed' : '#ffffff',
                      border: firebaseActiveSubTab === 'users' ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '18px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: firebaseActiveSubTab === 'users' ? '0 6px 20px rgba(234,88,12,0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.8rem' }}>👥</span>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                        collection
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>users</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>Khách hàng & Quản trị</div>
                    <div style={{ marginTop: '12px', fontSize: '1.25rem', fontWeight: 900, color: '#ea580c' }}>
                      {customers.length + 1} tài khoản
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>
                      ✓ Phân quyền Admin / Customer
                    </div>
                  </div>

                  {/* Table 4: Settings */}
                  <div
                    onClick={() => {
                      setFirebaseActiveSubTab('settings');
                      handleLoadFirebaseCollection('settings');
                    }}
                    style={{
                      background: firebaseActiveSubTab === 'settings' ? '#fff7ed' : '#ffffff',
                      border: firebaseActiveSubTab === 'settings' ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '18px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: firebaseActiveSubTab === 'settings' ? '0 6px 20px rgba(234,88,12,0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.8rem' }}>⚙️</span>
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                        collection
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>settings</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>VietQR & Thông tin Shop</div>
                    <div style={{ marginTop: '12px', fontSize: '1.25rem', fontWeight: 900, color: '#ea580c' }}>
                      2 cấu hình
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>
                      ✓ bank_qr & store_info
                    </div>
                  </div>
                </div>

                {/* SubTab Data Table / Document Explorer */}
                <div style={{
                  marginTop: '24px',
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}>
                  {/* Explorer Tab Bar */}
                  <div style={{
                    display: 'flex',
                    borderBottom: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    overflowX: 'auto',
                    padding: '8px 12px',
                    gap: '8px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setFirebaseActiveSubTab('overview')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: firebaseActiveSubTab === 'overview' ? '#ffffff' : 'transparent',
                        color: firebaseActiveSubTab === 'overview' ? '#0f172a' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: firebaseActiveSubTab === 'overview' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
                      }}
                    >
                      📊 Tổng Quan Cấu Trúc
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFirebaseActiveSubTab('products');
                        if (!firebaseDbData.products) handleLoadFirebaseCollection('products');
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: firebaseActiveSubTab === 'products' ? '#ea580c' : 'transparent',
                        color: firebaseActiveSubTab === 'products' ? '#ffffff' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      📦 products ({openDrawings.length + closedDrawings.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFirebaseActiveSubTab('orders');
                        if (!firebaseDbData.orders) handleLoadFirebaseCollection('orders');
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: firebaseActiveSubTab === 'orders' ? '#ea580c' : 'transparent',
                        color: firebaseActiveSubTab === 'orders' ? '#ffffff' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      🛍️ orders ({orders.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFirebaseActiveSubTab('users');
                        if (!firebaseDbData.users) handleLoadFirebaseCollection('users');
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: firebaseActiveSubTab === 'users' ? '#ea580c' : 'transparent',
                        color: firebaseActiveSubTab === 'users' ? '#ffffff' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      👥 users ({customers.length + 1})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFirebaseActiveSubTab('settings');
                        if (!firebaseDbData.settings) handleLoadFirebaseCollection('settings');
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: firebaseActiveSubTab === 'settings' ? '#ea580c' : 'transparent',
                        color: firebaseActiveSubTab === 'settings' ? '#ffffff' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      ⚙️ settings (2 docs)
                    </button>
                  </div>

                  {/* Explorer Content */}
                  <div style={{ padding: '20px' }}>
                    {loadingFirebaseTable ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
                        <div>Đang tải dữ liệu từ Firebase Cloud Firestore...</div>
                      </div>
                    ) : firebaseActiveSubTab === 'overview' ? (
                      /* Overview Tab */
                      <div>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                          Cấu trúc các bảng dữ liệu trên Cloud Firestore
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 800, color: '#ea580c' }}>📁 collection: products</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                              Lưu trữ toàn bộ danh sách sản phẩm thẻ bài Pokémon, giá bán USD/VND, số lượng tồn kho, trạng thái Open/Closed, đếm ngược thời gian và hình ảnh.
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                              <code>id, title, price, wasPrice, stock, category, status, statusTime, description</code>
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 800, color: '#ea580c' }}>📁 collection: orders</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                              Lưu trữ chi tiết các đơn đặt hàng của khách: họ tên, email, số điện thoại, địa chỉ nhận hàng, phương thức thanh toán VietQR / COD, danh sách sản phẩm và trạng thái đơn.
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                              <code>id, customerName, customerEmail, customerPhone, shippingAddress, items, total, status, createdAt</code>
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 800, color: '#ea580c' }}>📁 collection: users</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                              Lưu trữ hồ sơ tài khoản khách hàng và tài khoản quản trị viên hệ thống (phân quyền role <code>admin</code> và <code>customer</code>).
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                              <code>id, name, username, email, phone, address, role, createdAt</code>
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontWeight: 800, color: '#ea580c' }}>📁 collection: settings</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                              Lưu trữ cài đặt hệ thống: thông tin ngân hàng tạo mã VietQR động (MBBank, STK, Tên chủ thẻ) và thông tin cửa hàng Point TCG.
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.78rem', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                              <code>settings/bank_qr_config, settings/store_info</code>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Collection Data Table & JSON Inspector */
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                            Dữ liệu trực tiếp bảng <code>{firebaseActiveSubTab}</code>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const dataToCopy = firebaseDbData[firebaseActiveSubTab] || (
                                firebaseActiveSubTab === 'products' ? [...openDrawings, ...closedDrawings] :
                                firebaseActiveSubTab === 'orders' ? orders :
                                firebaseActiveSubTab === 'users' ? customers : qrSettings
                              );
                              navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
                              alert('Đã sao chép toàn bộ dữ liệu JSON vào bộ nhớ đệm!');
                            }}
                            style={{
                              padding: '6px 12px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            📋 Sao chép JSON
                          </button>
                        </div>

                        {/* Render Items */}
                        <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                          {firebaseActiveSubTab === 'products' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left' }}>
                                  <th style={{ padding: '10px 12px' }}>Document ID</th>
                                  <th style={{ padding: '10px 12px' }}>Tên Sản Phẩm</th>
                                  <th style={{ padding: '10px 12px' }}>Giá</th>
                                  <th style={{ padding: '10px 12px' }}>Tồn kho</th>
                                  <th style={{ padding: '10px 12px' }}>Phân loại</th>
                                  <th style={{ padding: '10px 12px' }}>Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(firebaseDbData.products || [...openDrawings, ...closedDrawings]).map((prod) => (
                                  <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 12px' }}><code style={{ color: '#0053e2', fontWeight: 700 }}>{prod.id}</code></td>
                                    <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: '280px' }}>{prod.title}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#16a34a' }}>${prod.price}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{prod.stock ?? 20}</td>
                                    <td style={{ padding: '10px 12px' }}>{prod.category || 'Booster Box'}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{
                                        background: prod.status === 'open' ? '#dcfce7' : '#f1f5f9',
                                        color: prod.status === 'open' ? '#15803d' : '#475569',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '0.74rem',
                                        fontWeight: 800
                                      }}>
                                        {prod.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {firebaseActiveSubTab === 'orders' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left' }}>
                                  <th style={{ padding: '10px 12px' }}>Mã Đơn</th>
                                  <th style={{ padding: '10px 12px' }}>Khách Hàng</th>
                                  <th style={{ padding: '10px 12px' }}>Số Điện Thoại</th>
                                  <th style={{ padding: '10px 12px' }}>Tổng Tiền</th>
                                  <th style={{ padding: '10px 12px' }}>Thanh Toán</th>
                                  <th style={{ padding: '10px 12px' }}>Trạng Thái</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(firebaseDbData.orders || orders).map((ord) => (
                                  <tr key={ord.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 12px' }}><code style={{ color: '#ea580c', fontWeight: 800 }}>#{ord.id}</code></td>
                                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{ord.customerName}</td>
                                    <td style={{ padding: '10px 12px' }}>{ord.customerPhone}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: 800, color: '#16a34a' }}>${ord.total}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>{ord.paymentMethod?.slice(0, 20)}...</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{
                                        background: ord.status?.includes('Giao thành công') ? '#dcfce7' : '#eff6ff',
                                        color: ord.status?.includes('Giao thành công') ? '#15803d' : '#1d4ed8',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '0.74rem',
                                        fontWeight: 800
                                      }}>
                                        {ord.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {firebaseActiveSubTab === 'users' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left' }}>
                                  <th style={{ padding: '10px 12px' }}>ID / Username</th>
                                  <th style={{ padding: '10px 12px' }}>Họ Và Tên</th>
                                  <th style={{ padding: '10px 12px' }}>Email</th>
                                  <th style={{ padding: '10px 12px' }}>Số Điện Thoại</th>
                                  <th style={{ padding: '10px 12px' }}>Phân Quyền (Role)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(firebaseDbData.users || customers).map((usr, idx) => (
                                  <tr key={usr.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 12px' }}><code style={{ color: '#0053e2', fontWeight: 700 }}>{usr.id || usr.username}</code></td>
                                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{usr.name}</td>
                                    <td style={{ padding: '10px 12px' }}>{usr.email}</td>
                                    <td style={{ padding: '10px 12px' }}>{usr.phone || 'Chưa cập nhật'}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{
                                        background: usr.role === 'admin' ? '#fee2e2' : '#f1f5f9',
                                        color: usr.role === 'admin' ? '#b91c1c' : '#334155',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '0.74rem',
                                        fontWeight: 800
                                      }}>
                                        {usr.role || 'customer'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {firebaseActiveSubTab === 'settings' && (
                            <div style={{ padding: '16px', background: '#f8fafc' }}>
                              <pre style={{ margin: 0, fontSize: '0.82rem', color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(firebaseDbData.settings || {
                                  bank_qr_config: qrSettings,
                                  store_info: {
                                    storeName: 'Point TCG',
                                    email: 'kiba14123@gmail.com',
                                    hotline: '0901 234 567',
                                    messenger: 'https://m.me/1429099050281227',
                                    website: 'https://point-tcg.web.app'
                                  }
                                }, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            PRINTABLE PACKING SLIP / VẬN ĐƠN GIAO HÀNG (SHOPEE STYLE)
           ========================================================================= */}
        {selectedSlipOrder && (
          <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setSelectedSlipOrder(null)}>
            <div className="packing-slip-modal" onClick={(e) => e.stopPropagation()}>
              <div className="slip-top-actions">
                <button
                  type="button"
                  className="btn-print-trigger"
                  onClick={() => window.print()}
                >
                  🖨️ In Phiếu Đóng Gói (Print)
                </button>
                <button
                  type="button"
                  className="btn-slip-close"
                  onClick={() => setSelectedSlipOrder(null)}
                >
                  ✕ Đóng
                </button>
              </div>

              {/* The Printable Slip Document */}
              <div className="printable-slip-card" id="printable-slip">
                <div className="slip-brand-row">
                  <div>
                    <h3 className="slip-brand-name">⚡ POINT TCG LOGISTICS</h3>
                    <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Dịch Vụ Vận Chuyển Hàng Sưu Tầm Niêm Phong An Toàn</p>
                  </div>
                  <div className="slip-barcode-box">
                    <div className="mock-barcode-lines" />
                    <div className="barcode-code">#{selectedSlipOrder.id}</div>
                  </div>
                </div>

                <div className="slip-addresses-grid">
                  <div className="slip-addr-col">
                    <div className="addr-tag">TỪ (SENDER):</div>
                    <div style={{ fontWeight: 800 }}>POINT TCG FLAGSHIP VAULT</div>
                    <div>Tổng kho Thẻ Bài Pokémon Chính Hãng</div>
                    <div>Hotline: 1900-POKEMON | TP. Hồ Chí Minh</div>
                  </div>

                  <div className="slip-addr-col recipient-col">
                    <div className="addr-tag recipient-tag">ĐẾN (RECIPIENT):</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{selectedSlipOrder.customerName}</div>
                    <div style={{ fontWeight: 700, color: '#0053e2' }}>SĐT: {selectedSlipOrder.customerPhone || 'N/A'}</div>
                    <div style={{ marginTop: '4px' }}>{selectedSlipOrder.shippingAddress}</div>
                    {selectedSlipOrder.orderNotes && (
                      <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#b45309' }}>
                        * Ghi chú: {selectedSlipOrder.orderNotes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Packing Checklist */}
                <div className="slip-items-box">
                  <div className="slip-box-title">DANH SÁCH SẢN PHẨM CẦN ĐÓNG HỘP (PACKING CHECKLIST)</div>
                  <table className="slip-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>✓</th>
                        <th>Tên Thẻ / Hộp Pokémon</th>
                        <th style={{ width: '60px', textAlign: 'center' }}>SL</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Đơn Giá</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSlipOrder.items?.map((item, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center' }}>[ ]</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img
                                src={getProductImage(item)}
                                alt={item.title}
                                style={{ width: '38px', height: '38px', borderRadius: '4px', objectFit: 'contain', background: '#ffffff', flexShrink: 0, border: '1px solid #cbd5e1' }}
                              />
                              <div>
                                <strong>{item.title}</strong>
                                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Mã sản phẩm: #{item.id}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800 }}>x{item.qty}</td>
                          <td style={{ textAlign: 'right' }}>${item.price?.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>${(item.price * item.qty).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* COD & Total Summary */}
                <div className="slip-cod-footer">
                  <div className="cod-amount-box">
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>TIỀN THU NGƯỜI NHẬN (COD):</div>
                    <div className="cod-big-amount">
                      {selectedSlipOrder.paymentMethod.includes('COD')
                        ? `$${selectedSlipOrder.total?.toFixed(2)}`
                        : '0.00 (ĐÃ THANH TOÁN ONLINE)'}
                    </div>
                  </div>

                  <div className="slip-instruction">
                    <div>⚠️ <strong>CHỈ DẪN VẬN CHUYỂN:</strong> ĐỒNG KIỂM NIÊM PHONG • KHÔNG ĐƯỢC LÀM RÁCH SEAL • TRẢ HÀNG NẾU HỘP BỊ MÓP MÉO</div>
                  </div>
                </div>

                <div className="slip-signatures-row">
                  <div>
                    <div>Chữ ký người gửi (Shopper):</div>
                    <div className="signature-line">Point TCG Vault</div>
                  </div>
                  <div>
                    <div>Chữ ký người nhận:</div>
                    <div className="signature-line" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Countdown Timer Modal */}
        {quickTimerProduct && (
          <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setQuickTimerProduct(null)}>
            <div className="quick-timer-modal" onClick={(e) => e.stopPropagation()}>
              <div className="quick-timer-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>⏱️</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                      Tuỳ Chỉnh "Drawing ends in"
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                      {quickTimerProduct.title}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setQuickTimerProduct(null)}
                >
                  ✕
                </button>
              </div>

              <div className="quick-timer-body">
                {/* Mode selector */}
                <div className="countdown-mode-toggle" style={{ marginBottom: '14px' }}>
                  <button
                    type="button"
                    className={`btn-mode-chip ${quickTimerData.mode === 'timer' ? 'active' : ''}`}
                    onClick={() => setQuickTimerData({ ...quickTimerData, mode: 'timer' })}
                  >
                    ⏳ Đếm Giờ : Phút : Giây
                  </button>
                  <button
                    type="button"
                    className={`btn-mode-chip ${quickTimerData.mode === 'custom' ? 'active' : ''}`}
                    onClick={() => setQuickTimerData({ ...quickTimerData, mode: 'custom' })}
                  >
                    ✍️ Chữ Cố Định
                  </button>
                </div>

                {quickTimerData.mode === 'timer' ? (
                  <>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label">Tiền tố hiển thị (Label):</label>
                      <input
                        type="text"
                        className="form-input"
                        value={quickTimerData.label}
                        onChange={(e) => setQuickTimerData({ ...quickTimerData, label: e.target.value })}
                      />
                      <div className="countdown-preset-chips" style={{ marginTop: '6px' }}>
                        {['Drawing ends in', 'Kết thúc trong', 'Sắp hết hạn sau', 'Raffle closes in'].map((txt) => (
                          <button
                            key={txt}
                            type="button"
                            className={`preset-text-chip ${quickTimerData.label === txt ? 'active' : ''}`}
                            onClick={() => setQuickTimerData({ ...quickTimerData, label: txt })}
                          >
                            {txt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="countdown-inputs-grid" style={{ marginBottom: '14px' }}>
                      <div className="countdown-input-unit">
                        <label className="unit-label">Giờ</label>
                        <input
                          type="number"
                          min="0"
                          className="form-input unit-input"
                          value={quickTimerData.hours}
                          onChange={(e) => setQuickTimerData({ ...quickTimerData, hours: Math.max(0, parseInt(e.target.value) || 0) })}
                        />
                      </div>
                      <div className="countdown-separator">:</div>
                      <div className="countdown-input-unit">
                        <label className="unit-label">Phút</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="form-input unit-input"
                          value={quickTimerData.minutes}
                          onChange={(e) => setQuickTimerData({ ...quickTimerData, minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                        />
                      </div>
                      <div className="countdown-separator">:</div>
                      <div className="countdown-input-unit">
                        <label className="unit-label">Giây</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="form-input unit-input"
                          value={quickTimerData.seconds}
                          onChange={(e) => setQuickTimerData({ ...quickTimerData, seconds: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                        />
                      </div>
                    </div>

                    <div className="countdown-duration-presets" style={{ marginBottom: '16px' }}>
                      <div className="presets-list">
                        {[
                          { label: '⚡ 30 phút', h: 0, m: 30, s: 0 },
                          { label: '🔥 1 giờ', h: 1, m: 0, s: 0 },
                          { label: '🕒 2 giờ 14p', h: 2, m: 14, s: 4 },
                          { label: '🕒 3 giờ', h: 3, m: 0, s: 0 },
                          { label: '⭐ 6 giờ', h: 6, m: 0, s: 0 },
                          { label: '🌙 12 giờ', h: 12, m: 0, s: 0 },
                          { label: '📅 24 giờ (1 ngày)', h: 24, m: 0, s: 0 },
                          { label: '✨ 7 ngày', h: 168, m: 0, s: 0 }
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`btn-time-chip ${quickTimerData.hours === preset.h && quickTimerData.minutes === preset.m ? 'selected' : ''}`}
                            onClick={() => setQuickTimerData({
                              ...quickTimerData,
                              hours: preset.h,
                              minutes: preset.m,
                              seconds: preset.s
                            })}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Nhập chữ tuỳ chỉnh:</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ví dụ: Drawing ends in 02:59:31"
                      value={quickTimerData.customText}
                      onChange={(e) => setQuickTimerData({ ...quickTimerData, customText: e.target.value })}
                    />
                    <div className="countdown-preset-chips" style={{ marginTop: '8px' }}>
                      {['Drawing ends in 02:59:31', 'Drawing ends in 02:14:04', 'Drawing ends in 05:07:01', '🔥 Sắp kết thúc hôm nay'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="preset-text-chip"
                          onClick={() => setQuickTimerData({ ...quickTimerData, customText: s })}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Preview Bar */}
                <div className="countdown-live-badge-preview" style={{ marginBottom: '18px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Xem trước:</span>
                  <div className="countdown-status-badge" style={{ display: 'inline-flex', margin: 0 }}>
                    <svg className="countdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>
                      {quickTimerData.mode === 'custom' && quickTimerData.customText.trim()
                        ? quickTimerData.customText.trim()
                        : `${quickTimerData.label} ${String(quickTimerData.hours).padStart(2, '0')}:${String(quickTimerData.minutes).padStart(2, '0')}:${String(quickTimerData.seconds).padStart(2, '0')}`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-admin-save"
                    onClick={handleSaveQuickTimer}
                  >
                    💾 Cập Nhật Thời Gian
                  </button>
                  <button
                    type="button"
                    className="btn-admin-cancel"
                    onClick={() => setQuickTimerProduct(null)}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (isFullPage) {
    return <div className="admin-fullpage-wrapper">{modalInner}</div>;
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Admin Portal">
      {modalInner}
    </div>
  );
}
