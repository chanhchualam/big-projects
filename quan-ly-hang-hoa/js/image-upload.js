// =====================================================================
// File: js/image-upload.js
// Đường dẫn: chi tiêu/js/image-upload.js
// Mục đích: Quản lý ảnh sản phẩm trong form thêm/sửa (CÁCH C — base64):
//   - Chọn nhiều ảnh / kéo-thả, tối đa 3 ảnh, xem trước trước khi lưu
//   - Chỉ nhận jpg/png/webp, tối đa 2MB mỗi ảnh gốc
//   - Nén + thu nhỏ ở trình duyệt (cạnh dài nhất 1024px) bằng
//     browser-image-compression, định dạng WebP (hoặc JPEG nếu trình duyệt
//     không nén được WebP), tạo thêm ảnh thu nhỏ ~10KB cho danh sách
//   - Thanh tiến trình Bootstrap, thông báo lỗi thân thiện
//
// Nơi lưu:
//   product_images/{productId}.imageUrls  = [dataUrl1, dataUrl2, dataUrl3]
//   products/{productId}.thumbnailUrl     = dataUrl ảnh thu nhỏ của ảnh đầu tiên
//   -> Ảnh đầu tiên là ảnh đại diện. Thay ảnh = ghi đè document
//      product_images (ảnh cũ bị xoá thật), xoá sản phẩm = xoá luôn document đó.
//
// Thư viện browser-image-compression được tải tự động khi cần (lazy-load.js).
// =====================================================================

import { APP_CONFIG } from "./config.js";
import { escapeHtml, createAppError } from "./utils.js";
import { loadImageCompression } from "./lazy-load.js";

// Firestore giới hạn 1 MiB / document -> chừa khoảng trống an toàn
const MAX_IMAGE_DOCUMENT_CHARS = 950000;

let imageIdCounter = 0;

export class ProductImageManager {
  /**
   * @param {object} elements
   * @param {HTMLElement} elements.dropzone
   * @param {HTMLInputElement} elements.fileInput   <input type="file" multiple>
   * @param {HTMLElement} elements.previewList
   * @param {HTMLElement} elements.progressWrapper  <div class="progress">
   * @param {HTMLElement} elements.progressBar      <div class="progress-bar">
   * @param {HTMLElement} elements.errorBox
   * @param {HTMLElement} elements.countLabel
   */
  constructor(elements) {
    this.elements = elements;
    this.images = []; // { id, kind: "existing" | "new", dataUrl?, file?, previewUrl }
    this.hasChanges = false;
    this.bindEvents();
    this.render();
  }

  // ------------------------------ Trạng thái ------------------------------
  reset() {
    this.revokePreviewUrls();
    this.images = [];
    this.hasChanges = false;
    this.hideError();
    this.setProgress(null);
    this.render();
  }

  // Nạp ảnh đã lưu (khi mở form sửa)
  setExistingImages(dataUrls) {
    this.revokePreviewUrls();
    this.images = (dataUrls || []).map((dataUrl) => ({
      id: `img-${++imageIdCounter}`,
      kind: "existing",
      dataUrl,
      previewUrl: dataUrl
    }));
    this.hasChanges = false;
    this.render();
  }

  setLoading(isLoading) {
    if (isLoading) {
      this.elements.previewList.innerHTML = `
        <div class="text-muted small"><span class="spinner-border spinner-border-sm me-2"></span>Đang tải ảnh...</div>`;
    } else {
      this.render();
    }
  }

  revokePreviewUrls() {
    this.images
      .filter((image) => image.kind === "new")
      .forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }

