/**
 * quiz.js - Core quiz engine
 * Handles question display, answer selection, timer, scoring,
 * survival mode, and AI integration.
 */

import {
  loadMistakeBank, saveMistakeBank, loadQuizSession, saveLastResult,
  recordWrong, recordCorrect, showToast, formatTime, getScoreBadge,
  markAnswered, startQuiz
} from "./app.js";
import {
  getQuestionsByChapter, getRandomQuestions, getMistakeBankQuestions,
  getAllQuestionsOrdered, shuffleOptions, highlightKeywords, DEFAULT_KEYWORDS,
  fisherYates
} from "./data.js";
import { explainWrongAnswer, sendChatMessage, createMnemonic } from "./ai.js";

// -------------------------------------------------------
// STATE
// -------------------------------------------------------
let state = {
  mode: null,           // "chapter" | "exam" | "mistake" | "survival" | "keyword"
  questions: [],        // Array of (possibly shuffled) question objects
  currentIndex: 0,
  score: 0,
  wrongAnswers: [],     // [{question, userAnswer, correctAnswer}]
  answered: false,      // Whether current question has been answered
  timerInterval: null,
  timeLeft: 2700,       // 45 min in seconds
  startTime: null,
  keywordMode: false,
  chatHistory: [],
  survivalStreak: 0,
};

// DOM refs
const els = {};

// -------------------------------------------------------
// INIT
// -------------------------------------------------------
async function init() {
  // Grab DOM elements
  els.questionMeta    = document.getElementById("question-meta");
  els.questionText    = document.getElementById("question-text");
  els.optionsList     = document.getElementById("options-list");
  els.progressBar     = document.getElementById("progress-bar-fill");
  els.progressLabel   = document.getElementById("progress-label");
  els.timerEl         = document.getElementById("timer");
  els.btnNext         = document.getElementById("btn-next");
  els.btnHighlight    = document.getElementById("btn-highlight");
  els.btnExplain      = document.getElementById("btn-explain");
  els.aiBox           = document.getElementById("ai-explain-box");
  els.gameOverlay     = document.getElementById("game-over-overlay");
  els.streakCount     = document.getElementById("streak-count");
  els.chatbotToggle   = document.getElementById("chatbot-toggle");
  els.chatbotPanel    = document.getElementById("chatbot-panel");
  els.chatMessages    = document.getElementById("chat-messages");
  els.chatInput       = document.getElementById("chat-input");
  els.chatSend        = document.getElementById("chat-send");
  els.chatClose       = document.getElementById("chat-close");
  els.modeBadge       = document.getElementById("mode-badge");

  // Load session
  const session = loadQuizSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }

  state.mode = session.mode;
  state.startTime = session.startedAt || Date.now();
  state.keywordMode = session.mode === "keyword";

  // Load questions based on mode
  let questions = [];
  switch (session.mode) {
    case "chapter":
      questions = await getQuestionsByChapter(session.chapter);
      break;
    case "exam":
      questions = await getRandomQuestions(40);
      break;
    case "mistake":
      questions = await getMistakeBankQuestions(loadMistakeBank());
      if (questions.length === 0) {
        showToast("Chưa có câu nào trong Tử địa!");
        setTimeout(() => window.location.href = "index.html", 1500);
        return;
      }
      break;
    case "survival":
      questions = await getAllQuestionsOrdered();
      break;
    case "keyword":
      questions = await getRandomQuestions(40);
      break;
    default:
      window.location.href = "index.html";
      return;
  }

  // Shuffle questions (except survival mode - keep order) and shuffle options
  if (session.mode !== "survival") {
    fisherYates(questions);
  }
  state.questions = questions.map(q => shuffleOptions(q));

  if (state.questions.length === 0) {
    showToast("Không tìm thấy câu hỏi!");
    setTimeout(() => window.location.href = "index.html", 1500);
    return;
  }

  // Mode badge label
  const modeLabels = {
    chapter: "📚 Học theo Chương",
    exam: "📝 Thi thử",
    mistake: "☠️ Tử địa",
    survival: "⚡ Sinh tồn",
    keyword: "🔍 Soi từ khóa",
  };
  if (els.modeBadge) els.modeBadge.textContent = modeLabels[session.mode] || session.mode;

  // Timer - only for exam mode
  if (session.mode === "exam") {
    if (els.timerEl) els.timerEl.classList.remove("hidden");
    startTimer();
  } else {
    if (els.timerEl) els.timerEl.classList.add("hidden");
  }

  // Bind controls
  if (els.btnNext) els.btnNext.addEventListener("click", nextQuestion);
  if (els.btnHighlight) {
    els.btnHighlight.addEventListener("click", toggleKeywords);
    if (state.keywordMode) {
      state.keywordMode = true;
      els.btnHighlight.classList.add("active");
    }
  }
  if (els.btnExplain) els.btnExplain.addEventListener("click", () => showAIExplanation());

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeydown);

  // Chatbot
  if (els.chatbotToggle) els.chatbotToggle.addEventListener("click", toggleChatbot);
  if (els.chatClose) els.chatClose.addEventListener("click", () => els.chatbotPanel.classList.add("hidden"));
  if (els.chatSend) els.chatSend.addEventListener("click", handleChatSend);
  if (els.chatInput) {
    els.chatInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
    });
  }

  // Game over overlay button
  const btnRestartSurvival = document.getElementById("btn-restart-survival");
  if (btnRestartSurvival) {
    btnRestartSurvival.addEventListener("click", () => {
      startQuiz({ mode: "survival" });
    });
  }
  const btnGoHome = document.getElementById("btn-go-home-overlay");
  if (btnGoHome) {
    btnGoHome.addEventListener("click", () => window.location.href = "index.html");
  }

  // Show first question
  showQuestion();
}

