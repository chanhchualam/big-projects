// src/services/firestoreService.js
// Quản lý và đồng bộ các bảng dữ liệu trên Firebase Cloud Firestore:
// 1. 'products': Bảng sản phẩm thẻ bài Pokémon
// 2. 'orders': Bảng đơn đặt hàng (mỗi đơn có trường uid của người đặt)
// 3. 'users': Bảng hồ sơ khách hàng (id = Firebase Auth uid, KHÔNG lưu mật khẩu)
// 4. 'admins': Danh sách uid quản trị viên (chỉ tạo từ Firebase Console)
// 5. 'settings': Bảng cấu hình hệ thống (VietQR, thông tin shop)
// Quyền truy cập được kiểm soát bởi firestore.rules.
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';

// -------------------------------------------------------------
// 1. BẢNG PRODUCTS (SẢN PHẨM)
// -------------------------------------------------------------
export async function fetchProductsFromDb() {
  try {
    const snap = await getDocs(collection(db, 'products'));
    if (!snap.empty) {
      const list = [];
      snap.forEach((d) => list.push({ ...d.data(), id: d.id }));
      return list;
    }
  } catch (err) {
    console.warn('Firestore fetchProducts fallback to local:', err.message);
  }
  return null;
}

export async function saveProductToDb(product) {
  try {
    if (!product || !product.id) return false;
    await setDoc(doc(db, 'products', product.id), product, { merge: true });
    return true;
  } catch (err) {
    console.error('Firestore saveProduct error:', err);
    return false;
  }
}

// Giảm tồn kho nguyên tử khi khách đặt hàng (rules chặn tồn kho âm)
export async function decrementProductStock(productId, qty) {
  try {
    if (!productId || !(qty > 0)) return false;
    await updateDoc(doc(db, 'products', String(productId)), { stock: increment(-qty) });
    return true;
  } catch (err) {
    console.warn('Firestore decrementProductStock error:', err.message);
    return false;
  }
}

export async function deleteProductFromDb(productId) {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return true;
  } catch (err) {
    console.error('Firestore deleteProduct error:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 2. BẢNG ORDERS (ĐƠN HÀNG)
// -------------------------------------------------------------
function snapToList(snap) {
  const list = [];
  snap.forEach((d) => list.push({ ...d.data(), id: d.id }));
  return list;
}

// Toàn bộ đơn hàng — chỉ admin đọc được
export async function fetchOrdersFromDb() {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    return snapToList(snap);
  } catch (err) {
    console.warn('Firestore fetchOrders error:', err.message);
  }
  return null;
}

// Đơn hàng của một người dùng (khách chỉ đọc được đơn của chính mình)
export async function fetchOrdersForUser(uid) {
  try {
    if (!uid) return [];
    const snap = await getDocs(query(collection(db, 'orders'), where('uid', '==', uid)));
    return snapToList(snap);
  } catch (err) {
    console.warn('Firestore fetchOrdersForUser error:', err.message);
  }
  return null;
}

export async function saveOrderToDb(order) {
  try {
    if (!order || !order.id) return false;
    await setDoc(doc(db, 'orders', order.id), order, { merge: true });
    return true;
  } catch (err) {
    console.error('Firestore saveOrder error:', err);
    return false;
  }
}

export async function updateOrderStatusInDb(orderId, newStatus) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: newStatus,
      updatedAt: new Date().toLocaleString('vi-VN')
    });
    return true;
  } catch (err) {
    console.error('Firestore updateOrderStatus error:', err);
    return false;
  }
}

export async function deleteOrderFromDb(orderId) {
  try {
    await deleteDoc(doc(db, 'orders', orderId));
    return true;
  } catch (err) {
    console.error('Firestore deleteOrder error:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 3. BẢNG USERS (HỒ SƠ KHÁCH HÀNG) & ADMINS
// -------------------------------------------------------------
// Toàn bộ khách hàng — chỉ admin đọc được
export async function fetchUsersFromDb() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.empty) {
      return snapToList(snap);
    }
  } catch (err) {
    console.warn('Firestore fetchUsers error:', err.message);
  }
  return null;
}

export async function fetchUserProfile(uid) {
  try {
    if (!uid) return null;
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  } catch (err) {
    console.warn('Firestore fetchUserProfile error:', err.message);
    return null;
  }
}

export async function isAdminUid(uid) {
  try {
    if (!uid) return false;
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function saveUserToDb(user) {
  try {
    if (!user || !user.id) return false;
    // eslint-disable-next-line no-unused-vars
    const { password, ...safeUser } = user;
    await setDoc(doc(db, 'users', user.id), safeUser, { merge: true });
    return true;
  } catch (err) {
    console.error('Firestore saveUser error:', err);
    return false;
  }
}

export async function updateUserProfileInDb(uid, fields) {
  try {
    if (!uid) return false;
    await updateDoc(doc(db, 'users', uid), { ...fields, updatedAt: new Date().toLocaleString('vi-VN') });
    return true;
  } catch (err) {
    console.error('Firestore updateUserProfile error:', err);
    return false;
  }
}

export async function deleteUserFromDb(userId) {
  try {
    if (!userId) return false;
    await deleteDoc(doc(db, 'users', userId));
    return true;
  } catch (err) {
    console.error('Firestore deleteUser error:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 4. BẢNG SETTINGS (CẤU HÌNH HỆ THỐNG / VIETQR)
// -------------------------------------------------------------
export async function fetchSettingsFromDb(key) {
  try {
    const snap = await getDoc(doc(db, 'settings', key));
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn(`Firestore fetchSettings (${key}) error:`, err.message);
  }
  return null;
}

export async function saveSettingsToDb(key, data) {
  try {
    await setDoc(doc(db, 'settings', key), data, { merge: true });
    return true;
  } catch (err) {
    console.error(`Firestore saveSettings (${key}) error:`, err);
    return false;
  }
}

// -------------------------------------------------------------
// ĐỒNG BỘ DỮ LIỆU ĐANG HIỂN THỊ LÊN FIREBASE FIRESTORE (CHỈ ADMIN)
// -------------------------------------------------------------
export async function syncAllLocalDataToFirebase({ products = [], orders = [], users = [], bankQrConfig = null }) {
  const results = {
    productsCount: 0,
    ordersCount: 0,
    usersCount: 0,
    settingsUpdated: false
  };

  try {
    // 1. Sync products
    if (Array.isArray(products) && products.length > 0) {
      for (const p of products) {
        if (p && p.id) {
          await setDoc(doc(db, 'products', p.id), p, { merge: true });
          results.productsCount++;
        }
      }
    }

    // 2. Sync orders
    if (Array.isArray(orders) && orders.length > 0) {
      for (const o of orders) {
        if (o && o.id) {
          await setDoc(doc(db, 'orders', o.id), o, { merge: true });
          results.ordersCount++;
        }
      }
    }

    // 3. Sync users (không bao giờ ghi mật khẩu)
    if (Array.isArray(users) && users.length > 0) {
      for (const u of users) {
        if (u && u.id) {
          // eslint-disable-next-line no-unused-vars
          const { password, ...safeUser } = u;
          await setDoc(doc(db, 'users', u.id), safeUser, { merge: true });
          results.usersCount++;
        }
      }
    }

    // 4. Sync settings
    if (bankQrConfig) {
      await setDoc(doc(db, 'settings', 'bank_qr_config'), bankQrConfig, { merge: true });
      results.settingsUpdated = true;
    }

    return { success: true, ...results };
  } catch (err) {
    console.error('Error syncing local data to Firebase:', err);
    return { success: false, error: err.message, ...results };
  }
}
