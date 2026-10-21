/**
 * app.js - Entry point: Unified Auth (Local + Firebase), navigation helpers,
 *          mistake bank, shared utilities, and login modal.
 */

import {
  signInWithGoogle,
  signOutFirebase,
  onFirebaseAuthStateChanged,
  getFirebaseUser,
  firebaseReady
} from "./firebase.js";
import { loadQuestions } from "./data.js";
import { openApiKeyModal, initApiKeyUI, getApiKey, setApiKey, hasApiKey } from "./ai.js";

export { openApiKeyModal, initApiKeyUI, getApiKey, setApiKey, hasApiKey };

// -------------------------------------------------------
// UNIFIED AUTH STATE (Local + Firebase)
// -------------------------------------------------------
const LOCAL_USER_KEY = "cnxhkh_current_user";
const authListeners = new Set();

/** Convert emoji or character to a high quality SVG Data URL avatar */
export function emojiToAvatarUrl(emoji) {
  if (!emoji) return `https://ui-avatars.com/api/?name=U&background=1a1a2e&color=fff&size=80`;
  if (emoji.startsWith("http") || emoji.startsWith("data:")) return emoji;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%231a1a2e'/><text x='50%' y='55%' font-size='50' dominant-baseline='middle' text-anchor='middle'>${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Get local user from localStorage */
export function getLocalUser() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USER_KEY) || "null");
  } catch {
    return null;
  }
}

/** Set or clear local user */
export function setLocalUser(user) {
  if (user) {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_USER_KEY);
  }
  dispatchAuth(getCurrentUser());
}

/** Get current active user (Firebase takes priority, fallback to Local User) */
export function getCurrentUser() {
  const fbUser = getFirebaseUser();
  if (fbUser) return fbUser;
  return getLocalUser();
}

/** Subscribe to auth state changes */
export function onAuthChange(callback) {
  authListeners.add(callback);
  callback(getCurrentUser());
  return () => authListeners.delete(callback);
}

function dispatchAuth(user) {
  authListeners.forEach(cb => {
    try { cb(user); } catch (e) { console.warn(e); }
  });
  document.dispatchEvent(new CustomEvent("authReady", { detail: user }));
}

// Listen to Firebase auth changes to keep unified state in sync
onFirebaseAuthStateChanged(fbUser => {
  if (fbUser) {
    // If signed into Firebase, use it
    dispatchAuth(fbUser);
  } else {
    // Check if we have a local user
    dispatchAuth(getLocalUser());
  }
});

/** Log in quickly with nickname + avatar (No external credentials required) */
export function loginAsLocalUser(displayName, avatarEmoji = "🎓") {
  const name = (displayName || "Học viên").trim();
  const user = {
    uid: "local_" + Date.now(),
    displayName: name,
    photoURL: emojiToAvatarUrl(avatarEmoji),
    email: "",
    isLocal: true,
    avatarEmoji,
    createdAt: new Date().toISOString()
  };
  setLocalUser(user);
  showToast(`Xin chào, ${name}!`);
  return user;
}

/** Sign out from both Firebase and Local storage */
export async function signOutUser() {
  setLocalUser(null);
  await signOutFirebase();
  showToast("Đã đăng xuất");
}

// -------------------------------------------------------
// LOGIN MODAL UI
// -------------------------------------------------------
let selectedAvatarEmoji = "🎓";

