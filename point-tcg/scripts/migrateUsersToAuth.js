// scripts/migrateUsersToAuth.js
// Đẩy các tài khoản khách hàng cũ (collection 'users' có trường `password`) lên Firebase Authentication.
// Với mỗi tài khoản:
//   1. Tạo tài khoản Firebase Auth bằng email + mật khẩu cũ (hoặc đăng nhập nếu email đã tồn tại)
//   2. Ghi hồ sơ sang users/{uid} (KHÔNG kèm mật khẩu), xoá document cũ nếu id khác uid
//   3. Gắn uid vào các đơn hàng cũ có cùng customerEmail để khách xem được đơn của mình
//
// CHẠY TRƯỚC KHI deploy firestore.rules mới và TRƯỚC stripLegacyPasswords.js:
//   node scripts/migrateUsersToAuth.js --dry-run   (chỉ liệt kê, không ghi gì)
//   node scripts/migrateUsersToAuth.js
// Yêu cầu: Firebase Console > Authentication > Sign-in method > bật Email/Password.
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase.js';

const app = initializeApp(firebaseConfig, 'migrate-users');
const auth = getAuth(app);
const db = getFirestore(app);

const DRY_RUN = process.argv.includes('--dry-run');

// Tạo tài khoản Auth, hoặc đăng nhập nếu email đã được đăng ký trước đó
async function createOrSignIn(email, password) {
  try {
    const user = (await createUserWithEmailAndPassword(auth, email, password)).user;
    return { user, created: true };
  } catch (err) {
    if (err.code !== 'auth/email-already-in-use') throw err;
    const user = (await signInWithEmailAndPassword(auth, email, password)).user;
    return { user, created: false };
  }
}

async function migrateUser(oldDoc) {
  const { password, ...data } = oldDoc.data();
  const email = (data.email || '').trim().toLowerCase();

  const { user, created } = await createOrSignIn(email, password);
  if (data.name) await updateProfile(user, { displayName: data.name });

  // Hồ sơ mới khớp với rules 'users' (role customer, không có password)
  await setDoc(doc(db, 'users', user.uid), {
    ...data,
    id: user.uid,
    email,
    role: 'customer',
    migratedFrom: oldDoc.id
  });
  if (oldDoc.id !== user.uid) {
    await deleteDoc(oldDoc.ref);
  }

  const ordersSnap = await getDocs(query(collection(db, 'orders'), where('customerEmail', '==', email)));
  let linked = 0;
  for (const o of ordersSnap.docs) {
    if (!o.data().uid) {
      await updateDoc(o.ref, { uid: user.uid });
      linked++;
    }
  }

  await signOut(auth);
  return { uid: user.uid, created, linked };
}

async function main() {
  const snap = await getDocs(collection(db, 'users'));
  const legacy = snap.docs.filter((d) => {
    const u = d.data();
    return typeof u.password === 'string' && u.email && u.role !== 'admin';
  });

  console.log(`Tìm thấy ${legacy.length}/${snap.size} tài khoản cần đẩy lên Firebase Authentication.`);
  if (DRY_RUN) {
    legacy.forEach((d) => console.log(`   • ${d.data().email} (users/${d.id})`));
    console.log('\n(--dry-run) Không ghi gì. Bỏ --dry-run để chạy thật.');
    process.exit(0);
  }

  let ok = 0;
  const failed = [];
  for (const d of legacy) {
    const email = d.data().email;
    try {
      const { uid, created, linked } = await migrateUser(d);
      ok++;
      console.log(`   ✔ ${email} → ${created ? 'đã tạo' : 'đã có sẵn'} uid ${uid}, gắn ${linked} đơn hàng`);
    } catch (err) {
      failed.push(email);
      const reason = {
        'auth/weak-password': 'mật khẩu cũ dưới 6 ký tự',
        'auth/invalid-email': 'email không hợp lệ',
        'auth/invalid-credential': 'email đã có tài khoản Auth với mật khẩu khác'
      }[err.code] || err.message;
      console.error(`   ✘ ${email}: ${reason}`);
      await signOut(auth).catch(() => {});
    }
  }

  console.log(`\nHoàn tất: ${ok} thành công, ${failed.length} lỗi.`);
  if (failed.length) {
    console.log('Các tài khoản lỗi vẫn giữ nguyên trong Firestore; khách có thể tự đăng ký lại bằng email đó.');
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  const hints = {
    'auth/operation-not-allowed': 'Chưa bật Email/Password: Firebase Console > Authentication > Sign-in method.',
    'auth/configuration-not-found': 'Chưa bật Authentication: Firebase Console > Authentication > Get started.',
    'permission-denied': 'Firestore rules mới đã được deploy nên script không đọc/ghi được. Chạy script trước khi deploy rules.'
  };
  console.error('❌ Lỗi:', hints[err.code] || err.message);
  process.exit(1);
});
