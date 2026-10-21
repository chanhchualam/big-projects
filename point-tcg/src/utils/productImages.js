// src/utils/productImages.js
// Nhiều ảnh cho một sản phẩm: product.image là ảnh chính, product.gallery là các ảnh phụ.
// Ảnh lưu dạng data URL ngay trong document Firestore (giới hạn 1MB / sản phẩm) nên phải nén nhỏ.

export const MAX_GALLERY_IMAGES = 8;
// Chừa chỗ cho các trường khác trong document (giới hạn Firestore là 1 048 576 byte)
export const PRODUCT_DOC_BUDGET = 950 * 1024;

export function getProductImages(product) {
  if (!product) return [];
  const extra = Array.isArray(product.gallery) ? product.gallery : [];
  return [product.image, ...extra].filter(Boolean);
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