export function openLoginModal(onSuccess) {
  let modal = document.getElementById("login-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "login-modal";
    modal.className = "overlay";
    modal.innerHTML = `
      <div class="overlay__box" style="max-width:440px;text-align:left;position:relative;">
        <button id="btn-close-login-modal" type="button" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:#888;">✕</button>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span style="font-size:1.8rem;">🔑</span>
          <h3 style="margin:0;color:var(--color-primary);font-size:1.25rem;">Đăng nhập / Tạo hồ sơ</h3>
        </div>
        
        <!-- Tab selector -->
        <div style="display:flex;border-bottom:1px solid var(--color-border);margin-bottom:16px;">
          <button id="tab-login-quick" type="button" style="flex:1;padding:10px 6px;border:none;background:none;font-weight:700;font-size:0.9rem;cursor:pointer;border-bottom:2px solid var(--color-accent);color:var(--color-primary);transition:0.2s;">⚡ Đăng nhập nhanh</button>
          <button id="tab-login-google" type="button" style="flex:1;padding:10px 6px;border:none;background:none;font-weight:600;font-size:0.9rem;cursor:pointer;border-bottom:2px solid transparent;color:var(--color-text-muted);transition:0.2s;">🌐 Google (Firebase)</button>
        </div>

        <!-- Panel: Quick Login -->
        <div id="panel-login-quick">
          <p style="font-size:0.85rem;color:var(--color-text-muted);line-height:1.4;margin-bottom:14px;">
            Nhập tên của bạn để lưu tiến độ, xem thống kê hồ sơ và ghi điểm lên Bảng xếp hạng ngay mà không cần tạo tài khoản.
          </p>
          
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Tên hoặc Biệt danh:</label>
            <input id="input-quick-name" type="text" placeholder="Nhập tên của bạn..." 
                   style="width:100%;padding:10px 12px;border:1px solid var(--color-border);border-radius:var(--radius-btn);font-size:0.95rem;box-sizing:border-box;" maxlength="30" />
          </div>

          <div style="margin-bottom:18px;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Chọn biểu tượng đại diện:</label>
            <div id="avatar-picker" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
              <button type="button" class="avatar-opt active" data-avatar="🎓" style="font-size:1.8rem;padding:6px 10px;cursor:pointer;border:2px solid var(--color-accent);border-radius:8px;background:#fff;">🎓</button>
              <button type="button" class="avatar-opt" data-avatar="🚀" style="font-size:1.8rem;padding:6px 10px;cursor:pointer;border:2px solid var(--color-border);border-radius:8px;background:#fff;">🚀</button>
              <button type="button" class="avatar-opt" data-avatar="🦁" style="font-size:1.8rem;padding:6px 10px;cursor:pointer;border:2px solid var(--color-border);border-radius:8px;background:#fff;">🦁</button>
              <button type="button" class="avatar-opt" data-avatar="🐱" style="font-size:1.8rem;padding:6px 10px;cursor:pointer;border:2px solid var(--color-border);border-radius:8px;background:#fff;">🐱</button>
              <button type="button" class="avatar-opt" data-avatar="👑" style="font-size:1.8rem;padding:6px 10px;cursor:pointer;border:2px solid var(--color-border);border-radius:8px;background:#fff;">👑</button>
              <button type="button" class="avatar-opt" data-avatar="🧠" style="font-size:1.8rem;padding:6px 10px;cursor:pointer;border:2px solid var(--color-border);border-radius:8px;background:#fff;">🧠</button>
              <button type="button" class="avatar-opt" data-avatar="🎯" style="font-size:1.8rem;padding:6px 10px;cursor:pointer;border:2px solid var(--color-border);border-radius:8px;background:#fff;">🎯</button>
              <button type="button" class="avatar-opt" data-avatar="⭐" style="font-size:1.8rem;padding:6px 10px;cursor:pointer;border:2px solid var(--color-border);border-radius:8px;background:#fff;">⭐</button>
            </div>
          </div>

          <button id="btn-submit-quick-login" type="button" class="btn btn--primary" style="width:100%;padding:12px;font-size:1rem;">
            🚀 Bắt đầu ôn tập ngay
          </button>
        </div>

        <!-- Panel: Google Login -->
        <div id="panel-login-google" class="hidden">
          <p style="font-size:0.85rem;color:var(--color-text-muted);line-height:1.4;margin-bottom:14px;">
            Đăng nhập qua Google Firebase để đồng bộ điểm số và đua Top toàn cầu qua đám mây.
          </p>

          <button id="btn-google-signin-modal" type="button" class="btn btn--primary" style="width:100%;padding:12px;display:flex;align-items:center;justify-content:center;gap:10px;background:#4285F4;border-color:#4285F4;font-size:0.95rem;">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            Đăng nhập với Google
          </button>

          <div id="google-login-status" class="hidden" style="margin-top:14px;background:#fdecea;border-left:4px solid var(--color-danger);padding:10px 12px;border-radius:4px;font-size:0.82rem;color:#b71c1c;line-height:1.4;">
          </div>
        </div>

      </div>
    `;
    document.body.appendChild(modal);

    // DOM bindings inside modal
    const tabQuick = modal.querySelector("#tab-login-quick");
    const tabGoogle = modal.querySelector("#tab-login-google");
    const panelQuick = modal.querySelector("#panel-login-quick");
    const panelGoogle = modal.querySelector("#panel-login-google");
    const btnClose = modal.querySelector("#btn-close-login-modal");
    const inputName = modal.querySelector("#input-quick-name");
    const btnSubmitQuick = modal.querySelector("#btn-submit-quick-login");
    const btnGoogle = modal.querySelector("#btn-google-signin-modal");
    const googleStatus = modal.querySelector("#google-login-status");
    const avatarBtns = modal.querySelectorAll(".avatar-opt");

    // Tab switching
    tabQuick.addEventListener("click", () => {
      tabQuick.style.borderBottom = "2px solid var(--color-accent)";
      tabQuick.style.color = "var(--color-primary)";
      tabGoogle.style.borderBottom = "2px solid transparent";
      tabGoogle.style.color = "var(--color-text-muted)";
      panelQuick.classList.remove("hidden");
      panelGoogle.classList.add("hidden");
    });

    tabGoogle.addEventListener("click", () => {
      tabGoogle.style.borderBottom = "2px solid var(--color-accent)";
      tabGoogle.style.color = "var(--color-primary)";
      tabQuick.style.borderBottom = "2px solid transparent";
      tabQuick.style.color = "var(--color-text-muted)";
      panelGoogle.classList.remove("hidden");
      panelQuick.classList.add("hidden");
    });

    // Avatar selection
    avatarBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        avatarBtns.forEach(b => {
          b.style.borderColor = "var(--color-border)";
          b.classList.remove("active");
        });
        btn.style.borderColor = "var(--color-accent)";
        btn.classList.add("active");
        selectedAvatarEmoji = btn.dataset.avatar || "🎓";
      });
    });

    // Close modal
    btnClose.addEventListener("click", () => modal.classList.add("hidden"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });

    // Submit quick login
    btnSubmitQuick.addEventListener("click", () => {
      const name = inputName.value.trim();
      if (!name) {
        alert("Vui lòng nhập Tên hoặc Biệt danh của bạn!");
        inputName.focus();
        return;
      }
      const user = loginAsLocalUser(name, selectedAvatarEmoji);
      modal.classList.add("hidden");
      if (typeof onSuccess === "function") onSuccess(user);
    });

    inputName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnSubmitQuick.click();
    });

    // Submit Google login with friendly error handling
    btnGoogle.addEventListener("click", async () => {
      btnGoogle.disabled = true;
      btnGoogle.innerHTML = '<span class="spinner"></span> Đang kết nối Google...';
      googleStatus.classList.add("hidden");

      try {
        const user = await signInWithGoogle();
        modal.classList.add("hidden");
        showToast(`Đăng nhập thành công: ${user.displayName || user.email}`);
        if (typeof onSuccess === "function") onSuccess(user);
      } catch (err) {
        googleStatus.classList.remove("hidden");
        let msg = `⚠️ <strong>Đăng nhập Google không thành công:</strong><br>`;
        if (err.code === "auth/unauthorized-domain") {
          msg += `Tên miền <code>${window.location.hostname}</code> chưa được thêm vào mục <strong>Authorized domains</strong> trong Firebase Console.<br><br>👉 <strong>Khuyên dùng:</strong> Hãy bấm qua tab <strong>⚡ Đăng nhập nhanh</strong> để vào học ngay lập tức!`;
        } else if (err.code === "auth/popup-blocked") {
          msg += `Trình duyệt của bạn đang chặn cửa sổ Popup. Vui lòng cho phép popup hoặc dùng tab <strong>Đăng nhập nhanh</strong>.`;
        } else if (err.code === "auth/popup-closed-by-user") {
          msg += `Cửa sổ đăng nhập đã bị đóng trước khi hoàn tất.`;
        } else {
          msg += `${err.message || err.code || "Không thể kết nối"}.<br><br>👉 Bạn có thể chuyển sang tab <strong>Đăng nhập nhanh</strong> để ôn tập ngay!`;
        }
        googleStatus.innerHTML = msg;
      } finally {
        btnGoogle.disabled = false;
        btnGoogle.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Đăng nhập với Google
        `;
      }
    });
  }

  // Pre-fill existing local name if any
  const cur = getLocalUser();
  const input = modal.querySelector("#input-quick-name");
  if (cur && input) input.value = cur.displayName || "";
  
  modal.classList.remove("hidden");
  setTimeout(() => input?.focus(), 100);
}

// -------------------------------------------------------
// NAVBAR AUTH INITIALIZATION
// -------------------------------------------------------

export function initNavAuth() {
  const btnLogin = document.getElementById("btn-login");
  const userInfo = document.getElementById("user-info");
  const userName = document.getElementById("user-name");
  const userAvatar = document.getElementById("user-avatar");
  const btnLogout = document.getElementById("btn-logout");

  // Wire up login button click -> open modal
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      openLoginModal();
    });
  }

  // Wire up logout button
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await signOutUser();
    });
  }

  // React to unified auth changes
  onAuthChange(user => {
    if (user) {
      if (btnLogin) btnLogin.classList.add("hidden");
      if (userInfo) userInfo.classList.remove("hidden");
      if (userName) userName.textContent = user.displayName || user.email || "Học viên";
      if (userAvatar) {
        userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=e94560&color=fff`;
      }
    } else {
      if (btnLogin) btnLogin.classList.remove("hidden");
      if (userInfo) userInfo.classList.add("hidden");
    }
  });
}

