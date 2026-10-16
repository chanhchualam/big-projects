// src/utils/auth.js
// Manage Admin Credentials, Registered Users, and Order History with LocalStorage persistence
import { createCardSvg, allProducts, getProductCatalogImage } from '../products';

const ADMIN_STORAGE_KEY = 'point-tcg-admin-creds';
const USERS_STORAGE_KEY = 'point-tcg-registered-users';
const ORDERS_STORAGE_KEY = 'point-tcg-orders';

const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  name: 'Quản Trị Viên Point TCG',
  email: 'admin@pointtcg.com'
};

// Default sample collector account for immediate testing
const DEFAULT_SAMPLE_USER = {
  id: 'usr_sample_1',
  name: 'Ash Ketchum',
  email: 'collector@pointtcg.com',
  password: 'password123',
  phone: '0901234567',
  address: 'Số 123 Đường Pallet, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  role: 'customer',
  createdAt: '2026-10-01 10:30'
};

const DEFAULT_SAMPLE_USER_2 = {
  id: 'usr_sample_2',
  name: 'Misty Waterflower',
  email: 'misty@cerulean.com',
  password: 'password123',
  phone: '0912345678',
  address: 'Tòa nhà Cerulean Gym, Số 88 Đường Ven Hồ, Quận Ba Đình, Hà Nội',
  role: 'customer',
  createdAt: '2026-10-05 14:15'
};

// Default Sample Orders for immediate admin demonstration
const DEFAULT_SAMPLE_ORDERS = [
  {
    id: 'PTCG-992144',
    customerName: 'Ash Ketchum',
    customerEmail: 'collector@pointtcg.com',
    customerPhone: '0901234567',
    shippingAddress: 'Số 123 Đường Pallet, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    orderNotes: 'Bọc kỹ chống va đập giúp em, quà sinh nhật.',
    shippingMethod: 'Tiêu chuẩn (Tamper-Proof Box)',
    paymentMethod: 'Chuyển Khoản Ngân Hàng / VietQR',
    items: [
      {
        id: 'open-1',
        title: 'Pokémon TCG: Scarlet & Violet 151 Ultra-Premium Collection Box',
        price: 119.99,
        qty: 1,
        image: createCardSvg('🔥', 'SCARLET & VIOLET 151', '<stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#7c2d12"/>')
      }
    ],
    subtotal: 119.99,
    shippingFee: 0,
    discountAmount: 0,
    total: 119.99,
    amountVnd: 3048000,
    status: 'Chờ thanh toán QR (Đơn mới)',
    createdAt: '10/10/2026, 08:30:15'
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
        id: 'open-2',
        title: 'Pokémon TCG: Crown Zenith Special Collection — Pikachu VMAX Box',
        price: 49.99,
        qty: 2,
        image: createCardSvg('⚡', 'CROWN ZENITH PIKACHU', '<stop offset="0%" stop-color="#eab308"/><stop offset="100%" stop-color="#854d0e"/>')
      }
    ],
    subtotal: 99.98,
    shippingFee: 15.0,
    discountAmount: 9.99,
    total: 104.99,
    amountVnd: 2667000,
    status: 'Đang chuẩn bị hàng',
    createdAt: '09/10/2026, 16:45:22'
  }
];

// ==========================================
// 1. ADMIN CREDENTIALS
// ==========================================
export function getAdminCredentials() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.username && parsed.password) {
        return {
          ...DEFAULT_ADMIN,
          ...parsed
        };
      }
    }
  } catch (err) {
    console.error('Error reading admin creds:', err);
  }
  return DEFAULT_ADMIN;
}

export function saveAdminCredentials(creds) {
  try {
    const current = getAdminCredentials();
    const updated = {
      ...current,
      ...creds
    };
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error saving admin creds:', err);
    return null;
  }
}

export function resetAdminCredentials() {
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch (err) {
    console.error('Error resetting admin creds:', err);
  }
  return DEFAULT_ADMIN;
}

