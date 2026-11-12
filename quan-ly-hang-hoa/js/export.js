// =====================================================================
// File: js/export.js
// Đường dẫn: chi tiêu/js/export.js
// Mục đích: Xuất báo cáo
//   - Excel (.xlsx, SheetJS): mỗi báo cáo 1 sheet, số giữ dạng số để
//     tính tiếp trong Excel, có định dạng #,##0 và độ rộng cột
//   - PDF (jsPDF + autoTable): tiêu đề cửa hàng, ngày xuất, bảng số liệu,
//     ảnh biểu đồ, ảnh thumbnail sản phẩm mới; NHÚNG FONT ROBOTO
//     (assets/fonts) để không lỗi dấu tiếng Việt
//   - PNG: ảnh biểu đồ từ chart.toBase64Image()
//
// Thư viện SheetJS / jsPDF chỉ được tải khi bấm nút xuất (lazy-load.js).
// =====================================================================

import { STORE_INFO } from "./config.js";
import { formatCurrency, formatNumber, formatDate, formatDateTime, toDateInputValue } from "./utils.js";
import { loadXlsx, loadJsPdf } from "./lazy-load.js";

const PAYMENT_METHOD_LABELS = { cash: "Tiền mặt", transfer: "Chuyển khoản", card: "Thẻ" };
const STATUS_LABELS = { completed: "Hoàn thành", cancelled: "Đã huỷ" };

function buildFileName(report, extension) {
  return `bao-cao_${toDateInputValue(report.range.from)}_${toDateInputValue(report.range.to)}.${extension}`;
}

