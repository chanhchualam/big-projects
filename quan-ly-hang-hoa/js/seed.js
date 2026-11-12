// =====================================================================
// File: js/seed.js
// Đường dẫn: chi tiêu/js/seed.js
// Mục đích: Nạp / xoá DỮ LIỆU MẪU để thử ứng dụng, và đếm số document
//           trong từng collection (kiểm tra dữ liệu đã lên Firestore).
//
// - Mọi document mẫu có id cố định bắt đầu bằng "sample-" -> xoá được
//   chính xác, không đụng tới dữ liệu thật của bạn.
// - Ghi bằng writeBatch: tất cả thành công hoặc không có gì được ghi.
// =====================================================================

import {
  db,
  COLLECTIONS,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  documentId,
  writeBatch,
  deleteField,
  serverTimestamp,
  getCountFromServer
} from "./firebase.js";
import {
  showToast,
  showError,
  confirmDialog,
  setButtonLoading,
  buildSearchKeywords,
  formatNumber,
  escapeHtml
} from "./utils.js";
import { recompressStoredDataUrl, createThumbnailDataUrl, estimateDataUrlBytes } from "./image-upload.js";

const PRODUCT_IMAGES_COLLECTION = "product_images";

// ------------------------------ DỮ LIỆU MẪU ------------------------------
const SAMPLE_CATEGORIES = [
  { id: "sample-cat-douong", name: "Đồ uống", description: "Nước ngọt, nước suối, cà phê, trà" },
  { id: "sample-cat-banhkeo", name: "Bánh kẹo", description: "Bánh quy, kẹo, snack" },
  { id: "sample-cat-giavi", name: "Gia vị", description: "Nước mắm, dầu ăn, bột ngọt" },
  { id: "sample-cat-hoapham", name: "Hoá mỹ phẩm", description: "Dầu gội, sữa tắm, bột giặt" },
  { id: "sample-cat-giadung", name: "Đồ gia dụng", description: "Đồ dùng trong nhà" }
];

// Đã bỏ chức năng Nhà cung cấp / Khách hàng. Giữ id dữ liệu mẫu cũ để nút
// "Xoá dữ liệu mẫu" dọn sạch các bản ghi mẫu đã nạp trước đây.
const LEGACY_SAMPLE_SUPPLIER_IDS = ["sample-sup-1", "sample-sup-2", "sample-sup-3"];
const LEGACY_SAMPLE_CUSTOMER_IDS = ["sample-cus-1", "sample-cus-2", "sample-cus-3"];

const SAMPLE_PRODUCTS = [
  { id: "sample-prd-01", code: "SP001", name: "Nước suối Aquafina 500ml", categoryId: "sample-cat-douong", unit: "chai", costPrice: 3500, salePrice: 5000, stock: 120, minStock: 24 },
  { id: "sample-prd-02", code: "SP002", name: "Coca-Cola lon 330ml", categoryId: "sample-cat-douong", unit: "lon", costPrice: 7000, salePrice: 10000, stock: 8, minStock: 24 },
  { id: "sample-prd-03", code: "SP003", name: "Cà phê sữa G7 hộp 18 gói", categoryId: "sample-cat-douong", unit: "hộp", costPrice: 42000, salePrice: 52000, stock: 30, minStock: 5 },
  { id: "sample-prd-04", code: "SP004", name: "Trà xanh Không Độ 455ml", categoryId: "sample-cat-douong", unit: "chai", costPrice: 6500, salePrice: 10000, stock: 48, minStock: 12 },
  { id: "sample-prd-05", code: "SP005", name: "Bánh Chocopie hộp 12 cái", categoryId: "sample-cat-banhkeo", unit: "hộp", costPrice: 45000, salePrice: 58000, stock: 15, minStock: 5 },
  { id: "sample-prd-06", code: "SP006", name: "Snack khoai tây Lay's 52g", categoryId: "sample-cat-banhkeo", unit: "gói", costPrice: 9000, salePrice: 13000, stock: 3, minStock: 10 },
  { id: "sample-prd-07", code: "SP007", name: "Kẹo dẻo Haribo 80g", categoryId: "sample-cat-banhkeo", unit: "gói", costPrice: 18000, salePrice: 25000, stock: 25, minStock: 6 },
  { id: "sample-prd-08", code: "SP008", name: "Nước mắm Nam Ngư 750ml", categoryId: "sample-cat-giavi", unit: "chai", costPrice: 32000, salePrice: 41000, stock: 20, minStock: 6 },
  { id: "sample-prd-09", code: "SP009", name: "Dầu ăn Neptune 1 lít", categoryId: "sample-cat-giavi", unit: "chai", costPrice: 48000, salePrice: 59000, stock: 0, minStock: 5 },
  { id: "sample-prd-10", code: "SP010", name: "Dầu gội Clear 650g", categoryId: "sample-cat-hoapham", unit: "chai", costPrice: 135000, salePrice: 169000, stock: 10, minStock: 3 },
  { id: "sample-prd-11", code: "SP011", name: "Bột giặt OMO 3kg", categoryId: "sample-cat-hoapham", unit: "túi", costPrice: 165000, salePrice: 199000, stock: 4, minStock: 4 },
  { id: "sample-prd-12", code: "SP012", name: "Khăn giấy Pulppy hộp 100 tờ", categoryId: "sample-cat-giadung", unit: "hộp", costPrice: 14000, salePrice: 20000, stock: 40, minStock: 10 }
];

