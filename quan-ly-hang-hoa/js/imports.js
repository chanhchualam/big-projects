// =====================================================================
// File: js/imports.js
// Đường dẫn: chi tiêu/js/imports.js
// Mục đích: Trang Nhập kho
//   - Tạo phiếu nhập nhiều dòng hàng -> stock.createImport (transaction,
//     tự cộng tồn kho, ghi stock_logs, sinh số phiếu PNxxxxxx)
//   - Danh sách phiếu nhập: lọc số phiếu / khoảng ngày,
//     phân trang cursor, realtime, xem chi tiết, huỷ phiếu
//   - Mở từ trang Cảnh báo: imports.html?addProduct=<productId>
// =====================================================================

import {
  db,
  COLLECTIONS,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from "./firebase.js";
import {
  escapeHtml,
  showToast,
  showError,
  setButtonLoading,
  promptDialog,
  confirmDialog,
  debounce,
  formatCurrency,
  formatNumber,
  formatDateTime,
  toDateInputValue,
  fromDateInputValue,
  startOfDay,
  endOfDay,
  getQueryParam,
  parseMoney,
  formatMoneyInputValue
} from "./utils.js";
import { PaginatedList, renderPagination } from "./paginated-list.js";
import { createSearchPicker, renderProductSuggestion } from "./search-picker.js";
import { createImport, cancelImport } from "./stock.js";

const $ = (id) => document.getElementById(id);

// Dòng hàng đang nhập: { productId, code, name, unit, stock, quantity, costPrice }
let importLines = [];
const currentImports = new Map(); // id -> phiếu đang hiển thị ở danh sách
let importList;
let lastPageState = { docs: [], pageIndex: 0, hasNext: false, hasPrev: false };
let totalCount = null;

export async function initImportsPage() {
  $("importDate").value = toDateInputValue(new Date());
  $("importDate").max = toDateInputValue(new Date());

  createSearchPicker({
    input: $("importProductSearch"),
    collectionName: COLLECTIONS.PRODUCTS,
    renderItem: (product) => renderProductSuggestion(product),
    onSelect: (product, productId) => addProductLine(productId, product)
  });

  bindCreateForm();
  bindLineEvents();
  renderLines();

  setupImportList();
  bindListFilters();

  // Mở từ trang Cảnh báo: thêm sẵn hàng cần nhập
  const productIdFromUrl = getQueryParam("addProduct");
  if (productIdFromUrl) await addProductById(productIdFromUrl);
}

// --------------------------- Dòng hàng ---------------------------
function addProductLine(productId, product) {
  const existingLine = importLines.find((line) => line.productId === productId);
  if (existingLine) {
    existingLine.quantity += 1;
    showToast(`Đã tăng số lượng "${product.name}" lên ${formatNumber(existingLine.quantity)}.`, "info", 2000);
  } else {
    importLines.push({
      productId,
      code: product.code,
      name: product.name,
      unit: product.unit,
      stock: product.stock,
      quantity: 1,
      costPrice: product.costPrice
    });
  }
  renderLines();
  // Đưa con trỏ vào ô số lượng của dòng vừa thêm
  const row = $("importLinesBody").querySelector(`tr[data-product-id="${CSS.escape(productId)}"] input[data-field="quantity"]`);
  row?.select();
}

async function addProductById(productId) {
  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
    if (!snapshot.exists()) {
      showToast("Không tìm thấy hàng hoá cần nhập.", "warning");
      return;
    }
    addProductLine(snapshot.id, snapshot.data());
  } catch (error) {
    showError(error, "Không tải được hàng hoá.");
  }
}

