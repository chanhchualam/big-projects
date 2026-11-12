// =====================================================================
// File: js/invoice-print.js
// Đường dẫn: chi tiêu/js/invoice-print.js
// Mục đích: Dựng hoá đơn để in từ document invoices/{id}. Hoá đơn đã lưu
//           sẵn tên khách, tên hàng, giá tại thời điểm bán (denormalize)
//           nên chỉ cần ĐỌC 1 DOCUMENT là in được.
// =====================================================================

import { db, COLLECTIONS, doc, getDoc } from "./firebase.js";
import { STORE_INFO, APP_CONFIG } from "./config.js";
import {
  escapeHtml,
  formatCurrency,
  formatNumber,
  formatDateTime,
  getQueryParam,
  showError
} from "./utils.js";

const PAYMENT_METHOD_LABELS = { cash: "Tiền mặt", transfer: "Chuyển khoản", card: "Thẻ" };
const PAPER_STORAGE_KEY = "invoicePaperSize";

export async function initInvoicePrintPage() {
  const container = document.getElementById("receiptContainer");
  const printButton = document.getElementById("printButton");
  document.getElementById("closeButton").addEventListener("click", () => {
    // Tab mở bằng window.open thì đóng được, nếu không thì quay lại trang bán hàng
    window.close();
    setTimeout(() => { window.location.href = "sales.html"; }, 200);
  });
  printButton.addEventListener("click", () => window.print());
  setupPaperSize();

  const invoiceId = getQueryParam("id");
  if (!invoiceId) {
    container.innerHTML = `<div class="alert alert-warning m-4">Thiếu mã hoá đơn trên đường dẫn.</div>`;
    return;
  }

  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.INVOICES, invoiceId));
    if (!snapshot.exists()) {
      container.innerHTML = `<div class="alert alert-warning m-4">Không tìm thấy hoá đơn.</div>`;
      return;
    }
    const invoice = snapshot.data({ serverTimestamps: "estimate" });
    container.innerHTML = renderReceipt(invoice);
    document.title = `Hoá đơn ${invoice.code}`;
    printButton.disabled = false;

    // Mở từ màn hình bán hàng (&print=1) -> tự bật hộp thoại in
    if (getQueryParam("print") === "1") setTimeout(() => window.print(), 300);
  } catch (error) {
    container.innerHTML = `<div class="alert alert-danger m-4">Không tải được hoá đơn.</div>`;
    showError(error, "Không tải được hoá đơn.");
  }
}

// Chọn khổ giấy A5 / K80, nhớ lựa chọn cho lần sau
function setupPaperSize() {
  const savedSize = localStorage.getItem(PAPER_STORAGE_KEY) || "a5";
  const applySize = (size) => {
    document.body.classList.toggle("paper-a5", size === "a5");
    document.body.classList.toggle("paper-k80", size === "k80");
    document.getElementById("pageSizeStyle").textContent = size === "k80"
      ? "@media print { @page { size: 80mm auto; margin: 2mm; } }"
      : "@media print { @page { size: A5; margin: 8mm; } }";
    localStorage.setItem(PAPER_STORAGE_KEY, size);
  };
  document.querySelectorAll('input[name="paperSize"]').forEach((radio) => {
    radio.checked = radio.value === savedSize;
    radio.addEventListener("change", () => applySize(radio.value));
  });
  applySize(savedSize);
}

function renderReceipt(invoice) {
  const isCancelled = invoice.status === "cancelled";
  return `
    <div class="receipt">
      ${isCancelled ? `<div class="cancelled-stamp">HOÁ ĐƠN ĐÃ HUỶ</div>` : ""}
      <div class="text-center mb-2">
        <div class="store-name">${escapeHtml(STORE_INFO.name)}</div>
        <div>${escapeHtml(STORE_INFO.address)}</div>
        <div>ĐT: ${escapeHtml(STORE_INFO.phone)}${STORE_INFO.email ? ` · ${escapeHtml(STORE_INFO.email)}` : ""}</div>
        ${STORE_INFO.taxCode ? `<div>MST: ${escapeHtml(STORE_INFO.taxCode)}</div>` : ""}
      </div>
      <hr class="my-2">
      <div class="text-center fw-bold fs-6 mb-1">HOÁ ĐƠN BÁN HÀNG</div>
      <div class="text-center mb-2">Số: <strong>${escapeHtml(invoice.code)}</strong> · ${formatDateTime(invoice.invoiceDate)}</div>
      ${invoice.customerId ? `<div>Khách hàng: <strong>${escapeHtml(invoice.customerName)}</strong></div>` : ""}
      ${invoice.customerPhone ? `<div>Điện thoại: ${escapeHtml(invoice.customerPhone)}</div>` : ""}

      <table class="items mt-2">
        <thead>
          <tr>
            <th class="text-start">Hàng hoá</th>
            <th class="text-end">SL</th>
            <th class="text-end hide-on-k80">Đơn giá</th>
            <th class="text-end">T.Tiền</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map((item, index) => `
            <tr>
              <td>
                ${index + 1}. ${escapeHtml(item.name)}
                <div class="small text-muted">${formatCurrency(item.salePrice)} / ${escapeHtml(item.unit)}</div>
              </td>
              <td class="text-end">${formatNumber(item.quantity)}</td>
              <td class="text-end hide-on-k80">${formatNumber(item.salePrice)}</td>
              <td class="text-end">${formatNumber(item.lineTotal)}</td>
            </tr>`).join("")}
        </tbody>
      </table>

      <table class="totals mt-2">
        <tr><td>Tạm tính</td><td class="text-end">${formatCurrency(invoice.subtotal)}</td></tr>
        ${invoice.discount > 0 ? `<tr><td>Giảm giá</td><td class="text-end">-${formatCurrency(invoice.discount)}</td></tr>` : ""}
        <tr class="grand"><td>TỔNG CỘNG</td><td class="text-end">${formatCurrency(invoice.total)}</td></tr>
        <tr><td>Thanh toán</td><td class="text-end">${escapeHtml(PAYMENT_METHOD_LABELS[invoice.paymentMethod] || "")}</td></tr>
        ${invoice.paymentMethod === "cash" ? `
          <tr><td>Khách đưa</td><td class="text-end">${formatCurrency(invoice.amountPaid)}</td></tr>
          <tr><td>Tiền thừa</td><td class="text-end">${formatCurrency(invoice.changeAmount)}</td></tr>` : ""}
      </table>

      ${invoice.note ? `<div class="mt-2"><em>Ghi chú: ${escapeHtml(invoice.note)}</em></div>` : ""}
      <hr class="my-2">
      <div class="text-center">${escapeHtml(STORE_INFO.invoiceFooter)}</div>
      <div class="text-center small text-muted mt-1">${escapeHtml(APP_CONFIG.appName)}</div>
    </div>`;
}
