/**
 * ai.js - Gemini API integration for quiz explanations and chatbot
 * BYOK (Bring Your Own Key) architecture - API Key is saved in user's browser localStorage
 * Safe for public GitHub repositories & GitHub Pages.
 */

const STORAGE_KEY = "cnxhkh_gemini_api_key";

// System instruction for all CNXHKH related queries
const SYSTEM_INSTRUCTION = `Bạn là giảng viên môn Chủ nghĩa xã hội khoa học (CNXHKH), 
chuyên gia về giáo trình CNXHKH của Bộ GD&ĐT Việt Nam. 
Trả lời ngắn gọn, bám sát giáo trình, dùng tiếng Việt. 
Từ chối lịch sự các câu hỏi không liên quan đến môn CNXHKH, 
chủ nghĩa Mác-Lênin, lịch sử Đảng, tư tưởng Hồ Chí Minh.`;

// -------------------------------------------------------
// API KEY HELPERS
// -------------------------------------------------------

export function getApiKey() {
  return (localStorage.getItem(STORAGE_KEY) || "").trim();
}

export function setApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasApiKey() {
  return Boolean(getApiKey());
}

/**
 * Open the API Key configuration modal.
 * @param {Function} onSuccess - Callback when a valid key is saved.
 */
export function openApiKeyModal(onSuccess) {
  let modal = document.getElementById("api-key-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "api-key-modal";
    modal.className = "overlay";
    modal.innerHTML = `
      <div class="overlay__box" style="max-width:480px;text-align:left;position:relative;">
        <button id="btn-close-api-modal" type="button" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:#888;">✕</button>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:1.8rem;">⚙️</span>
          <h3 style="margin:0;color:var(--color-primary);font-size:1.25rem;">Cài đặt Gemini API Key</h3>
        </div>
        <p style="font-size:0.875rem;color:var(--color-text-muted);line-height:1.5;margin-bottom:14px;">
          Để kích hoạt các tính năng AI (<strong>Giải thích tại sao sai</strong>, <strong>Mẹo ghi nhớ</strong>, <strong>Chatbot trợ giảng</strong>), hãy dán Gemini API Key của bạn bên dưới.
        </p>
        <div style="background:#e8f4fd;border-left:4px solid #2196f3;padding:10px 12px;border-radius:4px;font-size:0.82rem;color:#0d47a1;margin-bottom:16px;line-height:1.4;">
          🔒 <strong>Bảo mật 100%:</strong> API Key chỉ lưu trên trình duyệt của bạn (LocalStorage), không bị gửi lên GitHub hay bất kỳ máy chủ nào khác.
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Gemini API Key:</label>
          <div style="position:relative;">
            <input id="input-gemini-key" type="password" placeholder="Dán API Key tại đây..." 
                   style="width:100%;padding:10px 42px 10px 12px;border:1px solid var(--color-border);border-radius:var(--radius-btn);font-family:monospace;font-size:0.85rem;box-sizing:border-box;" />
            <button id="btn-toggle-key-visibility" type="button" title="Hiện/ẩn key" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:#888;">👁️</button>
          </div>
        </div>
        <p style="font-size:0.82rem;color:var(--color-text-muted);margin-bottom:18px;">
          Chưa có API Key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="color:var(--color-accent);font-weight:600;text-decoration:underline;">👉 Lấy key miễn phí tại Google AI Studio</a> (chỉ mất 10 giây).
        </p>
        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          <button id="btn-clear-api-key" type="button" class="btn btn--secondary btn--sm" style="color:var(--color-danger);border-color:var(--color-danger);">Xóa Key</button>
          <button id="btn-save-api-key" type="button" class="btn btn--primary btn--sm">💾 Lưu Key</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const input = modal.querySelector("#input-gemini-key");
    const btnToggle = modal.querySelector("#btn-toggle-key-visibility");
    const btnClose = modal.querySelector("#btn-close-api-modal");
    const btnSave = modal.querySelector("#btn-save-api-key");
    const btnClear = modal.querySelector("#btn-clear-api-key");

    btnToggle.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      btnToggle.textContent = input.type === "password" ? "👁️" : "🙈";
    });

    btnClose.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });

    btnSave.addEventListener("click", () => {
      const val = input.value.trim();
      if (!val) {
        alert("Vui lòng nhập API Key!");
        return;
      }
      setApiKey(val);
      modal.classList.add("hidden");
      updateApiKeyStatus();
      if (typeof onSuccess === "function") onSuccess();
    });

    btnClear.addEventListener("click", () => {
      if (confirm("Bạn có chắc muốn xóa API Key khỏi trình duyệt?")) {
        setApiKey("");
        input.value = "";
        modal.classList.add("hidden");
        updateApiKeyStatus();
      }
    });
  }

  const input = modal.querySelector("#input-gemini-key");
  if (input) input.value = getApiKey();
  modal.classList.remove("hidden");
  setTimeout(() => input?.focus(), 100);
}

/** Update API Key badge / indicator on all buttons */
export function updateApiKeyStatus() {
  const btns = document.querySelectorAll("#btn-api-key, .btn-api-key");
  const hasKey = hasApiKey();
  btns.forEach(btn => {
    btn.innerHTML = hasKey 
      ? `⚙️ <span class="nav-btn-text">API Key</span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#28a745;vertical-align:middle;margin-left:3px;" title="Đã lưu API Key"></span>`
      : `⚙️ <span class="nav-btn-text">API Key</span>`;
  });
}

