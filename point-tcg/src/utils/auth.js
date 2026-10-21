// src/utils/auth.js
// Xác thực người dùng & quản trị viên bằng Firebase Authentication.
// - Mật khẩu do Firebase Auth quản lý (đã băm phía server), KHÔNG lưu trong Firestore hay localStorage.
// - Quyền admin: uid phải có document trong collection 'admins' (tạo từ Firebase Console).
// - Khách vãng lai đặt hàng bằng phiên đăng nhập ẩn danh để chỉ chính họ đọc được đơn của mình.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  linkWithCredential,
  sendPasswordResetEmail,
  EmailAuthProvider
} from 'firebase/auth';
import { auth } from '../firebase';
import { getProductCatalogImage } from '../products';
import {
  saveUserToDb,
  fetchUserProfile,
  isAdminUid,
  updateUserProfileInDb
} from '../services/firestoreService';

// Các khoá localStorage cũ từng chứa mật khẩu / dữ liệu cá nhân của người khác
const LEGACY_STORAGE_KEYS = [
  'point-tcg-admin-creds',
  'point-tcg-admin-session',
  'point-tcg-registered-users',
  'point-tcg-orders',
  'point-tcg-user'
];

export function purgeLegacyLocalData() {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage không khả dụng — bỏ qua
  }
}

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-email': 'Địa chỉ email không hợp lệ!',
  'auth/invalid-credential': 'Sai email hoặc mật khẩu! Vui lòng kiểm tra lại.',
  'auth/wrong-password': 'Sai email hoặc mật khẩu! Vui lòng kiểm tra lại.',
  'auth/user-not-found': 'Sai email hoặc mật khẩu! Vui lòng kiểm tra lại.',
  'auth/user-disabled': 'Tài khoản này đã bị khoá.',
  'auth/email-already-in-use': 'Email này đã được đăng ký tài khoản! Vui lòng đăng nhập.',
  'auth/credential-already-in-use': 'Email này đã được đăng ký tài khoản! Vui lòng đăng nhập.',
  'auth/weak-password': 'Mật khẩu phải có tối thiểu 6 ký tự!',
  'auth/too-many-requests': 'Bạn đã thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.',
  'auth/requires-recent-login': 'Vui lòng nhập đúng mật khẩu hiện tại để xác nhận.',
  'auth/network-request-failed': 'Lỗi kết nối mạng. Vui lòng thử lại!',
  'auth/operation-not-allowed': 'Phương thức đăng nhập chưa được bật trong Firebase Console.',
  'auth/admin-restricted-operation': 'Phương thức đăng nhập chưa được bật trong Firebase Console.'
};

export function getAuthErrorMessage(err, fallback = 'Có lỗi xảy ra. Vui lòng thử lại!') {
  return AUTH_ERROR_MESSAGES[err?.code] || fallback;
}

// ==========================================
// 1. PHIÊN ĐĂNG NHẬP
// ==========================================
// Dựng đối tượng user cho UI từ Firebase user + hồ sơ Firestore + danh sách admins
export async function buildSessionUser(fbUser) {
  if (!fbUser || fbUser.isAnonymous) return null;
  const [profile, admin] = await Promise.all([
    fetchUserProfile(fbUser.uid),
    isAdminUid(fbUser.uid)
  ]);
  const email = fbUser.email || profile?.email || '';
  return {
    id: fbUser.uid,
    name: profile?.name || fbUser.displayName || email.split('@')[0],
    username: email.split('@')[0],
    email,
    phone: profile?.phone || '',
    address: profile?.address || '',
    role: admin ? 'admin' : 'customer'
  };
}

// Đảm bảo có phiên Firebase (ẩn danh nếu là khách vãng lai) trước khi tạo đơn
export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign out error:', err);
  }
}

