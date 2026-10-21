// src/firebase.js
// Firebase Cloud Firestore + Authentication connection for Point TCG
// Lưu ý: firebaseConfig của web app là thông tin công khai. Dữ liệu được bảo vệ bởi
// Firebase Authentication + Firestore Security Rules (firestore.rules), không phải bởi apiKey.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyDCBxzdbKBbmnujiIdON9aGNchUMmB0-LY",
  authDomain: "point-tcg.firebaseapp.com",
  projectId: "point-tcg",
  storageBucket: "point-tcg.firebasestorage.app",
  messagingSenderId: "186098114",
  appId: "1:186098114:web:point-tcg"
};

// Singleton pattern to prevent re-initializing
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default db;
