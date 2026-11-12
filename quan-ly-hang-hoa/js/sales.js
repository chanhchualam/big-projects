// =====================================================================
// File: js/sales.js
// Đường dẫn: chi tiêu/js/sales.js
// Mục đích: Trang Bán hàng
//   - Giỏ hàng: chọn hàng bằng ô tìm kiếm / máy quét, sửa giá, số lượng.
//     Giao diện chặn bán vượt tồn; stock.createInvoice kiểm tra lại
//     bằng tồn kho mới nhất trên server trong transaction.
//   - Giảm giá, phương thức thanh toán,
//     tính tiền thừa, in hoá đơn sau khi thanh toán.
//   - Danh sách hoá đơn: lọc số HĐ / khoảng ngày, phân trang, realtime,
//     xem chi tiết, in lại, huỷ hoá đơn (cộng lại tồn kho).
// =====================================================================

import { db, COLLECTIONS, collection, where, orderBy, Timestamp } from "./firebase.js";
import {
  escapeHtml,
  showToast,
  showError,
  setButtonLoading,
  confirmDialog,
  promptDialog,
  debounce,
  formatCurrency,
  formatNumber,
  formatDateTime,
  fromDateInputValue,
  startOfDay,
  endOfDay,
  parseMoney,
  formatMoneyInputValue
} from "./utils.js";
import { PaginatedList, renderPagination } from "./paginated-list.js";
import { createSearchPicker, renderProductSuggestion } from "./search-picker.js";
import { createInvoice, cancelInvoice } from "./stock.js";

const $ = (id) => document.getElementById(id);

export const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
  card: "Thẻ"
};

// Giỏ hàng: { productId, code, name, unit, stock, quantity, salePrice, costPrice }
let cart = [];
const currentInvoices = new Map();
let invoiceList;
let lastPageState = { docs: [], pageIndex: 0, hasNext: false, hasPrev: false };
let totalCount = null;

export function initSalesPage() {
  createSearchPicker({
    input: $("saleProductSearch"),
    collectionName: COLLECTIONS.PRODUCTS,
    renderItem: (product) => renderProductSuggestion(product),
    isDisabled: (product) => product.stock <= 0, // hết hàng thì không cho chọn
    onSelect: (product, productId) => addToCart(productId, product)
  });

  bindCartEvents();
  bindPaymentEvents();
  bindCheckout();
  bindKeyboardShortcuts();
  renderCart();

  setupInvoiceList();
  bindInvoiceListEvents();

  $("saleProductSearch").focus();
}

// ------------------------------- Giỏ hàng -------------------------------
function addToCart(productId, product) {
  const existingLine = cart.find((line) => line.productId === productId);
  if (existingLine) {
    if (existingLine.quantity + 1 > product.stock) {
      showToast(`"${product.name}" chỉ còn ${formatNumber(product.stock)} ${product.unit}.`, "warning");
      return;
    }
    existingLine.quantity += 1;
    existingLine.stock = product.stock;
  } else {
    cart.push({
      productId,
      code: product.code,
      name: product.name,
      unit: product.unit,
      stock: product.stock,
      quantity: 1,
      salePrice: product.salePrice,
      costPrice: product.costPrice
    });
  }
  renderCart();
}

function getLineError(line) {
  if (!(line.quantity > 0)) return "Số lượng phải > 0";
  if (line.quantity > line.stock) return `Chỉ còn ${formatNumber(line.stock)} ${line.unit}`;
  if (!(line.salePrice >= 0)) return "Đơn giá phải ≥ 0";
  return "";
}

