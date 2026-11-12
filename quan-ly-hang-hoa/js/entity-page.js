// =====================================================================
// File: js/entity-page.js
// Đường dẫn: chi tiêu/js/entity-page.js
// Mục đích: Trang quản lý dạng "danh sách + form modal" dùng chung cho
//           Danh mục (và các trang dạng danh sách sau này). Mỗi trang chỉ khai báo
//           cấu hình (cột, field, kiểm tra xoá...) trong file riêng.
//
// Tính năng: tìm kiếm (searchKeywords), sắp xếp, phân trang cursor,
//            realtime, thêm/sửa trong modal có kiểm tra dữ liệu, xoá có
//            xác nhận + chặn xoá nếu đang được tham chiếu.
// =====================================================================

import {
  db,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  serverTimestamp
} from "./firebase.js";
import { APP_CONFIG } from "./config.js";
import {
  escapeHtml,
  showToast,
  showError,
  confirmDialog,
  setButtonLoading,
  debounce,
  buildSearchKeywords,
  toSearchToken,
  createAppError
} from "./utils.js";
import { PaginatedList, renderPagination } from "./paginated-list.js";

/**
 * @param {object} config
 * @param {string} config.collectionName
 * @param {string} config.entityLabel        vd "nhà cung cấp"
 * @param {string} config.icon               class bootstrap-icons
 * @param {boolean} config.searchable        có field searchKeywords không
 * @param {string[]} [config.searchFields]   field dùng sinh searchKeywords
 * @param {string} [config.searchPlaceholder]
 * @param {Array} config.sortOptions         [{ value, label, field, direction }]
 * @param {Array} config.columns             [{ label, className, render(item, id) }]
 * @param {Array} config.fields              [{ name, label, type, required, maxLength, ... }]
 * @param {() => object} [config.getCreateDefaults]
 * @param {(id, item) => Promise<string|null>} [config.beforeDelete]  trả về lý do chặn xoá
 * @param {(id, values, oldItem) => Promise<void>} [config.afterUpdate]
 * @param {(rows: Array<{id, item, rowElement}>) => void} [config.afterRenderRows]
 */