// -------------------------------------------------------
// MISTAKE BANK - localStorage key
// -------------------------------------------------------
const MB_KEY = "cnxhkh_mistake_bank";

export function loadMistakeBank() {
  try {
    return JSON.parse(localStorage.getItem(MB_KEY) || "{}");
  } catch { return {}; }
}

export function saveMistakeBank(bank) {
  localStorage.setItem(MB_KEY, JSON.stringify(bank));
}

export function recordWrong(qId) {
  const bank = loadMistakeBank();
  const entry = bank[qId] || { wrongCount: 0, correctStreak: 0 };
  entry.wrongCount++;
  entry.correctStreak = 0;
  bank[qId] = entry;
  saveMistakeBank(bank);
}

export function recordCorrect(qId, isMistakeMode = false) {
  const bank = loadMistakeBank();
  if (!bank[qId]) return;
  if (isMistakeMode) {
    bank[qId].correctStreak = (bank[qId].correctStreak || 0) + 1;
    if (bank[qId].correctStreak >= 3) {
      delete bank[qId];
    }
    saveMistakeBank(bank);
  }
}

export function getMistakeCount() {
  return Object.keys(loadMistakeBank()).length;
}

// -------------------------------------------------------
// SESSION STORAGE - persist quiz state across pages
// -------------------------------------------------------
const SESSION_KEY = "cnxhkh_quiz_session";

