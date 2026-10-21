// scripts/stripLegacyPasswords.js
// Xoá trường `password` (mật khẩu dạng chữ thường) khỏi các document cũ trong collection 'users'.
//
// CHẠY MỘT LẦN, TRƯỚC KHI deploy firestore.rules mới (sau khi deploy, script này sẽ bị rules chặn):
//   node scripts/stripLegacyPasswords.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { firebaseConfig } from '../src/firebase.js';

const app = initializeApp(firebaseConfig, 'strip-legacy-passwords');
const db = getFirestore(app);

async function main() {
  const snap = await getDocs(collection(db, 'users'));
  let stripped = 0;
  for (const d of snap.docs) {
    if ('password' in d.data()) {
      await updateDoc(d.ref, { password: deleteField() });
      stripped++;
      console.log(`   ✔ Đã xoá mật khẩu khỏi users/${d.id}`);
    }
  }
  console.log(`\nHoàn tất: đã xoá mật khẩu khỏi ${stripped}/${snap.size} tài khoản.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
