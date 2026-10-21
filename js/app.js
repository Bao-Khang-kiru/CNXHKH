/**
 * app.js - Entry point: Auth state management, navigation helpers,
 *          mistake bank (localStorage + Firebase sync), shared utilities
 */

import { onAuthChange, signInWithGoogle, signOutUser, getCurrentUser } from "./firebase.js";
import { loadQuestions } from "./data.js";
import { openApiKeyModal, initApiKeyUI, getApiKey, setApiKey, hasApiKey } from "./ai.js";

export { openApiKeyModal, initApiKeyUI, getApiKey, setApiKey, hasApiKey };

// -------------------------------------------------------
// MISTAKE BANK - localStorage key
// -------------------------------------------------------
const MB_KEY = "cnxhkh_mistake_bank"; // {qId: {wrongCount, correctStreak}}

/** Load mistake bank from localStorage. */
export function loadMistakeBank() {
  try {
    return JSON.parse(localStorage.getItem(MB_KEY) || "{}");
  } catch { return {}; }
}

/** Save mistake bank to localStorage. */
export function saveMistakeBank(bank) {
  localStorage.setItem(MB_KEY, JSON.stringify(bank));
}

/**
 * Record a wrong answer in the mistake bank.
 * @param {number} qId - Question ID
 */
export function recordWrong(qId) {
  const bank = loadMistakeBank();
  const entry = bank[qId] || { wrongCount: 0, correctStreak: 0 };
  entry.wrongCount++;
  entry.correctStreak = 0;
  bank[qId] = entry;
  saveMistakeBank(bank);
}

/**
 * Record a correct answer in the mistake bank (used in Tử địa mode).
 * If correctStreak >= 3, removes the question from the bank.
 * @param {number} qId - Question ID
 * @param {boolean} isMistakeMode - Whether currently in Tử địa mode
 */
export function recordCorrect(qId, isMistakeMode = false) {
  const bank = loadMistakeBank();
  if (!bank[qId]) return; // Not in mistake bank, nothing to do
  if (isMistakeMode) {
    bank[qId].correctStreak = (bank[qId].correctStreak || 0) + 1;
    if (bank[qId].correctStreak >= 3) {
      delete bank[qId]; // Graduated from mistake bank
    }
    saveMistakeBank(bank);
  }
}

/** Get total number of mistakes in the bank. */
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
// LAST RESULTS - persist results for results.html
// -------------------------------------------------------
const RESULT_KEY = "cnxhkh_last_result";

export function saveLastResult(data) {
  localStorage.setItem(RESULT_KEY, JSON.stringify(data));
}

export function loadLastResult() {
  try {
    return JSON.parse(localStorage.getItem(RESULT_KEY) || "null");
  } catch { return null; }
}

// -------------------------------------------------------
// NAV HELPERS
// -------------------------------------------------------

/** Navigate to quiz.html with given mode parameters. */
export function startQuiz(params) {
  saveQuizSession({ ...params, startedAt: Date.now() });
  window.location.href = "quiz.html";
}

// -------------------------------------------------------
// AUTH UI HELPERS (shared across pages)
// -------------------------------------------------------

/**
 * Initialize navbar auth state.
 * Looks for elements with IDs: #btn-login, #user-info, #user-name, #user-avatar, #btn-logout
 */
export function initNavAuth() {
  const btnLogin = document.getElementById("btn-login");
  const userInfo = document.getElementById("user-info");
  const userName = document.getElementById("user-name");
  const userAvatar = document.getElementById("user-avatar");
  const btnLogout = document.getElementById("btn-logout");

  onAuthChange(user => {
    if (user) {
      // Logged in
      if (btnLogin) btnLogin.classList.add("hidden");
      if (userInfo) userInfo.classList.remove("hidden");
      if (userName) userName.textContent = user.displayName || user.email;
      if (userAvatar) {
        userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=e94560&color=fff`;
      }
    } else {
      // Logged out
      if (btnLogin) btnLogin.classList.remove("hidden");
      if (userInfo) userInfo.classList.add("hidden");
    }

    // Dispatch custom event so pages can react
    document.dispatchEvent(new CustomEvent("authReady", { detail: user }));
  });

  // Wire up login button
  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      btnLogin.disabled = true;
      btnLogin.innerHTML = '<span class="spinner"></span> Đang đăng nhập...';
      const user = await signInWithGoogle();
      if (!user) {
        btnLogin.disabled = false;
        btnLogin.innerHTML = '🔑 Đăng nhập Google';
        showToast("Đăng nhập thất bại. Vui lòng thử lại.");
      }
    });
  }

  // Wire up logout button
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await signOutUser();
      showToast("Đã đăng xuất");
    });
  }
}

// -------------------------------------------------------
// TOAST NOTIFICATIONS
// -------------------------------------------------------

let toastTimer = null;

/** Show a toast notification message. */
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

/** Format seconds as MM:SS string. */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Get badge/title based on score percentage. */
export function getScoreBadge(pct) {
  if (pct < 50)  return { icon: "🌱", title: "Tân binh Nhập môn" };
  if (pct < 70)  return { icon: "📘", title: "Học viên Chăm chỉ" };
  if (pct < 80)  return { icon: "🎯", title: "Chiến thần Qua môn" };
  if (pct < 90)  return { icon: "🧠", title: "Lý luận gia Lão luyện" };
  if (pct < 100) return { icon: "🏆", title: "Cao thủ CNXHKH" };
  return { icon: "👑", title: "Trùm cuối CNXHKH" };
}

/** Progress tracking: total answered from localStorage. */
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
