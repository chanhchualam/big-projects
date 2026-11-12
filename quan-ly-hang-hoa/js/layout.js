// =====================================================================
// File: js/layout.js
// Đường dẫn: chi tiêu/js/layout.js
// Mục đích: Dựng sidebar + topbar dùng chung cho mọi trang nội bộ và
//           khởi động trang sau khi route guard xác nhận đăng nhập.
//
// Cách dùng trong 1 trang HTML:
//   import { initPage } from "./js/layout.js";
//   initPage({ pageId: "dashboard", title: "Tổng quan" }, async (user) => { ... });
// =====================================================================

import { requireAuth, logout } from "./auth.js";
import { APP_CONFIG } from "./config.js";
import { escapeHtml, showError, enableMoneyInputs } from "./utils.js";

// Danh sách menu. ready: false = trang sẽ được làm ở bước sau (hiện "Sắp có").
export const MENU_ITEMS = [
  { section: "Tổng quan" },
  { id: "dashboard", label: "Tổng quan", icon: "bi-speedometer2", href: "dashboard.html", ready: true },
  { id: "alerts", label: "Cảnh báo", icon: "bi-bell", href: "alerts.html", ready: true },

  { section: "Hàng hoá" },
  { id: "products", label: "Hàng hoá", icon: "bi-box-seam", href: "products.html", ready: true },
  { id: "new-products", label: "Sản phẩm mới", icon: "bi-stars", href: "new-products.html", ready: true },
  { id: "categories", label: "Danh mục", icon: "bi-tags", href: "categories.html", ready: true },

  { section: "Giao dịch" },
  { id: "sales", label: "Bán hàng", icon: "bi-cart-check", href: "sales.html", ready: true },
  { id: "imports", label: "Nhập kho", icon: "bi-box-arrow-in-down", href: "imports.html", ready: true },

  { section: "Báo cáo" },
  { id: "reports", label: "Báo cáo thống kê", icon: "bi-graph-up-arrow", href: "reports.html", ready: true },

  { section: "Hệ thống" },
  { id: "seed", label: "Dữ liệu mẫu", icon: "bi-database-add", href: "seed.html", ready: true }
];

function renderSidebar(activePageId) {
  const sidebar = document.getElementById("appSidebar");
  if (!sidebar) return;

  const menuHtml = MENU_ITEMS.map((item) => {
    if (item.section) {
      return `<div class="nav-section">${escapeHtml(item.section)}</div>`;
    }
    const isActive = item.id === activePageId;
    if (!item.ready) {
      return `
        <span class="nav-link opacity-50" title="Sẽ có ở bước tiếp theo" aria-disabled="true">
          <i class="bi ${item.icon}"></i><span>${escapeHtml(item.label)}</span>
          <span class="badge text-bg-secondary fw-normal">Sắp có</span>
        </span>`;
    }
    return `
      <a class="nav-link ${isActive ? "active" : ""}" href="${item.href}" ${isActive ? 'aria-current="page"' : ""}>
        <i class="bi ${item.icon}"></i><span>${escapeHtml(item.label)}</span>
      </a>`;
  }).join("");

  sidebar.innerHTML = `
    <a class="sidebar-brand" href="dashboard.html">
      <i class="bi bi-box-seam-fill"></i><span>${escapeHtml(APP_CONFIG.appName)}</span>
    </a>
    <nav class="nav flex-column pb-4">${menuHtml}</nav>`;
}

function renderTopbar(title, user) {
  const topbar = document.getElementById("appTopbar");
  if (!topbar) return;
  topbar.innerHTML = `
    <button class="btn btn-light d-lg-none" type="button" id="sidebarToggle" aria-label="Mở menu">
      <i class="bi bi-list fs-5"></i>
    </button>
    <h1 class="page-title text-truncate">${escapeHtml(title)}</h1>
    <div class="ms-auto dropdown">
      <button class="btn btn-light dropdown-toggle d-flex align-items-center gap-2" type="button"
              data-bs-toggle="dropdown" aria-expanded="false">
        <i class="bi bi-person-circle fs-5"></i>
        <span class="d-none d-sm-inline">${escapeHtml(user.email || "Admin")}</span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><span class="dropdown-item-text small text-muted">Chủ cửa hàng</span></li>
        <li><hr class="dropdown-divider"></li>
        <li>
          <button class="dropdown-item text-danger" type="button" id="logoutButton">
            <i class="bi bi-box-arrow-right me-2"></i>Đăng xuất
          </button>
        </li>
      </ul>
    </div>`;
}

// Bật/tắt sidebar trên điện thoại
function bindSidebarToggle() {
  const toggleButton = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  toggleButton?.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  backdrop?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
}

/**
 * Khởi động 1 trang nội bộ: chặn truy cập nếu chưa đăng nhập,
 * dựng layout, rồi gọi hàm khởi tạo riêng của trang.
 */
export function initPage({ pageId, title }, onPageReady) {
  enableMoneyInputs(); // ô class "money-input" tự thêm dấu chấm hàng nghìn
  requireAuth(async (user) => {
    document.title = `${title} | ${APP_CONFIG.appName}`;
    renderSidebar(pageId);
    renderTopbar(title, user);
    bindSidebarToggle();
    document.getElementById("logoutButton")?.addEventListener("click", logout);

    if (typeof onPageReady === "function") {
      try {
        await onPageReady(user);
      } catch (error) {
        showError(error, "Không tải được dữ liệu trang.");
      }
    }
  });
}
