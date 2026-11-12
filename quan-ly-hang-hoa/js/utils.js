// =====================================================================
// File: js/utils.js
// Đường dẫn: chi tiêu/js/utils.js
// Mục đích: Hàm tiện ích dùng chung: toast, hộp xác nhận, định dạng
//           tiền/ngày, chống XSS, dịch lỗi Firebase sang tiếng Việt.
// Yêu cầu: trang HTML phải nạp Bootstrap 5 bundle (window.bootstrap).
// =====================================================================

import { APP_CONFIG } from "./config.js";
import { Timestamp } from "./firebase.js";

// ---------------------------------------------------------------------
// TOAST THÔNG BÁO (Bootstrap)
// type: "success" | "danger" | "warning" | "info"
// ---------------------------------------------------------------------
const TOAST_ICONS = {
  success: "bi-check-circle-fill",
  danger: "bi-x-circle-fill",
  warning: "bi-exclamation-triangle-fill",
  info: "bi-info-circle-fill"
};

function getToastContainer() {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container position-fixed top-0 end-0 p-3";
    container.style.zIndex = "1100";
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = "success", delay = 3500) {
  const container = getToastContainer();
  const toastElement = document.createElement("div");
  const textClass = type === "warning" ? "text-dark" : "text-white";
  toastElement.className = `toast align-items-center border-0 bg-${type} ${textClass}`;
  toastElement.setAttribute("role", "alert");
  toastElement.setAttribute("aria-live", "assertive");
  toastElement.setAttribute("aria-atomic", "true");
  toastElement.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi ${TOAST_ICONS[type] || TOAST_ICONS.info} me-2"></i>${escapeHtml(message)}
      </div>
      <button type="button" class="btn-close ${type === "warning" ? "" : "btn-close-white"} me-2 m-auto"
              data-bs-dismiss="toast" aria-label="Đóng"></button>
    </div>`;
  container.appendChild(toastElement);
  const toast = new bootstrap.Toast(toastElement, { delay });
  toastElement.addEventListener("hidden.bs.toast", () => toastElement.remove());
  toast.show();
}

// Hiển thị lỗi thân thiện + log chi tiết ra console để debug
export function showError(error, fallbackMessage = "Đã xảy ra lỗi, vui lòng thử lại.") {
  console.error(error);
  showToast(getFriendlyErrorMessage(error, fallbackMessage), "danger", 5000);
}

// ---------------------------------------------------------------------
// HỘP THOẠI XÁC NHẬN (Promise) — thay cho window.confirm()
// Dùng: if (await confirmDialog("Xoá sản phẩm này?")) { ... }
// ---------------------------------------------------------------------
export function confirmDialog(message, {
  title = "Xác nhận",
  confirmText = "Đồng ý",
  cancelText = "Huỷ",
  confirmClass = "btn-danger"
} = {}) {
  return new Promise((resolve) => {
    const modalElement = document.createElement("div");
    modalElement.className = "modal fade";
    modalElement.tabIndex = -1;
    modalElement.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-question-circle me-2"></i>${escapeHtml(title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
          </div>
          <div class="modal-body">${escapeHtml(message)}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${escapeHtml(cancelText)}</button>
            <button type="button" class="btn ${confirmClass}" data-action="confirm">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalElement);
    const modal = new bootstrap.Modal(modalElement);
    let confirmed = false;
    modalElement.querySelector('[data-action="confirm"]').addEventListener("click", () => {
      confirmed = true;
      modal.hide();
    });
    modalElement.addEventListener("hidden.bs.modal", () => {
      modalElement.remove();
      resolve(confirmed);
    });
    modal.show();
  });
}

// ---------------------------------------------------------------------
// HỘP THOẠI NHẬP LÝ DO (Promise) — trả về chuỗi đã nhập, hoặc null nếu huỷ
// Dùng: const reason = await promptDialog("Lý do huỷ phiếu?");
// ---------------------------------------------------------------------
export function promptDialog(message, {
  title = "Nhập thông tin",
  placeholder = "",
  confirmText = "Xác nhận",
  confirmClass = "btn-danger",
  required = true,
  maxLength = 500
} = {}) {
  return new Promise((resolve) => {
    const modalElement = document.createElement("div");
    modalElement.className = "modal fade";
    modalElement.tabIndex = -1;
    modalElement.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <form class="modal-content" novalidate>
          <div class="modal-header">
            <h5 class="modal-title">${escapeHtml(title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
          </div>
          <div class="modal-body">
            <label class="form-label" for="promptDialogInput">${escapeHtml(message)}</label>
            <textarea class="form-control" id="promptDialogInput" rows="3" maxlength="${maxLength}"
                      placeholder="${escapeHtml(placeholder)}" ${required ? "required" : ""}></textarea>
            <div class="invalid-feedback">Vui lòng nhập nội dung.</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
            <button type="submit" class="btn ${confirmClass}">${escapeHtml(confirmText)}</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modalElement);
    const modal = new bootstrap.Modal(modalElement);
    const form = modalElement.querySelector("form");
    const textarea = modalElement.querySelector("textarea");
    let result = null;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      textarea.setCustomValidity(required && !textarea.value.trim() ? "required" : "");
      form.classList.add("was-validated");
      if (!form.checkValidity()) return;
      result = textarea.value.trim();
      modal.hide();
    });
    modalElement.addEventListener("shown.bs.modal", () => textarea.focus());
    modalElement.addEventListener("hidden.bs.modal", () => {
      modalElement.remove();
      resolve(result);
    });
    modal.show();
  });
}

// ---------------------------------------------------------------------
// TRẠNG THÁI ĐANG TẢI CHO NÚT BẤM (chống bấm 2 lần khi đang lưu)
// ---------------------------------------------------------------------
export function setButtonLoading(button, isLoading, loadingText = "Đang xử lý...") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${escapeHtml(loadingText)}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

// ---------------------------------------------------------------------
// CHỐNG XSS: luôn escape dữ liệu người dùng trước khi chèn vào innerHTML
// ---------------------------------------------------------------------
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------
// ĐỊNH DẠNG SỐ / TIỀN
// ---------------------------------------------------------------------
// Tiền Việt Nam: số nguyên đồng, dấu chấm ngăn cách hàng nghìn, ký hiệu "đ"
// Ví dụ: 1250000 -> "1.250.000 đ"   (đổi ký hiệu ở APP_CONFIG.currencySymbol)
const moneyFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat(APP_CONFIG.locale, { maximumFractionDigits: 2 });

export function formatCurrency(amount) {
  const value = Math.round(Number(amount) || 0);
  // \u00a0 = dấu cách không xuống dòng: số và "đ" luôn nằm cùng 1 dòng
  return `${moneyFormatter.format(value)}\u00a0${APP_CONFIG.currencySymbol}`;
}

// ---------------------------------------------------------------------
// Ô NHẬP TIỀN (class "money-input"): gõ 1250000 -> tự hiện "1.250.000"
// Chỉ nhận chữ số (tiền Việt không có số lẻ), giữ đúng vị trí con trỏ.
// Dùng: <input type="text" inputmode="numeric" class="form-control money-input">
// ---------------------------------------------------------------------
const MAX_MONEY_DIGITS = 13; // tối đa 9.999.999.999.999 đ

// 1250000 -> "1.250.000" ; "" / null -> ""
export function formatMoneyInputValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const digits = String(Math.max(Math.round(Number(value) || 0), 0));
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "1.250.000" -> 1250000 ; "" -> NaN (để biết người dùng chưa nhập)
export function parseMoney(text) {
  const digits = String(text ?? "").replace(/\D/g, "");
  return digits === "" ? NaN : Number(digits);
}

function handleMoneyInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.classList.contains("money-input")) return;

  const caretPosition = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = input.value.slice(0, caretPosition).replace(/\D/g, "").length;
  const digits = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_MONEY_DIGITS);
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (formatted === input.value) return;

  input.value = formatted;
  // Đặt lại con trỏ sau đúng số chữ số đã gõ trước nó
  let newCaret = 0;
  let digitCount = 0;
  while (newCaret < formatted.length && digitCount < digitsBeforeCaret) {
    if (/\d/.test(formatted[newCaret])) digitCount += 1;
    newCaret += 1;
  }
  input.setSelectionRange(newCaret, newCaret);
}

// Gọi 1 lần cho mỗi trang. Lắng nghe ở pha "capture" nên định dạng xong
// TRƯỚC khi code của trang đọc giá trị; áp dụng cả cho ô tạo động (giỏ hàng).
let moneyInputsEnabled = false;
export function enableMoneyInputs() {
  if (moneyInputsEnabled) return;
  moneyInputsEnabled = true;
  document.addEventListener("input", handleMoneyInput, true);
}

export function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0);
}

// Chuyển chuỗi người dùng nhập ("1.250.000", "1,5") thành số. Trả NaN nếu sai.
export function parseNumber(input) {
  if (typeof input === "number") return input;
  if (input === null || input === undefined) return NaN;
  const text = String(input).trim();
  if (text === "") return NaN;
  // Bỏ dấu chấm phân cách hàng nghìn, đổi dấu phẩy thập phân thành chấm
  const normalized = text.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : NaN;
}

// ---------------------------------------------------------------------
// NGÀY GIỜ — chấp nhận Timestamp Firestore, Date, chuỗi, hoặc null
// ---------------------------------------------------------------------
export function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp || typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatDate(value) {
  const date = toJsDate(value);
  if (!date) return "—";
  return date.toLocaleDateString(APP_CONFIG.locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value) {
  const date = toJsDate(value);
  if (!date) return "—";
  return date.toLocaleString(APP_CONFIG.locale, {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

// Date -> "YYYY-MM-DD" theo giờ địa phương (dùng cho <input type="date">)
export function toDateInputValue(value) {
  const date = toJsDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// "YYYY-MM-DD" -> Date 00:00 giờ địa phương (tránh lệch múi giờ của new Date("YYYY-MM-DD"))
export function fromDateInputValue(text) {
  if (!text) return null;
  const [year, month, day] = text.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

// Số ngày từ hôm nay đến ngày đích (âm = đã quá hạn)
export function daysUntil(value) {
  const date = toJsDate(value);
  if (!date) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(date) - startOfDay(new Date())) / msPerDay);
}

// ---------------------------------------------------------------------
// KHÁC
// ---------------------------------------------------------------------
export function debounce(callback, waitMs = 300) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => callback(...args), waitMs);
  };
}

// Chuẩn hoá chuỗi để tìm kiếm không dấu: "Bánh Mì" -> "banh mi"
export function normalizeSearchText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

// Sinh mảng từ khoá tìm kiếm (lưu vào field searchKeywords) để tìm bằng
// array-contains — Firestore không có tìm kiếm toàn văn.
// Ví dụ "Bánh mì" -> ["b","ba","ban","banh","m","mi","banh ","banh m","banh mi"]
export function buildSearchKeywords(...texts) {
  const keywords = new Set();
  texts.forEach((text) => {
    const normalized = normalizeSearchText(text).replace(/\s+/g, " ");
    if (!normalized) return;
    // Tiền tố của từng từ: gõ "mi" vẫn tìm ra "Bánh mì"
    normalized.split(" ").forEach((word) => {
      for (let index = 1; index <= Math.min(word.length, 20); index++) {
        keywords.add(word.slice(0, index));
      }
    });
    // Tiền tố của cả cụm (chỉ khi có nhiều từ): gõ "banh mi" tìm ra "Bánh mì thịt"
    if (normalized.includes(" ")) {
      for (let index = 1; index <= Math.min(normalized.length, SEARCH_PHRASE_MAX_LENGTH); index++) {
        keywords.add(normalized.slice(0, index));
      }
    }
  });
  return [...keywords].slice(0, 200);
}

// Độ dài tối đa của cụm từ tìm kiếm (giữ mảng searchKeywords gọn -> tải nhanh)
const SEARCH_PHRASE_MAX_LENGTH = 30;

// Chuẩn hoá từ khoá người dùng gõ vào ô tìm kiếm để so với searchKeywords
export function toSearchToken(text) {
  return normalizeSearchText(text).replace(/\s+/g, " ").slice(0, SEARCH_PHRASE_MAX_LENGTH);
}

// Lấy tham số trên URL: getQueryParam("id")
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ---------------------------------------------------------------------
// DỊCH MÃ LỖI FIREBASE SANG TIẾNG VIỆT
// ---------------------------------------------------------------------
const FIREBASE_ERROR_MESSAGES = {
  // Auth
  "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
  "auth/invalid-email": "Email không hợp lệ.",
  "auth/user-disabled": "Tài khoản đã bị vô hiệu hoá.",
  "auth/user-not-found": "Không tìm thấy tài khoản.",
  "auth/wrong-password": "Mật khẩu không đúng.",
  "auth/too-many-requests": "Bạn đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.",
  "auth/network-request-failed": "Không có kết nối mạng. Vui lòng kiểm tra Internet.",
  "auth/missing-password": "Vui lòng nhập mật khẩu.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "firebaseConfig chưa đúng (apiKey sai). Kiểm tra js/firebase.js.",
  // Firestore
  "permission-denied": "Bạn không có quyền thực hiện thao tác này (kiểm tra Security Rules / UID).",
  "unavailable": "Mất kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
  "not-found": "Dữ liệu không tồn tại hoặc đã bị xoá.",
  "already-exists": "Dữ liệu đã tồn tại.",
  "failed-precondition": "Thiếu index Firestore hoặc dữ liệu đã thay đổi. Xem console để biết chi tiết.",
  "aborted": "Dữ liệu đang được cập nhật bởi thao tác khác. Vui lòng thử lại.",
  "deadline-exceeded": "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
  "resource-exhausted": "Đã vượt hạn mức sử dụng Firebase.",
  "unauthenticated": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  // Storage
  "storage/unauthorized": "Không có quyền tải ảnh lên (kiểm tra storage.rules, dung lượng, định dạng).",
  "storage/canceled": "Đã huỷ tải ảnh lên.",
  "storage/quota-exceeded": "Đã hết dung lượng lưu trữ ảnh.",
  "storage/retry-limit-exceeded": "Mạng chập chờn, tải ảnh thất bại. Vui lòng thử lại.",
  "storage/object-not-found": "Ảnh không còn tồn tại."
};

export function getFriendlyErrorMessage(error, fallbackMessage = "Đã xảy ra lỗi, vui lòng thử lại.") {
  if (!error) return fallbackMessage;
  // Lỗi do chính ứng dụng ném ra (ví dụ: "Không đủ tồn kho") — hiển thị nguyên văn
  if (error.isAppError) return error.message;
  const code = String(error.code || "").replace(/^firestore\//, "");
  return FIREBASE_ERROR_MESSAGES[code] || fallbackMessage;
}

// Tạo lỗi nghiệp vụ có thông điệp thân thiện (dùng trong transaction)
export function createAppError(message) {
  const error = new Error(message);
  error.isAppError = true;
  return error;
}
