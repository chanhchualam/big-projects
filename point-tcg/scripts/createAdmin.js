// scripts/createAdmin.js
// Tạo (hoặc dùng lại) tài khoản Firebase Auth và cấp quyền quản trị bằng document admins/{uid}.
//
// CHẠY TRƯỚC KHI deploy firestore.rules mới (sau khi deploy, collection 'admins' chỉ sửa được từ Firebase Console):
//   node scripts/createAdmin.js admin@email.com
// Yêu cầu: Firebase Console > Authentication > Sign-in method > bật Email/Password.
import readline from 'node:readline';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase.js';

const app = initializeApp(firebaseConfig, 'create-admin');
const auth = getAuth(app);
const db = getFirestore(app);

// Đọc mật khẩu từ terminal mà không hiển thị ký tự
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (str) => {
      if (str.includes(question)) rl.output.write(str);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Cách dùng: node scripts/createAdmin.js admin@email.com');
    process.exit(1);
  }

  const password = await askHidden('Mật khẩu admin (tối thiểu 8 ký tự): ');
  if (password.length < 8) {
    console.error('❌ Mật khẩu phải có tối thiểu 8 ký tự.');
    process.exit(1);
  }
  const confirm = await askHidden('Nhập lại mật khẩu: ');
  if (confirm !== password) {
    console.error('❌ Mật khẩu xác nhận không khớp.');
    process.exit(1);
  }

  let user;
  try {
    user = (await createUserWithEmailAndPassword(auth, email, password)).user;
    console.log(`✔ Đã tạo tài khoản ${email}`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      user = (await signInWithEmailAndPassword(auth, email, password)).user;
      console.log(`✔ Tài khoản ${email} đã tồn tại, đăng nhập thành công`);
    } else {
      throw err;
    }
  }

  await setDoc(doc(db, 'admins', user.uid), { email, createdAt: new Date().toISOString() });
  console.log(`✔ Đã cấp quyền admin: admins/${user.uid}`);
  console.log('\n🎉 Xong! Đăng nhập trang quản trị tại /#admin bằng email và mật khẩu vừa tạo.');
  process.exit(0);
}

main().catch((err) => {
  const hints = {
    'auth/operation-not-allowed': 'Chưa bật Email/Password: Firebase Console > Authentication > Sign-in method.',
    'auth/configuration-not-found': 'Chưa bật Authentication: Firebase Console > Authentication > Get started.',
    'auth/invalid-credential': 'Email đã tồn tại nhưng mật khẩu không đúng.',
    'auth/weak-password': 'Mật khẩu quá yếu.',
    'permission-denied': 'Firestore rules mới đã được deploy nên không ghi được admins/. Hãy thêm document admins/{uid} thủ công trong Firebase Console.'
  };
  console.error('❌ Lỗi:', hints[err.code] || err.message);
  process.exit(1);
});