/** Global listener for elements that trigger the API Key modal */
export function initApiKeyUI() {
  document.addEventListener("click", (e) => {
    const target = e.target.closest("#btn-api-key, .btn-api-key, [data-action='open-api-key-modal']");
    if (target) {
      e.preventDefault();
      openApiKeyModal();
    }
  });
  updateApiKeyStatus();
}

// Auto-initialize when script loads
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApiKeyUI);
  } else {
    initApiKeyUI();
  }
}

// -------------------------------------------------------
// CORE GEMINI API CALL
// -------------------------------------------------------

/**
 * Core function to call the Gemini API.
 * @param {string} prompt - User prompt
 * @param {string} systemInstruction - System instruction text
 * @param {Array} history - Chat history [{role, parts: [{text}]}]
 * @returns {string} - Generated text response
 */
async function callGemini(prompt, systemInstruction = SYSTEM_INSTRUCTION, history = []) {
  const apiKey = getApiKey();
  if (!apiKey) {
    openApiKeyModal();
    throw new Error("NO_API_KEY");
  }

  const body = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      ...history,
      { role: "user", parts: [{ text: prompt }] }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 512,
    }
  };

  // Supported model fallbacks
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        const errText = await res.text();
        throw new Error(`API_KEY_INVALID: ${errText}`);
      }

      if (!res.ok) {
        lastError = new Error(`Model ${model} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      if (err.message?.startsWith("API_KEY_INVALID")) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("Không nhận được phản hồi từ Gemini API.");
}

// -------------------------------------------------------
// FEATURE WRAPPERS
// -------------------------------------------------------

/**
 * Explain why the user's answer was wrong.
 * @param {string} question - Question text
 * @param {string[]} options - Array of 4 option strings
 * @param {number} userAnswer - Index of user's choice (0-3)
 * @param {number} correctAnswer - Index of correct answer (0-3)
 * @returns {string} - HTML explanation string
 */
export async function explainWrongAnswer(question, options, userAnswer, correctAnswer) {
  const labels = ["A", "B", "C", "D"];
  const prompt = `Câu hỏi: "${question}"

Các đáp án:
${options.map((o, i) => `${labels[i]}. ${o}`).join("\n")}

Học sinh đã chọn: ${labels[userAnswer]}. ${options[userAnswer]}
Đáp án đúng là: ${labels[correctAnswer]}. ${options[correctAnswer]}

Hãy giải thích ngắn gọn trong 3-4 gạch đầu dòng:
1. Tại sao đáp án ${labels[correctAnswer]} là ĐÚNG (theo giáo trình CNXHKH Bộ GD&ĐT VN)
2. Tại sao đáp án ${labels[userAnswer]} là SAI / bẫy gì trong đó
Dùng tiếng Việt, súc tích.`;

  const system = `Bạn là giảng viên CNXHKH, giải thích ngắn gọn trong 3-4 gạch đầu dòng tại sao đáp án đúng lại chính xác theo giáo trình CNXHKH của Bộ GD&ĐT Việt Nam, và chỉ ra bẫy trong đáp án sai. Trả lời bằng tiếng Việt.`;

  try {
    const text = await callGemini(prompt, system);
    // Convert markdown bullet points to HTML
    const html = text
      .split("\n")
      .map(line => {
        line = line.trim();
        if (!line) return "";
        if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
          return `<li>${line.substring(2)}</li>`;
        }
        if (/^\d+\./.test(line)) {
          return `<li>${line.replace(/^\d+\.\s*/, "")}</li>`;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return `<strong>${line.slice(2, -2)}</strong>`;
        }
        return `<p>${line}</p>`;
      })
      .filter(Boolean)
      .join("");
    return `<ul style="padding-left:18px;margin:0">${html}</ul>`;
  } catch (e) {
    console.error("explainWrongAnswer error:", e);
    if (e.message === "NO_API_KEY") {
      return `
        <div style="padding:8px 0;">
          <p style="color:var(--color-accent);margin-bottom:8px;">⚠️ Bạn chưa cài đặt Gemini API Key để dùng tính năng giải thích.</p>
          <button type="button" class="btn btn--primary btn--sm" data-action="open-api-key-modal">⚙️ Nhập Gemini API Key</button>
        </div>
      `;
    }
    if (e.message?.startsWith("API_KEY_INVALID")) {
      return `
        <div style="padding:8px 0;">
          <p style="color:var(--color-danger);margin-bottom:8px;">⚠️ Gemini API Key không hợp lệ hoặc đã hết hạn.</p>
          <button type="button" class="btn btn--primary btn--sm" data-action="open-api-key-modal">⚙️ Đổi API Key</button>
        </div>
      `;
    }
    return `<p style="color:#666">Không thể tải giải thích lúc này. Vui lòng kiểm tra kết nối mạng hoặc thử lại.</p>`;
  }
}

/**
 * Create a mnemonic (mẹo nhớ) for the correct answer.
 * @param {string} question - Question text
 * @param {string} correctAnswer - Correct answer text
 * @returns {string} - One-line mnemonic string
 */
export async function createMnemonic(question, correctAnswer) {
  const prompt = `Tạo MỘT câu mẹo nhớ ngắn gọn (dưới 20 từ) để nhớ rằng câu trả lời cho câu hỏi sau là đáp án đã cho.
Câu hỏi: "${question}"
Đáp án đúng: "${correctAnswer}"
Chỉ trả về câu mẹo nhớ, không giải thích thêm.`;

  try {
    const text = await callGemini(prompt);
    return text.trim();
  } catch (e) {
    console.error("createMnemonic error:", e);
    return "";
  }
}

/**
 * Send a chat message to the AI chatbot.
 * @param {string} userMessage - Current user message
 * @param {Array} history - Previous messages [{role, text}]
 * @returns {string} - AI response text
 */
export async function sendChatMessage(userMessage, history = []) {
  const geminiHistory = history.map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.text }]
  }));

  try {
    const text = await callGemini(userMessage, SYSTEM_INSTRUCTION, geminiHistory);
    return text.trim();
  } catch (e) {
    console.error("sendChatMessage error:", e);
    if (e.message === "NO_API_KEY") {
      return "⚠️ Bạn chưa nhập Gemini API Key. Vui lòng nhấp vào nút '⚙️ API Key' ở thanh điều hướng để dán key miễn phí vào nhé!";
    }
    if (e.message?.startsWith("API_KEY_INVALID")) {
      return "⚠️ Gemini API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại key ở nút '⚙️ API Key'.";
    }
    return "Xin lỗi, tôi không thể kết nối lúc này. Vui lòng thử lại.";
  }
}