function renderCart() {
  const tableBody = $("cartBody");
  if (cart.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="5"><div class="empty-state py-5"><i class="bi bi-cart"></i>
        Giỏ hàng trống — tìm hàng ở ô phía trên (phím tắt F2)
      </div></td></tr>`;
  } else {
    tableBody.innerHTML = cart.map((line, index) => {
      const error = getLineError(line);
      return `
        <tr data-product-id="${escapeHtml(line.productId)}">
          <td>
            <div class="fw-semibold">${index + 1}. ${escapeHtml(line.name)}</div>
            <div class="small text-muted">${escapeHtml(line.code)} · Tồn: ${formatNumber(line.stock)} ${escapeHtml(line.unit)}</div>
          </td>
          <td><input type="text" inputmode="numeric" autocomplete="off" class="form-control form-control-sm text-end money-input" data-field="salePrice"
                     value="${formatMoneyInputValue(line.salePrice)}" aria-label="Đơn giá"></td>
          <td>
            <input type="number" class="form-control form-control-sm ${error ? "is-invalid" : ""}" data-field="quantity"
                   min="0.001" max="${line.stock}" step="any" value="${line.quantity}" aria-label="Số lượng">
            <div class="invalid-feedback" data-role="lineError">${escapeHtml(error)}</div>
          </td>
          <td class="text-end text-money fw-semibold" data-role="lineTotal">${formatCurrency(line.quantity * line.salePrice)}</td>
          <td class="text-end">
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove" aria-label="Xoá khỏi giỏ"><i class="bi bi-x-lg"></i></button>
          </td>
        </tr>`;
    }).join("");
  }
  updateTotals();
}

function calculateTotals() {
  const subtotal = cart.reduce((sum, line) => sum + Math.round((line.quantity || 0) * (line.salePrice || 0)), 0);
  const discountInput = Math.max(parseMoney($("saleDiscount").value) || 0, 0);
  const discount = Math.min(discountInput, subtotal);
  return { subtotal, discount, total: subtotal - discount };
}

function updateTotals() {
  const { subtotal, total } = calculateTotals();
  $("cartItemCount").textContent = formatNumber(cart.reduce((sum, line) => sum + (line.quantity || 0), 0));
  $("cartSubtotal").textContent = formatCurrency(subtotal);
  $("cartTotal").textContent = formatCurrency(total);
  renderQuickCashButtons(total);
  updateChange();
  $("checkoutButton").disabled = cart.length === 0 || cart.some((line) => getLineError(line));
}

function bindCartEvents() {
  const tableBody = $("cartBody");

  tableBody.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-field]");
    if (!input) return;
    const row = input.closest("tr");
    const line = cart.find((item) => item.productId === row.dataset.productId);
    if (!line) return;
    // Ô đơn giá là ô tiền ("1.250.000"), ô số lượng là số thường
    line[input.dataset.field] = input.classList.contains("money-input") ? parseMoney(input.value) : Number(input.value);

    // Cập nhật tại chỗ (không vẽ lại bảng để không mất con trỏ khi đang gõ)
    const error = getLineError(line);
    const quantityInput = row.querySelector('input[data-field="quantity"]');
    quantityInput.classList.toggle("is-invalid", Boolean(error));
    row.querySelector('[data-role="lineError"]').textContent = error;
    row.querySelector('[data-role="lineTotal"]').textContent = formatCurrency((line.quantity || 0) * (line.salePrice || 0));
    updateTotals();
  });

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-action="remove"]');
    if (!button) return;
    const productId = button.closest("tr").dataset.productId;
    cart = cart.filter((line) => line.productId !== productId);
    renderCart();
  });

  $("saleDiscount").addEventListener("input", updateTotals);

  $("clearCartButton").addEventListener("click", async () => {
    if (cart.length && !(await confirmDialog("Xoá toàn bộ giỏ hàng?", { confirmText: "Xoá giỏ" }))) return;
    resetSale();
  });
}

// ------------------------------- Thanh toán -------------------------------
function getPaymentMethod() {
  return document.querySelector('input[name="paymentMethod"]:checked').value;
}

function renderQuickCashButtons(total) {
  const container = $("quickCashButtons");
  if (total <= 0) {
    container.innerHTML = "";
    return;
  }
  // Gợi ý: đúng số tiền + các mệnh giá làm tròn lên
  const suggestions = new Set([total]);
  [10000, 50000, 100000, 500000].forEach((step) => suggestions.add(Math.ceil(total / step) * step));
  container.innerHTML = [...suggestions].sort((a, b) => a - b).slice(0, 4).map((amount) => `
    <button type="button" class="btn btn-sm btn-outline-secondary" data-amount="${amount}">${formatNumber(amount)}</button>`).join("");
}

function updateChange() {
  const { total } = calculateTotals();
  const amountPaid = parseMoney($("amountPaid").value) || 0;
  const change = amountPaid - total;
  const changeElement = $("changeAmount");
  changeElement.textContent = $("amountPaid").value === "" ? formatCurrency(0) : formatCurrency(change);
  changeElement.classList.toggle("text-danger", $("amountPaid").value !== "" && change < 0);
}

function bindPaymentEvents() {
  document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      $("cashBox").classList.toggle("d-none", getPaymentMethod() !== "cash");
    });
  });
  $("amountPaid").addEventListener("input", updateChange);
  $("quickCashButtons").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-amount]");
    if (!button) return;
    $("amountPaid").value = formatMoneyInputValue(button.dataset.amount);
    updateChange();
  });
}

function resetSale() {
  cart = [];
  $("saleDiscount").value = 0;
  $("amountPaid").value = "";
  $("saleNote").value = "";
  $("payCash").checked = true;
  $("cashBox").classList.remove("d-none");
  renderCart();
  $("saleProductSearch").focus();
}

function bindCheckout() {
  const checkoutButton = $("checkoutButton");

  $("saleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (checkoutButton.disabled) return;

    const invalidLine = cart.find((line) => getLineError(line));
    if (cart.length === 0 || invalidLine) {
      showToast(invalidLine ? `"${invalidLine.name}": ${getLineError(invalidLine)}` : "Giỏ hàng trống.", "warning");
      return;
    }

    const { discount, total } = calculateTotals();
    const paymentMethod = getPaymentMethod();
    // Không nhập tiền khách đưa = khách trả đúng số tiền
    const amountPaidInput = $("amountPaid").value;
    const amountPaid = paymentMethod === "cash" && amountPaidInput !== "" ? parseMoney(amountPaidInput) : total;
    if (paymentMethod === "cash" && amountPaid < total) {
      showToast(`Tiền khách đưa còn thiếu ${formatCurrency(total - amountPaid)}.`, "warning");
      $("amountPaid").focus();
      return;
    }

    // Mở sẵn tab in NGAY khi bấm (nếu mở sau khi await, trình duyệt sẽ chặn popup)
    const printWindow = $("printAfterSale").checked ? window.open("", "_blank") : null;

    setButtonLoading(checkoutButton, true, "Đang thanh toán...");
    try {
      const result = await createInvoice({
        customerId: null,
        customerName: "Khách lẻ",
        customerPhone: "",
        lines: cart.map((line) => ({ productId: line.productId, quantity: line.quantity, salePrice: line.salePrice })),
        discount,
        paymentMethod,
        amountPaid,
        note: $("saleNote").value.trim()
      });

      showToast(`Đã thanh toán hoá đơn ${result.code} — ${formatCurrency(result.total)}.`);
      if (printWindow) printWindow.location.href = `invoice-print.html?id=${encodeURIComponent(result.id)}&print=1`;
      resetSale();
      invoiceList.refreshCount();
    } catch (error) {
      if (printWindow) printWindow.close();
      showError(error, "Thanh toán thất bại.");
    } finally {
      setButtonLoading(checkoutButton, false);
      updateTotals();
    }
  });
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "F2") {
      event.preventDefault();
      $("saleProductSearch").focus();
    }
    if (event.key === "F9") {
      event.preventDefault();
      $("saleForm").requestSubmit();
    }
  });
}

// ------------------------------- Danh sách hoá đơn -------------------------------
function getInvoiceConstraints() {
  const code = $("filterInvoiceCode").value.trim().toUpperCase();
  if (code) return [where("code", "==", code)];

  const constraints = [];
  const fromDate = fromDateInputValue($("filterInvoiceFrom").value);
  const toDate = fromDateInputValue($("filterInvoiceTo").value);
  if (fromDate) constraints.push(where("invoiceDate", ">=", Timestamp.fromDate(startOfDay(fromDate))));
  if (toDate) constraints.push(where("invoiceDate", "<=", Timestamp.fromDate(endOfDay(toDate))));
  constraints.push(orderBy("invoiceDate", "desc"));
  return constraints;
}

function setupInvoiceList() {
  invoiceList = new PaginatedList({
    collectionRef: collection(db, COLLECTIONS.INVOICES),
    getConstraints: getInvoiceConstraints,
    pageSize: Number($("invoicePageSize").value),
    onPage: (pageState) => {
      lastPageState = pageState;
      renderInvoiceRows(pageState.docs);
      drawPagination();
    },
    onCount: (count) => {
      totalCount = count;
      drawPagination();
    },
    onError: (error) => {
      $("invoiceListBody").innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Không tải được danh sách</td></tr>`;
      showError(error, "Không tải được danh sách hoá đơn.");
    }
  });
  invoiceList.reload();
}

