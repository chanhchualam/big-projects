// src/utils/qrConfig.js
// Manage dynamic QR code and Bank Transfer configuration for Point TCG

import { fetchSettingsFromDb, saveSettingsToDb } from '../services/firestoreService';

// Mã QR hiện trong 1 phút; hết giờ đơn tự chuyển cho shop kiểm tra tiền và xác nhận
export const QR_SECONDS = 60;

export const STORAGE_QR_KEY = 'point-tcg-qr-config';
const QR_SETTINGS_DOC = 'bank_qr_config';

export const POPULAR_BANKS = [
  { code: 'MB', name: 'MB Bank (Ngân hàng Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank (Ngoại Thương Việt Nam)' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương Việt Nam)' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { code: 'ACB', name: 'ACB (Á Châu)' },
  { code: 'TPB', name: 'TPBank (Tiên Phong)' },
  { code: 'BIDV', name: 'BIDV (Đầu Tư và Phát Triển)' },
  { code: 'VBA', name: 'Agribank (Nông Nghiệp & PTNT)' },
  { code: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)' },
  { code: 'VIB', name: 'VIB (Quốc Tế)' },
  { code: 'OCB', name: 'OCB (Phương Đông)' },
  { code: 'SHB', name: 'SHB (Sài Gòn - Hà Nội)' },
  { code: 'SEAB', name: 'SeABank (Đông Nam Á)' },
  { code: 'LPB', name: 'LPBank (Lộc Phát Việt Nam)' },
  { code: 'HDB', name: 'HDBank (Phát Triển TP.HCM)' },
  { code: 'MSB', name: 'MSB (Hàng Hải)' },
  { code: 'VIETINBANK', name: 'VietinBank (Công Thương Việt Nam)' }
];

export const DEFAULT_QR_CONFIG = {
  mode: 'vietqr', // 'vietqr' | 'custom_image'
  bankCode: 'MB',
  bankName: 'MB Bank (Quân Đội)',
  accountNumber: '8888 6688 9999',
  accountName: 'POINT TCG STORE',
  qrTemplate: 'compact2', // 'compact2' | 'compact' | 'qr_only'
  notePrefix: 'PTCG',
  customQrImage: '' // Base64 data URL or external URL
};

// Bản cache cục bộ để hiển thị ngay; nguồn dữ liệu chính là Firestore settings/bank_qr_config
export function getQrConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_QR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_QR_CONFIG,
        ...parsed
      };
    }
  } catch (err) {
    console.warn('Error reading qr config from localStorage:', err);
  }
  return DEFAULT_QR_CONFIG;
}

// Chấp nhận cả định dạng cũ do scripts/seedFirebase.js tạo (bankId, accountNo, template)
function normalizeQrConfig(data) {
  return {
    ...DEFAULT_QR_CONFIG,
    ...data,
    bankCode: data.bankCode || data.bankId || DEFAULT_QR_CONFIG.bankCode,
    accountNumber: data.accountNumber || data.accountNo || DEFAULT_QR_CONFIG.accountNumber,
    qrTemplate: data.qrTemplate || data.template || DEFAULT_QR_CONFIG.qrTemplate
  };
}

function cacheQrConfig(config) {
  try {
    localStorage.setItem(STORAGE_QR_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Error caching qr config:', err);
  }
  window.dispatchEvent(new CustomEvent('qr-config-updated', { detail: config }));
}

// Tải cấu hình QR mới nhất từ Firestore (ai cũng đọc được, chỉ admin ghi được)
export async function loadQrConfig() {
  const remote = await fetchSettingsFromDb(QR_SETTINGS_DOC);
  if (!remote) return getQrConfig();
  const config = normalizeQrConfig(remote);
  cacheQrConfig(config);
  return config;
}

// Lưu cấu hình QR lên Firestore (bị rules từ chối nếu không phải admin)
export async function saveQrConfig(newConfig) {
  const sanitized = {
    ...DEFAULT_QR_CONFIG,
    ...newConfig
  };
  const ok = await saveSettingsToDb(QR_SETTINGS_DOC, sanitized);
  if (!ok) return null;
  cacheQrConfig(sanitized);
  return sanitized;
}

export async function resetQrConfig() {
  return saveQrConfig(DEFAULT_QR_CONFIG);
}

/**
 * Generate VietQR or Custom QR URL
 * @param {Object} config - QR config object
 * @param {number} amountVnd - Total order amount in VND
 * @param {string} orderId - Order identifier
 * @returns {string} Image source URL for QR code
 */
export function generateQrUrl(config, amountVnd, orderId) {
  const cfg = config || DEFAULT_QR_CONFIG;

  if (cfg.mode === 'custom_image' && cfg.customQrImage) {
    return cfg.customQrImage;
  }

  const cleanAcc = (cfg.accountNumber || '888866889999').replace(/[^0-9a-zA-Z]/g, '');
  const bank = cfg.bankCode || 'MB';
  const template = cfg.qrTemplate || 'compact2';
  const amount = Math.max(0, parseInt(amountVnd, 10) || 0);
  const addInfo = encodeURIComponent(`${cfg.notePrefix || 'PTCG'} ${orderId || 'ORDER'}`);
  const accountName = encodeURIComponent(cfg.accountName || 'POINT TCG STORE');

  return `https://img.vietqr.io/image/${bank}-${cleanAcc}-${template}.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
}
