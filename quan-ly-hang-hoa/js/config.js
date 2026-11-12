// =====================================================================
// File: js/config.js
// Đường dẫn: chi tiêu/js/config.js
// Mục đích: Cấu hình chung của cửa hàng & ứng dụng (sửa tại đây,
//           không phải tìm trong từng file).
// =====================================================================

// UID của tài khoản admin duy nhất (kiba14123@gmail.com).
// Dùng để chặn sớm ở giao diện; bảo mật THẬT vẫn nằm ở firestore.rules.
export const OWNER_UID = "0PETfvFBcqSQovsOIHC9FhOvVZb2";

// TODO: Sửa thông tin cửa hàng — dùng khi in hoá đơn và xuất PDF/Excel
export const STORE_INFO = Object.freeze({
  name: "CỬA HÀNG CỦA TÔI",
  address: "Số 1, Đường ABC, Quận XYZ, TP. HCM",
  phone: "0900 000 000",
  email: "",
  taxCode: "", // mã số thuế (nếu có)
  invoiceFooter: "Cảm ơn quý khách và hẹn gặp lại!"
});

export const APP_CONFIG = Object.freeze({
  appName: "Quản lý hàng hoá",
  currency: "VND",
  currencySymbol: "đ", // ký hiệu hiển thị: "đ", "₫" hoặc "VNĐ"
  locale: "vi-VN",

  // Phân trang
  pageSize: 10,
  pageSizeOptions: [10, 20, 50],

  // Cảnh báo
  slowMovingDays: 60, // không bán được trong 60 ngày là "tồn lâu"

  // Ảnh sản phẩm
  // Cách C: ảnh nén thành base64, lưu ở collection product_images/{productId}
  // (sản phẩm chỉ giữ 1 ảnh thu nhỏ thumbnailUrl để danh sách tải nhanh).
  // Lý do: project đang ở gói Spark (miễn phí) — Firebase Storage cần gói Blaze.
  imageStorageMode: "firestore",
  maxImagesPerProduct: 3,
  maxImageSizeMB: 2, // dung lượng tối đa mỗi ảnh GỐC người dùng chọn
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],

  // --- Tối ưu dung lượng ---
  // Ảnh đầy đủ (xem chi tiết): chỉ tải khi mở chi tiết/sửa sản phẩm
  imageMaxDimension: 1024, // cạnh dài nhất (px)
  imageCompressedMaxMB: 0.15, // ~150KB/ảnh -> 3 ảnh vẫn dư xa giới hạn 1MB/document
  imageQuality: 0.78,
  // Ảnh thu nhỏ: nằm trong document sản phẩm nên tải cùng MỌI danh sách,
  // ô tìm kiếm, cảnh báo... -> giữ thật nhỏ để trang chạy nhanh
  thumbnailMaxDimension: 240, // đủ nét cho ô 44px và card lưới
  thumbnailMaxKB: 12,
  thumbnailQuality: 0.7,

  // Tiền tố số phiếu
  importCodePrefix: "PN",
  invoiceCodePrefix: "HD"
});

// Danh sách đơn vị tính gợi ý ở form sản phẩm
export const UNIT_SUGGESTIONS = Object.freeze([
  "cái", "chiếc", "hộp", "gói", "chai", "lon", "thùng",
  "kg", "g", "lít", "ml", "mét", "bộ", "đôi", "cuộn", "túi"
]);