export function saveQuizSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadQuizSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch { return null; }
}

export function clearQuizSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// -------------------------------------------------------
// STATS & RESULTS TRACKING
// -------------------------------------------------------
const RESULT_KEY = "cnxhkh_last_result";
const STATS_KEY = "cnxhkh_user_stats";

export function recordLocalStats(result) {
  try {
    const stats = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    stats.totalAnswered = (stats.totalAnswered || 0) + (result.total || 0);
    stats.totalCorrect = (stats.totalCorrect || 0) + (result.score || 0);
    stats.streakDays = stats.streakDays || 1;
    stats.chapterStats = stats.chapterStats || {};
    if (result.chapter) {
      const chKey = `ch${result.chapter}`;
      stats.chapterStats[chKey] = stats.chapterStats[chKey] || { answered: 0, correct: 0 };
      stats.chapterStats[chKey].answered += result.total || 0;
      stats.chapterStats[chKey].correct += result.score || 0;
    }
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn("recordLocalStats error:", e);
  }
}

export function saveLastResult(data) {
  localStorage.setItem(RESULT_KEY, JSON.stringify(data));
  recordLocalStats(data);
}

export function loadLastResult() {
  try {
    return JSON.parse(localStorage.getItem(RESULT_KEY) || "null");
  } catch { return null; }
}

// -------------------------------------------------------
// NAV HELPERS
// -------------------------------------------------------

export function startQuiz(params) {
  saveQuizSession({ ...params, startedAt: Date.now() });
  window.location.href = "quiz.html";
}

// -------------------------------------------------------
// TOAST NOTIFICATIONS
// -------------------------------------------------------

let toastTimer = null;

export function showToast(message, duration = 2500) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

// -------------------------------------------------------
// FORMAT HELPERS
// -------------------------------------------------------

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function getScoreBadge(pct) {
  if (pct < 50)  return { icon: "🌱", title: "Tân binh Nhập môn" };
  if (pct < 70)  return { icon: "📘", title: "Học viên Chăm chỉ" };
  if (pct < 80)  return { icon: "🎯", title: "Chiến thần Qua môn" };
  if (pct < 90)  return { icon: "🧠", title: "Lý luận gia Lão luyện" };
  if (pct < 100) return { icon: "🏆", title: "Cao thủ CNXHKH" };
  return { icon: "👑", title: "Trùm cuối CNXHKH" };
}

// -------------------------------------------------------
// PROGRESS TRACKING
// -------------------------------------------------------
const PROGRESS_KEY = "cnxhkh_answered_ids";

export function markAnswered(qIds) {
  try {
    const existing = new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) || "[]"));
    for (const id of qIds) existing.add(id);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...existing]));
  } catch {}
}

export function getAnsweredCount() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "[]").length;
  } catch { return 0; }
}
