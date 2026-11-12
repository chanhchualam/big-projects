// =====================================================================
// File: js/firebase.js
// Đường dẫn: chi tiêu/js/firebase.js
// Mục đích: Khởi tạo Firebase (App, Auth, Firestore) MỘT LẦN
//           và re-export các hàm SDK để các module khác chỉ cần import
//           từ file này. Phiên bản SDK chỉ xuất hiện trong file này:
//           muốn nâng cấp, thay "12.6.0" ở 3 dòng import + FIREBASE_VERSION.
// =====================================================================
//
// 🔓 LƯU Ý BẢO MẬT:
// firebaseConfig bên dưới là thông tin CÔNG KHAI — nó chỉ định danh
// project, không phải mật khẩu. Ai xem source trang web cũng thấy được.
// Bảo mật thật sự nằm ở firestore.rules (chỉ cho đúng
// UID của chủ cửa hàng đọc/ghi). Vì vậy KHÔNG cần giấu file này.
// =====================================================================

// Phiên bản Firebase JS SDK dùng chung cho toàn bộ ứng dụng
// (import ES Module phải là chuỗi tĩnh nên không ghép biến được)
const FIREBASE_VERSION = "12.6.0";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  onSnapshot,
  runTransaction,
  writeBatch,
  serverTimestamp,
  Timestamp,
  increment,
  deleteField,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  count,
  documentId
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ---------------------------------------------------------------------
// firebaseConfig của project quan-ly-hang-hoa-doh5v (đã điền sẵn)
// (Firebase Console → ⚙️ Project settings → General → Your apps → Config)
// ---------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyA4xLiY2c2MafUVD4rOHAYT41luGniWqsY",
  authDomain: "quan-ly-hang-hoa-doh5v.firebaseapp.com",
  projectId: "quan-ly-hang-hoa-doh5v",
  storageBucket: "quan-ly-hang-hoa-doh5v.firebasestorage.app",
  messagingSenderId: "794746688857",
  appId: "1:794746688857:web:cca27310cd2ffd3c16a848"
};

// Cảnh báo sớm nếu quên dán config (giúp debug nhanh khi chạy lần đầu)
if (firebaseConfig.apiKey.startsWith("DAN_")) {
  console.error(
    "[firebase.js] Bạn chưa dán firebaseConfig! Mở js/firebase.js và thay các giá trị TODO."
  );
}

// Khởi tạo Firebase App
const app = initializeApp(firebaseConfig);

// ---------------- Authentication ----------------
const auth = getAuth(app);
auth.languageCode = "vi"; // email reset mật khẩu bằng tiếng Việt

// Giữ phiên đăng nhập sau khi đóng trình duyệt
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("[firebase.js] Không đặt được persistence:", error);
});

// ---------------- Cloud Firestore ----------------
// Bật cache offline (IndexedDB) + hỗ trợ mở nhiều tab cùng lúc.
// Lợi ích: trang mở nhanh hơn, giảm lượt đọc, vẫn xem được khi mất mạng.
// Lưu ý: runTransaction BẮT BUỘC có mạng (đây là điều tốt — đảm bảo
// tồn kho không bị sai khi bán hàng lúc offline).
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (error) {
  // Một số trình duyệt (chế độ ẩn danh cũ) không hỗ trợ IndexedDB
  console.warn("[firebase.js] Không bật được cache offline, dùng cache bộ nhớ:", error);
  db = initializeFirestore(app, {});
}

// Cloud Storage KHÔNG dùng: ảnh lưu trong Firestore (cách C, gói Spark miễn phí).
// Bỏ import firebase-storage.js giúp mỗi trang tải nhẹ hơn ~15KB.

// Tên các collection — dùng hằng số để tránh gõ sai chính tả
const COLLECTIONS = Object.freeze({
  CATEGORIES: "categories",
  PRODUCTS: "products",
  SUPPLIERS: "suppliers",
  CUSTOMERS: "customers",
  IMPORTS: "imports",
  INVOICES: "invoices",
  STOCK_LOGS: "stock_logs",
  COUNTERS: "counters" // sinh số phiếu tự tăng: PN000001, HD000001
});

export {
  FIREBASE_VERSION,
  app,
  auth,
  db,
  COLLECTIONS,
  // Auth
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  // Firestore
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  onSnapshot,
  runTransaction,
  writeBatch,
  serverTimestamp,
  Timestamp,
  increment,
  deleteField,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  count,
  documentId
};
