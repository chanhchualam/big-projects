// =====================================================================
// File: js/search-picker.js
// Đường dẫn: chi tiêu/js/search-picker.js
// Mục đích: Ô tìm kiếm có danh sách gợi ý để chọn hàng hoá
//           khi lập phiếu nhập, hoá đơn. Chỉ truy vấn tối đa vài kết quả
//           (array-contains searchKeywords + limit), không tải cả collection.
//
// - Gõ tên / mã (không dấu cũng được) -> hiện gợi ý
// - Phím ↑ ↓ để chọn, Enter để thêm (dùng được với máy quét mã vạch:
//   máy quét gõ mã rồi tự nhấn Enter)
// =====================================================================

import { db, collection, query, where, orderBy, limit, getDocs } from "./firebase.js";
import { debounce, toSearchToken, escapeHtml, showError } from "./utils.js";

/**
 * @param {object} options
 * @param {HTMLInputElement} options.input
 * @param {string} options.collectionName
 * @param {(item, id) => string} options.renderItem   HTML 1 dòng gợi ý
 * @param {(item, id) => void} options.onSelect
 * @param {number} [options.maxResults=8]
 * @param {(item) => boolean} [options.isDisabled]    dòng không cho chọn (vd: hết hàng)
 */
export function createSearchPicker({ input, collectionName, renderItem, onSelect, maxResults = 8, isDisabled }) {
  // Khung gợi ý đặt ngay dưới ô nhập
  const wrapper = input.closest(".search-picker") || input.parentElement;
  wrapper.classList.add("position-relative");
  const dropdown = document.createElement("div");
  dropdown.className = "list-group position-absolute w-100 shadow d-none";
  dropdown.style.zIndex = "1060";
  dropdown.style.top = "100%";
  dropdown.style.maxHeight = "320px";
  dropdown.style.overflowY = "auto";
  dropdown.setAttribute("role", "listbox");
  wrapper.appendChild(dropdown);

  input.setAttribute("autocomplete", "off");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");

  let results = []; // [{ id, item }]
  let activeIndex = -1;
  let requestVersion = 0;

  function close() {
    dropdown.classList.add("d-none");
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function render() {
    if (results.length === 0) {
      dropdown.innerHTML = `<div class="list-group-item text-muted small">Không tìm thấy kết quả</div>`;
    } else {
      dropdown.innerHTML = results.map(({ id, item }, index) => {
        const disabled = isDisabled ? isDisabled(item) : false;
        return `
          <button type="button" class="list-group-item list-group-item-action ${index === activeIndex ? "active" : ""} ${disabled ? "disabled" : ""}"
                  data-index="${index}" role="option" ${disabled ? 'aria-disabled="true"' : ""}>
            ${renderItem(item, id)}
          </button>`;
      }).join("");
    }
    dropdown.classList.remove("d-none");
    input.setAttribute("aria-expanded", "true");
  }

  function selectAt(index) {
    const result = results[index];
    if (!result) return;
    if (isDisabled && isDisabled(result.item)) return;
    onSelect(result.item, result.id);
    input.value = "";
    results = [];
    close();
    input.focus();
  }

  async function search() {
    const token = toSearchToken(input.value);
    if (!token) {
      results = [];
      close();
      return;
    }
    const version = ++requestVersion;
    try {
      const snapshot = await getDocs(query(
        collection(db, collectionName),
        where("searchKeywords", "array-contains", token),
        orderBy("name", "asc"),
        limit(maxResults)
      ));
      if (version !== requestVersion) return; // đã có lượt gõ mới hơn
      results = snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, item: snapshotDoc.data() }));
      // Ưu tiên kết quả trùng khớp mã chính xác (máy quét mã vạch)
      const exactCode = input.value.trim().toUpperCase();
      results.sort((a, b) => Number(b.item.code === exactCode) - Number(a.item.code === exactCode));
      activeIndex = results.length > 0 ? 0 : -1;
      render();
    } catch (error) {
      showError(error, "Không tìm kiếm được.");
    }
  }

  const debouncedSearch = debounce(search, 250);
  input.addEventListener("input", debouncedSearch);

  input.addEventListener("keydown", async (event) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % results.length;
      render();
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + results.length) % results.length;
      render();
    } else if (event.key === "Enter") {
      event.preventDefault(); // không submit form
      if (dropdown.classList.contains("d-none") || results.length === 0) await search();
      if (activeIndex >= 0) selectAt(activeIndex);
    } else if (event.key === "Escape") {
      close();
    }
  });

  // mousedown thay vì click: chạy trước sự kiện blur của ô nhập
  dropdown.addEventListener("mousedown", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    event.preventDefault();
    selectAt(Number(button.dataset.index));
  });

  input.addEventListener("blur", () => setTimeout(close, 150));
  input.addEventListener("focus", () => {
    if (results.length && input.value.trim()) render();
  });

  return {
    clear() {
      input.value = "";
      results = [];
      close();
    }
  };
}

// Tiện ích: HTML 1 dòng gợi ý hàng hoá (dùng chung cho nhập kho / bán hàng)
export function renderProductSuggestion(product, { showStock = true } = {}) {
  const thumb = product.thumbnailUrl
    ? `<img src="${escapeHtml(product.thumbnailUrl)}" class="product-thumb" alt="">`
    : `<span class="product-thumb-placeholder"><i class="bi bi-image"></i></span>`;
  const stockClass = product.stock <= 0 ? "text-danger" : product.isLowStock ? "text-warning" : "text-success";
  return `
    <div class="d-flex align-items-center gap-2 text-start">
      ${thumb}
      <div class="flex-grow-1 min-w-0">
        <div class="fw-semibold text-truncate">${escapeHtml(product.name)}</div>
        <div class="small opacity-75">${escapeHtml(product.code)} · ${escapeHtml(product.unit)}</div>
      </div>
      ${showStock ? `<div class="small text-end ${stockClass}">Tồn<br><strong>${escapeHtml(String(product.stock))}</strong></div>` : ""}
    </div>`;
}
