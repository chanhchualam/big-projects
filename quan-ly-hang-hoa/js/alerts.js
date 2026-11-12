// =====================================================================
// File: js/alerts.js
// Đường dẫn: chi tiêu/js/alerts.js
// Mục đích: Cảnh báo realtime hàng sắp hết
//   where isLowStock == true, orderBy stock (index có sẵn), tối đa 100 dòng
//   — đủ cho cảnh báo, không tải cả kho.
// =====================================================================

import { db, COLLECTIONS, collection, query, where, orderBy, limit, onSnapshot } from "./firebase.js";
import { escapeHtml, formatNumber, showError } from "./utils.js";

const MAX_ROWS = 100;
const $ = (id) => document.getElementById(id);

export function initAlertsPage() {
  listenLowStock();
}

function renderProductCell(productId, product) {
  return `
    <div class="d-flex align-items-center gap-2">
      ${product.thumbnailUrl
        ? `<img src="${escapeHtml(product.thumbnailUrl)}" class="product-thumb" alt="">`
        : `<span class="product-thumb-placeholder"><i class="bi bi-image"></i></span>`}
      <div class="min-w-0">
        <div class="fw-semibold text-truncate">${escapeHtml(product.name)}</div>
        <div class="small text-muted">${escapeHtml(product.code)} · ${escapeHtml(product.categoryName || "")}</div>
      </div>
    </div>`;
}

function listenLowStock() {
  const tableBody = $("lowStockBody");
  onSnapshot(
    query(collection(db, COLLECTIONS.PRODUCTS), where("isLowStock", "==", true), orderBy("stock", "asc"), limit(MAX_ROWS)),
    (snapshot) => {
      $("lowStockCount").textContent = snapshot.size >= MAX_ROWS ? `${MAX_ROWS}+` : snapshot.size;
      if (snapshot.empty) {
        tableBody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="bi bi-check2-circle text-success"></i>Không có hàng sắp hết</div></td></tr>`;
        return;
      }
      tableBody.innerHTML = snapshot.docs.map((productDoc) => {
        const product = productDoc.data();
        const stockBadge = product.stock <= 0 ? "text-bg-danger" : "text-bg-warning";
        return `
          <tr>
            <td>${renderProductCell(productDoc.id, product)}</td>
            <td class="text-center"><span class="badge ${stockBadge}">${formatNumber(product.stock)} ${escapeHtml(product.unit)}</span></td>
            <td class="text-center">${formatNumber(product.minStock)}</td>
            <td class="text-end">
              <a class="btn btn-sm btn-success" href="imports.html?addProduct=${encodeURIComponent(productDoc.id)}">
                <i class="bi bi-box-arrow-in-down me-1"></i>Nhập thêm
              </a>
            </td>
          </tr>`;
      }).join("");
    },
    (error) => {
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">Không tải được danh sách</td></tr>`;
      showError(error, "Không tải được hàng sắp hết.");
    }
  );
}