// Các collection hiển thị ở bảng thống kê
const COLLECTIONS_TO_COUNT = [
  { name: COLLECTIONS.CATEGORIES, label: "Danh mục" },
  { name: COLLECTIONS.PRODUCTS, label: "Hàng hoá" },
  { name: "product_images", label: "Ảnh sản phẩm" },
  { name: COLLECTIONS.IMPORTS, label: "Phiếu nhập" },
  { name: COLLECTIONS.INVOICES, label: "Hoá đơn" },
  { name: COLLECTIONS.STOCK_LOGS, label: "Lịch sử kho" },
  { name: COLLECTIONS.COUNTERS, label: "Bộ đếm số phiếu" }
];

function getCategoryName(categoryId) {
  return SAMPLE_CATEGORIES.find((category) => category.id === categoryId)?.name || "";
}

// --------------------------- NẠP DỮ LIỆU MẪU ---------------------------
async function seedSampleData() {
  // Không ghi đè: rules không cho đổi createdAt của document đã có
  const existing = await getDoc(doc(db, COLLECTIONS.CATEGORIES, SAMPLE_CATEGORIES[0].id));
  if (existing.exists()) {
    showToast("Dữ liệu mẫu đã có sẵn. Hãy bấm \"Xoá dữ liệu mẫu\" trước nếu muốn nạp lại.", "warning", 5000);
    return false;
  }

  const batch = writeBatch(db);
  const now = serverTimestamp();

  SAMPLE_CATEGORIES.forEach(({ id, ...category }) => {
    batch.set(doc(db, COLLECTIONS.CATEGORIES, id), { ...category, createdAt: now, updatedAt: now });
  });

  SAMPLE_PRODUCTS.forEach(({ id, ...product }) => {
    batch.set(doc(db, COLLECTIONS.PRODUCTS, id), {
      ...product,
      categoryName: getCategoryName(product.categoryId), // denormalize để hiển thị nhanh
      isLowStock: product.stock <= product.minStock,
      stockValue: Math.round(product.stock * product.costPrice),
      imageUrls: [],
      thumbnailUrl: null,
      imageCount: 0,
      description: "",
      searchKeywords: buildSearchKeywords(product.name, product.code),
      lastSoldAt: now, // tính "tồn lâu" từ ngày thêm nếu chưa bán lần nào
      totalSold: 0,
      createdAt: now,
      updatedAt: now
    });

    // Ghi lịch sử kho: tồn đầu kỳ
    batch.set(doc(db, COLLECTIONS.STOCK_LOGS, `sample-log-${id}`), {
      productId: id,
      productCode: product.code,
      productName: product.name,
      type: "initial",
      quantityChange: product.stock,
      stockBefore: 0,
      stockAfter: product.stock,
      refType: "seed",
      refId: null,
      refCode: null,
      note: "Tồn đầu kỳ (dữ liệu mẫu)",
      createdAt: now
    });
  });

  await batch.commit();
  return true;
}

// --------------------------- XOÁ DỮ LIỆU MẪU ---------------------------
async function deleteSampleData() {
  const batch = writeBatch(db);
  SAMPLE_CATEGORIES.forEach(({ id }) => batch.delete(doc(db, COLLECTIONS.CATEGORIES, id)));
  LEGACY_SAMPLE_SUPPLIER_IDS.forEach((id) => batch.delete(doc(db, COLLECTIONS.SUPPLIERS, id)));
  LEGACY_SAMPLE_CUSTOMER_IDS.forEach((id) => batch.delete(doc(db, COLLECTIONS.CUSTOMERS, id)));
  SAMPLE_PRODUCTS.forEach(({ id }) => {
    batch.delete(doc(db, COLLECTIONS.PRODUCTS, id));
    batch.delete(doc(db, "product_images", id));
    batch.delete(doc(db, COLLECTIONS.STOCK_LOGS, `sample-log-${id}`));
  });
  await batch.commit();
}

