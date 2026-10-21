// scripts/seedFirebase.js
// Script đẩy toàn bộ dữ liệu (bảng products, orders, users, settings) lên Firebase Firestore
// LƯU Ý: Sau khi deploy firestore.rules, chỉ admin đã đăng nhập mới được ghi các bảng này,
// nên script (chạy không đăng nhập) sẽ bị từ chối. Chỉ dùng với Firestore Emulator hoặc
// chuyển sang firebase-admin với service account.
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDCBxzdbKBbmnujiIdON9aGNchUMmB0-LY",
  authDomain: "point-tcg.firebaseapp.com",
  projectId: "point-tcg",
  storageBucket: "point-tcg.firebasestorage.app",
  messagingSenderId: "186098114"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 1. DATA: PRODUCTS
const PRODUCTS_DATA = [
  {
    id: 'open-1',
    title: 'Pokémon TCG: Scarlet & Violet 151 Ultra-Premium Collection Box',
    price: 119.99,
    wasPrice: 139.99,
    category: 'Ultra Premium Collection',
    status: 'open',
    statusTime: 'Ends today at 5:00 PM',
    stock: 18,
    featured: true,
    description: 'The definitive Pokémon 151 collection featuring Mew ex etched foil promo, Mewtwo illustration rare promo, premium playmat, deck box, metal coin, and 16 booster packs from Scarlet & Violet—151.'
  },
  {
    id: 'open-2',
    title: 'Pokémon TCG: Crown Zenith Special Collection — Pikachu VMAX Box',
    price: 49.99,
    wasPrice: 59.99,
    category: 'Special Collection',
    status: 'open',
    statusTime: 'Ends tomorrow at 12:00 PM',
    stock: 25,
    featured: true,
    description: 'Gigantamax your collection with Pikachu VMAX etched foil promo card, Pikachu V promo card, an oversized Pikachu VMAX display card, and 5 Crown Zenith booster packs.'
  },
  {
    id: 'open-3',
    title: 'Pokémon TCG: Surging Sparks Booster Box (36 Booster Packs Factory Sealed)',
    price: 161.99,
    wasPrice: 179.99,
    category: 'Booster Box',
    status: 'open',
    statusTime: '2 days remaining',
    stock: 12,
    featured: true,
    description: 'Electrifying new expansion featuring Stellar Tera Pikachu ex, Archaludon ex, and legendary dragons. Includes 36 factory-sealed booster packs with tamper-evident shrinkwrap.'
  },
  {
    id: 'open-4',
    title: 'Pokémon TCG: Prismatic Evolutions Elite Trainer Box (Eevee Heroes)',
    price: 59.99,
    wasPrice: 69.99,
    category: 'Elite Trainer Box',
    status: 'open',
    statusTime: '3 days remaining',
    stock: 30,
    featured: true,
    description: 'Celebrate all 9 Eevee evolutions with foil promo cards, 9 booster packs, 65 specialty card sleeves, collector storage box, and tournament accessories.'
  },
  {
    id: 'open-5',
    title: 'Pokémon TCG: Paldean Fates Booster Bundle (6 Sealed Packs)',
    price: 26.94,
    wasPrice: 32.99,
    category: 'Booster Bundle',
    status: 'open',
    statusTime: '4 days remaining',
    stock: 45,
    featured: false,
    description: 'Hunt for Shiny Charizard ex and over 120 Shiny Pokémon in this compact 6-pack bundle. High pull-rate guaranteed.'
  },
  {
    id: 'open-6',
    title: 'Pokémon TCG: Twilight Masquerade Booster Box (Factory Sealed)',
    price: 144.99,
    wasPrice: 160.00,
    category: 'Booster Box',
    status: 'open',
    statusTime: '5 days remaining',
    stock: 15,
    featured: false,
    description: 'Journey to the mystical land of Kitakami with Ogerpon ex and Greninja ex. 36 factory-sealed booster packs in original case shrinkwrap.'
  },
  {
    id: 'closed-1',
    title: 'Pokémon TCG: Celebrations 25th Anniversary Ultra-Premium Collection',
    price: 349.99,
    wasPrice: 399.99,
    category: 'Vintage & Anniversary',
    status: 'closed',
    statusTime: 'Drawing Ended — Winners Allocated',
    stock: 0,
    featured: false,
    description: 'The holy grail of modern Pokémon collecting. Features 2 metal cards (Base Set Pikachu & Charizard), special gold Pokéball promo, and 17 Celebrations packs.'
  },
  {
    id: 'closed-2',
    title: 'Pokémon TCG: Evolving Skies Booster Box (First Edition Print Run)',
    price: 699.99,
    wasPrice: 750.00,
    category: 'Booster Box',
    status: 'closed',
    statusTime: 'Drawing Ended — Vault Sealed',
    stock: 0,
    featured: false,
    description: 'The legendary "Moonbreon" Umbreon VMAX Alt Art hunt. Factory-sealed with verified authentic Pokémon logo shrinkwrap.'
  }
];