export function authenticateAdmin(usernameOrEmail, password) {
  const creds = getAdminCredentials();
  const inputUser = (usernameOrEmail || '').trim().toLowerCase();
  const inputPass = (password || '').trim();
  if (
    (inputUser === creds.username.toLowerCase() || inputUser === creds.email?.toLowerCase()) &&
    inputPass === creds.password
  ) {
    const adminUser = {
      name: creds.name || 'Quản Trị Viên Point TCG',
      email: creds.email || 'admin@pointtcg.com',
      role: 'admin'
    };
    setAdminSession(adminUser);
    return {
      success: true,
      user: adminUser
    };
  }
  return {
    success: false,
    error: 'Sai tên đăng nhập hoặc mật khẩu quản trị!'
  };
}

const ADMIN_SESSION_KEY = 'point-tcg-admin-session';

export function getAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAdminSession(user) {
  try {
    if (user) {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch (err) {
    console.error('Error updating admin session:', err);
  }
}

// ==========================================
// 2. REGISTERED USERS (CUSTOMERS)
// ==========================================
export function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (err) {
    console.error('Error reading registered users:', err);
  }
  // Initialize with sample users if empty
  const initial = [DEFAULT_SAMPLE_USER, DEFAULT_SAMPLE_USER_2];
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
  } catch (e) {}
  return initial;
}

export function registerUser({ name, email, password, phone = '', address = '' }) {
  try {
    const users = getRegisteredUsers();
    const cleanEmail = email.trim().toLowerCase();

    // Check if email already exists
    const exists = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      return { success: false, error: 'Email này đã được đăng ký tài khoản! Vui lòng đăng nhập.' };
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      phone: phone.trim(),
      address: address.trim(),
      role: 'customer',
      createdAt: new Date().toLocaleDateString('vi-VN')
    };

    const updatedList = [newUser, ...users];
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));
    setAdminSession(null);

    return {
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        address: newUser.address,
        role: newUser.role
      }
    };
  } catch (err) {
    console.error('Registration error:', err);
    return { success: false, error: 'Lỗi khi lưu tài khoản. Vui lòng thử lại!' };
  }
}

export function deleteCustomer(userId) {
  try {
    const users = getRegisteredUsers();
    const filtered = users.filter(u => u.id !== userId);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export function authenticateUser(loginInput, password) {
  const cleanInput = loginInput.trim().toLowerCase();
  const cleanPass = password.trim();

  // 1. Check if input matches Admin credentials (cho phép admin đăng nhập trực tiếp từ modal người dùng)
  const adminCreds = getAdminCredentials();
  if (
    (cleanInput === adminCreds.username.toLowerCase() || cleanInput === adminCreds.email?.toLowerCase()) &&
    cleanPass === adminCreds.password
  ) {
    const adminUser = {
      id: 'admin_master',
      name: adminCreds.name || 'Quản Trị Viên Point TCG',
      email: adminCreds.email || 'admin@pointtcg.com',
      role: 'admin'
    };
    setAdminSession(adminUser);
    return {
      success: true,
      user: adminUser
    };
  }

  // 2. Check Customer registered users
  const users = getRegisteredUsers();
  const matchedUser = users.find(
    u => (u.email.toLowerCase() === cleanInput || u.name?.toLowerCase() === cleanInput) && u.password === cleanPass
  );

  if (matchedUser) {
    setAdminSession(null);
    return {
      success: true,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        phone: matchedUser.phone,
        address: matchedUser.address,
        role: 'customer'
      }
    };
  }

  return {
    success: false,
    error: 'Sai tài khoản/email hoặc mật khẩu! Vui lòng kiểm tra lại.'
  };
}

// ==========================================
// 3. ORDER HISTORY & SHOPPER MANAGEMENT
// ==========================================
export function getOrdersList() {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Auto-migrate orders to guarantee items ALWAYS carry synchronized card images
        let needsSave = false;
        const sanitized = parsed.map(order => {
          if (!order.items || !Array.isArray(order.items)) return order;
          const updatedItems = order.items.map(item => {
            const hasLegacyPlaceholder = !item.image || item.image.includes('pokemontcg.io');
            const catalogImg = getProductCatalogImage(item);
            if (catalogImg && (hasLegacyPlaceholder || item.image !== catalogImg)) {
              needsSave = true;
              return { ...item, image: catalogImg };
            }
            return item;
          });
          return { ...order, items: updatedItems };
        });

        if (needsSave) {
          localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(sanitized));
        }
        return sanitized;
      }
    }
  } catch (err) {
    console.error('Error reading orders:', err);
  }
  // Initialize with sample orders for immediate demonstration
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(DEFAULT_SAMPLE_ORDERS));
  } catch (e) {}
  return DEFAULT_SAMPLE_ORDERS;
}

