// =====================================================================
// File: js/stock.js
// Đường dẫn: chi tiêu/js/stock.js
// Mục đích: MỌI thay đổi tồn kho đều đi qua file này và dùng
//           runTransaction để đảm bảo:
//   - Đọc tồn kho MỚI NHẤT trên server ngay lúc ghi (2 tab cùng bán
//     1 món cũng không bị trừ sai) — Firestore tự chạy lại transaction
//     nếu dữ liệu bị thay đổi giữa chừng.
//   - Không bao giờ để tồn kho âm (kiểm tra ở đây + firestore.rules).
//   - Phiếu/hoá đơn, tồn kho, lịch sử kho (stock_logs), số phiếu tự tăng
//     và thống kê khách hàng được ghi CÙNG LÚC: hoặc tất cả, hoặc không.
//
// Lưu ý Firestore: trong transaction phải ĐỌC hết rồi mới GHI.
// =====================================================================

import {
  db,
  COLLECTIONS,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp
} from "./firebase.js";
import { APP_CONFIG } from "./config.js";
import { createAppError, formatNumber } from "./utils.js";

const MAX_LINES_PER_DOCUMENT = 200; // giới hạn trong firestore.rules

// Làm tròn tiền về số nguyên đồng
function roundMoney(value) {
  return Math.round(Number(value) || 0);
}

// Giá trị tồn kho của 1 sản phẩm = tồn × giá vốn. Lưu sẵn vào field
// stockValue để báo cáo dùng sum("stockValue") thay vì tải cả kho.
export function calculateStockValue(stock, costPrice) {
  return Math.max(Math.round((Number(stock) || 0) * (Number(costPrice) || 0)), 0);
}

// Làm tròn số lượng (cho phép lẻ như 1.5 kg) tránh lỗi số thực 0.1 + 0.2
function roundQuantity(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

// Kiểm tra danh sách dòng hàng gửi lên từ giao diện
function validateLines(lines, priceField) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw createAppError("Chưa có dòng hàng nào.");
  }
  if (lines.length > MAX_LINES_PER_DOCUMENT) {
    throw createAppError(`Mỗi phiếu tối đa ${MAX_LINES_PER_DOCUMENT} dòng hàng.`);
  }
  const seenProductIds = new Set();
  lines.forEach((line, index) => {
    if (!line.productId) throw createAppError(`Dòng ${index + 1}: chưa chọn hàng hoá.`);
    if (seenProductIds.has(line.productId)) {
      throw createAppError(`Dòng ${index + 1}: hàng hoá bị trùng, hãy gộp số lượng vào 1 dòng.`);
    }
    seenProductIds.add(line.productId);
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw createAppError(`Dòng ${index + 1}: số lượng phải lớn hơn 0.`);
    }
    if (!Number.isFinite(line[priceField]) || line[priceField] < 0) {
      throw createAppError(`Dòng ${index + 1}: đơn giá phải ≥ 0.`);
    }
  });
}

// Sinh số phiếu tự tăng: PN000001, HD000001 (đọc + ghi trong transaction)
async function readNextCode(transaction, counterId, prefix) {
  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterId);
  const counterSnapshot = await transaction.get(counterRef);
  const nextValue = (counterSnapshot.exists() ? counterSnapshot.data().value : 0) + 1;
  return {
    code: `${prefix}${String(nextValue).padStart(6, "0")}`,
    write: () => transaction.set(counterRef, { value: nextValue, updatedAt: serverTimestamp() })
  };
}

// Đọc nhiều sản phẩm trong transaction -> Map(productId -> { ref, data })
async function readProducts(transaction, productIds) {
  const snapshots = await Promise.all(
    productIds.map((productId) => transaction.get(doc(db, COLLECTIONS.PRODUCTS, productId)))
  );
  const products = new Map();
  snapshots.forEach((snapshot) => {
    if (snapshot.exists()) products.set(snapshot.id, { ref: snapshot.ref, data: snapshot.data() });
  });
  return products;
}

// Ghi 1 dòng lịch sử kho (trong transaction)
function writeStockLog(transaction, { productId, product, type, quantityChange, stockBefore, stockAfter, refType, refId, refCode, note }) {
  transaction.set(doc(collection(db, COLLECTIONS.STOCK_LOGS)), {
    productId,
    productCode: product.code,
    productName: product.name,
    type,
    quantityChange,
    stockBefore,
    stockAfter,
    refType,
    refId,
    refCode,
    note: note || "",
    createdAt: serverTimestamp()
  });
}

