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
  increment,
  writeBatch,
  arrayUnion,
  runTransaction,
  onSnapshot
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

// Trừ (direction = -1) hoặc hoàn (direction = 1) tồn kho theo các món trong đơn, chỉ admin.
// Ghi cùng cờ stockDeducted trên đơn trong một batch để không bị trừ hai lần.
export async function applyOrderStock(order, direction) {
  try {
    if (!order?.id || !Array.isArray(order.items)) return false;
    const batch = writeBatch(db);
    order.items.forEach((item) => {
      const qty = Number(item.qty) || 1;
      if (item.id) {
        batch.update(doc(db, 'products', String(item.id)), { stock: increment(direction * qty) });
      }
    });
    batch.update(doc(db, 'orders', order.id), { stockDeducted: direction < 0 });
    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Firestore applyOrderStock error:', err.message);
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

// Theo dõi trực tiếp đơn của một người dùng: admin đổi trạng thái là khách thấy ngay (trả về hàm huỷ theo dõi)
export function subscribeOrdersForUser(uid, onChange) {
  if (!uid) return () => {};
  return onSnapshot(
    query(collection(db, 'orders'), where('uid', '==', uid)),
    (snap) => onChange(snapToList(snap)),
    (err) => console.warn('Firestore subscribeOrdersForUser error:', err.message)
  );
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

// Mỗi lần đổi trạng thái được ghi thêm một mốc vào statusHistory để khách xem tiến trình đơn
export function makeStatusEntry(status) {
  return { status, at: new Date().toISOString() };
}

export async function updateOrderStatusInDb(orderId, newStatus) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: newStatus,
      statusHistory: arrayUnion(makeStatusEntry(newStatus)),
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
// 5. MÃ VẬN ĐƠN (CHỈ ADMIN)
// -------------------------------------------------------------
export async function updateOrderTrackingInDb(orderId, { carrier, trackingCode }) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      carrier: (carrier || '').trim(),
      trackingCode: (trackingCode || '').trim(),
      trackingAt: new Date().toISOString(),
      updatedAt: new Date().toLocaleString('vi-VN')
    });
    return true;
  } catch (err) {
    console.error('Firestore updateOrderTracking error:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 6. DANH SÁCH YÊU THÍCH (users/{uid}.wishlist)
// -------------------------------------------------------------
export async function saveWishlistToDb(uid, productIds) {
  try {
    if (!uid) return false;
    await updateDoc(doc(db, 'users', uid), { wishlist: productIds });
    return true;
  } catch (err) {
    console.warn('Firestore saveWishlist error:', err.message);
    return false;
  }
}

// -------------------------------------------------------------
// 7. BẢNG COUPONS (MÃ GIẢM GIÁ, id = mã viết hoa)
// -------------------------------------------------------------
// Khách chỉ đọc được đúng mã mình nhập; admin xem được toàn bộ danh sách
export async function fetchCoupon(code) {
  try {
    const id = (code || '').trim().toUpperCase();
    if (!id) return null;
    const snap = await getDoc(doc(db, 'coupons', id));
    return snap.exists() ? { ...snap.data(), code: snap.id } : null;
  } catch (err) {
    console.warn('Firestore fetchCoupon error:', err.message);
    return null;
  }
}

export async function fetchCouponsFromDb() {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    const list = [];
    snap.forEach((d) => list.push({ ...d.data(), code: d.id }));
    return list;
  } catch (err) {
    console.warn('Firestore fetchCoupons error:', err.message);
    return null;
  }
}

export async function saveCouponToDb(coupon) {
  try {
    const { code, ...data } = coupon;
    await setDoc(doc(db, 'coupons', code.trim().toUpperCase()), data, { merge: true });
    return true;
  } catch (err) {
    console.error('Firestore saveCoupon error:', err);
    return false;
  }
}

export async function deleteCouponFromDb(code) {
  try {
    await deleteDoc(doc(db, 'coupons', code));
    return true;
  } catch (err) {
    console.error('Firestore deleteCoupon error:', err);
    return false;
  }
}

// Tăng lượt dùng của mã khi đơn được tạo; trả false nếu mã đã hết lượt
export async function redeemCoupon(code) {
  try {
    return await runTransaction(db, async (tx) => {
      const ref = doc(db, 'coupons', code);
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const c = snap.data();
      if (c.maxUses > 0 && (c.usedCount || 0) >= c.maxUses) return false;
      tx.update(ref, { usedCount: (c.usedCount || 0) + 1 });
      return true;
    });
  } catch (err) {
    console.warn('Firestore redeemCoupon error:', err.message);
    return false;
  }
}

// -------------------------------------------------------------
// 8. BẢNG REVIEWS (ĐÁNH GIÁ SẢN PHẨM, id = productId_uid)
// -------------------------------------------------------------
export async function fetchReviewsFromDb() {
  try {
    const snap = await getDocs(collection(db, 'reviews'));
    return snapToList(snap);
  } catch (err) {
    console.warn('Firestore fetchReviews error:', err.message);
    return [];
  }
}

export async function saveReviewToDb(review) {
  try {
    const id = `${review.productId}_${review.uid}`;
    await setDoc(doc(db, 'reviews', id), review);
    return { ...review, id };
  } catch (err) {
    console.error('Firestore saveReview error:', err);
    return null;
  }
}

export async function deleteReviewFromDb(reviewId) {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
    return true;
  } catch (err) {
    console.error('Firestore deleteReview error:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 9. BẢNG RESTOCK_REQUESTS (BÁO KHI CÓ HÀNG LẠI)
// -------------------------------------------------------------
export async function saveRestockRequest({ productId, productTitle, email, uid }) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    // id cố định theo sản phẩm + email để một người không đăng ký trùng
    const id = `${productId}_${cleanEmail}`.replace(/[/]/g, '_');
    await setDoc(doc(db, 'restock_requests', id), {
      productId: String(productId),
      productTitle,
      email: cleanEmail,
      uid,
      createdAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('Firestore saveRestockRequest error:', err);
    return false;
  }
}

export async function fetchRestockRequestsFromDb() {
  try {
    const snap = await getDocs(collection(db, 'restock_requests'));
    return snapToList(snap);
  } catch (err) {
    console.warn('Firestore fetchRestockRequests error:', err.message);
    return null;
  }
}

export async function deleteRestockRequestFromDb(id) {
  try {
    await deleteDoc(doc(db, 'restock_requests', id));
    return true;
  } catch (err) {
    console.error('Firestore deleteRestockRequest error:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 10. BẢNG ANNOUNCEMENTS (THÔNG BÁO CỦA SHOP, ĐỌC CÔNG KHAI)
// -------------------------------------------------------------
export async function fetchAnnouncementsFromDb() {
  try {
    const snap = await getDocs(collection(db, 'announcements'));
    return snapToList(snap);
  } catch (err) {
    console.warn('Firestore fetchAnnouncements error:', err.message);
    return [];
  }
}

export async function saveAnnouncementToDb(announcement) {
  try {
    const { id, ...data } = announcement;
    const ref = id ? doc(db, 'announcements', id) : doc(collection(db, 'announcements'));
    await setDoc(ref, data, { merge: true });
    return ref.id;
  } catch (err) {
    console.error('Firestore saveAnnouncement error:', err);
    return null;
  }
}

export async function deleteAnnouncementFromDb(id) {
  try {
    await deleteDoc(doc(db, 'announcements', id));
    return true;
  } catch (err) {
    console.error('Firestore deleteAnnouncement error:', err);
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
