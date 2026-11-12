// =====================================================================
// File: js/dashboard.js
// Đường dẫn: chi tiêu/js/dashboard.js
// Mục đích: Trang tổng quan — số liệu hôm nay (aggregate query, không
//           tải cả collection) + danh sách realtime (onSnapshot).
// =====================================================================

import {
  db,
  COLLECTIONS,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  count,
  Timestamp
} from "./firebase.js";
import {
  escapeHtml,
  formatCurrency,
  formatNumber,
  formatDateTime,
  startOfDay,
  showError
} from "./utils.js";

export async function initDashboard() {
  listenRecentInvoices();
  listenLowStockProducts();
  await loadSummaryCards();
}

// ---------------------------------------------------------------------
// Thẻ tổng quan: dùng count()/sum() phía server -> chỉ tốn ~1 lượt đọc
// cho mỗi 1000 document, thay vì tải toàn bộ dữ liệu về trình duyệt.
// ---------------------------------------------------------------------
async function loadSummaryCards() {
  const todayStart = Timestamp.fromDate(startOfDay(new Date()));
  const productsRef = collection(db, COLLECTIONS.PRODUCTS);
  const invoicesRef = collection(db, COLLECTIONS.INVOICES);

  const todayInvoicesQuery = query(
    invoicesRef,
    where("status", "==", "completed"),
    where("invoiceDate", ">=", todayStart)
  );

  const [productResult, lowStockResult, todayResult] = await Promise.allSettled([
    getCountFromServer(productsRef),
    getCountFromServer(query(productsRef, where("isLowStock", "==", true))),
    getAggregateFromServer(todayInvoicesQuery, { revenue: sum("total"), invoiceCount: count() })
  ]);

  setStatValue("statProductCount", productResult, (snapshot) => formatNumber(snapshot.data().count));
  setStatValue("statLowStock", lowStockResult, (snapshot) => formatNumber(snapshot.data().count));
  setStatValue("statTodayRevenue", todayResult, (snapshot) => formatCurrency(snapshot.data().revenue || 0));
  setStatValue("statTodayInvoices", todayResult, (snapshot) => formatNumber(snapshot.data().invoiceCount));

  const firstError = [productResult, lowStockResult, todayResult].find((result) => result.status === "rejected");
  if (firstError) showError(firstError.reason, "Không tải được số liệu tổng quan.");
}

function setStatValue(elementId, settledResult, formatValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = settledResult.status === "fulfilled" ? formatValue(settledResult.value) : "—";
}

// ---------------------------------------------------------------------
// 5 hoá đơn mới nhất — realtime
// ---------------------------------------------------------------------
function listenRecentInvoices() {
  const tableBody = document.getElementById("recentInvoicesBody");
  const recentQuery = query(
    collection(db, COLLECTIONS.INVOICES),
    orderBy("invoiceDate", "desc"),
    limit(5)
  );

  onSnapshot(
    recentQuery,
    (snapshot) => {
      if (snapshot.empty) {
        tableBody.innerHTML = `
          <tr><td colspan="3"><div class="empty-state py-4"><i class="bi bi-receipt"></i>Chưa có hoá đơn nào</div></td></tr>`;
        return;
      }
      tableBody.innerHTML = snapshot.docs.map((invoiceDoc) => {
        // serverTimestamps: "estimate" -> hiển thị giờ tạm khi bản ghi vừa tạo chưa lên server
        const invoice = invoiceDoc.data({ serverTimestamps: "estimate" });
        const isCancelled = invoice.status === "cancelled";
        return `
          <tr class="${isCancelled ? "text-decoration-line-through text-muted" : ""}">
            <td class="fw-semibold">${escapeHtml(invoice.code)}</td>
            <td class="small">${formatDateTime(invoice.invoiceDate)}</td>
            <td class="text-end text-money">${formatCurrency(invoice.total)}</td>
          </tr>`;
      }).join("");
    },
    (error) => {
      tableBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">Không tải được hoá đơn</td></tr>`;
      showError(error, "Không tải được hoá đơn gần đây.");
    }
  );
}

// ---------------------------------------------------------------------
// Hàng sắp hết (isLowStock = true, tồn ít nhất lên đầu) — realtime
// Firestore không so sánh 2 field (stock <= minStock) trong query được,
// nên ta lưu sẵn cờ isLowStock và cập nhật nó mỗi lần tồn kho thay đổi.
// ---------------------------------------------------------------------
function listenLowStockProducts() {
  const listElement = document.getElementById("lowStockList");
  const lowStockQuery = query(
    collection(db, COLLECTIONS.PRODUCTS),
    where("isLowStock", "==", true),
    orderBy("stock", "asc"),
    limit(8)
  );

  onSnapshot(
    lowStockQuery,
    (snapshot) => {
      if (snapshot.empty) {
        listElement.innerHTML = `
          <li class="list-group-item"><div class="empty-state py-4"><i class="bi bi-check2-circle text-success"></i>Không có hàng sắp hết</div></li>`;
        return;
      }
      listElement.innerHTML = snapshot.docs.map((productDoc) => {
        const product = productDoc.data();
        const badgeClass = product.stock <= 0 ? "text-bg-danger" : "text-bg-warning";
        return `
          <li class="list-group-item d-flex align-items-center gap-2">
            <div class="flex-grow-1 min-w-0">
              <div class="fw-semibold text-truncate">${escapeHtml(product.name)}</div>
              <div class="small text-muted">${escapeHtml(product.code)} · Tối thiểu: ${formatNumber(product.minStock)} ${escapeHtml(product.unit)}</div>
            </div>
            <span class="badge ${badgeClass}">${formatNumber(product.stock)} ${escapeHtml(product.unit)}</span>
          </li>`;
      }).join("");
    },
    (error) => {
      listElement.innerHTML = `<li class="list-group-item text-center text-danger py-3">Không tải được danh sách</li>`;
      showError(error, "Không tải được danh sách hàng sắp hết.");
    }
  );
}
