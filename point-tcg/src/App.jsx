// src/App.jsx
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import Header, { normalizeSearchText } from './components/Header';
import SubNav from './components/SubNav';
import ProductCard from './components/ProductCard';
import { getProductSeries, groupProductsBySeries } from './utils/productSeries';
import Carousel from './components/Carousel';
import CartDrawer from './components/CartDrawer';
import SavedModal from './components/SavedModal';
import ProductDetailPage from './components/ProductDetailPage';
import SignInModal from './components/SignInModal';
// Trang quản trị chỉ tải khi vào #admin — khách mua hàng không phải tải phần code này
const AdminPage = lazy(() => import('./components/AdminPage'));
// Tải khi cần: form thanh toán (khi bấm mua) và trang đơn hàng / tài khoản
const CheckoutModal = lazy(() => import('./components/CheckoutModal'));
const CustomerOrdersPage = lazy(() => import('./components/CustomerOrdersPage'));
import FloatingMessenger from './components/FloatingMessenger';
import Footer from './components/Footer';
import NotificationBell from './components/NotificationBell';
import AnnouncementBar from './components/AnnouncementBar';
import HeroBanner from './components/HeroBanner';
import { useI18n } from './i18n';
import { VND_RATE } from './utils/currency';
import { checkAdminUnlocked, lockAdmin } from './utils/adminSecurity';
import { isPreorderProduct, getRemainingAllowance, getMaxPerCustomer, getPreorderSlotsLeft, getOrderedQty, getPreorderReservedFromOrders } from './utils/preorder';
import { PRE_DEPOSIT_PAID, PRE_ARRIVED, PAID_STATUS, PREORDER_STATUSES, CANCELLED_STATUS } from './utils/orderStatus';
import { getDrawingText } from './utils/countdown';
import {
  buildNotifications,
  trackWishlistChanges,
  getReadAt,
  markAllRead,
  isAnnouncementLive
} from './utils/notifications';
import {
  openDrawings as initialOpenDrawings,
  closedDrawings as initialClosedDrawings,
  allProducts,
  getProductCatalogImage
} from './products';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { buildSessionUser, signOutUser, purgeLegacyLocalData } from './utils/auth';
import {
  fetchProductsFromDb,
  fetchOrdersFromDb,
  saveOrderToDb,
  updateOrderStatusInDb,
  deleteOrderFromDb,
  saveProductToDb,
  saveProductMediaToDb,
  deleteProductFromDb,
  applyOrderStock,
  makeStatusEntry,
  updateOrderTrackingInDb,
  saveWishlistToDb,
  fetchUserProfile,
  fetchReviewsFromDb,
  saveRestockRequest,
  subscribeOrdersForUser,
  fetchAnnouncementsFromDb,
  fetchPreorderCounts,
  setPreorderCount
} from './services/firestoreService';
import { ensureSignedIn } from './utils/auth';

// Trạng thái admin đã xác nhận đơn → tồn kho trên Firestore được trừ
const STOCK_DEDUCTED_STATUSES = [
  'Đã thanh toán (Chờ chuẩn bị hàng)',
  'Đang chuẩn bị hàng',
  'Đang giao hàng',
  'Giao thành công'
];

// Loại sản phẩm: lấy từ trường category, sản phẩm cũ không có thì đoán theo tên
export function getProductCategory(product) {
  if (product?.category) return product.category;
  const t = (product?.title || '').toLowerCase();
  if (t.includes('elite trainer')) return 'Elite Trainer Box';
  if (t.includes('booster bundle')) return 'Booster Bundle';
  if (t.includes('booster box')) return 'Booster Box';
  if (t.includes('ultra-premium') || t.includes('ultra premium')) return 'Ultra Premium Collection';
  if (t.includes('collection')) return 'Special Collection';
  return 'Khác';
}

// Hàng đặt trước luôn hiện (còn suất hay không hiện trên thẻ sản phẩm)
const isInStock = (item) => isPreorderProduct(item) || typeof item.stock !== 'number' || item.stock > 0;

// Xoá dữ liệu cũ (mật khẩu, danh sách user, đơn hàng của người khác) còn sót trong localStorage
purgeLegacyLocalData();

// Helper to safely persist products list to localStorage with quota-exceeded fallback
export const safeSaveProducts = (key, products) => {
  if (!Array.isArray(products)) return;
  try {
    localStorage.setItem(key, JSON.stringify(products));
  } catch (quotaErr) {
    console.warn(`LocalStorage quota exceeded while saving ${key}, optimizing payload:`, quotaErr);
    try {
      // Create lean payload: if images are large data URLs (> 20KB), don't store raw base64 in list
      // Bản lưu tạm trong máy: bỏ ảnh lớn và ảnh phụ (luôn tải lại đầy đủ từ Firestore)
      const lean = products.map(p => ({
        ...p,
        image: typeof p.image === 'string' && p.image.startsWith('data:') && p.image.length > 20000
          ? ''
          : p.image,
        gallery: []
      }));
      localStorage.setItem(key, JSON.stringify(lean));
    } catch (retryErr) {
      console.error(`Could not persist ${key} to localStorage:`, retryErr);
    }
  }
};

// Helper to sanitize products loaded from localStorage and ensure images and stock are 100% synchronized
const sanitizeLoadedProducts = (savedList, fallbackList) => {
  // Danh sách rỗng là hợp lệ (admin đã xoá hết) — không được thay bằng sản phẩm mẫu
  if (!Array.isArray(savedList)) return fallbackList;
  return savedList.map(item => {
    const fallback = fallbackList.find(f => f.id === item.id || f.title?.toLowerCase().trim() === item.title?.toLowerCase().trim());
    const catalogImg = getProductCatalogImage(item);
    // CRITICAL: Preserve explicit 0 stock (out-of-stock items) so they stay sold out / disappear
    const resolvedStock = typeof item.stock === 'number' ? Math.max(0, item.stock) : (fallback?.stock ?? 20);
    return {
      ...item,
      image: item.image || catalogImg || (fallback ? fallback.image : ''),
      stock: resolvedStock
    };
  });
};

// LocalStorage key constants (all prefixed with 'point-tcg-')
const STORAGE_KEYS = {
  CART: 'point-tcg-cart',
  SAVED: 'point-tcg-saved',
  OPEN_PRODUCTS: 'point-tcg-open-drawings',
  CLOSED_PRODUCTS: 'point-tcg-closed-drawings'
};

const cartStorageKey = (uid) => `${STORAGE_KEYS.CART}:${uid}`;

// Giỏ đã lưu của tài khoản; giỏ chung kiểu cũ (trước khi tách theo tài khoản) chuyển cho người đăng nhập đầu tiên
function loadSavedCart(uid) {
  try {
    let raw = localStorage.getItem(cartStorageKey(uid));
    if (raw === null) {
      raw = localStorage.getItem(STORAGE_KEYS.CART);
      localStorage.removeItem(STORAGE_KEYS.CART);
    }
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const catalogImg = getProductCatalogImage(item);
      return catalogImg ? { ...item, image: catalogImg } : item;
    });
  } catch {
    return [];
  }
}

