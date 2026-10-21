/**
 * data.js - Load and manage question data
 * Handles loading questions.json and providing filtered/shuffled subsets
 */

let _allQuestions = null;

/**
 * Load questions from questions.json.
 * Caches the result after first load.
 * @returns {Promise<Array>} - Array of question objects
 */
export async function loadQuestions() {
  if (_allQuestions) return _allQuestions;
  try {
    const res = await fetch("questions.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _allQuestions = await res.json();
    return _allQuestions;
  } catch (e) {
    console.error("Failed to load questions.json:", e);
    return [];
  }
}

/**
 * Get questions filtered by chapter number.
 * @param {number} chapter - Chapter number (1-7)
 * @returns {Promise<Array>}
 */
export async function getQuestionsByChapter(chapter) {
  const all = await loadQuestions();
  return all.filter(q => q.chapter === chapter);
}

/**
 * Get N random questions from the full pool.
 * @param {number} n - Number of questions
 * @returns {Promise<Array>}
 */
export async function getRandomQuestions(n = 40) {
  const all = await loadQuestions();
  const shuffled = fisherYates([...all]);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/**
 * Get questions from mistake bank (Tử địa).
 * @param {Object} mistakeBank - {questionId: {wrongCount, correctStreak}}
 * @returns {Promise<Array>}
 */
export async function getMistakeBankQuestions(mistakeBank) {
  const all = await loadQuestions();
  const ids = Object.keys(mistakeBank).map(Number);
  return all.filter(q => ids.includes(q.id));
}

/**
 * Get all questions in order (for survival mode).
 * @returns {Promise<Array>}
 */
export async function getAllQuestionsOrdered() {
  const all = await loadQuestions();
  return [...all].sort((a, b) => a.id - b.id);
}

/**
 * Get list of unique chapters with counts.
 * @returns {Promise<Array>} - [{chapter, chapter_name, count}]
 */
export async function getChapterList() {
  const all = await loadQuestions();
  const map = {};
  for (const q of all) {
    if (!map[q.chapter]) {
      map[q.chapter] = { chapter: q.chapter, chapter_name: q.chapter_name, count: 0 };
    }
    map[q.chapter].count++;
  }
  return Object.values(map).sort((a, b) => a.chapter - b.chapter);
}

/**
 * Fisher-Yates shuffle algorithm.
 * @param {Array} arr - Array to shuffle (in-place)
 * @returns {Array} - Same array, shuffled
 */
export function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Shuffle the answer options of a question, tracking the new correct index.
 * Returns a new question object with shuffled options and updated correct index.
 * @param {Object} question - Question object
 * @returns {Object} - New question with shuffled options
 */
export function shuffleOptions(question) {
  const indices = [0, 1, 2, 3];
  fisherYates(indices);
  const newOptions = indices.map(i => question.options[i]);
  const newCorrect = indices.indexOf(question.correct);
  return { ...question, options: newOptions, correct: newCorrect, _originalOrder: indices };
}

/**
 * Get keyword list for highlighting.
 * Uses question's keywords array if available, otherwise uses default list.
 */
export const DEFAULT_KEYWORDS = [
  "quyết định nhất", "điều kiện cần", "điều kiện đủ", "cơ sở",
  "bản chất", "đặc trưng", "phương hướng", "sứ mệnh lịch sử",
  "tất yếu", "tiên phong", "nòng cốt", "chủ yếu", "trực tiếp",
  "giai cấp công nhân", "chủ nghĩa xã hội", "cộng sản chủ nghĩa",
  "dân chủ", "nhà nước", "liên minh", "đoàn kết", "vô sản"
];

/**
 * Highlight keywords in a given text string.
 * @param {string} text - Text to process
 * @param {string[]} keywords - Keywords to highlight
 * @returns {string} - HTML string with highlights
 */
export function highlightKeywords(text, keywords) {
  if (!keywords || keywords.length === 0) keywords = DEFAULT_KEYWORDS;
  let result = text;
  // Sort by length descending to avoid partial replacements
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    result = result.replace(re, '<mark class="keyword-highlight">$1</mark>');
  }
  return result;
}
