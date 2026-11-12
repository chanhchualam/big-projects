// =====================================================================
// File: js/products.js
// Đường dẫn: chi tiêu/js/products.js
// Mục đích: Trang Hàng hoá
//   - Danh sách: tìm kiếm (searchKeywords), lọc danh mục, sắp xếp,
//     phân trang cursor, realtime
//   - Xem chi tiết: ảnh (carousel), thông tin, 10 biến động kho gần nhất
//   - Thêm: writeBatch (sản phẩm + ảnh + stock_log tồn đầu kỳ)
//   - Sửa: runTransaction (đọc tồn kho mới nhất để tính isLowStock đúng)
//   - Xoá: writeBatch (sản phẩm + document ảnh)
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
  onSnapshot,
  writeBatch,
  runTransaction,
  serverTimestamp
} from "./firebase.js";
import { UNIT_SUGGESTIONS } from "./config.js";
import {
  escapeHtml,
  showToast,
  showError,
  confirmDialog,
  setButtonLoading,
  debounce,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  buildSearchKeywords,
  toSearchToken,
  createAppError,
  getQueryParam,
  parseMoney,
  formatMoneyInputValue
} from "./utils.js";
import { PaginatedList, renderPagination } from "./paginated-list.js";
import { ProductImageManager } from "./image-upload.js";
import { calculateStockValue } from "./stock.js";

const PRODUCT_IMAGES_COLLECTION = "product_images";

const SORT_OPTIONS = {
  created_desc: { field: "createdAt", direction: "desc" },
  name_asc: { field: "name", direction: "asc" },
  price_asc: { field: "salePrice", direction: "asc" },
  price_desc: { field: "salePrice", direction: "desc" },
  stock_asc: { field: "stock", direction: "asc" }
};

const STOCK_LOG_LABELS = {
  initial: { label: "Tồn đầu kỳ", className: "text-bg-secondary" },
  import: { label: "Nhập kho", className: "text-bg-success" },
  sale: { label: "Bán hàng", className: "text-bg-primary" },
  cancel_import: { label: "Huỷ phiếu nhập", className: "text-bg-warning" },
  cancel_sale: { label: "Huỷ hoá đơn", className: "text-bg-warning" },
  return: { label: "Trả hàng", className: "text-bg-info" },
  adjust: { label: "Điều chỉnh", className: "text-bg-dark" }
};

// ------------------------------- Trạng thái -------------------------------
const categories = new Map(); // id -> { name }
const currentProducts = new Map(); // id -> dữ liệu sản phẩm của trang đang xem
const productsOpenedFromUrl = new Map(); // id -> sản phẩm mở qua ?view=<id> (không nằm trong trang hiện tại)

// Tìm sản phẩm ở trang đang hiển thị, hoặc sản phẩm được mở từ đường dẫn
function getKnownProduct(productId) {
  return currentProducts.get(productId) || productsOpenedFromUrl.get(productId);
}
let editingProductId = null;
let detailProductId = null;
let lastPageState = { docs: [], pageIndex: 0, hasNext: false, hasPrev: false };
let totalCount = null;
let paginatedList;
let imageManager;

// Lấy phần tử DOM
const $ = (id) => document.getElementById(id);

export function initProductsPage() {
  const productModal = new bootstrap.Modal($("productModal"));
  const detailModal = new bootstrap.Modal($("productDetailModal"));

  imageManager = new ProductImageManager({
    dropzone: $("imageDropzone"),
    fileInput: $("imageFileInput"),
    previewList: $("imagePreviewList"),
    progressWrapper: $("imageProgress"),
    progressBar: $("imageProgressBar"),
    errorBox: $("imageError"),
    countLabel: $("imageCountLabel")
  });

  $("unitSuggestions").innerHTML = UNIT_SUGGESTIONS.map((unit) => `<option value="${escapeHtml(unit)}">`).join("");

  listenCategories();
  setupProductList();
  bindToolbarEvents();
  bindTableEvents(productModal, detailModal);
  bindFormEvents(productModal);

  $("addProductButton").addEventListener("click", () => openProductForm(productModal, null));
  $("detailEditButton").addEventListener("click", () => {
    detailModal.hide();
    if (detailProductId) openProductForm(productModal, detailProductId);
  });

  // Mở từ trang "Sản phẩm mới": products.html?view=<productId>
  const productIdFromUrl = getQueryParam("view");
  if (productIdFromUrl) openProductFromUrl(detailModal, productIdFromUrl);
}