// ------------- TỐI ƯU & ĐỒNG BỘ DỮ LIỆU ĐÃ CÓ (chạy 1 lần, chạy lại vô hại) -------------
// Với MỖI hàng hoá:
//   - Tính lại stockValue (= tồn × giá vốn) và isLowStock cho báo cáo
//   - Sinh lại searchKeywords theo cách mới (gọn hơn)
//   - Có ảnh: nén lại ảnh gốc sang WebP/JPEG ~150KB và ảnh thu nhỏ ~10KB
//     (chỉ ghi nếu ảnh mới NHỎ HƠN ảnh cũ)
// Đọc theo trang (cursor documentId) để không tải cả collection 1 lần.
const OPTIMIZE_PAGE_SIZE = 50;
const THUMBNAIL_ALREADY_SMALL_BYTES = 16 * 1024;

async function forEachDocumentPage(collectionName, handlePage) {
  let lastDoc = null;
  while (true) {
    const constraints = [orderBy(documentId()), limit(OPTIMIZE_PAGE_SIZE)];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
    if (snapshot.empty) break;
    await handlePage(snapshot.docs);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < OPTIMIZE_PAGE_SIZE) break;
  }
}

async function optimizeExistingData(onProgress) {
  const stats = { products: 0, productsWithImages: 0, bytesBefore: 0, bytesAfter: 0, imageErrors: 0 };

  await forEachDocumentPage(COLLECTIONS.PRODUCTS, async (productDocs) => {
    const batch = writeBatch(db); // cập nhật nhẹ (không ảnh) gom 1 lần ghi
    let hasBatchWrites = false;

    for (const productDoc of productDocs) {
      const product = productDoc.data();
      const productUpdates = {
        stockValue: Math.max(Math.round(product.stock * product.costPrice), 0),
        isLowStock: product.stock <= product.minStock,
        searchKeywords: buildSearchKeywords(product.name, product.code),
        expiryDate: deleteField(), // đã bỏ tính năng hạn sử dụng -> dọn field cũ
        updatedAt: serverTimestamp()
      };

      let imageWriteDone = false;
      if (product.imageCount > 0) {
        try {
          const imagesRef = doc(db, PRODUCT_IMAGES_COLLECTION, productDoc.id);
          const imagesSnapshot = await getDoc(imagesRef);
          const oldImageUrls = imagesSnapshot.exists() ? imagesSnapshot.data().imageUrls || [] : [];
          const oldBytes = oldImageUrls.reduce((total, url) => total + estimateDataUrlBytes(url), 0)
            + estimateDataUrlBytes(product.thumbnailUrl);

          const newImageUrls = [];
          for (const url of oldImageUrls) newImageUrls.push(await recompressStoredDataUrl(url));
          const thumbnailIsSmall = estimateDataUrlBytes(product.thumbnailUrl) <= THUMBNAIL_ALREADY_SMALL_BYTES;
          const newThumbnailUrl = newImageUrls.length && !thumbnailIsSmall
            ? await createThumbnailDataUrl(newImageUrls[0])
            : product.thumbnailUrl;

          const newBytes = newImageUrls.reduce((total, url) => total + estimateDataUrlBytes(url), 0)
            + estimateDataUrlBytes(newThumbnailUrl);
          stats.bytesBefore += oldBytes;
          stats.bytesAfter += newBytes;
          stats.productsWithImages += 1;

          if (newBytes < oldBytes) {
            // Ảnh lớn -> ghi riêng từng sản phẩm (1 request tối đa 10MB)
            const imageBatch = writeBatch(db);
            imageBatch.set(imagesRef, { imageUrls: newImageUrls, updatedAt: serverTimestamp() });
            imageBatch.update(productDoc.ref, { ...productUpdates, thumbnailUrl: newThumbnailUrl, imageCount: newImageUrls.length });
            await imageBatch.commit();
            imageWriteDone = true;
          }
        } catch (error) {
          console.warn("Không tối ưu được ảnh của", productDoc.id, error);
          stats.imageErrors += 1;
        }
      }

      if (!imageWriteDone) {
        batch.update(productDoc.ref, productUpdates);
        hasBatchWrites = true;
      }
      stats.products += 1;
      onProgress(`Hàng hoá: ${stats.products}...`);
    }

    if (hasBatchWrites) await batch.commit();
  });

  return stats;
}