function drawPagination() {
  renderPagination($("invoicePagination"), lastPageState, totalCount, invoiceList.pageSize, {
    onPrev: () => invoiceList.previousPage(),
    onNext: () => invoiceList.nextPage()
  });
}

function renderInvoiceStatus(status) {
  return status === "cancelled"
    ? `<span class="badge text-bg-secondary">Đã huỷ</span>`
    : `<span class="badge text-bg-success">Hoàn thành</span>`;
}

function renderInvoiceRows(docs) {
  currentInvoices.clear();
  const tableBody = $("invoiceListBody");
  if (docs.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-receipt"></i>Không có hoá đơn nào</div></td></tr>`;
    return;
  }
  tableBody.innerHTML = docs.map((invoiceDoc) => {
    const invoice = invoiceDoc.data({ serverTimestamps: "estimate" });
    currentInvoices.set(invoiceDoc.id, invoice);
    const isCancelled = invoice.status === "cancelled";
    return `
      <tr data-id="${escapeHtml(invoiceDoc.id)}" class="${isCancelled ? "text-muted" : ""}">
        <td class="fw-semibold">${escapeHtml(invoice.code)}</td>
        <td class="text-nowrap small">${formatDateTime(invoice.invoiceDate)}</td>
        <td class="text-center">${formatNumber(invoice.itemCount)}</td>
        <td class="text-end text-money fw-semibold ${isCancelled ? "text-decoration-line-through" : ""}">${formatCurrency(invoice.total)}</td>
        <td class="text-end text-money ${invoice.profit < 0 ? "text-danger" : "text-success"}">${formatCurrency(invoice.profit)}</td>
        <td class="small">${escapeHtml(PAYMENT_METHOD_LABELS[invoice.paymentMethod] || invoice.paymentMethod)}</td>
        <td class="text-center">${renderInvoiceStatus(invoice.status)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline-secondary" type="button" data-action="view" title="Xem" aria-label="Xem"><i class="bi bi-eye"></i></button>
          <a class="btn btn-sm btn-outline-primary" href="invoice-print.html?id=${encodeURIComponent(invoiceDoc.id)}" target="_blank" rel="noopener" title="In" aria-label="In"><i class="bi bi-printer"></i></a>
          ${isCancelled ? "" : `<button class="btn btn-sm btn-outline-danger" type="button" data-action="cancel" title="Huỷ hoá đơn" aria-label="Huỷ hoá đơn"><i class="bi bi-x-circle"></i></button>`}
        </td>
      </tr>`;
  }).join("");
}