// -------------------------------------------------------
// TIMER
// -------------------------------------------------------
function startTimer() {
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      finishQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  if (!els.timerEl) return;
  els.timerEl.textContent = formatTime(state.timeLeft);
  els.timerEl.className = "timer";
  if (state.timeLeft < 60) els.timerEl.classList.add("timer--danger");
  else if (state.timeLeft < 300) els.timerEl.classList.add("timer--warning");
}

// -------------------------------------------------------
// QUESTION DISPLAY
// -------------------------------------------------------
function showQuestion() {
  const q = state.questions[state.currentIndex];
  state.answered = false;

  // Reset AI box
  if (els.aiBox) els.aiBox.classList.add("hidden");
  if (els.btnExplain) els.btnExplain.classList.add("hidden");

  // Meta info
  if (els.questionMeta) {
    els.questionMeta.textContent = `Chương ${q.chapter} • Câu ${state.currentIndex + 1}/${state.questions.length}`;
  }

  // Question text (with optional keyword highlight)
  if (els.questionText) {
    const rawText = q.question;
    els.questionText.innerHTML = state.keywordMode
      ? highlightKeywords(rawText, q.keywords)
      : rawText;
  }

  // Options
  if (els.optionsList) {
    els.optionsList.innerHTML = "";
    const labels = ["A", "B", "C", "D"];
    q.options.forEach((opt, idx) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.dataset.index = idx;

      const optText = state.keywordMode ? highlightKeywords(opt, q.keywords) : opt;
      btn.innerHTML = `
        <span class="option-btn__label">${labels[idx]}</span>
        <span class="option-btn__text">${optText}</span>
      `;
      btn.addEventListener("click", () => selectAnswer(idx));
      li.appendChild(btn);
      els.optionsList.appendChild(li);
    });
  }

  // Progress
  updateProgress();

  // Next button state
  if (els.btnNext) {
    els.btnNext.textContent = state.currentIndex === state.questions.length - 1 ? "Nộp bài" : "Câu tiếp →";
    els.btnNext.disabled = true;
  }
}