// 2. DATA: ORDERS
const ORDERS_DATA = [
  {
    id: 'PTCG-992144',
    customerName: 'Trần Gia Huy',
    customerEmail: 'kiba14123@gmail.com',
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
        qty: 1
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
    paymentMethod: 'Thanh Toán Khi Nhận Hàng (COD)',
    items: [
      {
        id: 'open-2',
        title: 'Pokémon TCG: Crown Zenith Special Collection — Pikachu VMAX Box',
        price: 49.99,
        qty: 2
      }
    ],
    subtotal: 99.98,
    shippingFee: 15.0,
    discountAmount: 9.99,
    total: 104.99,
    amountVnd: 2667000,
    status: 'Đang chuẩn bị hàng',
    createdAt: '09/10/2026, 16:45:22'
  },
  {
    id: 'PTCG-774012',
    customerName: 'Red Champion',
    customerEmail: 'red@kanto.com',
    customerPhone: '0988776655',
    shippingAddress: 'Đỉnh Núi Silver, Thị trấn New Bark, Tỉnh Kanto',
    orderNotes: 'Gọi trước khi giao.',
    shippingMethod: 'Tiêu chuẩn (Tamper-Proof Box)',
    paymentMethod: 'Chuyển Khoản Ngân Hàng / VietQR',
    items: [
      {
        id: 'open-3',
        title: 'Pokémon TCG: Surging Sparks Booster Box (36 Booster Packs Factory Sealed)',
        price: 161.99,
        qty: 1
      }
    ],
    subtotal: 161.99,
    shippingFee: 0,
    discountAmount: 0,
    total: 161.99,
    amountVnd: 4115000,
    status: 'Đang giao hàng',
    createdAt: '12/10/2026, 11:20:00'
  },
  {
    id: 'PTCG-663091',
    customerName: 'Brock Pewter',
    customerEmail: 'brock@pewtergym.com',
    customerPhone: '0933445566',
    shippingAddress: 'Pewter Gym, Số 45 Đường Đá Sỏi, TP. Pewter',
    orderNotes: 'Hàng dễ vỡ, xin nhẹ tay.',
    shippingMethod: 'Tiêu chuẩn (Tamper-Proof Box)',
    paymentMethod: 'Chuyển Khoản Ngân Hàng / VietQR',
    items: [
      {
        id: 'open-4',
        title: 'Pokémon TCG: Prismatic Evolutions Elite Trainer Box (Eevee Heroes)',
        price: 59.99,
        qty: 1
      }
    ],
    subtotal: 59.99,
    shippingFee: 0,
    discountAmount: 0,
    total: 59.99,
    amountVnd: 1524000,
    status: 'Giao thành công',
    createdAt: '14/10/2026, 09:15:30'
  }
];