async function openProductFromUrl(detailModal, productId) {
  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.PRODUCTS, productId));
    if (!snapshot.exists()) {
      showToast("Không tìm thấy hàng hoá (có thể đã bị xoá).", "warning");
      return;
    }
    productsOpenedFromUrl.set(productId, snapshot.data({ serverTimestamps: "estimate" }));
    openProductDetail(detailModal, productId);
  } catch (error) {
    showError(error, "Không mở được hàng hoá.");
  }
}

// ------------------------------- Danh mục -------------------------------
// Danh mục thường ít (vài chục) nên lắng nghe toàn bộ để đổ vào ô chọn
function listenCategories() {
  onSnapshot(
    query(collection(db, COLLECTIONS.CATEGORIES), orderBy("name", "asc")),
    (snapshot) => {
      categories.clear();
      snapshot.docs.forEach((categoryDoc) => categories.set(categoryDoc.id, categoryDoc.data()));
      renderCategoryOptions();
    },
    (error) => showError(error, "Không tải được danh mục.")
  );
}

function renderCategoryOptions() {
  const optionsHtml = [...categories.entries()]
    .map(([id, category]) => `<option value="${escapeHtml(id)}">${escapeHtml(category.name)}</option>`)
    .join("");

  const filterSelect = $("categoryFilter");
  const selectedFilter = filterSelect.value;
  filterSelect.innerHTML = `<option value="">Tất cả danh mục</option>${optionsHtml}`;
  filterSelect.value = categories.has(selectedFilter) ? selectedFilter : "";

  const formSelect = $("productCategory");
  const selectedForm = formSelect.value;
  formSelect.innerHTML = categories.size
    ? `<option value="">— Chọn danh mục —</option>${optionsHtml}`
    : `<option value="">Chưa có danh mục — hãy tạo ở trang Danh mục</option>`;
  formSelect.value = categories.has(selectedForm) ? selectedForm : "";
}

// ------------------------------- Danh sách -------------------------------
function getListConstraints() {
  const searchToken = toSearchToken($("searchInput").value);
  const categoryId = $("categoryFilter").value;
  const constraints = [];

  if (searchToken) {
    // Index: searchKeywords (CONTAINS) [+ categoryId] + name ASC
    constraints.push(where("searchKeywords", "array-contains", searchToken));
    if (categoryId) constraints.push(where("categoryId", "==", categoryId));
    constraints.push(orderBy("name", "asc"));
    return constraints;
  }

  if (categoryId) constraints.push(where("categoryId", "==", categoryId));
  const sort = SORT_OPTIONS[$("sortSelect").value] || SORT_OPTIONS.created_desc;
  constraints.push(orderBy(sort.field, sort.direction));
  return constraints;
}

