// =====================================================================
// File: js/new-products.js
// Đường dẫn: chi tiêu/js/new-products.js
// Mục đích: Trang "Sản phẩm mới" — lưới card các sản phẩm vừa thêm
//   - orderBy("createdAt", "desc") + lọc danh mục (composite index
//     categoryId + createdAt DESC đã khai báo)
//   - Phân trang cursor + realtime (PaginatedList)
//   - Ảnh card dùng thumbnailUrl (~40KB) để trang tải nhanh; bấm vào card
//     mở chi tiết đầy đủ ở trang Hàng hoá
// =====================================================================

import { db, COLLECTIONS, collection, query, where, orderBy, getDocs } from "./firebase.js";
import { escapeHtml, formatCurrency, formatNumber, formatDate, toJsDate, showError } from "./utils.js";
import { PaginatedList, renderPagination } from "./paginated-list.js";

const NEW_BADGE_DAYS = 7; // thêm trong 7 ngày -> gắn nhãn "Mới"
const $ = (id) => document.getElementById(id);

let productList;
let lastPageState = { docs: [], pageIndex: 0, hasNext: false, hasPrev: false };
let totalCount = null;

export async function initNewProductsPage() {
  await loadCategoryFilter();

  productList = new PaginatedList({
    collectionRef: collection(db, COLLECTIONS.PRODUCTS),
    getConstraints: () => {
      const categoryId = $("newCategoryFilter").value;
      return categoryId
        ? [where("categoryId", "==", categoryId), orderBy("createdAt", "desc")]
        : [orderBy("createdAt", "desc")];
    },
    pageSize: Number($("newPageSize").value),
    onPage: (pageState) => {
      lastPageState = pageState;
      renderGrid(pageState.docs);
      drawPagination();
    },
    onCount: (countValue) => {
      totalCount = countValue;
      drawPagination();
    },
    onError: (error) => {
      $("newProductsGrid").innerHTML = `<div class="col-12 text-center text-danger py-5">Không tải được sản phẩm</div>`;
      showError(error, "Không tải được danh sách sản phẩm mới.");
    }
  });

  $("newCategoryFilter").addEventListener("change", () => productList.reload());
  $("newPageSize").addEventListener("change", (event) => productList.setPageSize(Number(event.target.value)));
  productList.reload();
}

async function loadCategoryFilter() {
  try {
    const snapshot = await getDocs(query(collection(db, COLLECTIONS.CATEGORIES), orderBy("name", "asc")));
    $("newCategoryFilter").innerHTML = `<option value="">Tất cả danh mục</option>` + snapshot.docs
      .map((categoryDoc) => `<option value="${escapeHtml(categoryDoc.id)}">${escapeHtml(categoryDoc.data().name)}</option>`)
      .join("");
  } catch (error) {
    showError(error, "Không tải được danh mục.");
  }
}

function drawPagination() {
  renderPagination($("newProductsPagination"), lastPageState, totalCount, productList.pageSize, {
    onPrev: () => {
      productList.previousPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onNext: () => {
      productList.nextPage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

function renderGrid(docs) {
  const grid = $("newProductsGrid");
  if (docs.length === 0) {
    grid.innerHTML = `
      <div class="col-12"><div class="card"><div class="empty-state">
        <i class="bi bi-stars"></i>Chưa có sản phẩm nào — <a href="products.html">thêm hàng hoá</a>
      </div></div></div>`;
    return;
  }

  const now = new Date();
  grid.innerHTML = docs.map((productDoc) => {
    const product = productDoc.data({ serverTimestamps: "estimate" });
    const createdAt = toJsDate(product.createdAt);
    const isNew = createdAt && (now - createdAt) / 86400000 <= NEW_BADGE_DAYS;
    const stockClass = product.stock <= 0 ? "text-bg-danger" : product.isLowStock ? "text-bg-warning" : "text-bg-success";
    const detailUrl = `products.html?view=${encodeURIComponent(productDoc.id)}`;

    return `
      <div class="col-6 col-md-4 col-xl-3">
        <a href="${detailUrl}" class="card product-card h-100 text-decoration-none text-reset">
          <div class="position-relative">
            ${product.thumbnailUrl
              ? `<img src="${escapeHtml(product.thumbnailUrl)}" class="card-img-top" alt="${escapeHtml(product.name)}" loading="lazy">`
              : `<div class="card-img-placeholder"><i class="bi bi-image"></i></div>`}
            ${isNew ? `<span class="badge text-bg-danger position-absolute top-0 start-0 m-2">Mới</span>` : ""}
            ${product.imageCount > 1 ? `<span class="badge text-bg-dark position-absolute top-0 end-0 m-2"><i class="bi bi-images"></i> ${product.imageCount}</span>` : ""}
          </div>
          <div class="card-body d-flex flex-column">
            <div class="small text-muted mb-1">${escapeHtml(product.code)} · ${escapeHtml(product.categoryName || "")}</div>
            <h3 class="h6 card-title mb-2">${escapeHtml(product.name)}</h3>
            <div class="mt-auto">
              <div class="fs-5 fw-bold text-primary text-money">${formatCurrency(product.salePrice)}</div>
              <div class="d-flex justify-content-between align-items-center small mt-1">
                <span class="badge ${stockClass}">Tồn ${formatNumber(product.stock)} ${escapeHtml(product.unit)}</span>
                <span class="text-muted"><i class="bi bi-calendar-plus me-1"></i>${formatDate(product.createdAt)}</span>
              </div>
            </div>
          </div>
        </a>
      </div>`;
  }).join("");
}