  // ------------------------------ Sự kiện ------------------------------
  bindEvents() {
    const { dropzone, fileInput, previewList } = this.elements;

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener("change", () => {
      this.addFiles(fileInput.files);
      fileInput.value = ""; // cho phép chọn lại đúng file vừa xoá
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });
    dropzone.addEventListener("drop", (event) => this.addFiles(event.dataTransfer.files));

    previewList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-image-action]");
      if (!button) return;
      const imageId = button.closest("[data-image-id]").dataset.imageId;
      if (button.dataset.imageAction === "remove") this.removeImage(imageId);
      if (button.dataset.imageAction === "cover") this.makeCover(imageId);
    });
  }

  // Kiểm tra và thêm file người dùng chọn
  addFiles(fileList) {
    this.hideError();
    const files = [...(fileList || [])];
    if (files.length === 0) return;

    const errors = [];
    const maxBytes = APP_CONFIG.maxImageSizeMB * 1024 * 1024;

    for (const file of files) {
      if (this.images.length >= APP_CONFIG.maxImagesPerProduct) {
        errors.push(`Chỉ được tối đa ${APP_CONFIG.maxImagesPerProduct} ảnh cho mỗi sản phẩm.`);
        break;
      }
      if (!APP_CONFIG.allowedImageTypes.includes(file.type)) {
        errors.push(`"${file.name}" không phải ảnh JPG, PNG hoặc WEBP.`);
        continue;
      }
      if (file.size > maxBytes) {
        errors.push(`"${file.name}" nặng ${(file.size / 1024 / 1024).toFixed(1)}MB, vượt quá ${APP_CONFIG.maxImageSizeMB}MB.`);
        continue;
      }
      this.images.push({
        id: `img-${++imageIdCounter}`,
        kind: "new",
        file,
        previewUrl: URL.createObjectURL(file)
      });
      this.hasChanges = true;
    }

    if (errors.length > 0) this.showError(errors.join(" "));
    this.render();
  }

  removeImage(imageId) {
    const image = this.images.find((item) => item.id === imageId);
    if (!image) return;
    if (image.kind === "new") URL.revokeObjectURL(image.previewUrl);
    this.images = this.images.filter((item) => item.id !== imageId);
    this.hasChanges = true;
    this.hideError();
    this.render();
  }

  // Đưa ảnh lên đầu danh sách = ảnh đại diện
  makeCover(imageId) {
    const index = this.images.findIndex((item) => item.id === imageId);
    if (index <= 0) return;
    const [image] = this.images.splice(index, 1);
    this.images.unshift(image);
    this.hasChanges = true;
    this.render();
  }

  // ------------------------------ Giao diện ------------------------------
  render() {
    const { previewList, dropzone, countLabel } = this.elements;
    const isFull = this.images.length >= APP_CONFIG.maxImagesPerProduct;

    dropzone.classList.toggle("disabled", isFull);
    dropzone.setAttribute("aria-disabled", String(isFull));
    countLabel.textContent = `${this.images.length}/${APP_CONFIG.maxImagesPerProduct} ảnh`;

    previewList.innerHTML = this.images.map((image, index) => `
      <div class="image-preview-item" data-image-id="${image.id}">
        <img src="${escapeHtml(image.previewUrl)}" alt="Ảnh sản phẩm ${index + 1}">
        <button type="button" class="btn btn-danger btn-sm btn-remove-image" data-image-action="remove"
                title="Xoá ảnh" aria-label="Xoá ảnh"><i class="bi bi-x"></i></button>
        ${index === 0
          ? `<span class="badge text-bg-primary badge-cover">Ảnh đại diện</span>`
          : `<button type="button" class="btn btn-light btn-sm badge-cover py-0 px-1" data-image-action="cover"
                     title="Đặt làm ảnh đại diện"><i class="bi bi-star"></i> Đại diện</button>`}
      </div>`).join("");
  }

  showError(message) {
    this.elements.errorBox.textContent = message;
    this.elements.errorBox.classList.remove("d-none");
  }

  hideError() {
    this.elements.errorBox.classList.add("d-none");
  }

  // percent = null -> ẩn thanh tiến trình
  setProgress(percent, label = "") {
    const { progressWrapper, progressBar } = this.elements;
    if (percent === null) {
      progressWrapper.classList.add("d-none");
      return;
    }
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    progressWrapper.classList.remove("d-none");
    progressWrapper.setAttribute("aria-valuenow", String(value));
    progressBar.style.width = `${value}%`;
    progressBar.textContent = label || `${value}%`;
  }

  // ------------------------------ Xử lý ảnh ------------------------------
  /**
   * Nén ảnh mới, giữ nguyên ảnh cũ, tạo ảnh thu nhỏ của ảnh đại diện.
   * @returns {Promise<{ imageUrls: string[], thumbnailUrl: string|null }>}
   */
  async buildImagePayload() {
    const newImageCount = this.images.filter((image) => image.kind === "new").length;
    const totalSteps = newImageCount + (this.images.length > 0 ? 1 : 0); // +1 bước tạo thumbnail
    let finishedSteps = 0;

    const reportStep = (stepPercent, label) => {
      const overall = totalSteps === 0 ? 100 : ((finishedSteps + stepPercent / 100) / totalSteps) * 100;
      this.setProgress(overall, label);
    };

    try {
      if (this.images.length > 0) {
        this.setProgress(2, "Đang chuẩn bị bộ nén ảnh...");
        await loadImageCompression(); // chỉ tải thư viện lần đầu cần dùng
      }

      const imageUrls = [];
      for (const image of this.images) {
        if (image.kind === "existing") {
          imageUrls.push(image.dataUrl);
          continue;
        }
        const label = `Đang nén ảnh ${finishedSteps + 1}/${newImageCount}...`;
        reportStep(0, label);
        const dataUrl = await compressFileToDataUrl(image.file, {
          maxWidthOrHeight: APP_CONFIG.imageMaxDimension,
          maxSizeMB: APP_CONFIG.imageCompressedMaxMB,
          quality: APP_CONFIG.imageQuality,
          onProgress: (percent) => reportStep(percent, label)
        });
        imageUrls.push(dataUrl);
        finishedSteps += 1;
      }

      let thumbnailUrl = null;
      if (imageUrls.length > 0) {
        reportStep(0, "Đang tạo ảnh thu nhỏ...");
        thumbnailUrl = await createThumbnailDataUrl(imageUrls[0]);
        finishedSteps += 1;
      }

      const totalChars = imageUrls.reduce((sum, dataUrl) => sum + dataUrl.length, 0);
      if (totalChars > MAX_IMAGE_DOCUMENT_CHARS) {
        throw createAppError(
          `Tổng dung lượng ảnh sau khi nén (${(totalChars / 1024).toFixed(0)}KB) vượt giới hạn ~1MB của Firestore. ` +
          "Hãy bớt 1 ảnh hoặc chọn ảnh đơn giản hơn."
        );
      }

      const totalKB = Math.round(imageUrls.reduce((sum, dataUrl) => sum + estimateDataUrlBytes(dataUrl), 0) / 1024);
      this.setProgress(100, `Đã nén xong · ${imageUrls.length} ảnh ≈ ${totalKB}KB`);
      return { imageUrls, thumbnailUrl };
    } catch (error) {
      this.setProgress(null);
      if (error.isAppError) throw error;
      console.error(error);
      throw createAppError("Không xử lý được ảnh (ảnh hỏng hoặc mất mạng khi tải bộ nén). Hãy thử lại.");
    }
  }
}