export function saveNewOrder(orderData) {
  try {
    const existing = getOrdersList() || [];
    const amountVnd = orderData.amountVnd || Math.round((orderData.total || 0) * 25400);

    // Sanitize order items so images are always 100% matched to store card images
    const sanitizedItems = (orderData.items || []).map(item => {
      let finalImg = item.image;
      const catalogImg = getProductCatalogImage(item);
      if (catalogImg && (!finalImg || finalImg.includes('pokemontcg.io') || !finalImg.startsWith('data:image/svg'))) {
        finalImg = catalogImg;
      }
      return {
        ...item,
        image: finalImg || item.image || ''
      };
    });

    const orderRecord = {
      ...orderData,
      id: orderData.id || `PTCG-${Date.now().toString().slice(-6)}`,
      items: sanitizedItems,
      amountVnd,
      status: orderData.status || 'Chờ thanh toán QR (Đơn mới)',
      createdAt: orderData.createdAt || new Date().toLocaleString('vi-VN')
    };

    // Attempt to persist in localStorage with quota-safety
    try {
      const updated = [orderRecord, ...existing.filter(o => o.id !== orderRecord.id)];
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));
    } catch (quotaErr) {
      console.warn('LocalStorage quota warning in saveNewOrder, trimming payload:', quotaErr);
      try {
        // Prune older orders and omit large base64 data URLs from old items
        const leanExisting = existing.slice(0, 5).map(o => ({
          ...o,
          items: (o.items || []).map(it => ({
            ...it,
            image: it.image?.startsWith('data:') && it.image.length > 500 ? '' : it.image
          }))
        }));
        const leanUpdated = [orderRecord, ...leanExisting.filter(o => o.id !== orderRecord.id)];
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(leanUpdated));
      } catch (retryErr) {
        console.error('Could not save orders to localStorage even after trimming:', retryErr);
      }
    }

    // Dispatch custom event for real-time order alert in Admin & Header
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('point-tcg-new-order', { detail: orderRecord }));
    }

    return orderRecord;
  } catch (err) {
    console.error('Error saving order:', err);
    // CRITICAL FALLBACK: Always return orderRecord or orderData so UI never crashes!
    return {
      ...orderData,
      id: orderData.id || `PTCG-${Date.now().toString().slice(-6)}`,
      amountVnd: orderData.amountVnd || Math.round((orderData.total || 0) * 25400),
      status: orderData.status || 'Chờ thanh toán QR (Đơn mới)',
      createdAt: orderData.createdAt || new Date().toLocaleString('vi-VN')
    };
  }
}

export function updateOrderStatus(orderId, newStatus) {
  try {
    const orders = getOrdersList();
    const updated = orders.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          status: newStatus,
          updatedAt: new Date().toLocaleString('vi-VN')
        };
      }
      return order;
    });
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('point-tcg-order-updated', { detail: { orderId, newStatus, updated } }));
    }

    return updated;
  } catch (err) {
    console.error('Error updating order status:', err);
    return null;
  }
}

export function deleteOrder(orderId) {
  try {
    const orders = getOrdersList();
    const filtered = orders.filter(o => o.id !== orderId);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(filtered));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('point-tcg-order-deleted', { detail: { orderId, updated: filtered } }));
    }

    return filtered;
  } catch (err) {
    console.error('Error deleting order:', err);
    return null;
  }
}
