// =====================================================================
// File: js/lazy-load.js
// Đường dẫn: chi tiêu/js/lazy-load.js
// Mục đích: Tải thư viện nặng KHI CẦN thay vì lúc mở trang
//   - SheetJS (~325KB), jsPDF (~110KB): chỉ tải khi bấm "Xuất Excel/PDF"
//   - browser-image-compression (~20KB): chỉ tải khi chọn ảnh
// Mỗi thư viện chỉ tải 1 lần; gọi lại sẽ dùng chung Promise đã có.
// =====================================================================

export const LIBRARY_URLS = Object.freeze({
  xlsx: "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js",
  jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
  jspdfAutoTable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js",
  imageCompression: "https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js"
});

const loadingScripts = new Map(); // url -> Promise

export function loadScript(url) {
  if (loadingScripts.has(url)) return loadingScripts.get(url);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadingScripts.delete(url); // cho phép thử lại khi mạng ổn định
      script.remove();
      reject(new Error(`Không tải được thư viện: ${url}. Kiểm tra kết nối mạng.`));
    };
    document.head.appendChild(script);
  });

  loadingScripts.set(url, promise);
  return promise;
}

export async function loadXlsx() {
  await loadScript(LIBRARY_URLS.xlsx);
  return window.XLSX;
}

// jspdf-autotable phải nạp SAU jspdf
export async function loadJsPdf() {
  await loadScript(LIBRARY_URLS.jspdf);
  await loadScript(LIBRARY_URLS.jspdfAutoTable);
  return window.jspdf.jsPDF;
}

export async function loadImageCompression() {
  await loadScript(LIBRARY_URLS.imageCompression);
  return window.imageCompression;
}