// =====================================================================
// PNG
// =====================================================================
export function downloadChartPng(chart, fileName) {
  const link = document.createElement("a");
  link.href = chart.toBase64Image("image/png", 1);
  link.download = `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// =====================================================================
// EXCEL
// =====================================================================
// Tạo sheet từ mảng 2 chiều; moneyColumns: chỉ số cột tiền -> định dạng #,##0
function createSheet(rows, { columnWidths = [], moneyColumns = [], headerRowIndex = 0 } = {}) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = columnWidths.map((width) => ({ wch: width }));
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex++) {
    moneyColumns.forEach((columnIndex) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (cell && cell.t === "n") cell.z = "#,##0";
    });
  }
  return sheet;
}

export async function exportReportToExcel(report) {
  await loadXlsx();
  const { summary } = report;
  const workbook = XLSX.utils.book_new();

  // 1. Tổng quan
  XLSX.utils.book_append_sheet(workbook, createSheet([
    [STORE_INFO.name],
    [`Báo cáo kinh doanh: ${report.range.label}`],
    [`Từ ${formatDate(report.range.from)} đến ${formatDate(report.range.to)} · Xuất lúc ${formatDateTime(new Date())}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng doanh thu (đ)", summary.revenue],
    ["Giá vốn hàng bán (đ)", summary.costOfGoods],
    ["Lợi nhuận gộp (đ)", summary.profit],
    ["Số hoá đơn hoàn thành", summary.invoiceCount],
    ["Số hoá đơn đã huỷ", summary.cancelledInvoiceCount],
    ["Tổng chi phí nhập (đ)", summary.importCost],
    ["Số phiếu nhập", summary.importCount],
    ["Giá trị tồn kho hiện tại (đ)", summary.inventoryValue],
    ["Số mặt hàng", summary.productCount]
  ], { columnWidths: [34, 20], moneyColumns: [1], headerRowIndex: 4 }), "Tổng quan");

  // 2. Theo ngày / tháng
  XLSX.utils.book_append_sheet(workbook, createSheet([
    [report.groupByMonth ? "Tháng" : "Ngày", "Doanh thu", "Giá vốn", "Lợi nhuận", "Số hoá đơn", "Tiền nhập kho"],
    ...report.series.map((point) => [point.label, point.revenue, point.costOfGoods, point.profit, point.invoiceCount, point.importTotal])
  ], { columnWidths: [12, 16, 16, 16, 12, 16], moneyColumns: [1, 2, 3, 5] }), report.groupByMonth ? "Theo tháng" : "Theo ngày");

  // 3. Theo danh mục
  XLSX.utils.book_append_sheet(workbook, createSheet([
    ["Danh mục", "Doanh thu", "Tỷ trọng (%)"],
    ...report.categories.map((category) => [category.name, category.revenue, Math.round(category.percent * 10) / 10])
  ], { columnWidths: [28, 16, 14], moneyColumns: [1] }), "Theo danh mục");

  // 4. Hàng bán chạy (toàn bộ hàng có bán trong kỳ)
  XLSX.utils.book_append_sheet(workbook, createSheet([
    ["Hạng", "Mã hàng", "Tên hàng", "Danh mục", "ĐVT", "SL bán", "Doanh thu", "Lợi nhuận"],
    ...report.topProducts.map((product, index) => [
      index + 1, product.code, product.name, product.categoryName, product.unit, product.quantity, product.revenue, product.profit
    ])
  ], { columnWidths: [6, 12, 36, 18, 8, 10, 16, 16], moneyColumns: [6, 7] }), "Hàng bán chạy");

  // 5. Hàng tồn lâu
  XLSX.utils.book_append_sheet(workbook, createSheet([
    ["Mã hàng", "Tên hàng", "Danh mục", "Tồn kho", "ĐVT", "Giá vốn", "Giá trị tồn", "Bán lần cuối", "Số ngày chưa bán"],
    ...report.slowMoving.map((product) => [
      product.code, product.name, product.categoryName || "", product.stock, product.unit, product.costPrice,
      product.stockValue ?? product.stock * product.costPrice, formatDate(product.lastSoldAt), product.daysSinceSale
    ])
  ], { columnWidths: [12, 36, 18, 10, 8, 14, 16, 14, 16], moneyColumns: [5, 6] }), "Hàng tồn lâu");

  // 6. Hàng sắp hết
  XLSX.utils.book_append_sheet(workbook, createSheet([
    ["Mã hàng", "Tên hàng", "Danh mục", "Tồn kho", "Tồn tối thiểu", "ĐVT"],
    ...report.lowStock.map((product) => [product.code, product.name, product.categoryName || "", product.stock, product.minStock, product.unit])
  ], { columnWidths: [12, 36, 18, 10, 14, 8] }), "Hàng sắp hết");

  // 7. Sản phẩm mới
  XLSX.utils.book_append_sheet(workbook, createSheet([
    ["Mã hàng", "Tên hàng", "Danh mục", "Ngày thêm", "Giá nhập", "Giá bán", "Tồn kho", "ĐVT", "Số ảnh"],
    ...report.newProducts.map((product) => [
      product.code, product.name, product.categoryName || "", formatDateTime(product.createdAt),
      product.costPrice, product.salePrice, product.stock, product.unit, product.imageCount || 0
    ])
  ], { columnWidths: [12, 36, 18, 18, 14, 14, 10, 8, 8], moneyColumns: [4, 5] }), "Sản phẩm mới");

  // 8. Danh sách hoá đơn trong kỳ
  XLSX.utils.book_append_sheet(workbook, createSheet([
    ["Số HĐ", "Thời gian", "Số dòng", "Tạm tính", "Giảm giá", "Tổng tiền", "Giá vốn", "Lợi nhuận", "Thanh toán", "Trạng thái"],
    ...report.invoices.map((invoice) => [
      invoice.code, formatDateTime(invoice.invoiceDate), invoice.itemCount,
      invoice.subtotal, invoice.discount, invoice.total, invoice.totalCost, invoice.profit,
      PAYMENT_METHOD_LABELS[invoice.paymentMethod] || invoice.paymentMethod, STATUS_LABELS[invoice.status] || invoice.status
    ])
  ], { columnWidths: [12, 18, 8, 14, 12, 14, 14, 14, 14, 12], moneyColumns: [3, 4, 5, 6, 7] }), "Hoá đơn");

  // 9. Danh sách phiếu nhập trong kỳ
  XLSX.utils.book_append_sheet(workbook, createSheet([
    ["Số phiếu", "Ngày nhập", "Số dòng", "Tổng tiền", "Trạng thái", "Ghi chú"],
    ...report.imports.map((importData) => [
      importData.code, formatDateTime(importData.importDate), importData.itemCount,
      importData.total, STATUS_LABELS[importData.status] || importData.status, importData.note || ""
    ])
  ], { columnWidths: [12, 18, 8, 16, 12, 30], moneyColumns: [3] }), "Phiếu nhập");

  XLSX.writeFile(workbook, buildFileName(report, "xlsx"));
}

// =====================================================================
// PDF
// =====================================================================
const FONT_FILES = [
  { file: "Roboto-Regular.ttf", style: "normal" },
  { file: "Roboto-Bold.ttf", style: "bold" }
];
const fontCache = new Map(); // tên file -> base64 (chỉ tải 1 lần mỗi phiên)

// ArrayBuffer -> base64 (chia nhỏ để không tràn stack với file ~500KB)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

