// src/utils/productImages.js
import { isStoreFramed } from '../products';
// Nhiều ảnh cho một sản phẩm: product.image là ảnh chính, product.gallery là các ảnh phụ.
// Ảnh lưu dạng data URL ngay trong document Firestore (giới hạn 1MB / sản phẩm) nên phải nén nhỏ.

export const MAX_GALLERY_IMAGES = 8;
// Chừa chỗ cho các trường khác trong document (giới hạn Firestore là 1 048 576 byte)
export const PRODUCT_DOC_BUDGET = 950 * 1024;

// media: product_media/{id} (ảnh gốc) nếu đã tải; nếu chưa thì dùng ảnh thu nhỏ trong products/{id}.
// Sản phẩm cũ chưa tách ảnh vẫn có gallery ngay trong products/{id}.
export function getProductImages(product, media = null) {
  if (!product) return [];
  if (media?.image) return [media.image, ...(media.gallery || [])].filter(Boolean);
  const extra = Array.isArray(product.thumbs) && product.thumbs.length
    ? product.thumbs
    : (Array.isArray(product.gallery) ? product.gallery : []);
  return [product.image, ...extra].filter(Boolean);
}

// Số ảnh thu nhỏ của ảnh phụ giữ trong products/{id} để thẻ sản phẩm trình chiếu
export const MAX_CARD_THUMBS = 3;

// Thu nhỏ ảnh (kể cả ảnh SVG có khung) thành JPEG cạnh dài maxDim để hiển thị ở trang chủ.
// Ảnh vốn đã nhỏ hoặc không vẽ được lên canvas (link ngoài chặn CORS) thì giữ nguyên.
export function makeThumbnail(src, { maxDim = 400, quality = 0.72, keepUnder = 40 * 1024 } = {}) {
  return new Promise((resolve) => {
    if (!src || typeof src !== 'string' || src.length <= keepUnder) {
      resolve(src || '');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(src);
    img.onload = () => {
      try {
        // SVG khai báo width="100%" bị trình duyệt coi là 150×150 → lấy kích thước thật từ viewBox
        const vb = svgViewBox(src);
        const w = vb ? vb.w : img.naturalWidth || maxDim;
        const h = vb ? vb.h : img.naturalHeight || maxDim;
        // Ảnh vector vẽ được ở mọi cỡ; ảnh chụp thì không phóng to
        const scale = vb ? maxDim / Math.max(w, h) : Math.min(1, maxDim / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out.length < src.length ? out : src);
      } catch {
        resolve(src);
      }
    };
    img.src = src;
  });
}

function svgViewBox(src) {
  if (!src.startsWith('data:image/svg')) return null;
  try {
    const body = src.slice(src.indexOf(',') + 1);
    const text = src.includes(';base64,') ? atob(body) : decodeURIComponent(body.slice(0, 2000));
    const m = text.match(/viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    return m ? { w: parseFloat(m[1]), h: parseFloat(m[2]) } : null;
  } catch {
    return null;
  }
}

// Chuẩn bị dữ liệu lưu: ảnh thu nhỏ cho products/{id}, ảnh gốc cho product_media/{id}
export async function splitProductImages(fullImage, gallery = []) {
  const [image, ...thumbs] = await Promise.all([
    makeThumbnail(fullImage),
    // Ảnh phụ trên thẻ sản phẩm nhỏ hơn, nén mạnh hơn: chỉ để trình chiếu
    ...gallery.slice(0, MAX_CARD_THUMBS).map((g) => makeThumbnail(g, { maxDim: 320, quality: 0.62, keepUnder: 24 * 1024 }))
  ]);
  return {
    // framed: ảnh gốc đã có khung shop → trang chi tiết không vẽ thêm khung (ảnh thu nhỏ là JPEG, không nhận ra được)
    productFields: { image, thumbs, gallery: [], hasMedia: true, mediaCount: 1 + gallery.length, framed: isStoreFramed(fullImage), frameColor: 'blue' },
    media: { image: fullImage, gallery }
  };
}

// Ước lượng dung lượng document sản phẩm khi lưu lên Firestore
export function estimateDocBytes(obj) {
  return new Blob([JSON.stringify(obj)]).size;
}

export const formatKb = (bytes) => `${Math.round(bytes / 1024)} KB`;

// Nén ảnh về JPEG cạnh dài tối đa maxDim. SVG nhỏ giữ nguyên.
export function compressImageFile(file, { maxDim = 900, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('not-image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = (e) => {
      const raw = e.target.result;
      if (file.type === 'image/svg+xml' && file.size < 150 * 1024) {
        resolve(raw);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('decode-failed'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        // Nền trắng cho ảnh PNG trong suốt khi đổi sang JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}
