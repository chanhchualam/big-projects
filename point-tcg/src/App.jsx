// src/App.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Header, { normalizeSearchText } from './components/Header';
import SubNav from './components/SubNav';
import ProductCard from './components/ProductCard';
import Carousel from './components/Carousel';
import CartDrawer from './components/CartDrawer';
import SavedModal from './components/SavedModal';
import ProductDetailPage from './components/ProductDetailPage';
import SignInModal from './components/SignInModal';
import AdminModal from './components/AdminModal';
import AdminPage from './components/AdminPage';
import CheckoutModal from './components/CheckoutModal';
import OrdersModal from './components/OrdersModal';
import Footer from './components/Footer';
import {
  openDrawings as initialOpenDrawings,
  closedDrawings as initialClosedDrawings,
  allProducts,
  getProductCatalogImage
} from './products';
import { getOrdersList, updateOrderStatus, deleteOrder, setAdminSession } from './utils/auth';

// Helper to safely persist products list to localStorage with quota-exceeded fallback
export const safeSaveProducts = (key, products) => {
  if (!Array.isArray(products)) return;
  try {
    localStorage.setItem(key, JSON.stringify(products));
  } catch (quotaErr) {
    console.warn(`LocalStorage quota exceeded while saving ${key}, optimizing payload:`, quotaErr);
    try {
      // Create lean payload: if images are large data URLs (> 20KB), don't store raw base64 in list
      const lean = products.map(p => ({
        ...p,
        image: typeof p.image === 'string' && p.image.startsWith('data:') && p.image.length > 20000
          ? ''
          : p.image
      }));
      localStorage.setItem(key, JSON.stringify(lean));
    } catch (retryErr) {
      console.error(`Could not persist ${key} to localStorage:`, retryErr);
    }
  }
};

