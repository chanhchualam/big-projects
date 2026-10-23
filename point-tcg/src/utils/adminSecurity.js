// src/utils/adminSecurity.js
// Lớp bảo mật thứ 2 cho trang quản trị: "mã bảo mật admin", tách riêng khỏi mật khẩu đăng nhập.
// Firestore rules (adminOk) từ chối mọi thao tác quản trị nếu lần đăng nhập hiện tại chưa mở khoá
// bằng mã này, nên lộ mật khẩu admin thôi là chưa đủ để vào được.
//   admin_secrets/{uid}  : sha256(proof)           — không ai đọc được
//   admin_sessions/{uid} : proof + auth_time       — mở khoá, hết hạn sau 8 giờ (rules kiểm tra)
//   admin_logs           : nhật ký mở khoá / khoá / đổi mã — chỉ thêm, không sửa xoá được
// proof = sha256(mã + ':' + uid), tính trong trình duyệt; mã gốc không bao giờ được gửi đi.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase';

export const SESSION_HOURS = 8;
export const IDLE_LOCK_MINUTES = 30;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const proofFor = (code, uid) => sha256Hex(`${code}:${uid}`);

// Mã đủ mạnh để không dò được: tối thiểu 8 ký tự, có cả chữ và số
export function getCodeStrengthError(code) {
  if (!code || code.length < 8) return 'Mã bảo mật phải có tối thiểu 8 ký tự.';
  if (!/[A-Za-z]/.test(code) || !/\d/.test(code)) return 'Mã bảo mật phải có cả chữ và số.';
  return '';
}

async function currentAuthTime() {
  const result = await auth.currentUser.getIdTokenResult();
  return Number(result.claims.auth_time);
}

function deviceLabel() {
  const ua = navigator.userAgent || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt khác';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return `${browser}${os ? ` / ${os}` : ''}`;
}

export async function logAdminEvent(type) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, 'admin_logs'), {
      uid: user.uid,
      email: user.email || '',
      type,
      at: serverTimestamp(),
      device: deviceLabel()
    });
  } catch {
    // Nhật ký chỉ để theo dõi, không chặn thao tác chính
  }
}

// Mở khoá: tạo phiên gắn với lần đăng nhập hiện tại. Sai mã → rules từ chối.
export async function unlockAdmin(code) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' };
  try {
    await setDoc(doc(db, 'admin_sessions', user.uid), {
      proof: await proofFor(code, user.uid),
      authTime: await currentAuthTime(),
      createdAt: serverTimestamp()
    });
    await logAdminEvent('unlock');
    return { success: true };
  } catch {
    await logAdminEvent('unlock_failed');
    return { success: false, error: 'Mã bảo mật không đúng.' };
  }
}

// Tạo mã lần đầu (chỉ được khi tài khoản chưa có mã) rồi mở khoá luôn
export async function setupAdminCode(code) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' };
  const weak = getCodeStrengthError(code);
  if (weak) return { success: false, error: weak };
  try {
    const proof = await proofFor(code, user.uid);
    await setDoc(doc(db, 'admin_secrets', user.uid), {
      codeHash: await sha256Hex(proof),
      updatedAt: serverTimestamp()
    });
  } catch {
    return { success: false, error: 'Tài khoản này đã có mã bảo mật. Hãy nhập mã để mở khoá (quên mã: xoá admin_secrets trong Firebase Console).' };
  }
  await logAdminEvent('code_set');
  return unlockAdmin(code);
}

export async function changeAdminCode(oldCode, newCode) {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' };
  const weak = getCodeStrengthError(newCode);
  if (weak) return { success: false, error: weak };
  try {
    const newProof = await proofFor(newCode, user.uid);
    await setDoc(doc(db, 'admin_secrets', user.uid), {
      codeHash: await sha256Hex(newProof),
      oldProof: await proofFor(oldCode, user.uid),
      updatedAt: serverTimestamp()
    });
  } catch {
    return { success: false, error: 'Mã bảo mật hiện tại không đúng.' };
  }
  await logAdminEvent('code_changed');
  // Phiên cũ dùng proof của mã cũ — mở khoá lại bằng mã mới
  return unlockAdmin(newCode);
}

export async function lockAdmin(reason = 'lock') {
  const user = auth.currentUser;
  if (!user) return;
  await logAdminEvent(reason);
  try {
    await deleteDoc(doc(db, 'admin_sessions', user.uid));
  } catch {
    // Không xoá được thì phiên vẫn tự hết hạn sau SESSION_HOURS giờ
  }
}

// Phiên còn hiệu lực không: thử đọc nhật ký (chỉ adminOk() đọc được)
export async function checkAdminUnlocked() {
  if (!auth.currentUser) return false;
  try {
    await getDocs(query(collection(db, 'admin_logs'), limit(1)));
    return true;
  } catch {
    return false;
  }
}

export async function fetchAdminLogs(max = 30) {
  try {
    const snap = await getDocs(query(collection(db, 'admin_logs'), orderBy('at', 'desc'), limit(max)));
    return snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, at: data.at?.toDate ? data.at.toDate() : null };
    });
  } catch {
    return [];
  }
}