// -------------------------------------------------------
// ANSWER SELECTION
// -------------------------------------------------------
function selectAnswer(selectedIdx) {
  if (state.answered) return;
  state.answered = true;

  const q = state.questions[state.currentIndex];
  const isCorrect = selectedIdx === q.correct;
  const optionBtns = document.querySelectorAll(".option-btn");

  // Disable all options
  optionBtns.forEach(btn => { btn.disabled = true; });

  // Style correct and wrong options
  optionBtns[q.correct].classList.add("option-btn--correct");
  if (!isCorrect) {
    optionBtns[selectedIdx].classList.add("option-btn--wrong");
  }

  if (isCorrect) {
    state.score++;
    if (state.mode === "mistake") {
      recordCorrect(q.id, true);
    }
    state.survivalStreak++;
  } else {
    // Record mistake
    recordWrong(q.id);
    state.wrongAnswers.push({
      question: q,
      userAnswer: selectedIdx,
      correctAnswer: q.correct,
      questionIndex: state.currentIndex + 1,
    });

    // Survival mode: game over
    if (state.mode === "survival") {
      setTimeout(() => showGameOver(), 800);
      return;
    }

    // Show "Tại sao sai?" button
    if (els.btnExplain) els.btnExplain.classList.remove("hidden");
  }

  // Enable next button
  if (els.btnNext) els.btnNext.disabled = false;
}

// -------------------------------------------------------
// NAVIGATION
// -------------------------------------------------------
function nextQuestion() {
  if (state.currentIndex >= state.questions.length - 1) {
    finishQuiz();
  } else {
    state.currentIndex++;
    showQuestion();
  }
}

// -------------------------------------------------------
// KEYWORD TOGGLE
// -------------------------------------------------------
function toggleKeywords() {
  state.keywordMode = !state.keywordMode;
  if (els.btnHighlight) {
    els.btnHighlight.textContent = state.keywordMode ? "🔍 Tắt từ khóa" : "🔍 Từ khóa";
    els.btnHighlight.classList.toggle("btn--primary", state.keywordMode);
    els.btnHighlight.classList.toggle("btn--secondary", !state.keywordMode);
  }
  showQuestion(); // Re-render with/without highlights
}

// -------------------------------------------------------
// AI EXPLANATION
// -------------------------------------------------------
async function showAIExplanation() {
  if (!els.aiBox || !els.btnExplain) return;
  const wrong = state.wrongAnswers[state.wrongAnswers.length - 1];
  if (!wrong) return;

  els.aiBox.classList.remove("hidden");
  els.aiBox.innerHTML = `
    <h4>🤖 Giải thích AI:</h4>
    <div class="ai-loading"><span class="spinner"></span> Đang phân tích...</div>
  `;
  els.btnExplain.disabled = true;

  try {
    const html = await explainWrongAnswer(
      wrong.question.question,
      wrong.question.options,
      wrong.userAnswer,
      wrong.correctAnswer
    );
    els.aiBox.innerHTML = `<h4>🤖 Tại sao sai?</h4>${html}`;
  } catch (e) {
    els.aiBox.innerHTML = `<h4>🤖 Giải thích AI:</h4><p>Không thể tải giải thích. Kiểm tra kết nối.</p>`;
  }
  els.btnExplain.disabled = false;
}

// -------------------------------------------------------
// PROGRESS
// -------------------------------------------------------
function updateProgress() {
  const current = state.currentIndex + 1;
  const total = state.questions.length;
  const pct = Math.round((current / total) * 100);

  if (els.progressBar) els.progressBar.style.width = pct + "%";
  if (els.progressLabel) els.progressLabel.textContent = `${current} / ${total}`;
}