// ==========================================
// 2. ĐĂNG KÝ / ĐĂNG NHẬP KHÁCH HÀNG
// ==========================================
export async function registerUser({ name, email, password, phone = '', address = '' }) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const current = auth.currentUser;
    let fbUser;

    if (current && current.isAnonymous) {
      // Nâng cấp phiên ẩn danh để giữ lại các đơn khách đã đặt trước khi đăng ký
      const credential = EmailAuthProvider.credential(cleanEmail, password);
      fbUser = (await linkWithCredential(current, credential)).user;
    } else {
      fbUser = (await createUserWithEmailAndPassword(auth, cleanEmail, password)).user;
    }

    await updateProfile(fbUser, { displayName: name.trim() });

    const profile = {
      id: fbUser.uid,
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      address: address.trim(),
      role: 'customer',
      createdAt: new Date().toLocaleDateString('vi-VN')
    };
    const saved = await saveUserToDb(profile);
    if (!saved) {
      console.warn('Không lưu được hồ sơ khách hàng lên Firestore.');
    }

    return {
      success: true,
      user: {
        id: profile.id,
        name: profile.name,
        username: cleanEmail.split('@')[0],
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        role: 'customer'
      }
    };
  } catch (err) {
    console.error('Registration error:', err);
    return { success: false, error: getAuthErrorMessage(err, 'Lỗi khi tạo tài khoản. Vui lòng thử lại!') };
  }
}

// Đăng nhập bằng email + mật khẩu (dùng chung cho khách hàng và admin)
export async function authenticateUser(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, (email || '').trim().toLowerCase(), password || '');
    const user = await buildSessionUser(cred.user);
    return { success: true, user };
  } catch (err) {
    return { success: false, error: getAuthErrorMessage(err, 'Sai email hoặc mật khẩu! Vui lòng kiểm tra lại.') };
  }
}

// Đăng nhập trang quản trị: yêu cầu tài khoản có trong collection 'admins'
export async function authenticateAdmin(email, password) {
  const res = await authenticateUser(email, password);
  if (!res.success) return res;
  if (res.user?.role !== 'admin') {
    await signOutUser();
    return { success: false, error: 'Tài khoản này không có quyền quản trị!' };
  }
  return res;
}

// Đổi mật khẩu cho tài khoản đang đăng nhập (yêu cầu nhập lại mật khẩu hiện tại)
export async function changePassword(currentPassword, newPassword) {
  try {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.email) {
      return { success: false, error: 'Bạn cần đăng nhập để đổi mật khẩu.' };
    }
    const credential = EmailAuthProvider.credential(fbUser.email, currentPassword);
    await reauthenticateWithCredential(fbUser, credential);
    await updatePassword(fbUser, newPassword);
    return { success: true };
  } catch (err) {
    return { success: false, error: getAuthErrorMessage(err, 'Không đổi được mật khẩu. Vui lòng thử lại!') };
  }
}

// Gửi email đặt lại mật khẩu. Không báo email có tồn tại hay không để tránh dò tài khoản.
export async function sendPasswordReset(email) {
  try {
    auth.languageCode = 'vi';
    await sendPasswordResetEmail(auth, (email || '').trim().toLowerCase());
    return { success: true };
  } catch (err) {
    if (err.code === 'auth/user-not-found') return { success: true };
    return { success: false, error: getAuthErrorMessage(err, 'Không gửi được email đặt lại mật khẩu. Vui lòng thử lại!') };
  }
}

export async function updateUserProfile(userId, { name, phone, address }) {
  const fields = {};
  if (name !== undefined) fields.name = name.trim();
  if (phone !== undefined) fields.phone = phone.trim();
  if (address !== undefined) fields.address = address.trim();
  const ok = await updateUserProfileInDb(userId, fields);
  return ok
    ? { success: true, user: { id: userId, ...fields } }
    : { success: false, error: 'Không lưu được thông tin tài khoản!' };
}

// ==========================================
// 3. ĐƠN HÀNG
// ==========================================
// Chuẩn hoá dữ liệu đơn hàng mới. Đơn được lưu lên Firestore bởi App (saveOrderToDb),
// không còn lưu bản sao toàn bộ đơn hàng trong localStorage.
export function saveNewOrder(orderData) {
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
    amountVnd: orderData.amountVnd || Math.round((orderData.total || 0) * 25400),
    status: orderData.status || 'Chờ thanh toán QR (Đơn mới)',
    // Tồn kho chỉ bị trừ khi admin xác nhận đơn; đơn cũ không có trường này đã trừ lúc đặt
    stockDeducted: false,
    createdAt: orderData.createdAt || new Date().toLocaleString('vi-VN')
  };

  // Dispatch custom event for real-time order alert in Admin & Header
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('point-tcg-new-order', { detail: orderRecord }));
  }

  return orderRecord;
}
