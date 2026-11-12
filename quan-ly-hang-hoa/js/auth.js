// =====================================================================
// File: js/auth.js
// Đường dẫn: chi tiêu/js/auth.js
// Mục đích: Đăng nhập, đăng xuất, quên mật khẩu và ROUTE GUARD
//           (chưa đăng nhập thì không vào được trang nội bộ).
// =====================================================================

import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from "./firebase.js";
import { OWNER_UID } from "./config.js";
import {
  showToast,
  showError,
  setButtonLoading,
  getFriendlyErrorMessage,
  confirmDialog,
  getQueryParam
} from "./utils.js";

const LOGIN_PAGE = "index.html";
const HOME_PAGE = "dashboard.html";

// Tên file trang hiện tại, ví dụ "products.html?id=abc"
function getCurrentPagePath() {
  const fileName = window.location.pathname.split("/").pop() || HOME_PAGE;
  return fileName + window.location.search;
}

// Chỉ cho phép chuyển hướng tới trang nội bộ (chống open-redirect)
function getSafeRedirectTarget() {
  const redirect = getQueryParam("redirect");
  if (redirect && /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(redirect) && !redirect.startsWith(LOGIN_PAGE)) {
    return redirect;
  }
  return HOME_PAGE;
}

// Tài khoản đăng nhập có phải chủ cửa hàng không
function isOwnerAccount(user) {
  return Boolean(user) && user.uid === OWNER_UID;
}

// ---------------------------------------------------------------------
// ROUTE GUARD — gọi ở đầu mọi trang nội bộ.
// - Chưa đăng nhập -> chuyển về index.html?redirect=<trang hiện tại>
// - Đăng nhập sai tài khoản -> đăng xuất ngay
// - Hợp lệ -> gọi onReady(user) đúng 1 lần
// Listener vẫn chạy tiếp: đăng xuất ở tab khác thì tab này cũng thoát.
// ---------------------------------------------------------------------
export function requireAuth(onReady) {
  document.body.classList.add("auth-pending");
  let hasInitialized = false;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace(`${LOGIN_PAGE}?redirect=${encodeURIComponent(getCurrentPagePath())}`);
      return;
    }
    if (!isOwnerAccount(user)) {
      await signOut(auth);
      return; // onAuthStateChanged sẽ chạy lại với user = null và chuyển trang
    }
    document.body.classList.remove("auth-pending");
    if (!hasInitialized) {
      hasInitialized = true;
      onReady(user);
    }
  });
}

// ---------------------------------------------------------------------
// ĐĂNG XUẤT
// ---------------------------------------------------------------------
export async function logout() {
  const confirmed = await confirmDialog("Bạn có chắc muốn đăng xuất?", {
    title: "Đăng xuất",
    confirmText: "Đăng xuất",
    confirmClass: "btn-primary"
  });
  if (!confirmed) return;
  try {
    await signOut(auth);
    window.location.replace(LOGIN_PAGE);
  } catch (error) {
    showError(error, "Không đăng xuất được, vui lòng thử lại.");
  }
}

// ---------------------------------------------------------------------
// TRANG ĐĂNG NHẬP (index.html)
// ---------------------------------------------------------------------
export function initLoginPage() {
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const submitButton = document.getElementById("loginSubmit");
  const errorBox = document.getElementById("loginError");
  const togglePasswordButton = document.getElementById("togglePassword");
  const forgotPasswordLink = document.getElementById("forgotPassword");
  const loginCard = document.getElementById("loginCard");
  const checkingBox = document.getElementById("authChecking");

  let isSubmitting = false;

  function showLoginError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("d-none");
  }

  function hideLoginError() {
    errorBox.classList.add("d-none");
  }

  // Đã đăng nhập sẵn (còn phiên cũ) -> vào thẳng ứng dụng
  onAuthStateChanged(auth, async (user) => {
    if (user && isOwnerAccount(user)) {
      window.location.replace(getSafeRedirectTarget());
      return;
    }
    if (user && !isOwnerAccount(user)) {
      await signOut(auth);
      showLoginError("Tài khoản này không có quyền sử dụng ứng dụng.");
    }
    // Chưa đăng nhập -> hiện form
    checkingBox.classList.add("d-none");
    loginCard.classList.remove("d-none");
    if (!isSubmitting) emailInput.focus();
  });

  // Hiện / ẩn mật khẩu
  togglePasswordButton.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePasswordButton.innerHTML = `<i class="bi ${isHidden ? "bi-eye-slash" : "bi-eye"}"></i>`;
    togglePasswordButton.setAttribute("aria-label", isHidden ? "Ẩn mật khẩu" : "Hiện mật khẩu");
  });

  // Gửi form đăng nhập
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideLoginError();

    // Kiểm tra dữ liệu nhập ở giao diện (Bootstrap validation)
    loginForm.classList.add("was-validated");
    if (!loginForm.checkValidity()) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    isSubmitting = true;
    setButtonLoading(submitButton, true, "Đang đăng nhập...");
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!isOwnerAccount(credential.user)) {
        await signOut(auth);
        showLoginError("Tài khoản này không có quyền sử dụng ứng dụng.");
        return;
      }
      // Chuyển trang do onAuthStateChanged ở trên đảm nhận
    } catch (error) {
      console.error(error);
      showLoginError(getFriendlyErrorMessage(error, "Đăng nhập thất bại, vui lòng thử lại."));
      passwordInput.select();
    } finally {
      isSubmitting = false;
      setButtonLoading(submitButton, false);
    }
  });

  // Quên mật khẩu -> gửi email đặt lại
  forgotPasswordLink.addEventListener("click", async (event) => {
    event.preventDefault();
    hideLoginError();
    const email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      showLoginError("Nhập email ở ô phía trên rồi bấm lại \"Quên mật khẩu\".");
      emailInput.focus();
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Đã gửi email đặt lại mật khẩu tới ${email} (kiểm tra cả thư mục Spam).`, "success", 6000);
    } catch (error) {
      showError(error, "Không gửi được email đặt lại mật khẩu.");
    }
  });
}