// Helper to sanitize products loaded from localStorage and ensure images and stock are 100% synchronized
const sanitizeLoadedProducts = (savedList, fallbackList) => {
  if (!Array.isArray(savedList) || savedList.length === 0) return fallbackList;
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
  USER: 'point-tcg-user',
  OPEN_PRODUCTS: 'point-tcg-open-drawings',
  CLOSED_PRODUCTS: 'point-tcg-closed-drawings'
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [activeCategory, setActiveCategory] = useState('all');
  const deductedOrderIdsRef = useRef(new Set());

  // Hash-based Page Routing (Trang chủ Store vs Trang Quản Trị Admin vs Trang Chi tiết Sản phẩm)
  const [currentRoute, setCurrentRoute] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.startsWith('#admin')) return 'admin';
    if (hash.startsWith('#product-')) return 'product';
    return 'store';
  });

  // Modals & Drawers state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [signInMode, setSignInMode] = useState('login'); // 'login' | 'register' | 'admin'
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adminProductToEdit, setAdminProductToEdit] = useState(null);

  // Centralized Orders State with Cross-Tab and Event Sync
  const [orders, setOrders] = useState(() => getOrdersList());

  useEffect(() => {
    const handleSync = () => {
      try {
        const fresh = getOrdersList();
        setOrders(fresh);
      } catch {}
    };

    const handleNewOrder = (e) => {
      const newOrder = e.detail;
      if (newOrder) {
        setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
      }
    };

    const handleOrderUpdated = (e) => {
      if (e.detail?.updated) {
        setOrders(e.detail.updated);
      } else {
        handleSync();
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'point-tcg-orders') {
        handleSync();
      }
    };

    window.addEventListener('point-tcg-new-order', handleNewOrder);
    window.addEventListener('point-tcg-order-updated', handleOrderUpdated);
    window.addEventListener('point-tcg-order-deleted', handleOrderUpdated);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('point-tcg-new-order', handleNewOrder);
      window.removeEventListener('point-tcg-order-updated', handleOrderUpdated);
      window.removeEventListener('point-tcg-order-deleted', handleOrderUpdated);
      window.removeEventListener('storage', handleStorageChange);
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

  // Open / Close dedicated Product Detail Page
  const handleOpenProductDetail = (product) => {
    if (!product) return;
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

  // Sync hash routing on hash change & on initial load
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const lower = hash.toLowerCase();
      if (lower.startsWith('#admin')) {
        setCurrentRoute('admin');
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

  // Cart state
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        return parsed.map(item => {
          const catalogImg = getProductCatalogImage(item);
          if (catalogImg) {
            return { ...item, image: catalogImg };
          }
          return item;
        });
      }
      return [];
    } catch {
      return [];
    }
  });

  // Saved / Favorited product IDs
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SAVED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Authenticated user state
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const isAdmin = user?.role === 'admin';

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
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(savedIds));
    } catch (e) {}
  }, [savedIds]);

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } catch (e) {}
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [user]);

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

  // Format countdown string with full customization support (Label & Text)
  const getCountdownString = (itemId) => {
    const product = openDrawings.find(p => p.id === itemId) || closedDrawings.find(p => p.id === itemId);

    // If product has custom fixed text
    if (product?.customCountdownText && product.customCountdownText.trim()) {
      return product.customCountdownText.trim();
    }

    const labelPrefix = product?.countdownLabel?.trim() || 'Drawing ends in';
    const target = targetTimestamps[itemId];
    if (!target) return `${labelPrefix} 02:14:33`;

    const diffSeconds = Math.max(0, Math.floor((target - currentTime) / 1000));
    if (diffSeconds === 0) {
      return product?.countdownEndedText?.trim() || 'Drawing Ended';
    }

    const hours = String(Math.floor(diffSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(diffSeconds % 60).padStart(2, '0');
    return `${labelPrefix} ${hours}:${minutes}:${seconds}`;
  };

  // -------------------------------------------------------------
  // OPEN ADMIN PORTAL & SIGN OUT HANDLERS
  // -------------------------------------------------------------
  const handleOpenAdmin = () => {
    setAdminProductToEdit(null);
    window.location.hash = '#admin';
    setCurrentRoute('admin');
  };

  const handleSignOut = () => {
    setUser(null);
    setAdminSession(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem('point-tcg-admin-session');
    } catch {}
  };

  // -------------------------------------------------------------
  // ORDER OPERATIONS: PLACE, UPDATE STATUS, DELETE & STOCK DEDUCTION
  // -------------------------------------------------------------
  const handleOrderPlaced = (newOrder) => {
    if (!newOrder || !newOrder.id) return;
    const alreadyDeducted = deductedOrderIdsRef.current.has(newOrder.id);
    deductedOrderIdsRef.current.add(newOrder.id);

    setOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);

    // Deduct stock for new orders
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
            return { ...p, stock: remaining };
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
            return { ...p, stock: remaining };
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
  };

  const handleUpdateOrderStatus = (orderId, newStatus) => {
    const updated = updateOrderStatus(orderId, newStatus);
    if (updated) {
      setOrders(updated);
    }
  };

  const handleDeleteOrder = (orderId) => {
    const filtered = deleteOrder(orderId);
    if (filtered) {
      setOrders(filtered);
    }
  };

  // -------------------------------------------------------------
  // ADMIN OPERATIONS: ADD, EDIT, DELETE, RESET
  // -------------------------------------------------------------
  const handleAddProduct = (newProduct, section) => {
    if (section === 'open') {
      setOpenDrawings(prev => [newProduct, ...prev]);
      setTargetTimestamps(prev => ({
        ...prev,
        [newProduct.id]: Date.now() + (newProduct.secondsRemaining || 7200) * 1000
      }));
    } else {
      setClosedDrawings(prev => [newProduct, ...prev]);
    }
  };

  const handleUpdateProduct = (updatedProduct, section) => {
    if (section === 'open') {
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
  };

  const handleDeleteProduct = (productId, section) => {
    if (section === 'open') {
      setOpenDrawings(prev => prev.filter(p => p.id !== productId));
    } else {
      setClosedDrawings(prev => prev.filter(p => p.id !== productId));
    }
    setCart(prev => prev.filter(item => item.id !== productId));
    setSavedIds(prev => prev.filter(id => id !== productId));
  };

  const handleResetDefaults = () => {
    setOpenDrawings(initialOpenDrawings);
    setClosedDrawings(initialClosedDrawings);
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
    const currentStock = typeof product.stock === 'number' ? product.stock : 20;
    if (currentStock <= 0) {
      alert(`Sản phẩm "${product.title}" hiện tại đã hết hàng!`);
      return;
    }

    const addCount = Math.max(1, Number(qtyToAdd) || 1);
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
      alert(`Bạn đã chọn tối đa ${currentStock} sản phẩm có sẵn trong kho!`);
    } else {
      setIsCartOpen(true);
    }
  };

  const handleBuyNow = (product, qtyToAdd = 1) => {
    const currentStock = typeof product.stock === 'number' ? product.stock : 20;
    if (currentStock <= 0) {
      alert(`Sản phẩm "${product.title}" hiện tại đã hết hàng!`);
      return;
    }

    const addCount = Math.max(1, Number(qtyToAdd) || 1);
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
    if (newQty <= 0) {
      handleRemoveFromCart(id);
      return;
    }

    // Find current stock from live product catalog
    const product = openDrawings.find(p => p.id === id) || closedDrawings.find(p => p.id === id);
    const maxStock = typeof product?.stock === 'number' ? product.stock : 999;

    let finalQty = newQty;
    if (newQty > maxStock) {
      alert(`Số lượng yêu cầu vượt quá tồn kho hiện tại (chỉ còn ${maxStock} sản phẩm)!`);
      finalQty = Math.max(1, maxStock);
    }

    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: finalQty, stock: maxStock } : item))
    );
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

  // Saved Items handlers
  const handleToggleSave = (product) => {
    setSavedIds((prev) => {
      if (prev.includes(product.id)) {
        return prev.filter((id) => id !== product.id);
      }
      return [...prev, product.id];
    });
  };

  const allProductsCombined = useMemo(() => {
    return [...openDrawings, ...closedDrawings];
  }, [openDrawings, closedDrawings]);

  const savedProductsList = useMemo(() => {
    return allProductsCombined
      .filter((p) => savedIds.includes(p.id))
      .filter((p) => typeof p.stock !== 'number' || p.stock > 0);
  }, [allProductsCombined, savedIds]);

  // Request to join drawing handler
  const handleRequestJoin = (product) => {
    if (!user) {
      setSelectedProduct(product);
      setSignInMode('customer');
      setIsSignInOpen(true);
      return;
    }
    alert(
      `🎉 Drawing entry submitted!\n\nCollector: ${user.name}\nItem: ${product.title}\nStatus: Active in raffle queue.\n\nYou will be notified immediately when the drawing closes!`
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

  // Filter storefront products: Only in-stock items (stock > 0) are shown to customers
  const filteredOpenDrawings = useMemo(() => {
    if (activeCategory === 'closed') return [];
    const inStock = openDrawings.filter((item) => typeof item.stock !== 'number' || item.stock > 0);
    const searchFiltered = filterBySearch(inStock);
    const catFiltered = filterByCategory(searchFiltered);
    return sortProducts(catFiltered);
  }, [openDrawings, searchQuery, sortBy, activeCategory]);

  const filteredClosedDrawings = useMemo(() => {
    if (activeCategory === 'open') return [];
    const inStock = closedDrawings.filter((item) => typeof item.stock !== 'number' || item.stock > 0);
    const searchFiltered = filterBySearch(inStock);
    const catFiltered = filterByCategory(searchFiltered);
    return sortProducts(catFiltered);
  }, [closedDrawings, searchQuery, sortBy, activeCategory]);

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
      <AdminPage
        currentUser={user}
        openDrawings={openDrawings}
        closedDrawings={closedDrawings}
        orders={orders}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onDeleteOrder={handleDeleteOrder}
        onAddProduct={handleAddProduct}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onResetDefaults={handleResetDefaults}
        initialProductToEdit={adminProductToEdit}
        onAdminLoginSuccess={(adminData) => setUser(adminData)}
        onSignOut={handleSignOut}
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
    );
  }

  return (
    <div className="app-container">
      {/* 1. Header Bar (#0053e2, Sticky) */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        savedCount={savedIds.length}
        onOpenSaved={() => setIsSavedOpen(true)}
        cartTotal={cartTotal}
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
        user={user}
        onOpenSignIn={(mode) => {
          setSignInMode(mode || 'login');
          setIsSignInOpen(true);
        }}
        onSignOut={handleSignOut}
        onOpenAdmin={handleOpenAdmin}
        onOpenOrders={() => setIsOrdersOpen(true)}
        pendingOrdersCount={pendingOrdersCount}
        products={allStoreProducts}
        onSelectProduct={handleOpenProductDetail}
        onLogoClick={handleBackToStore}
      />

      {/* 2. Main View: Product Detail Page OR Storefront */}
      {currentRoute === 'product' && selectedProduct ? (
        <ProductDetailPage
          product={selectedProduct}
          allProducts={allStoreProducts}
          onBackToStore={handleBackToStore}
          onSelectProduct={handleOpenProductDetail}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
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
            {/* Search & Sort Filter Toolbar */}
        <div className="section-toolbar" id="products-catalog-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {searchQuery ? (
              <div className="search-active-pill">
                <span>Search results for: <strong>"{searchQuery}"</strong> ({totalResultsCount} items found)</span>
                <span
                  className="clear-search-link"
                  onClick={() => setSearchQuery('')}
                  role="button"
                  tabIndex={0}
                >
                  Clear
                </span>
              </div>
            ) : activeCategory !== 'all' ? (
              <div className="search-active-pill">
                <span>Filter: <strong>{activeCategory}</strong></span>
                <span
                  className="clear-search-link"
                  onClick={() => setActiveCategory('all')}
                  role="button"
                  tabIndex={0}
                >
                  Reset Filter
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '0.88rem', color: '#64748b' }}>
                Showing <strong>{totalResultsCount}</strong> Pokémon collectible opportunities
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="sort-select-wrapper">
              <label htmlFor="sort-dropdown">Sort by:</label>
              <select
                id="sort-dropdown"
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort products"
              >
                <option value="default">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Customer Rating</option>
                <option value="newest">Newest Releases</option>
              </select>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------
            3. SECTION "OPEN DRAWINGS" (Placed above Closed drawings)
           ------------------------------------------------------------- */}
        {filteredOpenDrawings.length > 0 && (
          <section className="drawings-section" aria-labelledby="open-drawings-heading">
            <div className="section-header">
              <div className="section-title-wrap">
                <h2 id="open-drawings-heading" className="section-title">
                  <span>Open drawings</span>
                  <span className="live-indicator">
                    <span className="live-pulse" />
                    Live Now
                  </span>
                </h2>
                <p className="section-subtitle">
                  Active raffles closing today. Request to join before timer expires for a chance to purchase.
                </p>
              </div>
            </div>

            <div className="open-drawings-grid">
              {filteredOpenDrawings.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSaved={savedIds.includes(product.id)}
                  onToggleSave={handleToggleSave}
                  onAddToCart={handleAddToCart}
                  onRequestJoin={handleRequestJoin}
                  onBuyNow={handleBuyNow}
                  onOpenDetails={handleOpenProductDetail}
                  countdownString={getCountdownString(product.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* -------------------------------------------------------------
            4. SECTION "CLOSED DRAWINGS" (Horizontal Carousel)
           ------------------------------------------------------------- */}
        {filteredClosedDrawings.length > 0 && (
          <section className="drawings-section" aria-labelledby="closed-drawings-heading">
            <div className="section-header">
              <div className="section-title-wrap">
                <h2 id="closed-drawings-heading" className="section-title">
                  Closed drawings
                </h2>
                <p className="section-subtitle">See previous ones now closed.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <a
                  href="#closed-drawings"
                  className="section-view-all"
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`Hiển thị tất cả ${filteredClosedDrawings.length} sản phẩm closed drawings còn hàng.`);
                  }}
                >
                  View all ({filteredClosedDrawings.length})
                </a>
              </div>
            </div>

            {/* Horizontal Carousel with Circular White Arrows & Scroll-Snap */}
            <Carousel
              products={filteredClosedDrawings}
              savedIds={savedIds}
              onToggleSave={handleToggleSave}
              onAddToCart={handleAddToCart}
              onRequestJoin={handleRequestJoin}
              onBuyNow={handleBuyNow}
              onOpenDetails={handleOpenProductDetail}
            />
          </section>
        )}

        {/* Zero Results State */}
        {totalResultsCount === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', marginTop: '20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
              Không tìm thấy sản phẩm nào phù hợp {searchQuery ? `cho "${searchQuery}"` : ''}
            </h3>
            <p style={{ color: '#64748b', marginTop: '6px' }}>
              Thử tìm kiếm với các từ khoá phổ biến:
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
                }}
              >
                Reset Bộ Lọc & Tìm Kiếm
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

      {/* Admin Portal Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        openDrawings={openDrawings}
        closedDrawings={closedDrawings}
        orders={orders}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onDeleteOrder={handleDeleteOrder}
        onAddProduct={handleAddProduct}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onResetDefaults={handleResetDefaults}
      />

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
          setIsCheckoutOpen(true);
        }}
      />

      {/* Secure Checkout & Payment Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cart}
        cartTotal={cartTotal}
        user={user}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={() => setCart([])}
        onOrderPlaced={handleOrderPlaced}
        onOpenOrderHistory={() => setIsOrdersOpen(true)}
      />

      {/* Orders History Modal */}
      <OrdersModal
        isOpen={isOrdersOpen}
        onClose={() => setIsOrdersOpen(false)}
        user={user}
      />

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
        onClose={() => setIsSignInOpen(false)}
        initialMode={signInMode}
        onSignInSuccess={(userData) => {
          setUser(userData);
          if (userData.role === 'admin') {
            window.location.hash = '#admin';
            setCurrentRoute('admin');
          } else {
            setAdminSession(null);
            try {
              localStorage.removeItem('point-tcg-admin-session');
            } catch {}
            if (currentRoute === 'admin') {
              setCurrentRoute('store');
              window.location.hash = '';
            }
            if (selectedProduct && selectedProduct.status === 'open') {
              handleRequestJoin(selectedProduct);
            }
          }
        }}
      />
    </div>
  );
}
