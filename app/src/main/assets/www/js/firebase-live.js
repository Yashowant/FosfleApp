// Live Fosfle Firebase backend (Authentication + Cloud Firestore)
// Uses the official fosfle Firebase project configuration from the website.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-6quaikt4JwOVNjC_w63GviAuoE1AzII",
  authDomain: "fosfle.firebaseapp.com",
  projectId: "fosfle",
  storageBucket: "fosfle.firebasestorage.app",
  messagingSenderId: "258985436515",
  appId: "1:258985436515:web:f41c2d7e7253a63bf2df56"
};

const CACHE_ARTICLES_KEY = "fosfle_cached_articles_v2";

let sdkPromise = null;

async function loadFirebase() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = (async () => {
    const [appMod, authMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")
    ]);
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    return { app, auth, db, authMod, fsMod };
  })();
  return sdkPromise;
}

export async function subscribeAuth(callback) {
  try {
    const { auth, authMod } = await loadFirebase();
    return authMod.onAuthStateChanged(auth, (user) => callback(user, null));
  } catch (err) {
    console.warn("Firebase Auth offline or unavailable:", err);
    callback(null, err);
    return () => {};
  }
}

export async function loginWithEmail(email, password) {
  const { auth, authMod } = await loadFirebase();
  const cred = await authMod.signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function registerWithEmail(name, email, password) {
  const { auth, authMod } = await loadFirebase();
  const cred = await authMod.createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name && name.trim()) {
    await authMod.updateProfile(cred.user, { displayName: name.trim() });
  }
  return cred.user;
}

export async function sendPasswordReset(email) {
  const { auth, authMod } = await loadFirebase();
  await authMod.sendPasswordResetEmail(auth, email.trim());
}

export async function updateDisplayName(name) {
  const { auth, authMod } = await loadFirebase();
  if (!auth.currentUser) throw new Error("Not signed in");
  await authMod.updateProfile(auth.currentUser, { displayName: name.trim() });
  return auth.currentUser;
}

export async function logoutUser() {
  const { auth, authMod } = await loadFirebase();
  await authMod.signOut(auth);
}

export function getCachedArticles() {
  try {
    const raw = localStorage.getItem(CACHE_ARTICLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchLiveArticles() {
  try {
    const { db, fsMod } = await loadFirebase();
    const q = fsMod.query(
      fsMod.collection(db, "articles"),
      fsMod.where("status", "==", "published"),
      fsMod.orderBy("publishedAt", "desc"),
      fsMod.limit(40)
    );
    const snap = await fsMod.getDocs(q);
    const list = snap.docs.map((d) => {
      const data = d.data();
      let pubMs = Date.now();
      if (data.publishedAt?.toDate) pubMs = data.publishedAt.toDate().getTime();
      else if (data.publishedAt) pubMs = new Date(data.publishedAt).getTime() || Date.now();
      return {
        id: d.id,
        slug: data.slug || d.id,
        title: data.title || "Untitled Article",
        excerpt: data.excerpt || "",
        category: data.category || "Learning",
        author: data.author || "Yashowant Meher",
        coverImage: normalizeCoverUrl(data.coverImage),
        content: data.content || "",
        featured: Boolean(data.featured),
        tags: Array.isArray(data.tags) ? data.tags : [],
        publishedMs: pubMs
      };
    });
    try {
      localStorage.setItem(CACHE_ARTICLES_KEY, JSON.stringify(list));
    } catch {}
    return { articles: list, source: "live" };
  } catch (err) {
    console.warn("Firestore blog fetch failed, checking cache:", err);
    const cached = getCachedArticles();
    return { articles: cached, source: cached.length ? "cache" : "error", error: err };
  }
}

function normalizeCoverUrl(url) {
  if (!url) return "img/download.webp";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/img/")) return url.slice(1);
  return url;
}

export function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Incorrect email or password. Please check your details and try again.";
  }
  if (code.includes("email-already-in-use")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (code.includes("weak-password")) {
    return "Please choose a stronger password (at least 6 characters).";
  }
  if (code.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (code.includes("network-request-failed")) {
    return "You appear to be offline. Connect to the internet to sign in.";
  }
  return err?.message || "Authentication failed. Please try again.";
}