// Nhúng font Roboto (có đủ dấu tiếng Việt) vào tài liệu PDF
async function registerVietnameseFont(pdf) {
  for (const { file, style } of FONT_FILES) {
    if (!fontCache.has(file)) {
      const response = await fetch(`assets/fonts/${file}`);
      if (!response.ok) throw new Error(`Không tải được font ${file} (HTTP ${response.status}).`);
      fontCache.set(file, arrayBufferToBase64(await response.arrayBuffer()));
    }
    pdf.addFileToVFS(file, fontCache.get(file));
    pdf.addFont(file, "Roboto", style);
  }
  pdf.setFont("Roboto", "normal");
}

// Ảnh WebP -> JPEG nền trắng để chắc chắn jsPDF vẽ được (ảnh thu nhỏ rất nhẹ nên nhanh)
function convertImageToJpegDataUrl(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    if (dataUrl.startsWith("data:image/jpeg")) {
      resolve(dataUrl);
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

export async function exportReportToPdf(report, charts) {
  const JsPdf = await loadJsPdf();
  const pdf = new JsPdf({ unit: "mm", format: "a4", orientation: "portrait" });
  if (typeof pdf.autoTable !== "function") throw new Error("Chưa tải được plugin jspdf-autotable.");
  await registerVietnameseFont(pdf);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const tableStyles = {
    styles: { font: "Roboto", fontSize: 9, cellPadding: 1.8 },
    headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 251] },
    margin: { left: margin, right: margin }
  };
  let cursorY = margin;

  // Sang trang mới nếu không đủ chỗ cho khối cao `height` mm
  const ensureSpace = (height) => {
    if (cursorY + height > pageHeight - 16) {
      pdf.addPage();
      cursorY = margin;
    }
  };

  const sectionTitle = (text) => {
    ensureSpace(14);
    pdf.setFont("Roboto", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(30, 27, 75);
    pdf.text(text, margin, cursorY + 5);
    pdf.setFont("Roboto", "normal");
    pdf.setTextColor(0);
    cursorY += 8;
  };

  const addTable = (head, body, options = {}) => {
    pdf.autoTable({ ...tableStyles, ...options, startY: cursorY, head: [head], body });
    cursorY = pdf.lastAutoTable.finalY + 6;
  };

  // ---------- Tiêu đề cửa hàng ----------
  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(16);
  pdf.text(STORE_INFO.name, margin, cursorY + 6);
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  pdf.text(`${STORE_INFO.address} · ĐT: ${STORE_INFO.phone}`, margin, cursorY + 11);
  pdf.setTextColor(0);
  cursorY += 18;

  pdf.setFont("Roboto", "bold");
  pdf.setFontSize(15);
  pdf.text("BÁO CÁO KINH DOANH", pageWidth / 2, cursorY, { align: "center" });
  pdf.setFont("Roboto", "normal");
  pdf.setFontSize(10);
  pdf.text(`Kỳ báo cáo: ${report.range.label} (${formatDate(report.range.from)} – ${formatDate(report.range.to)})`, pageWidth / 2, cursorY + 6, { align: "center" });
  pdf.text(`Ngày xuất: ${formatDateTime(new Date())}`, pageWidth / 2, cursorY + 11, { align: "center" });
  cursorY += 18;

  // ---------- Tổng quan ----------
  const { summary } = report;
  sectionTitle("1. Tổng quan");
  addTable(["Chỉ tiêu", "Giá trị"], [
    ["Tổng doanh thu", formatCurrency(summary.revenue)],
    ["Giá vốn hàng bán", formatCurrency(summary.costOfGoods)],
    ["Lợi nhuận gộp", formatCurrency(summary.profit)],
    ["Số hoá đơn (hoàn thành / đã huỷ)", `${formatNumber(summary.invoiceCount)} / ${formatNumber(summary.cancelledInvoiceCount)}`],
    ["Tổng chi phí nhập", `${formatCurrency(summary.importCost)} (${formatNumber(summary.importCount)} phiếu)`],
    ["Giá trị tồn kho hiện tại", formatCurrency(summary.inventoryValue)]
  ], { columnStyles: { 1: { halign: "right" } } });

  // ---------- Biểu đồ (ảnh PNG) ----------
  sectionTitle("2. Biểu đồ");
  const chartList = [
    { id: "revenueChart", title: report.groupByMonth ? "Doanh thu & lợi nhuận theo tháng" : "Doanh thu & lợi nhuận theo ngày" },
    { id: "categoryChart", title: "Tỷ trọng doanh thu theo danh mục" },
    { id: "topProductsChart", title: "Top 10 hàng bán chạy" },
    { id: "importSalesChart", title: "So sánh nhập kho và bán ra" }
  ];
  chartList.forEach(({ id, title }) => {
    const chart = charts[id];
    if (!chart) return;
    const ratio = chart.height / chart.width;
    const imageWidth = id === "categoryChart" ? contentWidth * 0.6 : contentWidth;
    const imageHeight = imageWidth * ratio;
    ensureSpace(imageHeight + 8);
    pdf.setFontSize(10);
    pdf.text(title, margin, cursorY + 4);
    const imageX = margin + (contentWidth - imageWidth) / 2;
    pdf.addImage(chart.toBase64Image("image/png", 1), "PNG", imageX, cursorY + 6, imageWidth, imageHeight);
    cursorY += imageHeight + 10;
  });

  // ---------- Bảng số liệu ----------
  sectionTitle(report.groupByMonth ? "3. Doanh thu theo tháng" : "3. Doanh thu theo ngày");
  addTable(
    [report.groupByMonth ? "Tháng" : "Ngày", "Doanh thu", "Giá vốn", "Lợi nhuận", "Số HĐ", "Nhập kho"],
    report.series
      .filter((point) => point.revenue || point.importTotal || point.invoiceCount)
      .map((point) => [point.label, formatNumber(point.revenue), formatNumber(point.costOfGoods), formatNumber(point.profit), formatNumber(point.invoiceCount), formatNumber(point.importTotal)]),
    { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "center" }, 5: { halign: "right" } } }
  );

  sectionTitle("4. Doanh thu theo danh mục");
  addTable(["Danh mục", "Doanh thu", "Tỷ trọng"],
    report.categories.map((category) => [category.name, formatCurrency(category.revenue), `${category.percent.toFixed(1)}%`]),
    { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } } });

  sectionTitle("5. Hàng bán chạy");
  addTable(["#", "Mã", "Tên hàng", "SL bán", "Doanh thu", "Lợi nhuận"],
    report.topProducts.slice(0, 20).map((product, index) => [
      index + 1, product.code, product.name, `${formatNumber(product.quantity)} ${product.unit}`, formatCurrency(product.revenue), formatCurrency(product.profit)
    ]),
    { columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } } });

  sectionTitle("6. Hàng tồn lâu");
  addTable(["Mã", "Tên hàng", "Tồn", "Giá trị tồn", "Bán lần cuối"],
    report.slowMoving.map((product) => [
      product.code, product.name, `${formatNumber(product.stock)} ${product.unit}`,
      formatCurrency(product.stockValue ?? product.stock * product.costPrice),
      `${formatDate(product.lastSoldAt)} (${product.daysSinceSale} ngày)`
    ]),
    { columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } } });

  sectionTitle("7. Hàng sắp hết");
  addTable(["Mã", "Tên hàng", "Tồn", "Tối thiểu"],
    report.lowStock.map((product) => [product.code, product.name, `${formatNumber(product.stock)} ${product.unit}`, formatNumber(product.minStock)]),
    { columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } } });

  // Sản phẩm mới: vẽ thumbnail (data URL JPEG lưu trong Firestore) vào ô đầu tiên
  sectionTitle("8. Sản phẩm mới thêm trong kỳ");
  const newProducts = report.newProducts;
  const newProductThumbnails = await Promise.all(newProducts.map((product) => convertImageToJpegDataUrl(product.thumbnailUrl)));
  addTable(["Ảnh", "Mã", "Tên hàng", "Ngày thêm", "Giá bán", "Tồn"],
    newProducts.map((product) => ["", product.code, product.name, formatDate(product.createdAt), formatCurrency(product.salePrice), `${formatNumber(product.stock)} ${product.unit}`]),
    {
      bodyStyles: { minCellHeight: 13, valign: "middle" },
      columnStyles: { 0: { cellWidth: 16 }, 4: { halign: "right" }, 5: { halign: "right" } },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 0) return;
        const thumbnailUrl = newProductThumbnails[data.row.index];
        if (!thumbnailUrl) return;
        try {
          pdf.addImage(thumbnailUrl, "JPEG", data.cell.x + 1.5, data.cell.y + 1.5, 11, 11);
        } catch (error) {
          console.warn("Không vẽ được ảnh sản phẩm vào PDF:", error);
        }
      }
    });

  // ---------- Số trang ở chân mỗi trang ----------
  const pageCount = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    pdf.setPage(pageNumber);
    pdf.setFont("Roboto", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`${STORE_INFO.name} · Báo cáo ${report.range.label}`, margin, pageHeight - 8);
    pdf.text(`Trang ${pageNumber}/${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  pdf.save(buildFileName(report, "pdf"));
}

