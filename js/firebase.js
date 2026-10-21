/**
 * firebase.js - Firebase configuration and helper functions
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing one)
 * 3. Enable Authentication > Sign-in method > Google
 * 4. Enable Firestore Database
 * 5. Replace the config values below with your project's values
 * 6. In Firestore Rules, allow authenticated users to read/write their own data
 */

// --- Firebase Config (replace with your actual values) ---
const firebaseConfig = {
  apiKey: "AIzaSyC3GG1qng2rcwjQVpzWxZExQtogOgNkel0",
  authDomain: "cnxhkh-quiz.firebaseapp.com",
  projectId: "cnxhkh-quiz",
  storageBucket: "cnxhkh-quiz.firebasestorage.app",
  messagingSenderId: "888437870864",
  appId: "1:888437870864:web:4cc323413ecc427b289595",
  measurementId: "G-W99W7N8H4W"
};

// Firebase SDK imports (loaded as ES modules from CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Initialize Firebase app
let app, auth, db;
let firebaseReady = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  firebaseReady = true;
} catch (e) {
  console.warn("Firebase init failed – running in offline mode:", e.message);
}

// -------------------------------------------------------
// AUTH HELPERS
// -------------------------------------------------------

/** Sign in with Google popup. Returns user or null. */
export async function signInWithGoogle() {
  if (!firebaseReady) return null;
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (e) {
    console.error("Google sign-in error:", e);
    return null;
  }
}

/** Sign out current user. */
export async function signOutUser() {
  if (!firebaseReady) return;
  await signOut(auth);
}

/** Listen to auth state changes. Callback receives user or null. */
export function onAuthChange(callback) {
  if (!firebaseReady) { callback(null); return; }
  onAuthStateChanged(auth, callback);
}

/** Get current signed-in user (synchronous snapshot). */
export function getCurrentUser() {
  if (!firebaseReady) return null;
  return auth.currentUser;
}

// -------------------------------------------------------
// FIRESTORE HELPERS
// -------------------------------------------------------

/**
 * Get or create user profile document.
 * Path: users/{uid}
 */
export async function getUserProfile(uid) {
  if (!firebaseReady) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  // Create default profile
  const defaults = {
    totalAnswered: 0,
    totalCorrect: 0,
    streakDays: 0,
    lastStudyDate: null,
    mistakeBank: {},
    chapterStats: {},
    createdAt: serverTimestamp()
  };
  await setDoc(ref, defaults);
  return defaults;
}

/** Update user profile fields. */
export async function updateUserProfile(uid, data) {
  if (!firebaseReady) return;
  const ref = doc(db, "users", uid);
  await updateDoc(ref, data);
}

/** Record a quiz result. Path: results/{uid}/sessions/{auto-id} */
export async function saveQuizResult(uid, result) {
  if (!firebaseReady) return null;
  const ref = collection(db, "results", uid, "sessions");
  const docRef = await addDoc(ref, {
    ...result,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Submit score to leaderboard.
 * Path: leaderboard/{mode}/{auto-id}
 * mode: "exam" | "survival"
 */
export async function submitLeaderboardScore(mode, entry) {
  if (!firebaseReady) return null;
  const ref = collection(db, "leaderboard", mode, "scores");
  const docRef = await addDoc(ref, {
    ...entry,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Fetch leaderboard entries.
 * @param {string} mode - "exam" or "survival"
 * @param {number} topN - how many entries to fetch
 */
export async function getLeaderboard(mode, topN = 20) {
  if (!firebaseReady) return [];
  const sortField = mode === "exam" ? "score" : "streak";
  const ref = collection(db, "leaderboard", mode, "scores");
  const q = query(ref, orderBy(sortField, "desc"), limit(topN));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Sync mistake bank from Firebase.
 * Path: users/{uid}.mistakeBank
 */
export async function getMistakeBank(uid) {
  if (!firebaseReady) return null;
  const profile = await getUserProfile(uid);
  return profile?.mistakeBank || {};
}

/** Save entire mistake bank object to Firestore. */
export async function saveMistakeBank(uid, mistakeBank) {
  if (!firebaseReady) return;
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { mistakeBank });
}

/** Increment stats after a session. */
export async function incrementStats(uid, answered, correct, chapterId) {
  if (!firebaseReady) return;
  const ref = doc(db, "users", uid);
  const updateData = {
    totalAnswered: increment(answered),
    totalCorrect: increment(correct)
  };
  if (chapterId) {
    updateData[`chapterStats.ch${chapterId}.answered`] = increment(answered);
    updateData[`chapterStats.ch${chapterId}.correct`] = increment(correct);
  }
  await updateDoc(ref, updateData);
}

export { auth, db, firebaseReady };
