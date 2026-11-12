// =====================================================================
// File: js/categories.js
// Đường dẫn: chi tiêu/js/categories.js
// Mục đích: Cấu hình trang Danh mục hàng hoá
//  - Hiển thị số mặt hàng trong từng danh mục (count() phía server)
//  - Đổi tên danh mục -> cập nhật lại categoryName (denormalize) ở products
//  - Không cho xoá danh mục đang có hàng hoá
// =====================================================================

import {
  db,
  COLLECTIONS,
  collection,
  query,
  where,
  limit,
  getDocs,
  getCountFromServer,
  writeBatch,
  serverTimestamp
} from "./firebase.js";
import { escapeHtml, formatDate, formatNumber } from "./utils.js";
import { initEntityPage } from "./entity-page.js";

const productsRef = collection(db, COLLECTIONS.PRODUCTS);

// Firestore giới hạn 500 thao tác / batch -> chia nhỏ 400 cho an toàn
const BATCH_LIMIT = 400;

async function syncCategoryNameToProducts(categoryId, newName) {
  const snapshot = await getDocs(query(productsRef, where("categoryId", "==", categoryId)));
  for (let start = 0; start < snapshot.docs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    snapshot.docs.slice(start, start + BATCH_LIMIT).forEach((productDoc) => {
      batch.update(productDoc.ref, { categoryName: newName, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  }
  return snapshot.size;
}

export function initCategoriesPage() {
  initEntityPage({
    collectionName: COLLECTIONS.CATEGORIES,
    entityLabel: "danh mục",
    icon: "bi-tags",
    searchable: false,
    sortOptions: [
      { value: "name_asc", label: "Tên A → Z", field: "name", direction: "asc" },
      { value: "name_desc", label: "Tên Z → A", field: "name", direction: "desc" },
      { value: "created_desc", label: "Mới thêm", field: "createdAt", direction: "desc" }
    ],
    columns: [
      { label: "Tên danh mục", className: "fw-semibold", render: (item) => escapeHtml(item.name) },
      { label: "Mô tả", className: "text-muted", render: (item) => escapeHtml(item.description || "—") },
      {
        label: "Số mặt hàng",
        className: "text-center",
        render: () => `<span class="badge text-bg-light" data-role="productCount">…</span>`
      },
      { label: "Ngày tạo", className: "small text-nowrap", render: (item) => formatDate(item.createdAt) }
    ],
    fields: [
      { name: "name", label: "Tên danh mục", required: true, maxLength: 100, placeholder: "VD: Đồ uống" },
      { name: "description", label: "Mô tả", type: "textarea", maxLength: 500, placeholder: "Ghi chú thêm (không bắt buộc)" }
    ],

    // Đếm số mặt hàng của từng danh mục đang hiển thị (mỗi dòng 1 aggregate query)
    afterRenderRows: (rows) => {
      rows.forEach(async ({ id, rowElement }) => {
        const badge = rowElement.querySelector('[data-role="productCount"]');
        try {
          const snapshot = await getCountFromServer(query(productsRef, where("categoryId", "==", id)));
          badge.textContent = formatNumber(snapshot.data().count);
        } catch (error) {
          console.warn("Không đếm được mặt hàng của danh mục", id, error);
          badge.textContent = "—";
        }
      });
    },

    afterUpdate: async (id, values, oldItem) => {
      if (oldItem && oldItem.name !== values.name) {
        await syncCategoryNameToProducts(id, values.name);
      }
    },

    beforeDelete: async (id) => {
      const snapshot = await getDocs(query(productsRef, where("categoryId", "==", id), limit(1)));
      return snapshot.empty
        ? null
        : "Danh mục đang có hàng hoá. Hãy chuyển hoặc xoá các hàng hoá đó trước.";
    }
  });
}