function bindInvoiceListEvents() {
  const reload = () => invoiceList.reload();
  $("filterInvoiceCode").addEventListener("input", debounce(reload, 400));
  $("filterInvoiceFrom").addEventListener("change", reload);
  $("filterInvoiceTo").addEventListener("change", reload);
  $("invoicePageSize").addEventListener("change", (event) => invoiceList.setPageSize(Number(event.target.value)));

  const detailModal = new bootstrap.Modal($("invoiceDetailModal"));
  $("invoiceListBody").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const invoiceId = button.closest("tr").dataset.id;
    if (button.dataset.action === "view") showInvoiceDetail(detailModal, invoiceId);
    if (button.dataset.action === "cancel") handleCancelInvoice(invoiceId, button);
  });
}

function showInvoiceDetail(detailModal, invoiceId) {
  const invoice = currentInvoices.get(invoiceId);
  if (!invoice) return;
  $("invoiceDetailTitle").textContent = `Hoá đơn ${invoice.code}`;
  $("invoiceDetailPrint").href = `invoice-print.html?id=${encodeURIComponent(invoiceId)}`;
  $("invoiceDetailBody").innerHTML = `
    <div class="row g-2 mb-3 small">
      <div class="col-sm-6"><span class="text-muted">Thời gian:</span> ${formatDateTime(invoice.invoiceDate)}</div>
      <div class="col-sm-6"><span class="text-muted">Thanh toán:</span> ${escapeHtml(PAYMENT_METHOD_LABELS[invoice.paymentMethod] || "")}</div>
      <div class="col-sm-6"><span class="text-muted">Trạng thái:</span> ${renderInvoiceStatus(invoice.status)}</div>
      ${invoice.note ? `<div class="col-12"><span class="text-muted">Ghi chú:</span> ${escapeHtml(invoice.note)}</div>` : ""}
      ${invoice.status === "cancelled" ? `
        <div class="col-12 text-danger">Huỷ lúc ${formatDateTime(invoice.cancelledAt)} — Lý do: ${escapeHtml(invoice.cancelReason || "—")}</div>` : ""}
    </div>
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead><tr><th>#</th><th>Hàng hoá</th><th class="text-end">SL</th><th class="text-end">Đơn giá</th><th class="text-end">Thành tiền</th><th class="text-end">Giá vốn</th></tr></thead>
        <tbody>
          ${invoice.items.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(item.name)}<div class="small text-muted">${escapeHtml(item.code)}</div></td>
              <td class="text-end">${formatNumber(item.quantity)} ${escapeHtml(item.unit)}</td>
              <td class="text-end">${formatCurrency(item.salePrice)}</td>
              <td class="text-end">${formatCurrency(item.lineTotal)}</td>
              <td class="text-end text-muted">${formatCurrency(item.lineCost)}</td>
            </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr><td colspan="4" class="text-end">Tạm tính</td><td class="text-end">${formatCurrency(invoice.subtotal)}</td><td></td></tr>
          <tr><td colspan="4" class="text-end">Giảm giá</td><td class="text-end">-${formatCurrency(invoice.discount)}</td><td></td></tr>
          <tr><th colspan="4" class="text-end">Tổng cộng</th><th class="text-end">${formatCurrency(invoice.total)}</th><td></td></tr>
          <tr><td colspan="4" class="text-end">Khách đưa / Tiền thừa</td>
              <td class="text-end">${formatCurrency(invoice.amountPaid)} / ${formatCurrency(invoice.changeAmount)}</td><td></td></tr>
          <tr><td colspan="4" class="text-end">Lợi nhuận</td>
              <td class="text-end ${invoice.profit < 0 ? "text-danger" : "text-success"}">${formatCurrency(invoice.profit)}</td><td></td></tr>
        </tfoot>
      </table>
    </div>`;
  detailModal.show();
}

async function handleCancelInvoice(invoiceId, button) {
  const invoice = currentInvoices.get(invoiceId);
  if (!invoice) return;
  const reason = await promptDialog(
    `Huỷ hoá đơn ${invoice.code} (${formatCurrency(invoice.total)})? Hàng sẽ được CỘNG lại vào kho. Lý do huỷ:`,
    { title: "Huỷ hoá đơn", confirmText: "Huỷ hoá đơn", placeholder: "VD: Khách trả lại hàng, bấm nhầm..." }
  );
  if (reason === null) return;

  setButtonLoading(button, true, "");
  try {
    const result = await cancelInvoice(invoiceId, reason);
    const skippedNote = result.skippedProducts.length
      ? ` (bỏ qua hàng đã bị xoá: ${result.skippedProducts.join(", ")})`
      : "";
    showToast(`Đã huỷ hoá đơn ${result.code}, tồn kho đã được cộng lại${skippedNote}.`);
  } catch (error) {
    showError(error, "Không huỷ được hoá đơn.");
    setButtonLoading(button, false);
  }
}