function setupProductList() {
  paginatedList = new PaginatedList({
    collectionRef: collection(db, COLLECTIONS.PRODUCTS),
    getConstraints: getListConstraints,
    pageSize: Number($("pageSizeSelect").value),
    onPage: (pageState) => {
      lastPageState = pageState;
      renderProductRows(pageState.docs);
      drawPagination();
    },
    onCount: (count) => {
      totalCount = count;
      drawPagination();
    },
    onError: (error) => {
      $("productTableBody").innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Không tải được danh sách hàng hoá</td></tr>`;
      showError(error, "Không tải được danh sách hàng hoá.");
    }
  });
  paginatedList.reload();
}

function drawPagination() {
  renderPagination($("paginationContainer"), lastPageState, totalCount, paginatedList.pageSize, {
    onPrev: () => paginatedList.previousPage(),
    onNext: () => paginatedList.nextPage()
  });
}

function renderThumbnail(product) {
  return product.thumbnailUrl
    ? `<img src="${escapeHtml(product.thumbnailUrl)}" class="product-thumb" alt="${escapeHtml(product.name)}" loading="lazy">`
    : `<span class="product-thumb-placeholder"><i class="bi bi-image"></i></span>`;
}

function renderStockBadge(product) {
  let className = "text-bg-success";
  if (product.stock <= 0) className = "text-bg-danger";
  else if (product.isLowStock) className = "text-bg-warning";
  return `<span class="badge ${className}">${formatNumber(product.stock)}</span>`;
}

function renderProductRows(docs) {
  const tableBody = $("productTableBody");
  currentProducts.clear();

  if (docs.length === 0) {
    const isFiltering = $("searchInput").value.trim() || $("categoryFilter").value;
    tableBody.innerHTML = `
      <tr><td colspan="8"><div class="empty-state"><i class="bi bi-box-seam"></i>
        ${isFiltering ? "Không tìm thấy hàng hoá phù hợp" : "Chưa có hàng hoá nào — bấm \"Thêm hàng\" để bắt đầu"}
      </div></td></tr>`;
    return;
  }

  tableBody.innerHTML = docs.map((productDoc) => {
    const product = productDoc.data({ serverTimestamps: "estimate" });
    currentProducts.set(productDoc.id, product);
    const categoryName = product.categoryName || categories.get(product.categoryId)?.name || "—";
    return `
      <tr data-id="${escapeHtml(productDoc.id)}">
        <td>${renderThumbnail(product)}</td>
        <td class="fw-semibold text-nowrap">${escapeHtml(product.code)}</td>
        <td>
          <a href="#" class="text-decoration-none fw-semibold" data-action="view">${escapeHtml(product.name)}</a>
          <div class="small text-muted">${escapeHtml(categoryName)}</div>
        </td>
        <td>${escapeHtml(product.unit)}</td>
        <td class="text-end text-money">${formatCurrency(product.costPrice)}</td>
        <td class="text-end text-money fw-semibold">${formatCurrency(product.salePrice)}</td>
        <td class="text-center">${renderStockBadge(product)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline-secondary" type="button" data-action="view" title="Xem chi tiết" aria-label="Xem chi tiết"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-outline-primary" type="button" data-action="edit" title="Sửa" aria-label="Sửa"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete" title="Xoá" aria-label="Xoá"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  }).join("");
}

function bindToolbarEvents() {
  const searchInput = $("searchInput");
  const sortSelect = $("sortSelect");

  searchInput.addEventListener("input", debounce(() => {
    const isSearching = Boolean(searchInput.value.trim());
    sortSelect.disabled = isSearching;
    $("searchHint").textContent = isSearching ? "Đang tìm kiếm: kết quả sắp xếp theo tên A → Z." : "";
    paginatedList.reload();
  }, 400));

  $("categoryFilter").addEventListener("change", () => paginatedList.reload());
  sortSelect.addEventListener("change", () => paginatedList.reload());
  $("pageSizeSelect").addEventListener("change", (event) => paginatedList.setPageSize(Number(event.target.value)));
}

function bindTableEvents(productModal, detailModal) {
  $("productTableBody").addEventListener("click", (event) => {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    event.preventDefault();
    const productId = actionElement.closest("tr").dataset.id;
    const action = actionElement.dataset.action;
    if (action === "view") openProductDetail(detailModal, productId);
    if (action === "edit") openProductForm(productModal, productId);
    if (action === "delete") deleteProduct(productId, actionElement);
  });
}

// ------------------------------- Chi tiết -------------------------------
async function openProductDetail(detailModal, productId) {
  const product = getKnownProduct(productId);
  if (!product) return;
  detailProductId = productId;

  $("productDetailTitle").textContent = `${product.code} · ${product.name}`;
  $("productDetailBody").innerHTML = `<div class="text-center py-5"><div class="spinner-border"></div></div>`;
  detailModal.show();

  try {
    const [imagesSnapshot, logsSnapshot] = await Promise.all([
      getDoc(doc(db, PRODUCT_IMAGES_COLLECTION, productId)),
      getDocs(query(
        collection(db, COLLECTIONS.STOCK_LOGS),
        where("productId", "==", productId),
        orderBy("createdAt", "desc"),
        limit(10)
      ))
    ]);

    const imageUrls = imagesSnapshot.exists() ? imagesSnapshot.data().imageUrls || [] : [];
    const profit = product.salePrice - product.costPrice;
    const profitPercent = product.costPrice > 0 ? (profit / product.costPrice) * 100 : null;
    const categoryName = product.categoryName || categories.get(product.categoryId)?.name || "—";

    const carouselHtml = imageUrls.length === 0
      ? `<div class="product-card"><div class="card-img-placeholder rounded"><i class="bi bi-image"></i></div></div>`
      : `
        <div id="detailCarousel" class="carousel slide bg-light rounded">
          <div class="carousel-inner">
            ${imageUrls.map((url, index) => `
              <div class="carousel-item ${index === 0 ? "active" : ""}">
                <img src="${escapeHtml(url)}" class="d-block w-100 rounded" style="max-height:360px;object-fit:contain" alt="Ảnh ${index + 1}">
              </div>`).join("")}
          </div>
          ${imageUrls.length > 1 ? `
            <button class="carousel-control-prev" type="button" data-bs-target="#detailCarousel" data-bs-slide="prev">
              <span class="carousel-control-prev-icon"></span><span class="visually-hidden">Trước</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#detailCarousel" data-bs-slide="next">
              <span class="carousel-control-next-icon"></span><span class="visually-hidden">Sau</span>
            </button>` : ""}
        </div>`;

    const logsHtml = logsSnapshot.empty
      ? `<div class="text-muted small">Chưa có biến động kho.</div>`
      : `
        <div class="table-responsive">
          <table class="table table-sm align-middle mb-0">
            <thead><tr><th>Thời gian</th><th>Loại</th><th>Chứng từ</th><th class="text-end">Thay đổi</th><th class="text-end">Tồn sau</th></tr></thead>
            <tbody>
              ${logsSnapshot.docs.map((logDoc) => {
                const log = logDoc.data({ serverTimestamps: "estimate" });
                const typeInfo = STOCK_LOG_LABELS[log.type] || { label: log.type, className: "text-bg-light" };
                const changeClass = log.quantityChange >= 0 ? "text-success" : "text-danger";
                return `
                  <tr>
                    <td class="small text-nowrap">${formatDateTime(log.createdAt)}</td>
                    <td><span class="badge ${typeInfo.className}">${escapeHtml(typeInfo.label)}</span></td>
                    <td class="small">${escapeHtml(log.refCode || log.note || "—")}</td>
                    <td class="text-end fw-semibold ${changeClass}">${log.quantityChange >= 0 ? "+" : ""}${formatNumber(log.quantityChange)}</td>
                    <td class="text-end">${formatNumber(log.stockAfter)}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;

    $("productDetailBody").innerHTML = `
      <div class="row g-4">
        <div class="col-md-5">${carouselHtml}</div>
        <div class="col-md-7">
          <table class="table table-sm mb-0">
            <tbody>
              <tr><th class="text-muted fw-normal" style="width:40%">Mã hàng</th><td class="fw-semibold">${escapeHtml(product.code)}</td></tr>
              <tr><th class="text-muted fw-normal">Tên hàng</th><td>${escapeHtml(product.name)}</td></tr>
              <tr><th class="text-muted fw-normal">Danh mục</th><td>${escapeHtml(categoryName)}</td></tr>
              <tr><th class="text-muted fw-normal">Đơn vị tính</th><td>${escapeHtml(product.unit)}</td></tr>
              <tr><th class="text-muted fw-normal">Giá nhập</th><td>${formatCurrency(product.costPrice)}</td></tr>
              <tr><th class="text-muted fw-normal">Giá bán</th><td class="fw-semibold">${formatCurrency(product.salePrice)}</td></tr>
              <tr><th class="text-muted fw-normal">Lãi / đơn vị</th>
                <td class="${profit < 0 ? "text-danger" : "text-success"}">${formatCurrency(profit)}${profitPercent === null ? "" : ` (${profitPercent.toFixed(1)}%)`}</td></tr>
              <tr><th class="text-muted fw-normal">Tồn kho</th><td>${renderStockBadge(product)} <span class="small text-muted">tối thiểu ${formatNumber(product.minStock)}</span></td></tr>
              <tr><th class="text-muted fw-normal">Giá trị tồn (giá nhập)</th><td>${formatCurrency(product.stock * product.costPrice)}</td></tr>
              <tr><th class="text-muted fw-normal">Đã bán</th><td>${formatNumber(product.totalSold || 0)} ${escapeHtml(product.unit)}</td></tr>
              <tr><th class="text-muted fw-normal">Ngày thêm</th><td>${formatDateTime(product.createdAt)}</td></tr>
              <tr><th class="text-muted fw-normal">Cập nhật</th><td>${formatDateTime(product.updatedAt)}</td></tr>
            </tbody>
          </table>
          ${product.description ? `<p class="mt-3 mb-0 small">${escapeHtml(product.description)}</p>` : ""}
        </div>
        <div class="col-12">
          <h6 class="fw-semibold"><i class="bi bi-clock-history me-1"></i>Biến động kho gần đây</h6>
          ${logsHtml}
        </div>
      </div>`;
  } catch (error) {
    $("productDetailBody").innerHTML = `<div class="text-center text-danger py-4">Không tải được chi tiết hàng hoá</div>`;
    showError(error, "Không tải được chi tiết hàng hoá.");
  }
}

// ------------------------------- Form -------------------------------
async function openProductForm(productModal, productId) {
  const form = $("productForm");
  form.reset();
  form.classList.remove("was-validated");
  $("productCode").setCustomValidity("");
  $("productCodeFeedback").textContent = "Mã hàng chỉ gồm chữ, số, dấu - _ . và không để trống.";
  imageManager.reset();
  editingProductId = productId;

  const stockInput = $("productStock");
  const isEditing = Boolean(productId);
  $("productModalTitle").textContent = isEditing ? "Sửa hàng hoá" : "Thêm hàng hoá";
  stockInput.disabled = isEditing;
  $("productStockHelp").textContent = isEditing
    ? "Tồn kho chỉ thay đổi qua Nhập kho / Bán hàng (để lịch sử kho luôn khớp)."
    : "Sau khi tạo, tồn kho chỉ thay đổi qua Nhập kho / Bán hàng.";

  if (isEditing) {
    const product = getKnownProduct(productId);
    if (!product) return;
    $("productCode").value = product.code;
    $("productName").value = product.name;
    $("productCategory").value = categories.has(product.categoryId) ? product.categoryId : "";
    $("productUnit").value = product.unit;
    $("productCostPrice").value = formatMoneyInputValue(product.costPrice);
    $("productSalePrice").value = formatMoneyInputValue(product.salePrice);
    stockInput.value = product.stock;
    $("productMinStock").value = product.minStock;
    $("productDescription").value = product.description || "";
  } else {
    stockInput.value = 0;
    $("productMinStock").value = 5;
  }
  updateProfitHint();
  productModal.show();

  // Tải ảnh đã lưu (document riêng) để hiện trong khung xem trước
  if (isEditing && getKnownProduct(productId)?.imageCount > 0) {
    imageManager.setLoading(true);
    try {
      const imagesSnapshot = await getDoc(doc(db, PRODUCT_IMAGES_COLLECTION, productId));
      if (editingProductId !== productId) return; // người dùng đã mở sản phẩm khác
      imageManager.setExistingImages(imagesSnapshot.exists() ? imagesSnapshot.data().imageUrls : []);
    } catch (error) {
      imageManager.setLoading(false);
      showError(error, "Không tải được ảnh sản phẩm.");
    }
  }
}

function updateProfitHint() {
  const costPrice = parseMoney($("productCostPrice").value);
  const salePrice = parseMoney($("productSalePrice").value);
  const hint = $("profitHint");
  if (!$("productCostPrice").value || !$("productSalePrice").value) {
    hint.textContent = "";
    return;
  }
  const profit = salePrice - costPrice;
  const percent = costPrice > 0 ? ` (${((profit / costPrice) * 100).toFixed(1)}%)` : "";
  hint.className = `small ${profit < 0 ? "text-danger" : "text-success"}`;
  hint.innerHTML = profit < 0
    ? `<i class="bi bi-exclamation-triangle me-1"></i>Giá bán thấp hơn giá nhập: lỗ ${formatCurrency(-profit)}/đơn vị${percent}`
    : `<i class="bi bi-graph-up-arrow me-1"></i>Lãi ${formatCurrency(profit)}/đơn vị${percent}`;
}

function readProductForm() {
  return {
    code: $("productCode").value.trim().toUpperCase(),
    name: $("productName").value.trim(),
    categoryId: $("productCategory").value,
    unit: $("productUnit").value.trim(),
    costPrice: parseMoney($("productCostPrice").value),
    salePrice: parseMoney($("productSalePrice").value),
    stock: Number($("productStock").value),
    minStock: Number($("productMinStock").value),
    description: $("productDescription").value.trim()
  };
}

// Mã hàng không được trùng (1 người dùng nên kiểm tra trước khi ghi là đủ)
async function isProductCodeTaken(code, exceptProductId) {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.PRODUCTS), where("code", "==", code), limit(2)));
  return snapshot.docs.some((productDoc) => productDoc.id !== exceptProductId);
}

function bindFormEvents(productModal) {
  const form = $("productForm");
  const saveButton = $("productSaveButton");

  $("productCostPrice").addEventListener("input", updateProfitHint);
  $("productSalePrice").addEventListener("input", updateProfitHint);
  $("productCode").addEventListener("input", () => $("productCode").setCustomValidity(""));

  // Chặn đóng modal khi đang lưu
  $("productModal").addEventListener("hide.bs.modal", (event) => {
    if (saveButton.disabled) event.preventDefault();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    ["productName", "productUnit"].forEach((id) => {
      const input = $(id);
      input.setCustomValidity(input.value.trim() ? "" : "required");
    });
    form.classList.add("was-validated");
    if (!form.checkValidity()) return;

    const values = readProductForm();
    if ([values.costPrice, values.salePrice, values.minStock].some((value) => !Number.isFinite(value) || value < 0)
      || (!editingProductId && (!Number.isFinite(values.stock) || values.stock < 0))) {
      showToast("Giá và số lượng phải là số ≥ 0.", "warning");
      return;
    }

    if (values.salePrice < values.costPrice) {
      const accepted = await confirmDialog(
        `Giá bán (${formatCurrency(values.salePrice)}) thấp hơn giá nhập (${formatCurrency(values.costPrice)}). Vẫn lưu?`,
        { title: "Cảnh báo giá bán", confirmText: "Vẫn lưu", confirmClass: "btn-warning" }
      );
      if (!accepted) return;
    }

    setButtonLoading(saveButton, true, "Đang lưu...");
    try {
      if (await isProductCodeTaken(values.code, editingProductId)) {
        $("productCode").setCustomValidity("duplicate");
        $("productCodeFeedback").textContent = `Mã "${values.code}" đã tồn tại, hãy chọn mã khác.`;
        throw createAppError(`Mã hàng "${values.code}" đã tồn tại.`);
      }

      // Chỉ xử lý ảnh khi có thay đổi (thêm/xoá/đổi ảnh đại diện)
      const imagePayload = imageManager.hasChanges ? await imageManager.buildImagePayload() : null;

      if (editingProductId) {
        await updateProduct(editingProductId, values, imagePayload);
        showToast(`Đã cập nhật "${values.name}".`);
      } else {
        await createProduct(values, imagePayload);
        showToast(`Đã thêm "${values.name}".`);
        paginatedList.refreshCount();
      }
      setButtonLoading(saveButton, false);
      productModal.hide();
    } catch (error) {
      showError(error, "Không lưu được hàng hoá.");
      setButtonLoading(saveButton, false);
    } finally {
      imageManager.setProgress(null);
    }
  });
}

function buildProductData(values) {
  return {
    code: values.code,
    name: values.name,
    categoryId: values.categoryId,
    categoryName: categories.get(values.categoryId)?.name || "", // denormalize
    unit: values.unit,
    costPrice: values.costPrice,
    salePrice: values.salePrice,
    minStock: values.minStock,
    description: values.description,
    searchKeywords: buildSearchKeywords(values.name, values.code)
  };
}

// THÊM: ghi sản phẩm + ảnh + lịch sử tồn đầu kỳ trong 1 writeBatch
async function createProduct(values, imagePayload) {
  const productRef = doc(collection(db, COLLECTIONS.PRODUCTS)); // tạo id trước
  const batch = writeBatch(db);
  const imageUrls = imagePayload?.imageUrls || [];

  batch.set(productRef, {
    ...buildProductData(values),
    stock: values.stock,
    isLowStock: values.stock <= values.minStock,
    stockValue: calculateStockValue(values.stock, values.costPrice),
    imageUrls: [], // cách C: ảnh gốc nằm ở product_images/{id}
    thumbnailUrl: imagePayload?.thumbnailUrl || null,
    imageCount: imageUrls.length,
    lastSoldAt: serverTimestamp(), // mốc tính "hàng tồn lâu" khi chưa bán lần nào
    totalSold: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (imageUrls.length > 0) {
    batch.set(doc(db, PRODUCT_IMAGES_COLLECTION, productRef.id), {
      imageUrls,
      updatedAt: serverTimestamp()
    });
  }

  if (values.stock > 0) {
    batch.set(doc(collection(db, COLLECTIONS.STOCK_LOGS)), {
      productId: productRef.id,
      productCode: values.code,
      productName: values.name,
      type: "initial",
      quantityChange: values.stock,
      stockBefore: 0,
      stockAfter: values.stock,
      refType: "product",
      refId: productRef.id,
      refCode: null,
      note: "Tồn đầu kỳ khi tạo hàng hoá",
      createdAt: serverTimestamp()
    });
  }

  await batch.commit();
}

// SỬA: transaction đọc tồn kho mới nhất -> isLowStock luôn đúng kể cả khi
// có hoá đơn vừa bán xong ở tab khác. Ảnh cũ bị ghi đè/xoá trong cùng transaction.
async function updateProduct(productId, values, imagePayload) {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
  const imagesRef = doc(db, PRODUCT_IMAGES_COLLECTION, productId);

  await runTransaction(db, async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists()) throw createAppError("Hàng hoá này đã bị xoá.");
    const currentStock = productSnapshot.data().stock;

    const updates = {
      ...buildProductData(values),
      isLowStock: currentStock <= values.minStock,
      stockValue: calculateStockValue(currentStock, values.costPrice),
      updatedAt: serverTimestamp()
    };

    if (imagePayload) {
      updates.thumbnailUrl = imagePayload.thumbnailUrl;
      updates.imageCount = imagePayload.imageUrls.length;
      if (imagePayload.imageUrls.length > 0) {
        transaction.set(imagesRef, { imageUrls: imagePayload.imageUrls, updatedAt: serverTimestamp() });
      } else {
        transaction.delete(imagesRef); // xoá hết ảnh -> xoá luôn document ảnh
      }
    }

    transaction.update(productRef, updates);
  });
}

// ------------------------------- Xoá -------------------------------
async function deleteProduct(productId, button) {
  const product = getKnownProduct(productId);
  if (!product) return;

  const stockWarning = product.stock > 0 ? ` Hàng còn tồn ${formatNumber(product.stock)} ${product.unit}.` : "";
  const confirmed = await confirmDialog(
    `Xoá hàng hoá "${product.name}" (${product.code}) cùng toàn bộ ảnh?${stockWarning} Hoá đơn/phiếu nhập cũ vẫn giữ nguyên thông tin.`,
    { title: "Xoá hàng hoá", confirmText: "Xoá" }
  );
  if (!confirmed) return;

  setButtonLoading(button, true, "");
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.PRODUCTS, productId));
    batch.delete(doc(db, PRODUCT_IMAGES_COLLECTION, productId)); // xoá ảnh
    await batch.commit();
    showToast(`Đã xoá "${product.name}".`);
    paginatedList.refreshCount();
  } catch (error) {
    showError(error, "Không xoá được hàng hoá.");
    setButtonLoading(button, false);
  }
}
