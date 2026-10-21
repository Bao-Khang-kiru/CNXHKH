/**
 * firebase.js - Firebase configuration and helper functions
 * Enhanced with graceful local fallback for offline/GitHub Pages without Firebase setup.
 */

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "PLACEHOLDER_FIREBASE_API_KEY",
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
  console.warn("Firebase init failed – running in local offline mode:", e.message);
}

// -------------------------------------------------------
// AUTH HELPERS
// -------------------------------------------------------

/**
 * Sign in with Google popup.
 * Throws specific error codes for caller to display friendly messages.
 */
export async function signInWithGoogle() {
  if (!firebaseReady) {
    const err = new Error("Chưa kết nối Firebase");
    err.code = "firebase/not-ready";
    throw err;
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (e) {
    console.error("Google sign-in error:", e);
    throw e;
  }
}

/** Sign out current user from Firebase. */
export async function signOutFirebase() {
  if (!firebaseReady || !auth) return;
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Firebase sign out error:", e);
  }
}

/** Listen to auth state changes in Firebase. */
export function onFirebaseAuthStateChanged(callback) {
  if (!firebaseReady || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

/** Get Firebase user if logged in. */
export function getFirebaseUser() {
  if (!firebaseReady || !auth) return null;
  return auth.currentUser;
}

// -------------------------------------------------------
// LOCAL LEADERBOARD FALLBACK
// -------------------------------------------------------
const LOCAL_LB_KEY = "cnxhkh_local_leaderboard";

function getLocalLeaderboard(mode) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_LB_KEY) || "{}");
    return all[mode] || [];
  } catch {
    return [];
  }
}

function saveLocalLeaderboard(mode, entry) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_LB_KEY) || "{}");
    const list = all[mode] || [];
    list.push(entry);
    if (mode === "exam") {
      list.sort((a, b) => (b.score - a.score) || ((a.timeTaken || 0) - (b.timeTaken || 0)));
    } else {
      list.sort((a, b) => ((b.streak || b.score || 0) - (a.streak || a.score || 0)) || ((a.timeTaken || 0) - (b.timeTaken || 0)));
    }
    all[mode] = list.slice(0, 50); // Keep top 50
    localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Failed to save local leaderboard:", e);
  }
}

// -------------------------------------------------------
// FIRESTORE HELPERS
// -------------------------------------------------------

/**
 * Get or create user profile document.
 * Path: users/{uid}
 */
export async function getUserProfile(uid) {
  // If local user or Firebase offline, load from localStorage
  if (!firebaseReady || !uid || uid.startsWith("local_")) {
    try {
      const stats = JSON.parse(localStorage.getItem("cnxhkh_user_stats") || "{}");
      return {
        totalAnswered: stats.totalAnswered || 0,
        totalCorrect: stats.totalCorrect || 0,
        chapterStats: stats.chapterStats || {},
        streakDays: stats.streakDays || 1
      };
    } catch {
      return null;
    }
  }

  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    
    // Create default profile
    const defaults = {
      totalAnswered: 0,
      totalCorrect: 0,
      streakDays: 1,
      lastStudyDate: null,
      chapterStats: {},
      createdAt: serverTimestamp()
    };
    await setDoc(ref, defaults);
    return defaults;
  } catch (e) {
    console.warn("getUserProfile error, fallback to local:", e);
    const stats = JSON.parse(localStorage.getItem("cnxhkh_user_stats") || "{}");
    return {
      totalAnswered: stats.totalAnswered || 0,
      totalCorrect: stats.totalCorrect || 0,
      chapterStats: stats.chapterStats || {},
      streakDays: stats.streakDays || 1
    };
  }
}

/** Update user profile fields. */
export async function updateUserProfile(uid, data) {
  if (!firebaseReady || !uid || uid.startsWith("local_")) return;
  try {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, data);
  } catch (e) {
    console.warn("updateUserProfile error:", e);
  }
}

/** Record a quiz result. Path: results/{uid}/sessions/{auto-id} */
export async function saveQuizResult(uid, result) {
  if (!firebaseReady || !uid || uid.startsWith("local_")) return null;
  try {
    const ref = collection(db, "results", uid, "sessions");
    const docRef = await addDoc(ref, {
      ...result,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.warn("saveQuizResult error:", e);
    return null;
  }
}

/**
 * Submit score to leaderboard.
 * Saves locally first, then attempts Firebase if available.
 */
export async function submitLeaderboardScore(mode, entry) {
  // Always save locally
  saveLocalLeaderboard(mode, entry);

  if (!firebaseReady) return "local_saved";

  try {
    const ref = collection(db, "leaderboard", mode, "scores");
    const docRef = await addDoc(ref, {
      ...entry,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.warn("Firebase submitLeaderboardScore error (saved locally):", e);
    return "local_saved";
  }
}

/**
 * Fetch leaderboard entries.
 * Tries Firebase first; falls back to local records.
 */
export async function getLeaderboard(mode, topN = 20) {
  const localEntries = getLocalLeaderboard(mode);

  if (!firebaseReady) {
    return localEntries.slice(0, topN);
  }

  try {
    const sortField = mode === "exam" ? "score" : "streak";
    const ref = collection(db, "leaderboard", mode, "scores");
    const q = query(ref, orderBy(sortField, "desc"), limit(topN));
    const snap = await getDocs(q);
    const remote = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (remote.length > 0) return remote;
    return localEntries.slice(0, topN);
  } catch (e) {
    console.warn("getLeaderboard Firebase failed, returning local entries:", e);
    return localEntries.slice(0, topN);
  }
}

// Backward compatible aliases
export const getCurrentUser = getFirebaseUser;
export const onAuthChange = onFirebaseAuthStateChanged;
export const signOutUser = signOutFirebase;

export { auth, db, firebaseReady };
