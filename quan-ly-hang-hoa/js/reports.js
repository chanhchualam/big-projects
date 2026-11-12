// =====================================================================
// File: js/reports.js
// Đường dẫn: chi tiêu/js/reports.js
// Mục đích: Trang Báo cáo thống kê
//
// Nguồn dữ liệu (đều là query CÓ ĐIỀU KIỆN, không tải cả collection):
//   - invoices  : where invoiceDate trong khoảng ngày (single-field index)
//   - imports   : where importDate trong khoảng ngày
//   - products  : sum("stockValue") + count()  -> giá trị tồn kho (aggregate)
//                 where lastSoldAt < hôm nay - N ngày  -> hàng tồn lâu (limit)
//                 where isLowStock == true             -> hàng sắp hết (limit)
//                 where createdAt trong khoảng ngày    -> sản phẩm mới (limit)
// Từ hoá đơn trong kỳ tính ra: doanh thu, giá vốn, lợi nhuận theo ngày/
// tháng, tỷ trọng theo danh mục, top hàng bán chạy.
// =====================================================================

import {
  db,
  COLLECTIONS,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getAggregateFromServer,
  getCountFromServer,
  sum,
  count,
  Timestamp
} from "./firebase.js";
import { APP_CONFIG, STORE_INFO } from "./config.js";
import {
  escapeHtml,
  showError,
  showToast,
  setButtonLoading,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  toDateInputValue,
  fromDateInputValue,
  startOfDay,
  endOfDay,
  toJsDate
} from "./utils.js";
import { exportReportToExcel, exportReportToPdf, downloadChartPng } from "./export.js";

// Giới hạn an toàn cho 1 lần tải (cửa hàng nhỏ hiếm khi vượt trong 1 kỳ)
const MAX_DOCS_PER_QUERY = 5000;
const DETAIL_TABLE_LIMIT = 50;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Bảng màu dễ phân biệt (cả với người mù màu), dùng chung mọi biểu đồ
const COLORS = {
  revenue: "#4f46e5",
  profit: "#16a34a",
  imports: "#f59e0b",
  palette: ["#4f46e5", "#16a34a", "#f59e0b", "#dc2626", "#0891b2", "#9333ea", "#db2777", "#65a30d", "#ea580c", "#64748b"]
};

const $ = (id) => document.getElementById(id);
const charts = {}; // id canvas -> đối tượng Chart
let currentReport = null;

// ---------------------------------------------------------------------
// Plugin Chart.js
// ---------------------------------------------------------------------
// Nền trắng: ảnh PNG/PDF xuất ra không bị nền trong suốt (đen khi in)
const whiteBackgroundPlugin = {
  id: "whiteBackground",
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
};