export function initEntityPage(config) {
  const container = document.getElementById("pageContent");
  const collectionRef = collection(db, config.collectionName);
  const currentItems = new Map(); // id -> dữ liệu của trang đang hiển thị
  let editingId = null;
  let lastPageState = { docs: [], pageIndex: 0, hasNext: false, hasPrev: false };
  let totalCount = null;

  // ------------------------------ Giao diện ------------------------------
  container.innerHTML = `
    <div class="card">
      <div class="card-body border-bottom">
        <div class="row g-2 align-items-center">
          ${config.searchable ? `
          <div class="col-md-5">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input type="search" class="form-control" id="searchInput"
                     placeholder="${escapeHtml(config.searchPlaceholder || "Tìm kiếm...")}" maxlength="40">
            </div>
          </div>` : ""}
          <div class="col-6 col-md-3">
            <select class="form-select" id="sortSelect" aria-label="Sắp xếp">
              ${config.sortOptions.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("")}
            </select>
          </div>
          <div class="col-6 col-md-2">
            <select class="form-select" id="pageSizeSelect" aria-label="Số dòng mỗi trang">
              ${APP_CONFIG.pageSizeOptions.map((size) => `<option value="${size}">${size} dòng/trang</option>`).join("")}
            </select>
          </div>
          <div class="col-md text-md-end">
            <button class="btn btn-primary" id="addButton" type="button">
              <i class="bi bi-plus-lg me-1"></i>Thêm ${escapeHtml(config.entityLabel)}
            </button>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              ${config.columns.map((column) => `<th class="${column.className || ""}">${escapeHtml(column.label)}</th>`).join("")}
              <th class="text-end">Thao tác</th>
            </tr>
          </thead>
          <tbody id="entityTableBody">
            <tr><td colspan="${config.columns.length + 1}" class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></td></tr>
          </tbody>
        </table>
      </div>

      <div class="card-body border-top" id="paginationContainer"></div>
    </div>

    <!-- Modal thêm / sửa -->
    <div class="modal fade" id="entityModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <form class="modal-content" id="entityForm" novalidate>
          <div class="modal-header">
            <h5 class="modal-title" id="entityModalTitle"></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">${config.fields.map(renderFormField).join("")}</div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Huỷ</button>
            <button type="submit" class="btn btn-primary" id="entitySaveButton"><i class="bi bi-check-lg me-1"></i>Lưu</button>
          </div>
        </form>
      </div>
    </div>`;

  const tableBody = document.getElementById("entityTableBody");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const pageSizeSelect = document.getElementById("pageSizeSelect");
  const paginationContainer = document.getElementById("paginationContainer");
  const modalElement = document.getElementById("entityModal");
  const modal = new bootstrap.Modal(modalElement);
  const form = document.getElementById("entityForm");
  const saveButton = document.getElementById("entitySaveButton");

  // --------------------------- Truy vấn theo bộ lọc ---------------------------
  function getConstraints() {
    const searchToken = searchInput ? toSearchToken(searchInput.value) : "";
    if (searchToken) {
      // Khi tìm kiếm: luôn sắp theo tên (đã có composite index searchKeywords + name)
      return [where("searchKeywords", "array-contains", searchToken), orderBy("name", "asc")];
    }
    const sortOption = config.sortOptions.find((option) => option.value === sortSelect.value) || config.sortOptions[0];
    return [orderBy(sortOption.field, sortOption.direction)];
  }

  const paginatedList = new PaginatedList({
    collectionRef,
    getConstraints,
    pageSize: Number(pageSizeSelect.value),
    onPage: (pageState) => {
      lastPageState = pageState;
      renderRows(pageState.docs);
      drawPagination();
    },
    onCount: (count) => {
      totalCount = count;
      drawPagination();
    },
    onError: (error) => {
      tableBody.innerHTML = `<tr><td colspan="${config.columns.length + 1}" class="text-center text-danger py-4">Không tải được dữ liệu</td></tr>`;
      showError(error, `Không tải được danh sách ${config.entityLabel}.`);
    }
  });

  function drawPagination() {
    renderPagination(paginationContainer, lastPageState, totalCount, paginatedList.pageSize, {
      onPrev: () => paginatedList.previousPage(),
      onNext: () => paginatedList.nextPage()
    });
  }

  // ------------------------------ Vẽ bảng ------------------------------
  function renderRows(docs) {
    currentItems.clear();
    if (docs.length === 0) {
      const isSearching = searchInput && searchInput.value.trim();
      tableBody.innerHTML = `
        <tr><td colspan="${config.columns.length + 1}">
          <div class="empty-state"><i class="bi ${config.icon}"></i>
            ${isSearching ? "Không tìm thấy kết quả phù hợp" : `Chưa có ${escapeHtml(config.entityLabel)} nào`}
          </div>
        </td></tr>`;
      return;
    }

    tableBody.innerHTML = docs.map((snapshot) => {
      const item = snapshot.data({ serverTimestamps: "estimate" });
      currentItems.set(snapshot.id, item);
      return `
        <tr data-id="${escapeHtml(snapshot.id)}">
          ${config.columns.map((column) => `<td class="${column.className || ""}">${column.render(item, snapshot.id)}</td>`).join("")}
          <td class="actions">
            <button class="btn btn-sm btn-outline-primary" type="button" data-action="edit" title="Sửa" aria-label="Sửa">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete" title="Xoá" aria-label="Xoá">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>`;
    }).join("");

    if (typeof config.afterRenderRows === "function") {
      const rows = [...tableBody.querySelectorAll("tr[data-id]")].map((rowElement) => ({
        id: rowElement.dataset.id,
        item: currentItems.get(rowElement.dataset.id),
        rowElement
      }));
      config.afterRenderRows(rows);
    }
  }

  // Bấm nút Sửa / Xoá trong bảng (event delegation)
  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.closest("tr").dataset.id;
    if (button.dataset.action === "edit") openForm(id);
    if (button.dataset.action === "delete") handleDelete(id, button);
  });

  // ------------------------------ Form ------------------------------
  function openForm(id = null) {
    editingId = id;
    form.reset();
    form.classList.remove("was-validated");
    document.getElementById("entityModalTitle").textContent =
      id ? `Sửa ${config.entityLabel}` : `Thêm ${config.entityLabel}`;

    if (id) {
      const item = currentItems.get(id) || {};
      config.fields.forEach((field) => {
        form.elements[field.name].value = item[field.name] ?? "";
      });
    }
    modal.show();
  }

  modalElement.addEventListener("shown.bs.modal", () => {
    form.elements[config.fields[0].name]?.focus();
  });

  function readFormValues() {
    const values = {};
    config.fields.forEach((field) => {
      values[field.name] = String(form.elements[field.name].value || "").trim();
    });
    return values;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Chặn chuỗi toàn khoảng trắng ở field bắt buộc
    config.fields.forEach((field) => {
      const input = form.elements[field.name];
      input.setCustomValidity(field.required && !input.value.trim() ? "required" : "");
    });
    form.classList.add("was-validated");
    if (!form.checkValidity()) return;

    const values = readFormValues();
    const dataToSave = { ...values };
    if (config.searchable) {
      dataToSave.searchKeywords = buildSearchKeywords(...(config.searchFields || ["name"]).map((name) => values[name]));
    }

    setButtonLoading(saveButton, true, "Đang lưu...");
    try {
      if (editingId) {
        const oldItem = currentItems.get(editingId);
        await updateDoc(doc(db, config.collectionName, editingId), {
          ...dataToSave,
          updatedAt: serverTimestamp()
        });
        if (typeof config.afterUpdate === "function") {
          await config.afterUpdate(editingId, values, oldItem);
        }
        showToast(`Đã cập nhật ${config.entityLabel} "${values.name}".`);
      } else {
        const defaults = typeof config.getCreateDefaults === "function" ? config.getCreateDefaults() : {};
        await addDoc(collectionRef, {
          ...defaults,
          ...dataToSave,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showToast(`Đã thêm ${config.entityLabel} "${values.name}".`);
        paginatedList.refreshCount();
      }
      modal.hide();
    } catch (error) {
      showError(error, `Không lưu được ${config.entityLabel}.`);
    } finally {
      setButtonLoading(saveButton, false);
    }
  });

  // ------------------------------ Xoá ------------------------------
  async function handleDelete(id, button) {
    const item = currentItems.get(id);
    if (!item) return;

    const confirmed = await confirmDialog(
      `Xoá ${config.entityLabel} "${item.name}"? Thao tác này không thể hoàn tác.`,
      { title: `Xoá ${config.entityLabel}`, confirmText: "Xoá" }
    );
    if (!confirmed) return;

    setButtonLoading(button, true, "");
    try {
      if (typeof config.beforeDelete === "function") {
        const blockReason = await config.beforeDelete(id, item);
        if (blockReason) throw createAppError(blockReason);
      }
      await deleteDoc(doc(db, config.collectionName, id));
      showToast(`Đã xoá ${config.entityLabel} "${item.name}".`);
      paginatedList.refreshCount();
    } catch (error) {
      showError(error, `Không xoá được ${config.entityLabel}.`);
      setButtonLoading(button, false);
    }
  }

  // --------------------------- Sự kiện bộ lọc ---------------------------
  document.getElementById("addButton").addEventListener("click", () => openForm());

  sortSelect.addEventListener("change", () => paginatedList.reload());
  pageSizeSelect.addEventListener("change", () => paginatedList.setPageSize(Number(pageSizeSelect.value)));

  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      // Đang tìm kiếm thì luôn sắp theo tên -> khoá ô sắp xếp cho đỡ nhầm
      sortSelect.disabled = Boolean(searchInput.value.trim());
      paginatedList.reload();
    }, 400));
  }

  paginatedList.reload();
}

// Sinh HTML cho 1 field trong form
function renderFormField(field) {
  const id = `field-${field.name}`;
  const commonAttributes = `
    id="${id}" name="${field.name}"
    ${field.required ? "required" : ""}
    ${field.maxLength ? `maxlength="${field.maxLength}"` : ""}
    ${field.pattern ? `pattern="${field.pattern}"` : ""}
    placeholder="${escapeHtml(field.placeholder || "")}"`;

  const input = field.type === "textarea"
    ? `<textarea class="form-control" rows="3" ${commonAttributes}></textarea>`
    : `<input type="${field.type || "text"}" class="form-control" ${commonAttributes}>`;

  return `
    <div class="${field.colClass || "col-12"}">
      <label for="${id}" class="form-label">${escapeHtml(field.label)}${field.required ? ' <span class="text-danger">*</span>' : ""}</label>
      ${input}
      <div class="invalid-feedback">${escapeHtml(field.invalidMessage || (field.required ? `Vui lòng nhập ${field.label.toLowerCase()}.` : "Giá trị không hợp lệ."))}</div>
    </div>`;
}