export default function App() {
  const { t, lang, currency } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [activeCategory, setActiveCategory] = useState('all');
  // Bộ lọc sản phẩm: loại, khoảng giá (USD), tình trạng kho ('in' | 'out' | 'all')
  const [productType, setProductType] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [stockFilter, setStockFilter] = useState('in');
  const [activeSeries, setActiveSeries] = useState('all'); // lọc theo dòng sản phẩm (30th Celebration, Ascended Heroes...)
  const deductedOrderIdsRef = useRef(new Set());

  // Hash-based Page Routing (Trang chủ Store vs Trang Quản Trị Admin vs Trang Chi tiết Sản phẩm vs Trang Đơn Hàng)
  const [currentRoute, setCurrentRoute] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.startsWith('#admin')) return 'admin';
    if (hash.startsWith('#orders') || hash.startsWith('#account') || hash.startsWith('#don-hang')) return 'orders';
    if (hash.startsWith('#product-')) return 'product';
    return 'store';
  });

  // Modals & Drawers state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [signInMode, setSignInMode] = useState('login'); // 'login' | 'register' | 'admin'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adminProductToEdit, setAdminProductToEdit] = useState(null);

  // Authenticated user state — derived from Firebase Auth, never trusted from localStorage
  const [user, setUser] = useState(null);
  const [authUid, setAuthUid] = useState(null); // includes anonymous guest sessions
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      setAuthUid(fbUser ? fbUser.uid : null);
      try {
        setUser(await buildSessionUser(fbUser));
      } catch (err) {
        console.warn('Could not load session user:', err);
        setUser(null);
      }
      setAuthReady(true);
    });
  }, []);

  const isAdmin = user?.role === 'admin';

  // Đánh giá thật của khách (đọc công khai), gom theo sản phẩm
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    fetchReviewsFromDb().then(setReviews);
  }, []);
  const reviewStats = useMemo(() => {
    const map = {};
    reviews.forEach((r) => {
      const s = map[r.productId] || (map[r.productId] = { sum: 0, count: 0 });
      s.sum += r.rating;
      s.count += 1;
    });
    Object.values(map).forEach((s) => { s.avg = s.sum / s.count; });
    return map;
  }, [reviews]);
  // Số suất đặt trước đã có người giữ (preorder_counts), theo id sản phẩm
  const [preorderReserved, setPreorderReserved] = useState({});

  const withReviewStats = (p) => {
    const s = reviewStats[String(p.id)];
    return {
      ...p,
      rating: s ? s.avg : 0,
      reviewsCount: s ? s.count : 0,
      ...(isPreorderProduct(p) && { preorderReserved: preorderReserved[String(p.id)] || 0 })
    };
  };

  // Orders: admin sees every order, others only their own (enforced by firestore.rules)
  const [orders, setOrders] = useState([]);

  // Bảo mật lớp 2: admin chỉ đọc/ghi dữ liệu quản trị sau khi mở khoá bằng mã bảo mật (firestore.rules)
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  useEffect(() => {
    if (!isAdmin) {
      setAdminUnlocked(false);
      return;
    }
    let alive = true;
    // Tải lại trang trong lúc phiên mở khoá còn hạn thì không phải nhập lại mã
    checkAdminUnlocked().then((ok) => alive && setAdminUnlocked(ok));
    return () => {
      alive = false;
    };
  }, [isAdmin, authUid]);

  useEffect(() => {
    if (!authReady) return;
    // Khách: theo dõi trực tiếp đơn của mình để thấy ngay khi shop đổi trạng thái
    if (!isAdmin) {
      if (!authUid) {
        setOrders([]);
        return;
      }
      return subscribeOrdersForUser(authUid, setOrders);
    }
    if (!adminUnlocked) {
      setOrders([]);
      return;
    }
    let isMounted = true;
    fetchOrdersFromDb().then((list) => {
      if (isMounted) setOrders(list || []);
    });
    return () => {
      isMounted = false;
    };
  }, [authReady, authUid, isAdmin, adminUnlocked]);

  // Thông báo của shop (thanh trên đầu trang + chuông thông báo)
  const [announcements, setAnnouncements] = useState([]);
  useEffect(() => {
    fetchAnnouncementsFromDb().then(setAnnouncements);
  }, []);
  const liveAnnouncements = useMemo(
    () => announcements
      .filter((a) => isAnnouncementLive(a))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [announcements]
  );

  useEffect(() => {
    const handleNewOrder = (e) => {
      const newOrder = e.detail;
      if (newOrder) {
        setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
      }
    };

    const handleOrderUpdated = (e) => {
      if (e.detail?.updated) {
        setOrders(e.detail.updated);
      }
    };

    window.addEventListener('point-tcg-new-order', handleNewOrder);
    window.addEventListener('point-tcg-order-updated', handleOrderUpdated);

    return () => {
      window.removeEventListener('point-tcg-new-order', handleNewOrder);
      window.removeEventListener('point-tcg-order-updated', handleOrderUpdated);
    };
  }, []);

  // Compute pendingOrdersCount dynamically from `orders`
  const pendingOrdersCount = useMemo(() => {
    return orders.filter(o =>
      o.status?.includes('Chờ') ||
      o.status?.includes('Đã xác nhận') ||
      o.status?.includes('Đã thanh toán')
    ).length;
  }, [orders]);

  // Products State with LocalStorage Persistence
  const [openDrawings, setOpenDrawings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OPEN_PRODUCTS);
      return saved ? sanitizeLoadedProducts(JSON.parse(saved), initialOpenDrawings) : initialOpenDrawings;
    } catch {
      return initialOpenDrawings;
    }
  });

  const [closedDrawings, setClosedDrawings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLOSED_PRODUCTS);
      return saved ? sanitizeLoadedProducts(JSON.parse(saved), initialClosedDrawings) : initialClosedDrawings;
    } catch {
      return initialClosedDrawings;
    }
  });

  // Suất đặt trước đã giữ: tải lại khi danh sách sản phẩm đặt trước thay đổi
  const preorderIdsKey = [...openDrawings, ...closedDrawings]
    .filter(isPreorderProduct).map((p) => String(p.id)).sort().join(',');
  useEffect(() => {
    if (!preorderIdsKey) return;
    fetchPreorderCounts(preorderIdsKey.split(',')).then((counts) => setPreorderReserved((prev) => ({ ...prev, ...counts })));
  }, [preorderIdsKey]);

  // Dedicated state for initial tab when opening CustomerOrdersPage ('orders' | 'profile')
  const [ordersInitialTab, setOrdersInitialTab] = useState('orders');

  // Live load & sync from Firebase Firestore on startup
  const [productsLoaded, setProductsLoaded] = useState(false);
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cloudProducts = await fetchProductsFromDb();
        if (!isMounted) return;

        // Firestore là nguồn chính: nhóm nào trống thì hiện trống, không quay về sản phẩm mẫu
        if (Array.isArray(cloudProducts)) {
          setOpenDrawings(cloudProducts.filter(p => p.status !== 'closed'));
          setClosedDrawings(cloudProducts.filter(p => p.status === 'closed'));
          setProductsLoaded(true);
        }
      } catch (err) {
        console.warn('Firebase initial sync notice:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // -------------------------------------------------------------
  // BẮT BUỘC ĐĂNG NHẬP để xem chi tiết và đặt hàng
  // -------------------------------------------------------------
  // Ghi nhớ việc khách định làm, đăng nhập xong thì làm tiếp
  const [pendingAction, setPendingAction] = useState(null); // { type: 'detail' | 'cart' | 'buy' | 'checkout', product, qty }
  const [signInNotice, setSignInNotice] = useState('');
  const requireLogin = (action) => {
    if (user) return true;
    setPendingAction(action);
    setSignInNotice(t('Vui lòng đăng nhập để xem chi tiết và đặt hàng sản phẩm của shop.'));
    setSignInMode('login');
    setIsSignInOpen(true);
    return false;
  };
  // SignInModal gọi onClose ngay sau khi đăng nhập thành công → chỉ bỏ việc đang chờ khi khách tự đóng
  const justSignedInRef = useRef(false);
  const closeSignIn = () => {
    setIsSignInOpen(false);
    if (justSignedInRef.current) {
      justSignedInRef.current = false;
      return;
    }
    setSignInNotice('');
    setPendingAction(null);
  };

  // Open / Close dedicated Product Detail Page
  const handleOpenProductDetail = (product) => {
    if (!product) return;
    if (!requireLogin({ type: 'detail', product })) return;
    openProductDetailNow(product);
  };

  const openProductDetailNow = (product) => {
    setSelectedProduct(product);
    setCurrentRoute('product');
    window.location.hash = `#product-${product.id}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToStore = () => {
    setSelectedProduct(null);
    setCurrentRoute('store');
    try {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    } catch {
      window.location.hash = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenOrdersPage = (tab = 'orders') => {
    setSelectedProduct(null);
    setOrdersInitialTab(tab);
    setCurrentRoute('orders');
    window.location.hash = tab === 'profile' ? '#profile' : '#orders';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync hash routing on hash change & on initial load
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const lower = hash.toLowerCase();
      if (lower.startsWith('#admin')) {
        setCurrentRoute('admin');
        setSelectedProduct(null);
      } else if (lower.startsWith('#profile') || lower.startsWith('#account')) {
        setOrdersInitialTab('profile');
        setCurrentRoute('orders');
        setSelectedProduct(null);
      } else if (lower.startsWith('#orders') || lower.startsWith('#don-hang')) {
        setOrdersInitialTab('orders');
        setCurrentRoute('orders');
        setSelectedProduct(null);
      } else if (lower.startsWith('#product-')) {
        const prodId = hash.slice(9);
        const allList = [...openDrawings, ...closedDrawings];
        const found = allList.find((p) => p.id === prodId);
        if (found) {
          setSelectedProduct(found);
          setCurrentRoute('product');
        } else {
          setCurrentRoute('store');
        }
      } else {
        setCurrentRoute('store');
        setSelectedProduct(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [openDrawings, closedDrawings]);

  // Cart state — giỏ hàng gắn với từng tài khoản; chưa đăng nhập thì giỏ trống
  const [cart, setCart] = useState([]);
  const cartOwnerRef = useRef(null);
  useEffect(() => {
    const uid = user?.id || null;
    if (!uid) {
      cartOwnerRef.current = null;
      setCart([]);
      setIsCartOpen(false);
      return;
    }
    if (cartOwnerRef.current === uid) return;
    cartOwnerRef.current = uid;
    setCart(loadSavedCart(uid));
  }, [user]);

  // Saved / Favorited product IDs
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SAVED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Khách đăng nhập: gộp danh sách yêu thích trên máy với danh sách lưu trên tài khoản
  const wishlistLoadedRef = useRef(false);
  useEffect(() => {
    wishlistLoadedRef.current = false;
    if (!user || user.role === 'admin') return;
    let isMounted = true;
    fetchUserProfile(user.id).then((profile) => {
      if (!isMounted) return;
      const cloud = Array.isArray(profile?.wishlist) ? profile.wishlist : [];
      setSavedIds((local) => {
        const merged = [...new Set([...cloud, ...local])];
        if (merged.length !== cloud.length) saveWishlistToDb(user.id, merged);
        return merged;
      });
      wishlistLoadedRef.current = true;
    });
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role]);

  // Live countdown target timestamps
  const [targetTimestamps, setTargetTimestamps] = useState(() => {
    try {
      const saved = localStorage.getItem('point_tcg_target_timestamps');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    const map = {};
    const now = Date.now();
    openDrawings.forEach((item) => {
      map[item.id] = now + (item.secondsRemaining || 8073) * 1000;
    });
    return map;
  });

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('point_tcg_target_timestamps', JSON.stringify(targetTimestamps));
  }, [targetTimestamps]);

  // Sync state with localStorage safely
  useEffect(() => {
    safeSaveProducts(STORAGE_KEYS.OPEN_PRODUCTS, openDrawings);
  }, [openDrawings]);

  useEffect(() => {
    safeSaveProducts(STORAGE_KEYS.CLOSED_PRODUCTS, closedDrawings);
  }, [closedDrawings]);

  useEffect(() => {
    if (!cartOwnerRef.current) return;
    try {
      localStorage.setItem(cartStorageKey(cartOwnerRef.current), JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(savedIds));
    } catch (e) {}
  }, [savedIds]);

  // Cross-tab synchronization ONLY (fires only when ANOTHER browser tab updates localStorage)
  useEffect(() => {
    const handleCrossTabStorageChange = (e) => {
      if (e.key === STORAGE_KEYS.OPEN_PRODUCTS && e.newValue) {
        try {
          const parsed = sanitizeLoadedProducts(JSON.parse(e.newValue), initialOpenDrawings);
          setOpenDrawings(parsed);
        } catch (err) {}
      } else if (e.key === STORAGE_KEYS.CLOSED_PRODUCTS && e.newValue) {
        try {
          const parsed = sanitizeLoadedProducts(JSON.parse(e.newValue), initialClosedDrawings);
          setClosedDrawings(parsed);
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleCrossTabStorageChange);
    return () => {
      window.removeEventListener('storage', handleCrossTabStorageChange);
    };
  }, []);

  // Dòng thời gian của sản phẩm: dùng mốc endsAt chung cho mọi khách; sản phẩm cũ dùng mốc tính từ lúc mở web
  const getCountdownString = (itemId) => {
    const product = openDrawings.find(p => p.id === itemId) || closedDrawings.find(p => p.id === itemId);
    if (!product) return '';
    return getDrawingText(product, currentTime, targetTimestamps[itemId] || null);
  };

  // -------------------------------------------------------------
  // OPEN ADMIN PORTAL & SIGN OUT HANDLERS
  // -------------------------------------------------------------
  const handleOpenAdmin = () => {
    setAdminProductToEdit(null);
    window.location.hash = '#admin';
    setCurrentRoute('admin');
  };

  const handleSignOut = async () => {
    // Admin: xoá phiên mở khoá trước khi đăng xuất (cần còn đăng nhập để xoá)
    if (isAdmin) await lockAdmin('lock');
    setAdminUnlocked(false);
    setUser(null);
    setOrders([]);
    signOutUser();
  };

  // -------------------------------------------------------------
  // ORDER OPERATIONS: PLACE, UPDATE STATUS, DELETE & STOCK DEDUCTION
  // -------------------------------------------------------------
  // Returns true when the order was persisted to Firestore
  const handleOrderPlaced = async (newOrder) => {
    if (!newOrder || !newOrder.id) return false;

    const saved = await saveOrderToDb(newOrder);
    if (!saved) return false;

    if (newOrder.isPreorder) {
      setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
      const pid = String(newOrder.preorderProductId);
      setPreorderReserved((prev) => ({ ...prev, [pid]: (prev[pid] || 0) + (Number(newOrder.items?.[0]?.qty) || 1) }));
      return true;
    }

    const alreadyDeducted = deductedOrderIdsRef.current.has(newOrder.id);
    deductedOrderIdsRef.current.add(newOrder.id);
    setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);

    // Trừ tồn kho hiển thị cho khách; tồn kho trên Firestore chỉ admin trừ khi xác nhận đơn
    if (!alreadyDeducted && Array.isArray(newOrder.items) && newOrder.items.length > 0) {
      const qtyMap = {};
      newOrder.items.forEach(item => {
        const q = Number(item.qty) || 1;
        if (item.id) {
          qtyMap[item.id] = (qtyMap[item.id] || 0) + q;
          qtyMap[String(item.id)] = (qtyMap[String(item.id)] || 0) + q;
        }
        if (item.title) {
          qtyMap[item.title.trim().toLowerCase()] = (qtyMap[item.title.trim().toLowerCase()] || 0) + q;
        }
      });

      // 1. Deduct stock from Open Drawings
      let nextOpenDrawings = [];
      setOpenDrawings(prev => {
        const next = prev.map(p => {
          const purchased = qtyMap[p.id] || 
                            qtyMap[String(p.id)] || 
                            (p.title && qtyMap[p.title.trim().toLowerCase()]) || 
                            0;
          if (purchased > 0) {
            const currentStock = typeof p.stock === 'number' ? p.stock : 20;
            const remaining = Math.max(0, currentStock - purchased);
            const updatedProd = { ...p, stock: remaining };
            return updatedProd;
          }
          return p;
        });
        nextOpenDrawings = next;
        safeSaveProducts(STORAGE_KEYS.OPEN_PRODUCTS, next);
        return next;
      });

      // 2. Deduct stock from Closed Drawings
      let nextClosedDrawings = [];
      setClosedDrawings(prev => {
        const next = prev.map(p => {
          const purchased = qtyMap[p.id] || 
                            qtyMap[String(p.id)] || 
                            (p.title && qtyMap[p.title.trim().toLowerCase()]) || 
                            0;
          if (purchased > 0) {
            const currentStock = typeof p.stock === 'number' ? p.stock : 20;
            const remaining = Math.max(0, currentStock - purchased);
            const updatedProd = { ...p, stock: remaining };
            return updatedProd;
          }
          return p;
        });
        nextClosedDrawings = next;
        safeSaveProducts(STORAGE_KEYS.CLOSED_PRODUCTS, next);
        return next;
      });

      // 3. If currently viewed product in modal became out of stock, close the modal immediately
      setSelectedProduct(prev => {
        if (!prev) return null;
        const purchased = qtyMap[prev.id] || 
                          qtyMap[String(prev.id)] || 
                          (prev.title && qtyMap[prev.title.trim().toLowerCase()]) || 
                          0;
        if (purchased > 0) {
          const currentStock = typeof prev.stock === 'number' ? prev.stock : 20;
          if (currentStock - purchased <= 0) {
            return null;
          }
          return { ...prev, stock: currentStock - purchased };
        }
        return prev;
      });

      // 4. Remove any products from cart that are now out of stock
      setCart(prev => prev.filter(cItem => {
        const purchased = qtyMap[cItem.id] || 
                          qtyMap[String(cItem.id)] || 
                          (cItem.title && qtyMap[cItem.title.trim().toLowerCase()]) || 
                          0;
        const inOpen = nextOpenDrawings.find(p => p.id === cItem.id || (p.title && p.title === cItem.title));
        const inClosed = nextClosedDrawings.find(p => p.id === cItem.id || (p.title && p.title === cItem.title));
        const prod = inOpen || inClosed;
        return !prod || typeof prod.stock !== 'number' || prod.stock > 0;
      }));
    }

    // Báo cho CheckoutModal là đơn đã lưu, để chuyển sang bước QR / thành công
    return true;
  };

  // Returns true when Firestore accepted the change (rules limit what customers may set)
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const ok = await updateOrderStatusInDb(orderId, newStatus);
    if (!ok) {
      alert('Không thể cập nhật trạng thái đơn hàng (không có quyền hoặc lỗi kết nối).');
      return false;
    }

    // Admin xác nhận đơn → trừ tồn kho; huỷ đơn đã trừ → hoàn tồn kho
    let stockDeducted;
    const order = orders.find(o => o.id === orderId);
    if (user?.role === 'admin' && order) {
      // Đơn cũ (không có trường stockDeducted) đã bị trừ tồn kho ngay lúc khách đặt
      const deducted = order.stockDeducted !== false;
      const shouldDeduct = STOCK_DEDUCTED_STATUSES.includes(newStatus);
      const shouldRestore = newStatus === 'Đã huỷ';
      if ((shouldDeduct && !deducted) || (shouldRestore && deducted)) {
        if (await applyOrderStock(order, shouldDeduct ? -1 : 1)) {
          stockDeducted = shouldDeduct;
        } else {
          alert('Đã đổi trạng thái nhưng không cập nhật được tồn kho. Vui lòng kiểm tra lại sản phẩm.');
        }
      }
    }

    setOrders(prev => prev.map(o => (o.id === orderId
      ? {
          ...o,
          status: newStatus,
          statusHistory: [...(o.statusHistory || []), makeStatusEntry(newStatus)],
          ...(stockDeducted !== undefined && { stockDeducted })
        }
      : o)));
    return true;
  };

  // Hàng đặt trước đã về: tắt đặt trước, đặt tồn kho = số hàng về, trừ kho cho các đơn đã cọc
  // và chuyển chúng sang "chờ thanh toán phần còn lại" (cọc 100% thì thành "đã thanh toán")
  const handlePreorderArrived = async (product) => {
    const ofProduct = orders.filter((o) => o.isPreorder && String(o.preorderProductId) === String(product.id));
    const depositPaid = ofProduct.filter((o) => o.status === PRE_DEPOSIT_PAID);
    const unpaid = ofProduct.filter((o) => PREORDER_STATUSES.includes(o.status) && o.status !== PRE_DEPOSIT_PAID && o.status !== PRE_ARRIVED);
    const needed = depositPaid.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0), 0);

    const input = window.prompt(
      `Hàng "${product.title}" đã về.\n\n${depositPaid.length} đơn đã cọc cần ${needed} sản phẩm`
      + (unpaid.length ? `; ${unpaid.length} đơn chưa xác nhận cọc sẽ giữ nguyên để bạn xử lý.` : '.')
      + '\n\nNhập TỔNG số lượng hàng về:',
      String(needed)
    );
    if (input === null) return;
    const arrived = parseInt(input, 10);
    if (Number.isNaN(arrived) || arrived < 0) {
      alert('Số lượng không hợp lệ.');
      return;
    }
    if (arrived < needed && !window.confirm(`Số hàng về (${arrived}) ít hơn số đã cọc (${needed}). Vẫn tiếp tục? Tồn kho sẽ bị âm.`)) return;

    handleUpdateProduct({ ...product, preorder: false, stock: arrived }, product.status === 'open' ? 'open' : 'closed');

    let moved = 0;
    for (const order of depositPaid) {
      const next = Number(order.depositPercent) >= 100 ? PAID_STATUS : PRE_ARRIVED;
      if (!(await updateOrderStatusInDb(order.id, next))) continue;
      const deducted = order.stockDeducted !== false || await applyOrderStock(order, -1);
      moved += 1;
      setOrders((prev) => prev.map((o) => (o.id === order.id
        ? { ...o, status: next, stockDeducted: deducted === true || o.stockDeducted, statusHistory: [...(o.statusHistory || []), makeStatusEntry(next)] }
        : o)));
    }
    alert(`Đã cập nhật: tồn kho "${product.title}" = ${arrived}, ${moved}/${depositPaid.length} đơn đã cọc được báo hàng về.`);
  };

  // Admin: đồng bộ số suất đặt trước theo đơn thật (đơn huỷ trả lại suất)
  useEffect(() => {
    if (!isAdmin || !adminUnlocked || orders.length === 0) return;
    [...openDrawings, ...closedDrawings].filter(isPreorderProduct).forEach((p) => {
      const actual = getPreorderReservedFromOrders(orders, p.id);
      if ((preorderReserved[String(p.id)] || 0) !== actual) {
        setPreorderCount(p.id, actual).then((ok) => ok && setPreorderReserved((prev) => ({ ...prev, [String(p.id)]: actual })));
      }
    });
  }, [isAdmin, adminUnlocked, orders, preorderIdsKey]);

  const handleDeleteOrder = async (orderId) => {
    const ok = await deleteOrderFromDb(orderId);
    if (!ok) {
      alert('Không thể xoá đơn hàng (không có quyền hoặc lỗi kết nối).');
      return;
    }
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  // -------------------------------------------------------------
  // ADMIN OPERATIONS: ADD, EDIT, DELETE, RESET
  // -------------------------------------------------------------
  // media: ảnh gốc + ảnh phụ (product_media/{id}); newProduct chỉ chứa ảnh thu nhỏ
  const handleAddProduct = (newProduct, section, media) => {
    const prodToSave = { ...newProduct, status: section };
    if (section === 'open') {
      setOpenDrawings(prev => [newProduct, ...prev]);
      setTargetTimestamps(prev => ({
        ...prev,
        [newProduct.id]: Date.now() + (newProduct.secondsRemaining || 7200) * 1000
      }));
    } else {
      setClosedDrawings(prev => [newProduct, ...prev]);
    }
    if (media) saveProductMediaToDb(newProduct.id, media);
    saveProductToDb(prodToSave);
  };

  const handleUpdateProduct = (updatedProduct, section, media) => {
    const prodToSave = { ...updatedProduct, status: section };
    // Đổi khu vực Open Closed: bỏ khỏi danh sách cũ, thêm vào đầu danh sách mới
    const movedFrom = section === 'open'
      ? closedDrawings.some(p => p.id === updatedProduct.id)
      : openDrawings.some(p => p.id === updatedProduct.id);
    if (movedFrom) {
      if (section === 'open') {
        setClosedDrawings(prev => prev.filter(p => p.id !== updatedProduct.id));
        setOpenDrawings(prev => [updatedProduct, ...prev]);
        setTargetTimestamps(prev => ({
          ...prev,
          [updatedProduct.id]: Date.now() + (updatedProduct.secondsRemaining || 7200) * 1000
        }));
      } else {
        setOpenDrawings(prev => prev.filter(p => p.id !== updatedProduct.id));
        setClosedDrawings(prev => [updatedProduct, ...prev]);
      }
    } else if (section === 'open') {
      setOpenDrawings(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      setTargetTimestamps(prev => ({
        ...prev,
        [updatedProduct.id]: Date.now() + (updatedProduct.secondsRemaining || 7200) * 1000
      }));
    } else {
      setClosedDrawings(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    }
    // Live-sync currently viewed product on the detail page
    setSelectedProduct(prev => (prev && prev.id === updatedProduct.id ? updatedProduct : prev));
    if (media) saveProductMediaToDb(updatedProduct.id, media);
    saveProductToDb(prodToSave);
  };

  const handleDeleteProduct = (productId, section) => {
    if (section === 'open') {
      setOpenDrawings(prev => prev.filter(p => p.id !== productId));
    } else {
      setClosedDrawings(prev => prev.filter(p => p.id !== productId));
    }
    setCart(prev => prev.filter(item => item.id !== productId));
    setSavedIds(prev => prev.filter(id => id !== productId));
    deleteProductFromDb(productId).then((ok) => {
      if (!ok) alert('Không xoá được sản phẩm trên hệ thống (không có quyền hoặc lỗi kết nối). Tải lại trang để kiểm tra.');
    });
  };

  // Ghi lại các sản phẩm mẫu lên Firestore (không xoá sản phẩm admin đã tạo)
  const handleResetDefaults = () => {
    setOpenDrawings(prev => [...initialOpenDrawings, ...prev.filter(p => !initialOpenDrawings.some(i => i.id === p.id))]);
    setClosedDrawings(prev => [...initialClosedDrawings, ...prev.filter(p => !initialClosedDrawings.some(i => i.id === p.id))]);
    initialOpenDrawings.forEach((p) => saveProductToDb({ ...p, status: 'open' }));
    initialClosedDrawings.forEach((p) => saveProductToDb({ ...p, status: 'closed' }));
    localStorage.removeItem(STORAGE_KEYS.OPEN_PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.CLOSED_PRODUCTS);
    const map = {};
    const now = Date.now();
    initialOpenDrawings.forEach((item) => {
      map[item.id] = now + (item.secondsRemaining || 8073) * 1000;
    });
    setTargetTimestamps(map);
  };

  // -------------------------------------------------------------
  // CART OPERATIONS WITH INVENTORY STOCK CHECKING
  // -------------------------------------------------------------
  const handleAddToCart = (product, qtyToAdd = 1) => {
    if (!requireLogin({ type: 'cart', product, qty: qtyToAdd })) return;
    addToCartNow(product, qtyToAdd);
  };

  // Giới hạn mỗi khách: trả về số lượng được thêm (0 = không được thêm nữa) và báo cho khách
  const myOrders = user && user.role !== 'admin' ? orders : [];
  const capToAllowance = (product, wanted, inCartQty = 0) => {
    const allowance = getRemainingAllowance(product, myOrders, inCartQty);
    if (wanted <= allowance) return wanted;
    const max = getMaxPerCustomer(product);
    alert(allowance > 0
      ? t('Mỗi khách chỉ được mua tối đa {max} sản phẩm "{title}". Bạn chỉ có thể thêm {n} nữa.', { max, title: product.title, n: allowance })
      : t('Mỗi khách chỉ được mua tối đa {max} sản phẩm "{title}". Bạn đã đạt giới hạn.', { max, title: product.title }));
    return allowance;
  };

  const addToCartNow = (product, qtyToAdd = 1) => {
    if (isPreorderProduct(product)) {
      preorderNow(product, qtyToAdd);
      return;
    }
    const currentStock = typeof product.stock === 'number' ? product.stock : 20;
    if (currentStock <= 0) {
      alert(t('Sản phẩm "{title}" hiện tại đã hết hàng!', { title: product.title }));
      return;
    }

    const inCartQty = cart.find((item) => item.id === product.id)?.qty || 0;
    const addCount = capToAllowance(product, Math.max(1, Number(qtyToAdd) || 1), inCartQty);
    if (addCount <= 0) return;
    const resolvedImage = getProductCatalogImage(product) || product.image;
    let reachedLimit = false;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.qty >= currentStock) {
          reachedLimit = true;
          return prev;
        }
        const nextQty = Math.min(currentStock, existing.qty + addCount);
        return prev.map((item) =>
          item.id === product.id ? { ...item, image: resolvedImage, qty: nextQty, stock: currentStock } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          title: product.title,
          price: product.price,
          image: resolvedImage,
          qty: Math.min(currentStock, addCount),
          stock: currentStock
        }
      ];
    });

    if (reachedLimit) {
      alert(t('Bạn đã chọn tối đa {n} sản phẩm có sẵn trong kho!', { n: currentStock }));
    } else {
      setIsCartOpen(true);
    }
  };

  const handleBuyNow = (product, qtyToAdd = 1) => {
    if (!requireLogin({ type: 'buy', product, qty: qtyToAdd })) return;
    buyNowNow(product, qtyToAdd);
  };

  const buyNowNow = (product, qtyToAdd = 1) => {
    if (isPreorderProduct(product)) {
      preorderNow(product, qtyToAdd);
      return;
    }
    const currentStock = typeof product.stock === 'number' ? product.stock : 20;
    if (currentStock <= 0) {
      alert(t('Sản phẩm "{title}" hiện tại đã hết hàng!', { title: product.title }));
      return;
    }

    const inCartQty = cart.find((item) => item.id === product.id)?.qty || 0;
    const addCount = capToAllowance(product, Math.max(1, Number(qtyToAdd) || 1), inCartQty);
    if (addCount <= 0) {
      if (inCartQty > 0) setIsCheckoutOpen(true);
      return;
    }
    const resolvedImage = getProductCatalogImage(product) || product.image;
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const nextQty = Math.min(currentStock, existing.qty + addCount);
        return prev.map((item) =>
          item.id === product.id ? { ...item, image: resolvedImage, qty: nextQty, stock: currentStock } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          title: product.title,
          price: product.price,
          image: resolvedImage,
          qty: Math.min(currentStock, addCount),
          stock: currentStock
        }
      ];
    });
    setIsCheckoutOpen(true);
  };

  const handleUpdateCartQty = (id, newQty) => {
    if (!requireLogin({ type: 'cart-open' })) return;
    if (newQty <= 0) {
      handleRemoveFromCart(id);
      return;
    }

    // Find current stock from live product catalog
    const product = openDrawings.find(p => p.id === id) || closedDrawings.find(p => p.id === id);
    const maxStock = typeof product?.stock === 'number' ? product.stock : 999;

    let finalQty = newQty;
    if (newQty > maxStock) {
      alert(t('Số lượng yêu cầu vượt quá tồn kho hiện tại (chỉ còn {n} sản phẩm)!', { n: maxStock }));
      finalQty = Math.max(1, maxStock);
    }
    const currentQty = cart.find((item) => item.id === id)?.qty || 0;
    if (product && finalQty > currentQty) {
      finalQty = currentQty + capToAllowance(product, finalQty - currentQty, currentQty);
      if (finalQty === currentQty) return;
    }

    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: finalQty, stock: maxStock } : item))
    );
  };

  // -------------------------------------------------------------
  // ĐẶT TRƯỚC: thanh toán riêng từng sản phẩm (không qua giỏ), chỉ trả tiền cọc
  // -------------------------------------------------------------
  const [preorderCheckout, setPreorderCheckout] = useState(null); // { product, qty }
  const handlePreorder = (product, qty = 1) => {
    if (!requireLogin({ type: 'preorder', product, qty })) return;
    preorderNow(product, qty);
  };
  const preorderNow = (product, qty = 1) => {
    const live = withReviewStats(allProductsCombined.find((p) => String(p.id) === String(product.id)) || product);
    const slotsLeft = getPreorderSlotsLeft(live);
    if (slotsLeft <= 0) {
      alert(t('Sản phẩm "{title}" đã hết suất đặt trước.', { title: live.title }));
      return;
    }
    let wanted = Math.min(Math.max(1, Number(qty) || 1), slotsLeft);
    wanted = capToAllowance(live, wanted, 0);
    if (wanted <= 0) return;
    setPreorderCheckout({ product: live, qty: wanted });
    setIsCheckoutOpen(true);
  };
  const updatePreorderQty = (id, newQty) => {
    setPreorderCheckout((prev) => {
      if (!prev) return prev;
      if (newQty <= 0) return prev;
      const max = Math.min(getPreorderSlotsLeft(prev.product), getRemainingAllowance(prev.product, myOrders, 0));
      if (newQty > max) {
        alert(t('Bạn chỉ có thể đặt trước tối đa {n} sản phẩm này.', { n: max }));
        return prev;
      }
      return { ...prev, qty: newQty };
    });
  };
  // Kiểm tra lần cuối trước khi đặt: đơn này có làm khách vượt giới hạn mỗi khách không
  const checkOrderLimits = (items) => {
    for (const item of items || []) {
      const product = allProductsCombined.find((p) => String(p.id) === String(item.id));
      const max = getMaxPerCustomer(product);
      if (!max) continue;
      const already = getOrderedQty(myOrders, item.id);
      if (already + (Number(item.qty) || 0) > max) {
        return t('Mỗi khách chỉ được mua tối đa {max} sản phẩm "{title}". Bạn đã đặt {n} trong các đơn trước.', { max, title: item.title, n: already });
      }
    }
    return '';
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
    setPreorderCheckout(null);
  };

  const handleRemoveFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.price * item.qty, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.qty, 0);
  }, [cart]);

  // Saved Items handlers — khách đăng nhập thì lưu cả lên tài khoản để xem trên thiết bị khác
  const handleToggleSave = (product) => {
    setSavedIds((prev) => {
      const next = prev.includes(product.id)
        ? prev.filter((id) => id !== product.id)
        : [...prev, product.id];
      if (user && user.role !== 'admin' && wishlistLoadedRef.current) {
        saveWishlistToDb(user.id, next);
      }
      return next;
    });
  };

  // Báo khi có hàng lại: khách vãng lai dùng phiên ẩn danh để ghi yêu cầu
  const handleRequestRestock = async (product, email) => {
    try {
      const uid = await ensureSignedIn();
      return await saveRestockRequest({ productId: product.id, productTitle: product.title, email, uid });
    } catch {
      return false;
    }
  };

  const handleReviewSaved = (review) => {
    setReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
  };

  // Admin nhập đơn vị vận chuyển + mã vận đơn
  const handleUpdateOrderTracking = async (orderId, tracking) => {
    const ok = await updateOrderTrackingInDb(orderId, tracking);
    if (!ok) {
      alert('Không lưu được mã vận đơn (không có quyền hoặc lỗi kết nối).');
      return false;
    }
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...tracking } : o)));
    return true;
  };

  const allProductsCombined = useMemo(() => {
    return [...openDrawings, ...closedDrawings];
  }, [openDrawings, closedDrawings]);

  const savedProductsList = useMemo(() => {
    return allProductsCombined.filter((p) => savedIds.includes(p.id));
  }, [allProductsCombined, savedIds]);

  // -------------------------------------------------------------
  // THÔNG BÁO TRONG WEB (chuông )
  // -------------------------------------------------------------
  // Chỉ so sánh sản phẩm yêu thích sau khi đã tải giá/tồn kho thật từ Firestore
  const [wishlistEvents, setWishlistEvents] = useState([]);
  useEffect(() => {
    if (!productsLoaded) return;
    setWishlistEvents(trackWishlistChanges(allProductsCombined.filter((p) => savedIds.includes(p.id))));
  }, [productsLoaded, allProductsCombined, savedIds]);

  const viewerId = user?.id || authUid || 'guest';
  const [notifReadAt, setNotifReadAt] = useState(0);
  useEffect(() => {
    setNotifReadAt(getReadAt(viewerId));
  }, [viewerId]);

  const notifications = useMemo(
    () => buildNotifications({
      orders: isAdmin ? [] : orders,
      wishlistEvents,
      announcements: liveAnnouncements
    }),
    // lang: tiêu đề thông báo được dịch lúc tạo
    [orders, isAdmin, wishlistEvents, liveAnnouncements, lang, currency]
  );

  const handleMarkNotificationsRead = () => {
    markAllRead(viewerId);
    setNotifReadAt(getReadAt(viewerId));
  };

  const handleOpenNotification = (n) => {
    if (n.action?.type === 'orders') {
      handleOpenOrdersPage('orders');
    } else if (n.action?.type === 'product') {
      const product = allProductsCombined.find((p) => String(p.id) === n.action.productId);
      if (product) handleOpenProductDetail(product);
    } else if (n.action?.type === 'coupon') {
      navigator.clipboard?.writeText(n.action.code);
      alert(t('Đã sao chép mã giảm giá {code}. Dán vào ô voucher khi thanh toán nhé!', { code: n.action.code }));
    }
  };

  const productTypes = useMemo(() => {
    return [...new Set(allProductsCombined.map(getProductCategory))].sort();
  }, [allProductsCombined]);

  // Đăng nhập xong: làm tiếp việc khách đã bấm
  useEffect(() => {
    if (!user || !pendingAction) return;
    const { type, product, qty } = pendingAction;
    setPendingAction(null);
    setSignInNotice('');
    if (type === 'detail') openProductDetailNow(product);
    else if (type === 'cart') addToCartNow(product, qty);
    else if (type === 'buy') buyNowNow(product, qty);
    else if (type === 'preorder') preorderNow(product, qty);
    else if (type === 'checkout') setIsCheckoutOpen(true);
    else if (type === 'cart-open') setIsCartOpen(true);
  }, [user]);

  // Mở thẳng link sản phẩm khi chưa đăng nhập → về trang chủ và yêu cầu đăng nhập
  useEffect(() => {
    if (!authReady || user || currentRoute !== 'product' || !selectedProduct) return;
    const product = selectedProduct;
    setSelectedProduct(null);
    setCurrentRoute('store');
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      window.location.hash = '';
    }
    requireLogin({ type: 'detail', product });
  }, [authReady, user, currentRoute, selectedProduct]);

  // Request to join drawing handler
  const handleRequestJoin = (product) => {
    if (!user) {
      setSelectedProduct(product);
      setSignInMode('customer');
      setIsSignInOpen(true);
      return;
    }
    alert(
      t('Drawing entry submitted!\n\nCollector: {name}\nItem: {title}\nStatus: Active in raffle queue.\n\nYou will be notified immediately when the drawing closes!', { name: user.name, title: product.title })
    );
  };

  // Sorting & Filtering
  const sortProducts = (items) => {
    const list = [...items];
    if (sortBy === 'price-low') {
      return list.sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price-high') {
      return list.sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'rating') {
      return list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (sortBy === 'newest') {
      return list.reverse();
    }
    return list;
  };

  const filterBySearch = (items) => {
    if (!searchQuery || !searchQuery.trim()) return items;
    const normalized = normalizeSearchText(searchQuery);
    const keywords = normalized.split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return items;

    return items.filter((item) => {
      const targetText = normalizeSearchText([
        item.title,
        item.description,
        item.badge,
        item.category,
        item.optionsText,
        item.details,
        item.price ? `${item.price}` : ''
      ].filter(Boolean).join(' '));

      return keywords.every((kw) => targetText.includes(kw));
    });
  };

  const filterByCategory = (items) => {
    if (activeCategory === 'all' || activeCategory === 'open' || activeCategory === 'closed') {
      return items;
    }
    return items.filter((item) =>
      item.title.toLowerCase().includes(activeCategory.toLowerCase())
    );
  };

  // Lọc theo loại, khoảng giá và tình trạng kho
  // Ô giá nhập theo tiền tệ đang hiển thị; giá sản phẩm lưu bằng USD
  const filterByAttributes = (items) => {
    const toUsd = (v) => (currency === 'vnd' ? Number(v) / VND_RATE : Number(v));
    const min = priceMin === '' ? null : toUsd(priceMin);
    const max = priceMax === '' ? null : toUsd(priceMax);
    return items.filter((item) => {
      if (stockFilter === 'in' && !isInStock(item)) return false;
      if (stockFilter === 'out' && isInStock(item)) return false;
      if (productType !== 'all' && getProductCategory(item) !== productType) return false;
      if (min !== null && item.price < min) return false;
      if (max !== null && item.price > max) return false;
      return true;
    });
  };

  // Đổi tiền tệ thì khoảng giá đang nhập không còn đúng đơn vị → xoá
  useEffect(() => {
    setPriceMin('');
    setPriceMax('');
  }, [currency]);

  const hasAttributeFilter = productType !== 'all' || priceMin !== '' || priceMax !== '' || stockFilter !== 'in';
  const resetAttributeFilters = () => {
    setProductType('all');
    setPriceMin('');
    setPriceMax('');
    setStockFilter('in');
  };

  const filteredOpenDrawings = useMemo(() => {
    if (activeCategory === 'closed') return [];
    const list = filterByCategory(filterBySearch(filterByAttributes(openDrawings)));
    return sortProducts(list.map(withReviewStats));
  }, [openDrawings, searchQuery, sortBy, activeCategory, productType, priceMin, priceMax, stockFilter, reviewStats, currency]);

  const filteredClosedDrawings = useMemo(() => {
    if (activeCategory === 'open') return [];
    const list = filterByCategory(filterBySearch(filterByAttributes(closedDrawings)));
    return sortProducts(list.map(withReviewStats));
  }, [closedDrawings, searchQuery, sortBy, activeCategory, productType, priceMin, priceMax, stockFilter, reviewStats, currency]);

  // Dòng sản phẩm có trong kết quả hiện tại → thanh chọn nhanh; nếu dòng đang chọn biến mất thì coi như "Tất cả"
  const seriesChips = useMemo(
    () => groupProductsBySeries([...filteredOpenDrawings, ...filteredClosedDrawings]).map((g) => ({ name: g.name, count: g.items.length })),
    [filteredOpenDrawings, filteredClosedDrawings]
  );
  const selectedSeries = seriesChips.some((c) => c.name === activeSeries) ? activeSeries : 'all';
  const bySelectedSeries = (list) => (selectedSeries === 'all' ? list : list.filter((p) => getProductSeries(p) === selectedSeries));
  const openGroups = groupProductsBySeries(bySelectedSeries(filteredOpenDrawings));
  const closedGroups = groupProductsBySeries(bySelectedSeries(filteredClosedDrawings));
  const visibleClosedCount = closedGroups.reduce((sum, g) => sum + g.items.length, 0);

  const totalResultsCount = filteredOpenDrawings.length + filteredClosedDrawings.length;

  // Complete catalog of available products for header search autocomplete
  const allStoreProducts = useMemo(() => {
    return [...openDrawings, ...closedDrawings].filter(
      (item) => typeof item.stock !== 'number' || item.stock > 0
    );
  }, [openDrawings, closedDrawings]);

  // -------------------------------------------------------------
  // RENDER DEDICATED ADMIN PAGE (MỞ TRANG MỚI / TAB MỚI VỚI HASH #admin)
  // -------------------------------------------------------------
  if (currentRoute === 'admin') {
    return (
      <Suspense fallback={<div className="admin-loading-screen">Đang tải trang quản trị...</div>}>
        <AdminPage
          currentUser={user}
          authReady={authReady}
          openDrawings={openDrawings}
          closedDrawings={closedDrawings}
          orders={orders}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onUpdateOrderTracking={handleUpdateOrderTracking}
          onDeleteOrder={handleDeleteOrder}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          onResetDefaults={handleResetDefaults}
          initialProductToEdit={adminProductToEdit}
          onAdminLoginSuccess={(adminData) => setUser(adminData)}
          onSignOut={handleSignOut}
          adminUnlocked={adminUnlocked}
          onPreorderArrived={handlePreorderArrived}
          onAdminUnlockChange={setAdminUnlocked}
          onNavigateToStore={() => {
            setAdminProductToEdit(null);
            try {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {
              window.location.hash = '';
            }
            if (selectedProduct) {
              setCurrentRoute('product');
            } else {
              setCurrentRoute('store');
            }
          }}
        />
      </Suspense>
    );
  }

  // -------------------------------------------------------------
  // RENDER DEDICATED CUSTOMER ORDERS & ACCOUNT PAGE (#orders)
  // -------------------------------------------------------------
  if (currentRoute === 'orders') {
    return (
      <>
        <Suspense fallback={null}>
          <CustomerOrdersPage
            currentUser={user}
            initialTab={ordersInitialTab}
            onUpdateCurrentUser={(updated) => setUser(prev => (prev ? { ...prev, ...updated } : prev))}
            orders={orders}
            reviews={reviews}
            onReviewSaved={handleReviewSaved}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onAddToCart={handleAddToCart}
            onBackToStore={handleBackToStore}
            onOpenSignIn={(mode) => {
              setSignInMode(mode || 'login');
              setIsSignInOpen(true);
            }}
            onOpenProductDetail={handleOpenProductDetail}
          />
        </Suspense>
        <SignInModal
          isOpen={isSignInOpen}
          onClose={closeSignIn}
          initialMode={signInMode}
          notice={signInNotice}
          onSignInSuccess={(userData) => {
            justSignedInRef.current = true;
            setUser(userData);
            setIsSignInOpen(false);
          }}
        />
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cartItems={cart}
          onUpdateQty={handleUpdateCartQty}
          onRemoveItem={handleRemoveFromCart}
          cartTotal={cartTotal}
          onProceedCheckout={() => {
            setIsCartOpen(false);
            if (requireLogin({ type: 'checkout' })) setIsCheckoutOpen(true);
          }}
        />
        <FloatingMessenger />
      </>
    );
  }

  return (
    <div className="app-container">
      <AnnouncementBar announcements={liveAnnouncements} />

      {/* 1. Header Bar (#0053e2, Sticky) */}
      <Header
        notificationBell={
          <NotificationBell
            notifications={notifications}
            readAt={notifReadAt}
            onMarkAllRead={handleMarkNotificationsRead}
            onOpenItem={handleOpenNotification}
          />
        }
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        savedCount={savedIds.length}
        onOpenSaved={() => setIsSavedOpen(true)}
        cartTotal={cartTotal}
        cartCount={cartCount}
        onOpenCart={() => { if (requireLogin({ type: 'cart-open' })) setIsCartOpen(true); }}
        user={user}
        onOpenSignIn={(mode) => {
          setSignInMode(mode || 'login');
          setIsSignInOpen(true);
        }}
        onSignOut={handleSignOut}
        onOpenAdmin={handleOpenAdmin}
        onOpenOrders={handleOpenOrdersPage}
        pendingOrdersCount={pendingOrdersCount}
        products={allStoreProducts}
        onSelectProduct={handleOpenProductDetail}
        onLogoClick={handleBackToStore}
      />

      {/* 2. Main View: Product Detail Page OR Storefront */}
      {currentRoute === 'product' && selectedProduct ? (
        <ProductDetailPage
          product={withReviewStats(selectedProduct)}
          reviews={reviews.filter((r) => r.productId === String(selectedProduct.id))}
          user={user}
          orders={orders}
          onReviewSaved={handleReviewSaved}
          onOpenSignIn={(mode) => {
            setSignInMode(mode || 'login');
            setIsSignInOpen(true);
          }}
          onRequestRestock={handleRequestRestock}
          allProducts={allStoreProducts}
          onBackToStore={handleBackToStore}
          onSelectProduct={handleOpenProductDetail}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          onPreorder={handlePreorder}
          isSaved={savedIds.includes(selectedProduct.id)}
          onToggleSave={handleToggleSave}
        />
      ) : (
        <>
          {/* Sub-navigation Bar (#eaf0fb) */}
          <SubNav
            onCategorySelect={(cat) => setActiveCategory(cat)}
            activeCategory={activeCategory}
          />

          {/* Main Content Area */}
          <main className="main-content">
            {!searchQuery && (
              <HeroBanner
                onShopNow={() => document.getElementById('products-catalog-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              />
            )}
            {/* Search & Sort Filter Toolbar */}
        <div className="section-toolbar" id="products-catalog-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {searchQuery ? (
              <div className="search-active-pill">
                <span>{t('Search results for:')} <strong>"{searchQuery}"</strong> ({t('{n} items found', { n: totalResultsCount })})</span>
                <span
                  className="clear-search-link"
                  onClick={() => setSearchQuery('')}
                  role="button"
                  tabIndex={0}
                >
                  {t('Clear')}
                </span>
              </div>
            ) : activeCategory !== 'all' ? (
              <div className="search-active-pill">
                <span>{t('Filter:')} <strong>{t(activeCategory)}</strong></span>
                <span
                  className="clear-search-link"
                  onClick={() => setActiveCategory('all')}
                  role="button"
                  tabIndex={0}
                >
                  {t('Reset Filter')}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '0.88rem', color: '#64748b' }}>
                {t('Showing')} <strong>{totalResultsCount}</strong> {t('Pokémon collectible opportunities')}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="sort-select-wrapper">
              <label htmlFor="sort-dropdown">{t('Sort by:')}</label>
              <select
                id="sort-dropdown"
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label={t('Sort products')}
              >
                <option value="default">{t('Featured')}</option>
                <option value="price-low">{t('Price: Low to High')}</option>
                <option value="price-high">{t('Price: High to Low')}</option>
                <option value="rating">{t('Highest Customer Rating')}</option>
                <option value="newest">{t('Newest Releases')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bộ lọc: loại sản phẩm, khoảng giá, tình trạng kho */}
        <div className="product-filter-bar" aria-label={t('Lọc sản phẩm')}>
          <label className="filter-field">
            <span>{t('Loại')}</span>
            <select value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="all">{t('Tất cả loại')}</option>
              {productTypes.map((type) => (
                <option key={type} value={type}>{t(type)}</option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>{t('Giá từ ({sym})', { sym: currency === 'vnd' ? '₫' : '$' })}</span>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="0"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>{t('đến ({sym})', { sym: currency === 'vnd' ? '₫' : '$' })}</span>
            <input
              type="number"
              min="0"
              inputMode="decimal"
              placeholder={t('Không giới hạn')}
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>{t('Tình trạng')}</span>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
              <option value="in">{t('Còn hàng')}</option>
              <option value="out">{t('Hết hàng')}</option>
              <option value="all">{t('Tất cả')}</option>
            </select>
          </label>
          {hasAttributeFilter && (
            <button type="button" className="filter-reset-btn" onClick={resetAttributeFilters}>
              {t('Xoá bộ lọc')}
            </button>
          )}
        </div>

        {seriesChips.length > 1 && (
          <div className="series-chip-row" role="group" aria-label={t('Chọn dòng sản phẩm')}>
            <button
              type="button"
              className={`series-chip ${selectedSeries === 'all' ? 'active' : ''}`}
              onClick={() => setActiveSeries('all')}
            >
              {t('Tất cả dòng')}
            </button>
            {seriesChips.map((chip) => (
              <button
                key={chip.name}
                type="button"
                className={`series-chip ${selectedSeries === chip.name ? 'active' : ''}`}
                onClick={() => setActiveSeries(chip.name)}
              >
                {t(chip.name)} <span className="series-chip-count">{chip.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* -------------------------------------------------------------
            3. SECTION "OPEN DRAWINGS" (Placed above Closed drawings)
           ------------------------------------------------------------- */}
        {openGroups.length > 0 && (
          <section className="drawings-section" aria-labelledby="open-drawings-heading">
            <div className="section-header">
              <div className="section-title-wrap">
                <h2 id="open-drawings-heading" className="section-title">
                  <span>{t('Open drawings')}</span>
                  <span className="live-indicator">
                    <span className="live-pulse" />
                    {t('Live Now')}
                  </span>
                </h2>
                <p className="section-subtitle">
                  {t('Active raffles closing today. Request to join before timer expires for a chance to purchase.')}
                </p>
              </div>
            </div>

            {openGroups.map((group) => (
            <div key={group.name} className="series-group">
              <h3 className="series-group-title">
                {t(group.name)} <span className="series-group-count">{t('{n} sản phẩm', { n: group.items.length })}</span>
              </h3>
            <div className="open-drawings-grid">
              {group.items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSaved={savedIds.includes(product.id)}
                  onToggleSave={handleToggleSave}
                  onAddToCart={handleAddToCart}
                  onRequestJoin={handleRequestJoin}
                  onBuyNow={handleBuyNow}
                  onPreorder={handlePreorder}
                  onOpenDetails={handleOpenProductDetail}
                  onRequestRestock={handleRequestRestock}
                  defaultEmail={user?.email}
                  countdownString={getCountdownString(product.id)}
                />
              ))}
            </div>
            </div>
            ))}
          </section>
        )}

        {/* -------------------------------------------------------------
            4. SECTION "CLOSED DRAWINGS" (Horizontal Carousel)
           ------------------------------------------------------------- */}
        {closedGroups.length > 0 && (
          <section className="drawings-section" aria-labelledby="closed-drawings-heading">
            <div className="section-header">
              <div className="section-title-wrap">
                <h2 id="closed-drawings-heading" className="section-title">
                  {t('Closed drawings')}
                </h2>
                <p className="section-subtitle">{t('See previous ones now closed.')}</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <a
                  href="#closed-drawings"
                  className="section-view-all"
                  onClick={(e) => {
                    e.preventDefault();
                    alert(t('Hiển thị tất cả {n} sản phẩm closed drawings còn hàng.', { n: visibleClosedCount }));
                  }}
                >
                  {t('View all ({n})', { n: visibleClosedCount })}
                </a>
              </div>
            </div>

            {/* Horizontal Carousel with Circular White Arrows & Scroll-Snap */}
            {closedGroups.map((group) => (
            <div key={group.name} className="series-group">
              <h3 className="series-group-title">
                {t(group.name)} <span className="series-group-count">{t('{n} sản phẩm', { n: group.items.length })}</span>
              </h3>
            <Carousel
              products={group.items}
              savedIds={savedIds}
              onToggleSave={handleToggleSave}
              onAddToCart={handleAddToCart}
              onRequestJoin={handleRequestJoin}
              onBuyNow={handleBuyNow}
              onPreorder={handlePreorder}
              onOpenDetails={handleOpenProductDetail}
              onRequestRestock={handleRequestRestock}
              defaultEmail={user?.email}
            />
            </div>
            ))}
          </section>
        )}

        {/* Zero Results State */}
        {totalResultsCount === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', marginTop: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
              {t('Không tìm thấy sản phẩm nào phù hợp')} {searchQuery ? `"${searchQuery}"` : ''}
            </h3>
            <p style={{ color: '#64748b', marginTop: '6px' }}>
              {t('Thử tìm kiếm với các từ khoá phổ biến:')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              {['Booster Box', '151', 'Charizard', 'Pikachu', 'Crown Zenith', 'Elite Trainer'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0053e2',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSearchQuery(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="card-action-btn btn-request"
                style={{ width: 'auto', padding: '10px 24px' }}
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                  resetAttributeFilters();
                }}
              >
                {t('Xoá bộ lọc & tìm kiếm')}
              </button>
            </div>
          </div>
        )}
      </main>
        </>
      )}

      {/* 5. Footer with discreet Admin Login link */}
      <Footer onOpenAdminLogin={() => {
        setSignInMode('admin');
        setIsSignInOpen(true);
      }} />


      {/* Modals & Slide-in Drawers */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveFromCart}
        cartTotal={cartTotal}
        onProceedCheckout={() => {
          setIsCartOpen(false);
          if (requireLogin({ type: 'checkout' })) setIsCheckoutOpen(true);
        }}
      />

      {/* Secure Checkout & Payment Modal */}
      {isCheckoutOpen && (
        <Suspense fallback={null}>
          <CheckoutModal
            isOpen={isCheckoutOpen}
            onClose={closeCheckout}
            cartItems={preorderCheckout
              ? [{
                  id: preorderCheckout.product.id,
                  title: preorderCheckout.product.title,
                  price: preorderCheckout.product.price,
                  image: getProductCatalogImage(preorderCheckout.product) || preorderCheckout.product.image,
                  qty: preorderCheckout.qty,
                  // Số còn được đặt: theo suất còn lại và giới hạn mỗi khách
                  stock: Math.min(
                    getPreorderSlotsLeft(preorderCheckout.product),
                    getRemainingAllowance(preorderCheckout.product, myOrders, 0),
                    99
                  )
                }]
              : cart}
            cartTotal={preorderCheckout ? preorderCheckout.product.price * preorderCheckout.qty : cartTotal}
            preorderProduct={preorderCheckout?.product || null}
            checkLimits={checkOrderLimits}
            user={user}
            onUpdateQty={preorderCheckout ? updatePreorderQty : handleUpdateCartQty}
            onRemoveItem={preorderCheckout ? closeCheckout : handleRemoveFromCart}
            onClearCart={preorderCheckout ? () => {} : () => setCart([])}
            onOrderPlaced={handleOrderPlaced}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onOpenOrderHistory={handleOpenOrdersPage}
          />
        </Suspense>
      )}

      <SavedModal
        isOpen={isSavedOpen}
        onClose={() => setIsSavedOpen(false)}
        savedProducts={savedProductsList}
        onRemoveSaved={handleToggleSave}
        onAddToCart={handleAddToCart}
        onRequestJoin={handleRequestJoin}
      />

      <SignInModal
        isOpen={isSignInOpen}
        onClose={closeSignIn}
        initialMode={signInMode}
        notice={signInNotice}
        onSignInSuccess={(userData) => {
          justSignedInRef.current = true;
          setUser(userData);
          // Admin đăng nhập từ trang khách (không phải để mua hàng) → chuyển sang trang quản trị
          if (userData.role === 'admin' && !pendingAction) {
            window.location.hash = '#admin';
            setCurrentRoute('admin');
          } else if (currentRoute === 'admin') {
            setCurrentRoute('store');
            window.location.hash = '';
          }
        }}
      />

      {/* Floating Messenger & Contact Widget */}
      <FloatingMessenger />
    </div>
  );
}