// Chữ "Chưa có dữ liệu" khi kỳ báo cáo trống
const emptyStatePlugin = {
  id: "emptyState",
  afterDraw(chart) {
    const hasData = chart.data.datasets.some((dataset) => dataset.data.some((value) => Number(value) !== 0));
    if (hasData) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    ctx.save();
    ctx.fillStyle = "#9ca3af";
    ctx.font = "14px 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Chưa có dữ liệu trong kỳ", (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
    ctx.restore();
  }
};

// Rút gọn số tiền cho trục biểu đồ: 1.500.000 -> "1,5tr"
function formatCompactMoney(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `${(value / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (absolute >= 1e6) return `${(value / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (absolute >= 1e3) return `${(value / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
  return String(value);
}

// =====================================================================
// KHỞI TẠO
// =====================================================================
export async function initReportsPage() {
  if (typeof window.Chart !== "function") {
    showToast("Không tải được thư viện biểu đồ. Kiểm tra mạng rồi tải lại trang.", "danger", 6000);
    return;
  }
  Chart.register(whiteBackgroundPlugin, emptyStatePlugin);
  Chart.defaults.font.family = "'Segoe UI', Roboto, Arial, sans-serif";
  Chart.defaults.maintainAspectRatio = false;

  bindFilterEvents();
  bindExportEvents();
  $("slowMovingHint").textContent = `(không bán được ≥ ${APP_CONFIG.slowMovingDays} ngày)`;
  await loadReport(getPresetRange("month"));
}

// =====================================================================
// KHOẢNG THỜI GIAN
// =====================================================================
function getPresetRange(preset) {
  const now = new Date();
  const to = endOfDay(now);
  const formatShort = (date) => date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to, label: `Hôm nay (${formatDate(now)})` };
    case "7days": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to, label: `7 ngày (${formatShort(from)} – ${formatDate(now)})` };
    }
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to, label: `Năm ${now.getFullYear()}` };
    case "month":
    default:
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to,
        label: `Tháng ${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`
      };
  }
}

function getCustomRange() {
  const from = fromDateInputValue($("customFrom").value);
  const to = fromDateInputValue($("customTo").value);
  if (!from || !to) {
    showToast("Vui lòng chọn đủ Từ ngày và Đến ngày.", "warning");
    return null;
  }
  if (from > to) {
    showToast("\"Từ ngày\" phải trước hoặc bằng \"Đến ngày\".", "warning");
    return null;
  }
  if ((to - from) / MS_PER_DAY > 366 * 3) {
    showToast("Khoảng ngày tối đa 3 năm.", "warning");
    return null;
  }
  return { from: startOfDay(from), to: endOfDay(to), label: `${formatDate(from)} – ${formatDate(to)}` };
}

function bindFilterEvents() {
  const today = toDateInputValue(new Date());
  $("customFrom").value = toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  $("customTo").value = today;
  $("customFrom").max = today;
  $("customTo").max = today;

  document.querySelectorAll('input[name="rangePreset"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const isCustom = radio.value === "custom";
      $("customFrom").disabled = !isCustom;
      $("customTo").disabled = !isCustom;
      $("applyCustomRange").classList.toggle("d-none", !isCustom);
      if (!isCustom) loadReport(getPresetRange(radio.value));
    });
  });

  $("applyCustomRange").addEventListener("click", () => {
    const range = getCustomRange();
    if (range) loadReport(range);
  });
}

// =====================================================================
// TẢI + TÍNH TOÁN DỮ LIỆU
// =====================================================================
async function loadReport(range) {
  setLoadingState(true);
  $("rangeLabel").textContent = range.label;

  const fromTimestamp = Timestamp.fromDate(range.from);
  const toTimestamp = Timestamp.fromDate(range.to);
  const productsRef = collection(db, COLLECTIONS.PRODUCTS);
  const slowMovingBefore = startOfDay(new Date());
  slowMovingBefore.setDate(slowMovingBefore.getDate() - APP_CONFIG.slowMovingDays);

  try {
    const [
      invoiceSnapshot,
      importSnapshot,
      inventoryAggregate,
      productsWithValueCount,
      slowMovingSnapshot,
      lowStockSnapshot,
      newProductsSnapshot
    ] = await Promise.all([
      getDocs(query(
        collection(db, COLLECTIONS.INVOICES),
        where("invoiceDate", ">=", fromTimestamp),
        where("invoiceDate", "<=", toTimestamp),
        orderBy("invoiceDate", "asc"),
        limit(MAX_DOCS_PER_QUERY)
      )),
      getDocs(query(
        collection(db, COLLECTIONS.IMPORTS),
        where("importDate", ">=", fromTimestamp),
        where("importDate", "<=", toTimestamp),
        orderBy("importDate", "asc"),
        limit(MAX_DOCS_PER_QUERY)
      )),
      getAggregateFromServer(productsRef, { inventoryValue: sum("stockValue"), productCount: count() }),
      getCountFromServer(query(productsRef, where("stockValue", ">=", 0))),
      getDocs(query(productsRef, where("lastSoldAt", "<", Timestamp.fromDate(slowMovingBefore)), orderBy("lastSoldAt", "asc"), limit(DETAIL_TABLE_LIMIT))),
      getDocs(query(productsRef, where("isLowStock", "==", true), orderBy("stock", "asc"), limit(DETAIL_TABLE_LIMIT))),
      getDocs(query(
        productsRef,
        where("createdAt", ">=", fromTimestamp),
        where("createdAt", "<=", toTimestamp),
        orderBy("createdAt", "desc"),
        limit(DETAIL_TABLE_LIMIT)
      ))
    ]);

    currentReport = buildReport({
      range,
      invoiceDocs: invoiceSnapshot.docs,
      importDocs: importSnapshot.docs,
      inventory: inventoryAggregate.data(),
      productsWithValueCount: productsWithValueCount.data().count,
      slowMovingDocs: slowMovingSnapshot.docs,
      lowStockDocs: lowStockSnapshot.docs,
      newProductDocs: newProductsSnapshot.docs
    });

    renderWarnings(currentReport, invoiceSnapshot.size, importSnapshot.size);
    renderSummaryCards(currentReport.summary);
    renderCharts(currentReport);
    renderTables(currentReport);
    $("reportLoadedAt").textContent = `Cập nhật lúc ${formatDateTime(currentReport.generatedAt)}`;
    setLoadingState(false);
  } catch (error) {
    setLoadingState(false, true);
    showError(error, "Không tải được báo cáo.");
  }
}

function setLoadingState(isLoading, hasError = false) {
  ["exportExcelButton", "exportPdfButton", "printReportButton"].forEach((id) => {
    $(id).disabled = isLoading || hasError;
  });
  if (isLoading) {
    ["cardRevenue", "cardImportCost", "cardProfit", "cardInvoiceCount", "cardInventoryValue"].forEach((id) => {
      $(id).innerHTML = `<span class="spinner-border spinner-border-sm text-secondary"></span>`;
    });
  }
}

function toDayKey(date) {
  return toDateInputValue(date); // YYYY-MM-DD
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Tạo đủ các mốc ngày/tháng trong kỳ (ngày không bán vẫn hiện 0 trên biểu đồ)
function buildTimeBuckets(from, to) {
  const totalDays = Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY) + 1;
  const groupByMonth = totalDays > 62;
  const buckets = [];
  const cursor = startOfDay(from);

  if (groupByMonth) {
    cursor.setDate(1);
    while (cursor <= to) {
      buckets.push({ key: toMonthKey(cursor), label: `${String(cursor.getMonth() + 1).padStart(2, "0")}/${cursor.getFullYear()}` });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    while (cursor <= to) {
      buckets.push({
        key: toDayKey(cursor),
        label: cursor.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return { groupByMonth, buckets, keyOf: (date) => (groupByMonth ? toMonthKey(date) : toDayKey(date)) };
}

function buildReport({ range, invoiceDocs, importDocs, inventory, productsWithValueCount, slowMovingDocs, lowStockDocs, newProductDocs }) {
  const allInvoices = invoiceDocs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data({ serverTimestamps: "estimate" }) }));
  const invoices = allInvoices.filter((invoice) => invoice.status === "completed");
  const allImports = importDocs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data({ serverTimestamps: "estimate" }) }));
  const imports = allImports.filter((importData) => importData.status === "completed");

  const { groupByMonth, buckets, keyOf } = buildTimeBuckets(range.from, range.to);
  const seriesByKey = new Map(buckets.map((bucket) => [bucket.key, {
    label: bucket.label, revenue: 0, costOfGoods: 0, profit: 0, invoiceCount: 0, importTotal: 0
  }]));

  const categoryRevenue = new Map(); // tên danh mục -> doanh thu
  const productStats = new Map(); // productId -> thống kê bán

  let revenue = 0;
  let costOfGoods = 0;
  let profit = 0;

  invoices.forEach((invoice) => {
    revenue += invoice.total;
    costOfGoods += invoice.totalCost;
    profit += invoice.profit;

    const point = seriesByKey.get(keyOf(toJsDate(invoice.invoiceDate)));
    if (point) {
      point.revenue += invoice.total;
      point.costOfGoods += invoice.totalCost;
      point.profit += invoice.profit;
      point.invoiceCount += 1;
    }

    // Phân bổ giảm giá của cả hoá đơn về từng dòng theo tỷ lệ thành tiền
    const discountRatio = invoice.subtotal > 0 ? invoice.total / invoice.subtotal : 1;
    invoice.items.forEach((item) => {
      const lineRevenue = item.lineTotal * discountRatio;
      const categoryName = item.categoryName || "Chưa phân loại";
      categoryRevenue.set(categoryName, (categoryRevenue.get(categoryName) || 0) + lineRevenue);

      const stats = productStats.get(item.productId) || {
        productId: item.productId, code: item.code, name: item.name, unit: item.unit,
        categoryName, quantity: 0, revenue: 0, profit: 0
      };
      stats.quantity += item.quantity;
      stats.revenue += lineRevenue;
      stats.profit += lineRevenue - (item.lineCost ?? item.costPrice * item.quantity);
      productStats.set(item.productId, stats);
    });
  });

  let importCost = 0;
  imports.forEach((importData) => {
    importCost += importData.total;
    const point = seriesByKey.get(keyOf(toJsDate(importData.importDate)));
    if (point) point.importTotal += importData.total;
  });

  const categories = [...categoryRevenue.entries()]
    .map(([name, value]) => ({ name, revenue: Math.round(value), percent: revenue > 0 ? (value / revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const topProducts = [...productStats.values()]
    .map((stats) => ({ ...stats, revenue: Math.round(stats.revenue), profit: Math.round(stats.profit) }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);

  const now = new Date();
  const slowMoving = slowMovingDocs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((product) => product.stock > 0)
    .map((product) => ({
      ...product,
      daysSinceSale: Math.floor((now - toJsDate(product.lastSoldAt)) / MS_PER_DAY)
    }));

  return {
    range,
    generatedAt: new Date(),
    groupByMonth,
    series: [...seriesByKey.values()],
    summary: {
      revenue,
      costOfGoods,
      profit,
      invoiceCount: invoices.length,
      cancelledInvoiceCount: allInvoices.length - invoices.length,
      importCost,
      importCount: imports.length,
      inventoryValue: inventory.inventoryValue || 0,
      productCount: inventory.productCount,
      productsMissingValue: Math.max(inventory.productCount - productsWithValueCount, 0)
    },
    categories,
    topProducts,
    slowMoving,
    lowStock: lowStockDocs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    newProducts: newProductDocs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data({ serverTimestamps: "estimate" }) })),
    invoices: allInvoices,
    imports: allImports
  };
}

// =====================================================================
// HIỂN THỊ
// =====================================================================
function renderWarnings(report, invoiceDocCount, importDocCount) {
  const messages = [];
  if (report.summary.productsMissingValue > 0) {
    messages.push(
      `${formatNumber(report.summary.productsMissingValue)} hàng hoá chưa có dữ liệu giá trị tồn kho nên "Giá trị tồn kho" đang thiếu. ` +
      `Vào <a href="seed.html" class="alert-link">Dữ liệu mẫu</a> → bấm <strong>Tối ưu ngay</strong> (chỉ cần 1 lần).`
    );
  }
  if (invoiceDocCount >= MAX_DOCS_PER_QUERY || importDocCount >= MAX_DOCS_PER_QUERY) {
    messages.push(`Kỳ báo cáo có hơn ${formatNumber(MAX_DOCS_PER_QUERY)} chứng từ — chỉ tính ${formatNumber(MAX_DOCS_PER_QUERY)} chứng từ đầu. Hãy chọn khoảng ngày ngắn hơn.`);
  }
  const warningBox = $("reportWarning");
  warningBox.innerHTML = messages.map((message) => `<div><i class="bi bi-exclamation-triangle me-1"></i>${message}</div>`).join("");
  warningBox.classList.toggle("d-none", messages.length === 0);
}

function renderSummaryCards(summary) {
  $("cardRevenue").textContent = formatCurrency(summary.revenue);
  $("cardImportCost").textContent = formatCurrency(summary.importCost);
  $("cardProfit").textContent = formatCurrency(summary.profit);
  $("cardProfit").classList.toggle("text-danger", summary.profit < 0);
  $("cardCostOfGoods").textContent = `Giá vốn hàng bán: ${formatCurrency(summary.costOfGoods)}`;
  $("cardInvoiceCount").textContent = formatNumber(summary.invoiceCount);
  $("cardInventoryValue").textContent = formatCurrency(summary.inventoryValue);
}

function createChart(canvasId, config) {
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart($(canvasId), config);
}

const moneyTooltip = {
  callbacks: {
    label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? context.parsed.x ?? context.parsed)}`
  }
};

function renderCharts(report) {
  const labels = report.series.map((point) => point.label);
  $("revenueChartUnit").textContent = report.groupByMonth ? "(theo tháng)" : "(theo ngày)";

  // 1) Cột + đường: doanh thu và lợi nhuận theo ngày/tháng
  createChart("revenueChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { type: "bar", label: "Doanh thu", data: report.series.map((point) => point.revenue), backgroundColor: COLORS.revenue, borderRadius: 4, order: 2 },
        {
          type: "line", label: "Lợi nhuận", data: report.series.map((point) => point.profit),
          borderColor: COLORS.profit, backgroundColor: COLORS.profit, tension: 0.3, pointRadius: 3, order: 1
        }
      ]
    },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: { tooltip: moneyTooltip, legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, ticks: { callback: formatCompactMoney } } }
    }
  });

  // 2) Tròn: tỷ trọng doanh thu theo danh mục
  createChart("categoryChart", {
    type: "doughnut",
    data: {
      labels: report.categories.map((category) => category.name),
      datasets: [{
        label: "Doanh thu",
        data: report.categories.map((category) => category.revenue),
        backgroundColor: report.categories.map((_, index) => COLORS.palette[index % COLORS.palette.length]),
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => {
              const category = report.categories[context.dataIndex];
              return `${category.name}: ${formatCurrency(category.revenue)} (${category.percent.toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });

  // 3) Cột ngang: top 10 hàng bán chạy theo số lượng
  const top10 = report.topProducts.slice(0, 10);
  createChart("topProductsChart", {
    type: "bar",
    data: {
      labels: top10.map((product) => (product.name.length > 28 ? `${product.name.slice(0, 27)}…` : product.name)),
      datasets: [{ label: "Số lượng bán", data: top10.map((product) => product.quantity), backgroundColor: COLORS.revenue, borderRadius: 4 }]
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => top10[items[0].dataIndex].name,
            label: (context) => {
              const product = top10[context.dataIndex];
              return [`Số lượng: ${formatNumber(product.quantity)} ${product.unit}`, `Doanh thu: ${formatCurrency(product.revenue)}`];
            }
          }
        }
      },
      scales: { x: { beginAtZero: true } }
    }
  });

  // 4) Cột: so sánh tiền nhập kho và tiền bán ra theo ngày/tháng
  createChart("importSalesChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Nhập kho", data: report.series.map((point) => point.importTotal), backgroundColor: COLORS.imports, borderRadius: 4 },
        { label: "Bán ra", data: report.series.map((point) => point.revenue), backgroundColor: COLORS.revenue, borderRadius: 4 }
      ]
    },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: { tooltip: moneyTooltip, legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, ticks: { callback: formatCompactMoney } } }
    }
  });
}

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}" class="text-center text-muted py-4">${escapeHtml(text)}</td></tr>`;
}

function productLabel(product) {
  return `<div class="fw-semibold">${escapeHtml(product.name)}</div><div class="small text-muted">${escapeHtml(product.code)}${product.categoryName ? ` · ${escapeHtml(product.categoryName)}` : ""}</div>`;
}

function renderTables(report) {
  $("topProductsBody").innerHTML = report.topProducts.length === 0
    ? emptyRow(5, "Chưa bán được hàng trong kỳ")
    : report.topProducts.slice(0, 20).map((product, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${productLabel(product)}</td>
          <td class="text-end">${formatNumber(product.quantity)} ${escapeHtml(product.unit)}</td>
          <td class="text-end text-money">${formatCurrency(product.revenue)}</td>
          <td class="text-end text-money ${product.profit < 0 ? "text-danger" : "text-success"}">${formatCurrency(product.profit)}</td>
        </tr>`).join("");

  $("slowMovingBody").innerHTML = report.slowMoving.length === 0
    ? emptyRow(4, "Không có hàng tồn lâu")
    : report.slowMoving.map((product) => `
        <tr>
          <td>${productLabel(product)}</td>
          <td class="text-end">${formatNumber(product.stock)} ${escapeHtml(product.unit)}</td>
          <td class="text-end text-money">${formatCurrency(product.stockValue ?? product.stock * product.costPrice)}</td>
          <td class="small">${formatDate(product.lastSoldAt)}<div class="text-muted">${formatNumber(product.daysSinceSale)} ngày trước</div></td>
        </tr>`).join("");

  $("lowStockBody").innerHTML = report.lowStock.length === 0
    ? emptyRow(3, "Không có hàng sắp hết")
    : report.lowStock.map((product) => `
        <tr>
          <td>${productLabel(product)}</td>
          <td class="text-end"><span class="badge ${product.stock <= 0 ? "text-bg-danger" : "text-bg-warning"}">${formatNumber(product.stock)} ${escapeHtml(product.unit)}</span></td>
          <td class="text-end">${formatNumber(product.minStock)}</td>
        </tr>`).join("");

  $("newProductsBody").innerHTML = report.newProducts.length === 0
    ? emptyRow(5, "Không có sản phẩm mới trong kỳ")
    : report.newProducts.map((product) => `
        <tr>
          <td>${product.thumbnailUrl
            ? `<img src="${escapeHtml(product.thumbnailUrl)}" class="product-thumb" alt="${escapeHtml(product.name)}">`
            : `<span class="product-thumb-placeholder"><i class="bi bi-image"></i></span>`}</td>
          <td>${productLabel(product)}</td>
          <td class="small text-nowrap">${formatDateTime(product.createdAt)}</td>
          <td class="text-end text-money">${formatCurrency(product.salePrice)}</td>
          <td class="text-end">${formatNumber(product.stock)} ${escapeHtml(product.unit)}</td>
        </tr>`).join("");
}

// =====================================================================
// XUẤT FILE
// =====================================================================
function bindExportEvents() {
  $("exportExcelButton").addEventListener("click", async (event) => {
    if (!currentReport) return;
    const button = event.currentTarget;
    setButtonLoading(button, true, "Đang tạo Excel...");
    try {
      await exportReportToExcel(currentReport);
      showToast("Đã xuất file Excel.");
    } catch (error) {
      showError(error, "Không xuất được file Excel.");
    } finally {
      setButtonLoading(button, false);
    }
  });

  $("exportPdfButton").addEventListener("click", async (event) => {
    if (!currentReport) return;
    const button = event.currentTarget;
    setButtonLoading(button, true, "Đang tạo PDF...");
    try {
      await exportReportToPdf(currentReport, charts);
      showToast("Đã xuất file PDF.");
    } catch (error) {
      showError(error, "Không xuất được file PDF.");
    } finally {
      setButtonLoading(button, false);
    }
  });

  $("printReportButton").addEventListener("click", () => {
    $("printStoreName").textContent = STORE_INFO.name;
    $("printRangeLabel").textContent = `${currentReport?.range.label || ""} · In lúc ${formatDateTime(new Date())}`;
    window.print();
  });

  document.querySelectorAll("button[data-png]").forEach((button) => {
    button.addEventListener("click", () => {
      const chart = charts[button.dataset.png];
      if (!chart) return;
      downloadChartPng(chart, `${button.dataset.png}_${toDateInputValue(currentReport.range.from)}_${toDateInputValue(currentReport.range.to)}`);
    });
  });
}
