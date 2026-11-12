// =====================================================================
// File: js/paginated-list.js
// Đường dẫn: chi tiêu/js/paginated-list.js
// Mục đích: Phân trang bằng CURSOR (limit + startAfter) + realtime
//           (onSnapshot) cho các danh sách lớn. Không tải cả collection.
//
// Cách hoạt động:
// - Mỗi trang chỉ lắng nghe (pageSize + 1) document. Document thừa ra
//   dùng để biết còn trang sau hay không.
// - Lưu "cursor" (document cuối của trang trước) cho từng trang đã đi
//   qua -> bấm "Trang trước" quay lại được mà không phải đọc lại từ đầu.
// - Đổi trang/bộ lọc thì huỷ listener cũ trước khi mở listener mới.
// =====================================================================

import { query, limit, startAfter, onSnapshot, getCountFromServer } from "./firebase.js";
import { escapeHtml, formatNumber } from "./utils.js";

export class PaginatedList {
  /**
   * @param {object} options
   * @param {CollectionReference} options.collectionRef  collection cần đọc
   * @param {() => QueryConstraint[]} options.getConstraints  where/orderBy theo bộ lọc hiện tại
   * @param {number} options.pageSize
   * @param {(page) => void} options.onPage   nhận { docs, pageIndex, hasNext, hasPrev }
   * @param {(total:number|null) => void} [options.onCount]
   * @param {(error) => void} options.onError
   */
  constructor({ collectionRef, getConstraints, pageSize, onPage, onCount, onError }) {
    this.collectionRef = collectionRef;
    this.getConstraints = getConstraints;
    this.pageSize = pageSize;
    this.onPage = onPage;
    this.onCount = onCount || (() => {});
    this.onError = onError;

    this.pageIndex = 0;
    this.pageStartCursors = [null]; // pageStartCursors[i] = document cuối của trang i-1
    this.unsubscribe = null;
    this.subscriptionVersion = 0; // bỏ qua kết quả của listener cũ đến muộn
  }

  // Tải lại từ trang 1 (khi đổi bộ lọc, tìm kiếm, sắp xếp, số dòng/trang)
  reload() {
    this.pageIndex = 0;
    this.pageStartCursors = [null];
    this.subscribeCurrentPage();
    this.refreshCount();
  }

  setPageSize(pageSize) {
    this.pageSize = pageSize;
    this.reload();
  }

  nextPage() {
    if (!this.pageStartCursors[this.pageIndex + 1]) return;
    this.pageIndex += 1;
    this.subscribeCurrentPage();
  }

  previousPage() {
    if (this.pageIndex === 0) return;
    this.pageIndex -= 1;
    this.subscribeCurrentPage();
  }

  stop() {
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null;
  }

  subscribeCurrentPage() {
    this.stop();
    const version = ++this.subscriptionVersion;

    const constraints = [...this.getConstraints()];
    const cursor = this.pageStartCursors[this.pageIndex];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(this.pageSize + 1));

    this.unsubscribe = onSnapshot(
      query(this.collectionRef, ...constraints),
      (snapshot) => {
        if (version !== this.subscriptionVersion) return;

        const hasNext = snapshot.docs.length > this.pageSize;
        const pageDocs = snapshot.docs.slice(0, this.pageSize);

        // Trang hiện tại trống (vd: vừa xoá bản ghi cuối) -> lùi 1 trang
        if (pageDocs.length === 0 && this.pageIndex > 0) {
          this.previousPage();
          return;
        }

        if (hasNext) {
          this.pageStartCursors[this.pageIndex + 1] = pageDocs[pageDocs.length - 1];
        } else {
          this.pageStartCursors.length = this.pageIndex + 1;
        }

        this.onPage({
          docs: pageDocs,
          pageIndex: this.pageIndex,
          hasNext,
          hasPrev: this.pageIndex > 0
        });
      },
      (error) => {
        if (version === this.subscriptionVersion) this.onError(error);
      }
    );
  }

  // Đếm tổng số bản ghi theo bộ lọc (aggregate query — rất rẻ)
  async refreshCount() {
    try {
      const snapshot = await getCountFromServer(query(this.collectionRef, ...this.getConstraints()));
      this.onCount(snapshot.data().count);
    } catch (error) {
      console.warn("[PaginatedList] Không đếm được tổng số bản ghi:", error);
      this.onCount(null);
    }
  }
}

// ---------------------------------------------------------------------
// Vẽ thanh phân trang Bootstrap + dòng "Trang x · y bản ghi"
// ---------------------------------------------------------------------
export function renderPagination(container, { pageIndex, hasNext, hasPrev }, totalCount, pageSize, handlers) {
  if (!container) return;
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  const pageLabel = totalPages ? `Trang ${pageIndex + 1}/${totalPages}` : `Trang ${pageIndex + 1}`;
  const totalLabel = totalCount === null || totalCount === undefined ? "" : ` · ${formatNumber(totalCount)} bản ghi`;

  container.innerHTML = `
    <div class="d-flex flex-wrap align-items-center gap-2">
      <span class="text-muted small me-auto">${escapeHtml(pageLabel + totalLabel)}</span>
      <nav aria-label="Phân trang">
        <ul class="pagination pagination-sm mb-0">
          <li class="page-item ${hasPrev ? "" : "disabled"}">
            <button class="page-link" type="button" data-page="prev"><i class="bi bi-chevron-left"></i> Trước</button>
          </li>
          <li class="page-item ${hasNext ? "" : "disabled"}">
            <button class="page-link" type="button" data-page="next">Sau <i class="bi bi-chevron-right"></i></button>
          </li>
        </ul>
      </nav>
    </div>`;

  container.querySelector('[data-page="prev"]').addEventListener("click", handlers.onPrev);
  container.querySelector('[data-page="next"]').addEventListener("click", handlers.onNext);
}