function renderLines() {
  const tableBody = $("importLinesBody");
  if (importLines.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="6"><div class="empty-state py-4"><i class="bi bi-box-arrow-in-down"></i>
        Tìm và chọn hàng hoá ở ô phía trên để thêm vào phiếu nhập
      </div></td></tr>`;
  } else {
    tableBody.innerHTML = importLines.map((line, index) => `
      <tr data-product-id="${escapeHtml(line.productId)}">
        <td>
          <div class="fw-semibold">${index + 1}. ${escapeHtml(line.name)}</div>
          <div class="small text-muted">${escapeHtml(line.code)} · ${escapeHtml(line.unit)}</div>
        </td>
        <td class="text-center">${formatNumber(line.stock)}</td>
        <td><input type="number" class="form-control form-control-sm" data-field="quantity" min="0.001" step="any"
                   value="${line.quantity}" required aria-label="Số lượng"></td>
        <td><input type="text" inputmode="numeric" autocomplete="off" class="form-control form-control-sm text-end money-input" data-field="costPrice"
                   value="${formatMoneyInputValue(line.costPrice)}" required aria-label="Đơn giá nhập"></td>
        <td class="text-end text-money fw-semibold" data-role="lineTotal">${formatCurrency(line.quantity * line.costPrice)}</td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-danger" data-action="remove" aria-label="Xoá dòng"><i class="bi bi-x-lg"></i></button>
        </td>
      </tr>`).join("");
  }
  updateTotals();
}

function updateTotals() {
  const total = importLines.reduce((sum, line) => sum + (line.quantity || 0) * (line.costPrice || 0), 0);
  $("importLineCount").textContent = formatNumber(importLines.length);
  $("importGrandTotal").textContent = formatCurrency(total);
}

function bindLineEvents() {
  const tableBody = $("importLinesBody");

  // Sửa số lượng / đơn giá -> cập nhật thành tiền ngay (không vẽ lại cả bảng để giữ con trỏ)
  tableBody.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-field]");
    if (!input) return;
    const row = input.closest("tr");
    const line = importLines.find((item) => item.productId === row.dataset.productId);
    if (!line) return;
    // Ô đơn giá là ô tiền ("1.250.000"), ô số lượng là số thường
    line[input.dataset.field] = input.classList.contains("money-input") ? parseMoney(input.value) : Number(input.value);
    row.querySelector('[data-role="lineTotal"]').textContent = formatCurrency((line.quantity || 0) * (line.costPrice || 0));
    updateTotals();
  });

  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-action="remove"]');
    if (!button) return;
    const productId = button.closest("tr").dataset.productId;
    importLines = importLines.filter((line) => line.productId !== productId);
    renderLines();
  });
}

function resetCreateForm() {
  importLines = [];
  $("importForm").reset();
  $("importForm").classList.remove("was-validated");
  $("importDate").value = toDateInputValue(new Date());
  $("importUpdateCost").checked = true;
  renderLines();
}

// --------------------------- Lưu phiếu nhập ---------------------------
function bindCreateForm() {
  const form = $("importForm");
  const submitButton = $("importSubmitButton");

  $("importResetButton").addEventListener("click", async () => {
    if (importLines.length && !(await confirmDialog("Xoá toàn bộ dòng hàng đang nhập?", { confirmText: "Làm lại" }))) return;
    resetCreateForm();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    form.classList.add("was-validated");

    // Ngày nhập không được ở tương lai
    const importDateInput = $("importDate");
    const selectedDate = fromDateInputValue(importDateInput.value);
    importDateInput.setCustomValidity(!selectedDate || selectedDate > new Date() ? "invalid" : "");

    if (!form.checkValidity()) {
      showToast("Vui lòng kiểm tra lại các ô được tô đỏ.", "warning");
      return;
    }
    if (importLines.length === 0) {
      showToast("Phiếu nhập chưa có dòng hàng nào.", "warning");
      return;
    }
    const invalidLine = importLines.find((line) => !(line.quantity > 0) || !(line.costPrice >= 0));
    if (invalidLine) {
      showToast(`"${invalidLine.name}": số lượng phải > 0 và đơn giá ≥ 0.`, "warning");
      return;
    }

    // Nhập hôm nay -> dùng giờ hiện tại; nhập ngày cũ -> 12:00 trưa ngày đó
    const isToday = toDateInputValue(selectedDate) === toDateInputValue(new Date());
    const importDate = isToday ? new Date() : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 12);

    setButtonLoading(submitButton, true, "Đang lưu...");
    try {
      const result = await createImport({
        importDate,
        note: $("importNote").value.trim(),
        updateCostPrice: $("importUpdateCost").checked,
        lines: importLines.map((line) => ({ productId: line.productId, quantity: line.quantity, costPrice: line.costPrice }))
      });
      showToast(`Đã lưu phiếu nhập ${result.code}. Tồn kho đã được cộng.`);
      resetCreateForm();
      importList.refreshCount();
    } catch (error) {
      showError(error, "Không lưu được phiếu nhập.");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

// --------------------------- Danh sách phiếu nhập ---------------------------
function getListConstraints() {
  const code = $("filterImportCode").value.trim().toUpperCase();
  if (code) return [where("code", "==", code)];

  const constraints = [];
  const fromDate = fromDateInputValue($("filterFromDate").value);
  const toDate = fromDateInputValue($("filterToDate").value);

  if (fromDate) constraints.push(where("importDate", ">=", Timestamp.fromDate(startOfDay(fromDate))));
  if (toDate) constraints.push(where("importDate", "<=", Timestamp.fromDate(endOfDay(toDate))));
  constraints.push(orderBy("importDate", "desc"));
  return constraints;
}

function setupImportList() {
  importList = new PaginatedList({
    collectionRef: collection(db, COLLECTIONS.IMPORTS),
    getConstraints: getListConstraints,
    pageSize: Number($("importPageSize").value),
    onPage: (pageState) => {
      lastPageState = pageState;
      renderImportRows(pageState.docs);
      drawPagination();
    },
    onCount: (count) => {
      totalCount = count;
      drawPagination();
    },
    onError: (error) => {
      $("importListBody").innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Không tải được danh sách</td></tr>`;
      showError(error, "Không tải được danh sách phiếu nhập.");
    }
  });
  importList.reload();
}

function drawPagination() {
  renderPagination($("importPagination"), lastPageState, totalCount, importList.pageSize, {
    onPrev: () => importList.previousPage(),
    onNext: () => importList.nextPage()
  });
}

function renderStatusBadge(status) {
  return status === "cancelled"
    ? `<span class="badge text-bg-secondary">Đã huỷ</span>`
    : `<span class="badge text-bg-success">Hoàn thành</span>`;
}