// =====================================================================
// HÀM NÉN ẢNH DÙNG CHUNG (form sản phẩm + công cụ tối ưu ảnh cũ)
// =====================================================================

// Định dạng đầu ra: WebP nhỏ hơn JPEG ~25–35% ở cùng chất lượng.
// Chrome/Edge/Firefox nén được WebP; Safari thường KHÔNG (canvas trả về PNG)
// -> kiểm tra 1 lần, không hỗ trợ thì dùng JPEG. Mọi trình duyệt hiện đại
// đều HIỂN THỊ được WebP nên ảnh lưu từ máy nào cũng xem được ở máy khác.
let preferredImageType = null;
export function getPreferredImageType() {
  if (!preferredImageType) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    preferredImageType = canvas.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
  }
  return preferredImageType;
}

// Dung lượng thật (byte) của ảnh trong chuỗi data URL base64
export function estimateDataUrlBytes(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

// Nền trong suốt -> phủ trắng trước khi đổi sang JPEG (nếu không sẽ thành nền đen).
// WebP giữ được nền trong suốt nên không cần.
async function flattenTransparencyForJpeg(file, outputType) {
  if (outputType !== "image/jpeg" || file.type === "image/jpeg") return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

/**
 * Nén + thu nhỏ 1 file ảnh -> data URL (base64)
 * @param {File|Blob} file
 * @param {{ maxWidthOrHeight:number, maxSizeMB:number, quality:number, onProgress?:Function }} options
 */
export async function compressFileToDataUrl(file, { maxWidthOrHeight, maxSizeMB, quality, onProgress }) {
  const imageCompression = await loadImageCompression();
  const outputType = getPreferredImageType();
  const preparedFile = await flattenTransparencyForJpeg(file, outputType);
  const compressedFile = await imageCompression(preparedFile, {
    maxWidthOrHeight,
    maxSizeMB,
    fileType: outputType,
    initialQuality: quality,
    useWebWorker: true,
    onProgress
  });
  return imageCompression.getDataUrlFromFile(compressedFile);
}

// Ảnh thu nhỏ (lưu trong document sản phẩm, tải cùng mọi danh sách) -> càng nhỏ càng nhanh
export async function createThumbnailDataUrl(sourceDataUrl) {
  const imageCompression = await loadImageCompression();
  const sourceFile = await imageCompression.getFilefromDataUrl(sourceDataUrl, "cover");
  return compressFileToDataUrl(sourceFile, {
    maxWidthOrHeight: APP_CONFIG.thumbnailMaxDimension,
    maxSizeMB: APP_CONFIG.thumbnailMaxKB / 1024,
    quality: APP_CONFIG.thumbnailQuality
  });
}

// Nén lại 1 ảnh đã lưu (công cụ tối ưu dữ liệu cũ). Chỉ trả ảnh mới nếu NHỎ HƠN.
export async function recompressStoredDataUrl(dataUrl) {
  const imageCompression = await loadImageCompression();
  const sourceFile = await imageCompression.getFilefromDataUrl(dataUrl, "image");
  const optimizedDataUrl = await compressFileToDataUrl(sourceFile, {
    maxWidthOrHeight: APP_CONFIG.imageMaxDimension,
    maxSizeMB: APP_CONFIG.imageCompressedMaxMB,
    quality: APP_CONFIG.imageQuality
  });
  return optimizedDataUrl.length < dataUrl.length ? optimizedDataUrl : dataUrl;
}