// -------------------------------------------------------
// GAME OVER (Survival)
// -------------------------------------------------------
function showGameOver() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  if (els.streakCount) els.streakCount.textContent = state.survivalStreak;
  if (els.gameOverlay) els.gameOverlay.classList.remove("hidden");

  // Save survival result for leaderboard
  saveLastResult({
    mode: "survival",
    streak: state.survivalStreak,
    score: state.survivalStreak,
    total: state.questions.length,
    timeTaken: Math.round((Date.now() - state.startTime) / 1000),
    wrongAnswers: state.wrongAnswers,
    date: new Date().toISOString(),
  });
}

// -------------------------------------------------------
// FINISH QUIZ
// -------------------------------------------------------
function finishQuiz() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  const timeTaken = Math.round((Date.now() - state.startTime) / 1000);

  // Track which question IDs were answered
  markAnswered(state.questions.map(q => q.id));

  // Save result
  saveLastResult({
    mode: state.mode,
    score: state.score,
    total: state.questions.length,
    timeTaken,
    wrongAnswers: state.wrongAnswers,
    date: new Date().toISOString(),
  });

  window.location.href = "results.html";
}

// -------------------------------------------------------
// KEYBOARD SHORTCUTS
// -------------------------------------------------------
function handleKeydown(e) {
  const key = e.key;
  const optionBtns = document.querySelectorAll(".option-btn");

  if (!state.answered) {
    // 1-4 or A-D to select answer
    const map = { "1": 0, "2": 1, "3": 2, "4": 3, "a": 0, "b": 1, "c": 2, "d": 3 };
    const idx = map[key.toLowerCase()];
    if (idx !== undefined && optionBtns[idx]) {
      optionBtns[idx].click();
    }
  } else {
    // Space or ArrowRight to go next
    if (key === " " || key === "ArrowRight") {
      e.preventDefault();
      if (els.btnNext && !els.btnNext.disabled) els.btnNext.click();
    }
  }
}

// -------------------------------------------------------
// CHATBOT
// -------------------------------------------------------
function toggleChatbot() {
  if (!els.chatbotPanel) return;
  els.chatbotPanel.classList.toggle("hidden");
  if (!els.chatbotPanel.classList.contains("hidden") && els.chatInput) {
    els.chatInput.focus();
    // Initial greeting if empty
    if (els.chatMessages && els.chatMessages.children.length === 0) {
      appendChatMsg("ai", "Xin chào! Tôi là trợ lý CNXHKH. Bạn cần giải thích gì về bài học?");
    }
  }
}

function appendChatMsg(role, text) {
  if (!els.chatMessages) return;
  const div = document.createElement("div");
  div.className = `chat-msg chat-msg--${role}`;
  div.textContent = text;
  els.chatMessages.appendChild(div);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

async function handleChatSend() {
  const msg = els.chatInput?.value?.trim();
  if (!msg || !els.chatSend) return;

  els.chatInput.value = "";
  appendChatMsg("user", msg);
  els.chatSend.disabled = true;

  // Add loading indicator
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "chat-msg chat-msg--ai ai-loading";
  loadingDiv.innerHTML = '<span class="spinner"></span> Đang nghĩ...';
  els.chatMessages.appendChild(loadingDiv);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

  try {
    const reply = await sendChatMessage(msg, state.chatHistory);
    els.chatMessages.removeChild(loadingDiv);
    appendChatMsg("ai", reply);
    state.chatHistory.push({ role: "user", text: msg });
    state.chatHistory.push({ role: "ai", text: reply });
    // Keep history limited to last 10 exchanges
    if (state.chatHistory.length > 20) {
      state.chatHistory = state.chatHistory.slice(-20);
    }
  } catch (err) {
    els.chatMessages.removeChild(loadingDiv);
    appendChatMsg("ai", "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.");
  }
  els.chatSend.disabled = false;
  if (els.chatInput) els.chatInput.focus();
}

// -------------------------------------------------------
// START
// -------------------------------------------------------
init();