// =====================================================================
// NHẬP KHO: tạo phiếu nhập + CỘNG tồn kho
// =====================================================================
/**
 * @param {object} input
 * @param {Date} input.importDate
 * @param {string} input.note
 * @param {boolean} input.updateCostPrice  cập nhật giá nhập theo bình quân gia quyền
 * @param {Array<{productId, quantity, costPrice}>} input.lines
 * @returns {Promise<{ id: string, code: string }>}
 */
export async function createImport(input) {
  const lines = input.lines.map((line) => ({
    productId: line.productId,
    quantity: roundQuantity(line.quantity),
    costPrice: roundMoney(line.costPrice)
  }));
  validateLines(lines, "costPrice");

  const importRef = doc(collection(db, COLLECTIONS.IMPORTS));

  return runTransaction(db, async (transaction) => {
    // ---------- ĐỌC ----------
    const counter = await readNextCode(transaction, "imports", APP_CONFIG.importCodePrefix);
    const products = await readProducts(transaction, lines.map((line) => line.productId));

    // ---------- TÍNH TOÁN ----------
    const items = lines.map((line, index) => {
      const product = products.get(line.productId);
      if (!product) throw createAppError(`Dòng ${index + 1}: hàng hoá không còn tồn tại (có thể đã bị xoá).`);
      return {
        productId: line.productId,
        code: product.data.code,
        name: product.data.name,
        unit: product.data.unit,
        quantity: line.quantity,
        costPrice: line.costPrice,
        lineTotal: roundMoney(line.quantity * line.costPrice)
      };
    });
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

    // ---------- GHI ----------
    items.forEach((item) => {
      const product = products.get(item.productId);
      const stockBefore = product.data.stock;
      const stockAfter = roundQuantity(stockBefore + item.quantity);

      const updates = {
        stock: stockAfter,
        isLowStock: stockAfter <= product.data.minStock,
        updatedAt: serverTimestamp()
      };
      // Giá vốn bình quân gia quyền = (tồn cũ × giá cũ + nhập × giá nhập) / tồn mới
      if (input.updateCostPrice) {
        const oldValue = Math.max(stockBefore, 0) * product.data.costPrice;
        updates.costPrice = stockAfter > 0
          ? roundMoney((oldValue + item.quantity * item.costPrice) / stockAfter)
          : item.costPrice;
      }
      updates.stockValue = calculateStockValue(stockAfter, updates.costPrice ?? product.data.costPrice);
      transaction.update(product.ref, updates);

      writeStockLog(transaction, {
        productId: item.productId,
        product: product.data,
        type: "import",
        quantityChange: item.quantity,
        stockBefore,
        stockAfter,
        refType: "import",
        refId: importRef.id,
        refCode: counter.code
      });
    });

    transaction.set(importRef, {
      code: counter.code,
      importDate: Timestamp.fromDate(input.importDate),
      items,
      itemCount: items.length,
      total,
      note: input.note || "",
      status: "completed",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    counter.write();

    return { id: importRef.id, code: counter.code };
  });
}

// =====================================================================
// HUỶ PHIẾU NHẬP: TRỪ lại tồn kho (không cho âm)
// =====================================================================
export async function cancelImport(importId, reason) {
  const importRef = doc(db, COLLECTIONS.IMPORTS, importId);

  return runTransaction(db, async (transaction) => {
    const importSnapshot = await transaction.get(importRef);
    if (!importSnapshot.exists()) throw createAppError("Phiếu nhập không tồn tại.");
    const importData = importSnapshot.data();
    if (importData.status !== "completed") throw createAppError("Phiếu nhập này đã bị huỷ trước đó.");

    const products = await readProducts(transaction, importData.items.map((item) => item.productId));

    // Kiểm tra trước: hàng đã bán bớt thì không đủ để trừ lại
    importData.items.forEach((item) => {
      const product = products.get(item.productId);
      if (product && product.data.stock < item.quantity) {
        throw createAppError(
          `Không thể huỷ: "${item.name}" chỉ còn ${formatNumber(product.data.stock)} ${item.unit}, ` +
          `ít hơn số đã nhập (${formatNumber(item.quantity)}). Hàng đã được bán bớt.`
        );
      }
    });

    const skippedProducts = [];
    importData.items.forEach((item) => {
      const product = products.get(item.productId);
      if (!product) {
        skippedProducts.push(item.name); // sản phẩm đã bị xoá -> không còn tồn để trừ
        return;
      }
      const stockBefore = product.data.stock;
      const stockAfter = roundQuantity(stockBefore - item.quantity);
      transaction.update(product.ref, {
        stock: stockAfter,
        isLowStock: stockAfter <= product.data.minStock,
        stockValue: calculateStockValue(stockAfter, product.data.costPrice),
        updatedAt: serverTimestamp()
      });
      writeStockLog(transaction, {
        productId: item.productId,
        product: product.data,
        type: "cancel_import",
        quantityChange: -item.quantity,
        stockBefore,
        stockAfter,
        refType: "import",
        refId: importId,
        refCode: importData.code,
        note: reason
      });
    });

    transaction.update(importRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelReason: reason || "",
      updatedAt: serverTimestamp()
    });

    return { code: importData.code, skippedProducts };
  });
}

// =====================================================================
// BÁN HÀNG: tạo hoá đơn + TRỪ tồn kho, KHÔNG cho bán vượt tồn
// =====================================================================
/**
 * @param {object} input
 * @param {string|null} input.customerId   null = khách lẻ
 * @param {string} input.customerName
 * @param {string} input.customerPhone
 * @param {Array<{productId, quantity, salePrice}>} input.lines
 * @param {number} input.discount
 * @param {"cash"|"transfer"|"card"} input.paymentMethod
 * @param {number} input.amountPaid
 * @param {string} input.note
 * @returns {Promise<{ id: string, code: string, total: number }>}
 */
export async function createInvoice(input) {
  const lines = input.lines.map((line) => ({
    productId: line.productId,
    quantity: roundQuantity(line.quantity),
    salePrice: roundMoney(line.salePrice)
  }));
  validateLines(lines, "salePrice");

  const invoiceRef = doc(collection(db, COLLECTIONS.INVOICES));
  const customerRef = input.customerId ? doc(db, COLLECTIONS.CUSTOMERS, input.customerId) : null;

  return runTransaction(db, async (transaction) => {
    // ---------- ĐỌC ----------
    const counter = await readNextCode(transaction, "invoices", APP_CONFIG.invoiceCodePrefix);
    const products = await readProducts(transaction, lines.map((line) => line.productId));
    const customerSnapshot = customerRef ? await transaction.get(customerRef) : null;
    if (customerRef && !customerSnapshot.exists()) {
      throw createAppError("Khách hàng đã bị xoá, hãy chọn lại khách hàng.");
    }

    // ---------- KIỂM TRA TỒN KHO + TÍNH TIỀN ----------
    const items = lines.map((line, index) => {
      const product = products.get(line.productId);
      if (!product) throw createAppError(`Dòng ${index + 1}: hàng hoá không còn tồn tại.`);
      if (line.quantity > product.data.stock) {
        throw createAppError(
          `Không đủ hàng: "${product.data.name}" chỉ còn ${formatNumber(product.data.stock)} ${product.data.unit}, ` +
          `bạn đang bán ${formatNumber(line.quantity)}.`
        );
      }
      const lineTotal = roundMoney(line.quantity * line.salePrice);
      const lineCost = roundMoney(line.quantity * product.data.costPrice);
      return {
        productId: line.productId,
        code: product.data.code,
        name: product.data.name,
        unit: product.data.unit,
        categoryId: product.data.categoryId,
        categoryName: product.data.categoryName || "",
        quantity: line.quantity,
        salePrice: line.salePrice,
        costPrice: product.data.costPrice, // giá vốn tại thời điểm bán -> tính lợi nhuận chính xác
        lineTotal,
        lineCost
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const discount = Math.min(Math.max(roundMoney(input.discount), 0), subtotal);
    const total = subtotal - discount;
    const totalCost = items.reduce((sum, item) => sum + item.lineCost, 0);
    const amountPaid = input.paymentMethod === "cash" ? Math.max(roundMoney(input.amountPaid), 0) : total;
    if (input.paymentMethod === "cash" && amountPaid < total) {
      throw createAppError("Tiền khách đưa chưa đủ.");
    }

    // ---------- GHI ----------
    items.forEach((item) => {
      const product = products.get(item.productId);
      const stockBefore = product.data.stock;
      const stockAfter = roundQuantity(stockBefore - item.quantity);
      transaction.update(product.ref, {
        stock: stockAfter,
        isLowStock: stockAfter <= product.data.minStock,
        stockValue: calculateStockValue(stockAfter, product.data.costPrice),
        totalSold: roundQuantity((product.data.totalSold || 0) + item.quantity),
        lastSoldAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      writeStockLog(transaction, {
        productId: item.productId,
        product: product.data,
        type: "sale",
        quantityChange: -item.quantity,
        stockBefore,
        stockAfter,
        refType: "invoice",
        refId: invoiceRef.id,
        refCode: counter.code
      });
    });

    if (customerSnapshot) {
      const customer = customerSnapshot.data();
      transaction.update(customerRef, {
        totalSpent: (customer.totalSpent || 0) + total,
        invoiceCount: (customer.invoiceCount || 0) + 1,
        lastPurchaseAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    transaction.set(invoiceRef, {
      code: counter.code,
      customerId: input.customerId || null,
      customerName: input.customerName || "Khách lẻ", // denormalize
      customerPhone: input.customerPhone || "",
      invoiceDate: serverTimestamp(),
      items,
      itemCount: items.length,
      subtotal,
      discount,
      total,
      totalCost,
      profit: total - totalCost,
      paymentMethod: input.paymentMethod,
      amountPaid,
      changeAmount: amountPaid - total,
      note: input.note || "",
      status: "completed",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    counter.write();

    return { id: invoiceRef.id, code: counter.code, total };
  });
}

// =====================================================================
// HUỶ HOÁ ĐƠN: CỘNG lại tồn kho, trừ lại thống kê khách hàng
// =====================================================================
export async function cancelInvoice(invoiceId, reason) {
  const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);

  return runTransaction(db, async (transaction) => {
    const invoiceSnapshot = await transaction.get(invoiceRef);
    if (!invoiceSnapshot.exists()) throw createAppError("Hoá đơn không tồn tại.");
    const invoice = invoiceSnapshot.data();
    if (invoice.status !== "completed") throw createAppError("Hoá đơn này đã bị huỷ trước đó.");

    const products = await readProducts(transaction, invoice.items.map((item) => item.productId));
    const customerRef = invoice.customerId ? doc(db, COLLECTIONS.CUSTOMERS, invoice.customerId) : null;
    const customerSnapshot = customerRef ? await transaction.get(customerRef) : null;

    const skippedProducts = [];
    invoice.items.forEach((item) => {
      const product = products.get(item.productId);
      if (!product) {
        skippedProducts.push(item.name);
        return;
      }
      const stockBefore = product.data.stock;
      const stockAfter = roundQuantity(stockBefore + item.quantity);
      transaction.update(product.ref, {
        stock: stockAfter,
        isLowStock: stockAfter <= product.data.minStock,
        stockValue: calculateStockValue(stockAfter, product.data.costPrice),
        totalSold: Math.max(roundQuantity((product.data.totalSold || 0) - item.quantity), 0),
        updatedAt: serverTimestamp()
      });
      writeStockLog(transaction, {
        productId: item.productId,
        product: product.data,
        type: "cancel_sale",
        quantityChange: item.quantity,
        stockBefore,
        stockAfter,
        refType: "invoice",
        refId: invoiceId,
        refCode: invoice.code,
        note: reason
      });
    });

    if (customerSnapshot && customerSnapshot.exists()) {
      const customer = customerSnapshot.data();
      transaction.update(customerRef, {
        totalSpent: Math.max((customer.totalSpent || 0) - invoice.total, 0),
        invoiceCount: Math.max((customer.invoiceCount || 0) - 1, 0),
        updatedAt: serverTimestamp()
      });
    }

    transaction.update(invoiceRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelReason: reason || "",
      updatedAt: serverTimestamp()
    });

    return { code: invoice.code, skippedProducts };
  });
}