function renderImportRows(docs) {
  currentImports.clear();
  const tableBody = $("importListBody");
  if (docs.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-inbox"></i>Không có phiếu nhập nào</div></td></tr>`;
    return;
  }
  tableBody.innerHTML = docs.map((importDoc) => {
    const importData = importDoc.data({ serverTimestamps: "estimate" });
    currentImports.set(importDoc.id, importData);
    const isCancelled = importData.status === "cancelled";
    return `
      <tr data-id="${escapeHtml(importDoc.id)}" class="${isCancelled ? "text-muted" : ""}">
        <td class="fw-semibold">${escapeHtml(importData.code)}</td>
        <td class="text-nowrap">${formatDateTime(importData.importDate)}</td>
        <td class="text-center">${formatNumber(importData.itemCount)}</td>
        <td class="text-end text-money fw-semibold ${isCancelled ? "text-decoration-line-through" : ""}">${formatCurrency(importData.total)}</td>
        <td class="text-center">${renderStatusBadge(importData.status)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline-secondary" type="button" data-action="view" title="Xem" aria-label="Xem"><i class="bi bi-eye"></i></button>
          ${isCancelled ? "" : `<button class="btn btn-sm btn-outline-danger" type="button" data-action="cancel" title="Huỷ phiếu" aria-label="Huỷ phiếu"><i class="bi bi-x-circle"></i></button>`}
        </td>
      </tr>`;
  }).join("");
}

function bindListFilters() {
  const reload = () => importList.reload();
  $("filterImportCode").addEventListener("input", debounce(reload, 400));
  $("filterFromDate").addEventListener("change", reload);
  $("filterToDate").addEventListener("change", reload);
  $("importPageSize").addEventListener("change", (event) => importList.setPageSize(Number(event.target.value)));

  const detailModal = new bootstrap.Modal($("importDetailModal"));
  $("importListBody").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const importId = button.closest("tr").dataset.id;
    if (button.dataset.action === "view") showImportDetail(detailModal, importId);
    if (button.dataset.action === "cancel") handleCancelImport(importId, button);
  });
}

function showImportDetail(detailModal, importId) {
  const importData = currentImports.get(importId);
  if (!importData) return;
  $("importDetailTitle").textContent = `Phiếu nhập ${importData.code}`;
  $("importDetailBody").innerHTML = `
    <div class="row g-2 mb-3 small">
      <div class="col-sm-6"><span class="text-muted">Ngày nhập:</span> ${formatDateTime(importData.importDate)}</div>
      <div class="col-sm-6"><span class="text-muted">Trạng thái:</span> ${renderStatusBadge(importData.status)}</div>
      <div class="col-sm-6"><span class="text-muted">Tạo lúc:</span> ${formatDateTime(importData.createdAt)}</div>
      ${importData.note ? `<div class="col-12"><span class="text-muted">Ghi chú:</span> ${escapeHtml(importData.note)}</div>` : ""}
      ${importData.status === "cancelled" ? `
        <div class="col-12 text-danger">Huỷ lúc ${formatDateTime(importData.cancelledAt)} — Lý do: ${escapeHtml(importData.cancelReason || "—")}</div>` : ""}
    </div>
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead><tr><th>#</th><th>Hàng hoá</th><th class="text-end">SL</th><th class="text-end">Đơn giá</th><th class="text-end">Thành tiền</th></tr></thead>
        <tbody>
          ${importData.items.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(item.name)}<div class="small text-muted">${escapeHtml(item.code)}</div></td>
              <td class="text-end">${formatNumber(item.quantity)} ${escapeHtml(item.unit)}</td>
              <td class="text-end">${formatCurrency(item.costPrice)}</td>
              <td class="text-end">${formatCurrency(item.lineTotal)}</td>
            </tr>`).join("")}
        </tbody>
        <tfoot><tr><th colspan="4" class="text-end">Tổng tiền</th><th class="text-end">${formatCurrency(importData.total)}</th></tr></tfoot>
      </table>
    </div>`;
  detailModal.show();
}

async function handleCancelImport(importId, button) {
  const importData = currentImports.get(importId);
  if (!importData) return;
  const reason = await promptDialog(
    `Huỷ phiếu nhập ${importData.code}? Tồn kho của ${importData.itemCount} mặt hàng sẽ bị TRỪ lại. Lý do huỷ:`,
    { title: "Huỷ phiếu nhập", confirmText: "Huỷ phiếu", placeholder: "VD: Nhập nhầm số lượng" }
  );
  if (reason === null) return;

  setButtonLoading(button, true, "");
  try {
    const result = await cancelImport(importId, reason);
    const skippedNote = result.skippedProducts.length
      ? ` (bỏ qua hàng đã bị xoá: ${result.skippedProducts.join(", ")})`
      : "";
    showToast(`Đã huỷ phiếu ${result.code}, tồn kho đã được trừ lại${skippedNote}.`);
  } catch (error) {
    showError(error, "Không huỷ được phiếu nhập.");
    setButtonLoading(button, false);
  }
}