// 3. DATA: USERS
const USERS_DATA = [
  {
    id: 'admin_master',
    name: 'Quản Trị Viên Point TCG',
    username: 'admin',
    email: 'kiba14123@gmail.com',
    phone: '0901234567',
    role: 'admin',
    createdAt: '2026-10-01 00:00'
  },
  {
    id: 'usr_sample_1',
    name: 'Trần Gia Huy',
    username: '1246_TranGiahuy',
    email: 'kiba14123@gmail.com',
    phone: '0901234567',
    address: 'Số 123 Đường Pallet, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    role: 'customer',
    createdAt: '2026-10-01 10:30'
  },
  {
    id: 'usr_sample_2',
    name: 'Misty Waterflower',
    username: 'misty_cerulean',
    email: 'misty@cerulean.com',
    phone: '0912345678',
    address: 'Tòa nhà Cerulean Gym, Số 88 Đường Ven Hồ, Quận Ba Đình, Hà Nội',
    role: 'customer',
    createdAt: '2026-10-05 14:15'
  }
];

// 4. DATA: SETTINGS
const SETTINGS_DATA = {
  bank_qr_config: {
    bankId: 'MB',
    bankName: 'MBBank (Ngân hàng Quân Đội)',
    accountNo: '0901234567',
    accountName: 'TRAN GIA HUY',
    template: 'compact2',
    autoConfirmEnabled: true,
    transferSyntax: 'PTCG [Mã đơn hàng]',
    note: 'Hệ thống tự động kích hoạt mã QR động Napas 24/7 theo từng đơn hàng'
  },
  store_info: {
    storeName: 'Point TCG',
    tagline: 'Trung tâm thẻ bài Pokémon Chính Hãng 100% Factory Sealed',
    email: 'kiba14123@gmail.com',
    hotline: '0901 234 567',
    website: 'https://point-tcg.web.app',
    messenger: 'https://m.me/1429099050281227',
    address: 'Số 123 Đường Pallet, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
  }
};

async function seedFirebase() {
  console.log('🚀 Bắt đầu tạo các bảng và đẩy dữ liệu lên Firebase Firestore...');

  try {
    // 1. BẢNG PRODUCTS
    console.log(`\n📦 [1/4] Đang tạo bảng 'products' (${PRODUCTS_DATA.length} sản phẩm)...`);
    for (const prod of PRODUCTS_DATA) {
      await setDoc(doc(db, 'products', prod.id), prod, { merge: true });
      console.log(`   ✔ Đã lưu sản phẩm: ${prod.id} - ${prod.title.slice(0, 45)}...`);
    }

    // 2. BẢNG ORDERS
    console.log(`\n📑 [2/4] Đang tạo bảng 'orders' (${ORDERS_DATA.length} đơn hàng)...`);
    for (const order of ORDERS_DATA) {
      await setDoc(doc(db, 'orders', order.id), order, { merge: true });
      console.log(`   ✔ Đã lưu đơn hàng: #${order.id} - ${order.customerName} (${order.status})`);
    }

    // 3. BẢNG USERS
    console.log(`\n👥 [3/4] Đang tạo bảng 'users' (${USERS_DATA.length} tài khoản)...`);
    for (const user of USERS_DATA) {
      await setDoc(doc(db, 'users', user.id), user, { merge: true });
      console.log(`   ✔ Đã lưu tài khoản: ${user.name} (${user.role}) - ${user.email}`);
    }

    // 4. BẢNG SETTINGS
    console.log(`\n⚙️ [4/4] Đang tạo bảng 'settings' (Cấu hình VietQR & Cửa hàng)...`);
    for (const [key, val] of Object.entries(SETTINGS_DATA)) {
      await setDoc(doc(db, 'settings', key), val, { merge: true });
      console.log(`   ✔ Đã lưu cài đặt: settings/${key}`);
    }

    console.log('\n🎉 HOÀN THÀNH 100%! Tất cả 4 bảng đã được tạo và đẩy thành công lên Firebase Firestore!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Lỗi khi đẩy dữ liệu lên Firebase:', err);
    process.exit(1);
  }
}

seedFirebase();