// --------------------- ĐẾM DOCUMENT TỪNG COLLECTION ---------------------
async function renderCollectionCounts() {
  const tableBody = document.getElementById("collectionCountsBody");
  tableBody.innerHTML = `<tr><td colspan="3" class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></td></tr>`;

  const results = await Promise.allSettled(
    COLLECTIONS_TO_COUNT.map((item) => getCountFromServer(collection(db, item.name)))
  );

  tableBody.innerHTML = COLLECTIONS_TO_COUNT.map((item, index) => {
    const result = results[index];
    const countText = result.status === "fulfilled"
      ? formatNumber(result.value.data().count)
      : `<span class="text-danger" title="${escapeHtml(result.reason?.message)}">lỗi</span>`;
    return `
      <tr>
        <td><code>${escapeHtml(item.name)}</code></td>
        <td>${escapeHtml(item.label)}</td>
        <td class="text-end fw-semibold">${countText}</td>
      </tr>`;
  }).join("");

  const firstError = results.find((result) => result.status === "rejected");
  if (firstError) showError(firstError.reason, "Không đếm được dữ liệu (kiểm tra Security Rules).");
}

// ------------------------------ KHỞI TẠO ------------------------------
export async function initSeedPage() {
  const seedButton = document.getElementById("seedButton");
  const deleteButton = document.getElementById("deleteSampleButton");
  const refreshButton = document.getElementById("refreshCountsButton");

  seedButton.addEventListener("click", async () => {
    setButtonLoading(seedButton, true, "Đang ghi lên Firestore...");
    try {
      const created = await seedSampleData();
      if (created) {
        showToast(`Đã nạp ${SAMPLE_CATEGORIES.length} danh mục, ${SAMPLE_PRODUCTS.length} hàng hoá.`);
        await renderCollectionCounts();
      }
    } catch (error) {
      showError(error, "Nạp dữ liệu mẫu thất bại.");
    } finally {
      setButtonLoading(seedButton, false);
    }
  });

  deleteButton.addEventListener("click", async () => {
    const confirmed = await confirmDialog(
      "Xoá toàn bộ dữ liệu mẫu (các bản ghi có mã bắt đầu bằng \"sample-\")? Dữ liệu bạn tự nhập sẽ KHÔNG bị ảnh hưởng.",
      { title: "Xoá dữ liệu mẫu", confirmText: "Xoá" }
    );
    if (!confirmed) return;
    setButtonLoading(deleteButton, true, "Đang xoá...");
    try {
      await deleteSampleData();
      showToast("Đã xoá dữ liệu mẫu.");
      await renderCollectionCounts();
    } catch (error) {
      showError(error, "Xoá dữ liệu mẫu thất bại.");
    } finally {
      setButtonLoading(deleteButton, false);
    }
  });

  refreshButton.addEventListener("click", renderCollectionCounts);

  const syncButton = document.getElementById("syncStatsButton");
  const resultBox = document.getElementById("optimizeResult");
  syncButton.addEventListener("click", async () => {
    const confirmed = await confirmDialog(
      "Tối ưu toàn bộ dữ liệu đã có: nén lại ảnh, làm gọn từ khoá tìm kiếm, tính lại giá trị tồn kho. " +
      "Có thể mất vài phút nếu nhiều ảnh — đừng đóng trang khi đang chạy.",
      { title: "Tối ưu & đồng bộ dữ liệu", confirmText: "Bắt đầu", confirmClass: "btn-primary" }
    );
    if (!confirmed) return;

    setButtonLoading(syncButton, true, "Đang tối ưu...");
    resultBox.classList.add("d-none");
    try {
      const stats = await optimizeExistingData((message) => {
        syncButton.lastChild.textContent = message;
      });
      const savedKB = Math.max(Math.round((stats.bytesBefore - stats.bytesAfter) / 1024), 0);
      const percent = stats.bytesBefore > 0 ? Math.round((savedKB * 1024 * 100) / stats.bytesBefore) : 0;
      resultBox.innerHTML = `
        <i class="bi bi-check-circle me-1"></i>Đã xử lý <strong>${formatNumber(stats.products)}</strong> hàng hoá
        (${formatNumber(stats.productsWithImages)} có ảnh).
        ${stats.bytesBefore > 0
          ? `<br>Ảnh: ${formatNumber(Math.round(stats.bytesBefore / 1024))}KB → ${formatNumber(Math.round(stats.bytesAfter / 1024))}KB
             (giảm <strong>${formatNumber(savedKB)}KB, ${percent}%</strong>).`
          : ""}
        ${stats.imageErrors ? `<br><span class="text-danger">${stats.imageErrors} sản phẩm không nén lại được ảnh (giữ nguyên ảnh cũ).</span>` : ""}`;
      resultBox.classList.remove("d-none");
      showToast("Đã tối ưu & đồng bộ dữ liệu.");
    } catch (error) {
      showError(error, "Tối ưu dữ liệu thất bại.");
    } finally {
      setButtonLoading(syncButton, false);
    }
  });

  await renderCollectionCounts();
}
