import { HTML_MODULES, ALL_LESSONS, UPCOMING_TRACKS, PLAYGROUND_STARTERS } from "./course-data.js";
import {
  subscribeAuth,
  loginWithEmail,
  registerWithEmail,
  sendPasswordReset,
  logoutUser,
  fetchLiveArticles,
  getCachedArticles,
  friendlyAuthError
} from "./firebase-live.js";

const STORAGE_PROGRESS = "fosfle_progress_v2";
const STORAGE_THEME = "fosfle_theme_v2";

// Native Android bridge helper
const Native = {
  haptic(type = "tap") {
    try { window.FosfleNative?.haptic(type); } catch {}
  },
  share(title, text, url) {
    if (window.FosfleNative?.shareContent) {
      window.FosfleNative.shareContent(title, text, url);
    } else if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url || text).then(() => showToast("Link copied to clipboard"));
    }
  },
  setBars(isDark) {
    try { window.FosfleNative?.setSystemBarTheme(Boolean(isDark)); } catch {}
  }
};

// Persistent progress state
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      completedQuizzes: Array.isArray(parsed.completedQuizzes) ? parsed.completedQuizzes : [],
      completedChallenges: Array.isArray(parsed.completedChallenges) ? parsed.completedChallenges : [],
      lastLessonId: parsed.lastLessonId || "intro_html",
      streakDays: parsed.streakDays || 1,
      lastVisitDate: parsed.lastVisitDate || new Date().toISOString().slice(0, 10)
    };
  } catch {
    return {
      completedLessons: [],
      completedQuizzes: [],
      completedChallenges: [],
      lastLessonId: "intro_html",
      streakDays: 1,
      lastVisitDate: new Date().toISOString().slice(0, 10)
    };
  }
}

let progress = loadProgress();
function saveProgress() {
  const today = new Date().toISOString().slice(0, 10);
  if (progress.lastVisitDate !== today) {
    progress.streakDays = (progress.streakDays || 1) + 1;
    progress.lastVisitDate = today;
  }
  try { localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(progress)); } catch {}
  renderProgressUI();
}

// App state
let activeTab = "courses";
let practiceFilter = "all";
let courseSearch = "";
let blogArticles = [];
let blogLoaded = false;
let blogCategory = "all";
let blogSearch = "";
let authMode = "login"; // 'login' | 'register'
let currentUser = null;
let currentLessonObj = null;
let currentLessonMode = "lesson"; // 'lesson' | 'quiz' | 'challenge'
let currentArticleObj = null;
let articleFontPx = 15.5;

// Utility
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ==================== WEB SPLASH SEQUENCE ====================
function initSplash() {
  const splash = document.getElementById("webSplash");
  if (!splash) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("nativeSplash") === "1") {
    splash.remove();
    return;
  }
  const bar = document.getElementById("splashBar");
  const pctEl = document.getElementById("splashPct");
  const statusEl = document.getElementById("splashStatus");
  let pct = 0;
  const timer = setInterval(() => {
    pct = Math.min(100, pct + 7);
    if (bar) bar.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (statusEl) {
      if (pct < 35) statusEl.textContent = "BOOTING COURSE ENGINE";
      else if (pct < 70) statusEl.textContent = "LOADING 19 HTML5 MODULES";
      else if (pct < 95) statusEl.textContent = "SYNCING FOSFLE CLOUD";
      else statusEl.textContent = "READY TO LEARN";
    }
    if (pct >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        splash.classList.add("hidden");
        setTimeout(() => splash.remove(), 450);
      }, 180);
    }
  }, 55);
}

// ==================== THEME ====================
function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  localStorage.setItem(STORAGE_THEME, isDark ? "dark" : "light");
  Native.setBars(isDark);
  const btn = document.getElementById("settingsThemeBtn");
  if (btn) btn.textContent = isDark ? "Dark" : "Light";
  const icon = document.getElementById("themeIcon");
  if (icon) {
    icon.innerHTML = isDark
      ? '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
  // Sync theme to open lesson iframe
  const iframe = document.getElementById("lessonIframe");
  try {
    iframe?.contentWindow?.postMessage({ type: "fosfle-theme", theme: isDark ? "dark" : "light" }, "*");
  } catch {}
}

function toggleTheme() {
  Native.haptic("tap");
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(cur === "dark" ? "light" : "dark");
}

// ==================== NETWORK STATUS ====================
function updateNetworkUI(online) {
  const dot = document.getElementById("netDot");
  const label = document.getElementById("netLabel");
  if (dot) dot.classList.toggle("offline", !online);
  if (label) label.textContent = online ? "Online" : "Offline Mode";
}
window.onFosfleNetworkChange = (online) => updateNetworkUI(Boolean(online));
window.addEventListener("online", () => updateNetworkUI(true));
window.addEventListener("offline", () => updateNetworkUI(false));

// ==================== TABS ====================
function switchTab(tabId) {
  activeTab = tabId;
  Native.haptic("tap");
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabId}`));
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  window.scrollTo({ top: 0, behavior: "instant" });
  if (tabId === "blog" && !blogLoaded) {
    loadBlogFeed();
  }
}

// ==================== COURSES RENDER ====================
function renderProgressUI() {
  const doneCount = progress.completedLessons.length;
  const total = ALL_LESSONS.length;
  const pct = Math.round((doneCount / total) * 100);
  const circumference = 163.36;
  const offset = circumference - (circumference * pct) / 100;

  const ring = document.getElementById("heroRingFg");
  if (ring) ring.style.strokeDashoffset = String(offset);
  const pctLabel = document.getElementById("heroPctLabel");
  if (pctLabel) pctLabel.textContent = `${pct}%`;

  const elDone = document.getElementById("heroCompletedCount");
  if (elDone) elDone.textContent = String(doneCount);
  const elQuiz = document.getElementById("heroQuizCount");
  if (elQuiz) elQuiz.textContent = String(progress.completedQuizzes.length);
  const elStreak = document.getElementById("heroStreakCount");
  if (elStreak) elStreak.textContent = String(progress.streakDays || 1);

  const statL = document.getElementById("statLessons");
  const statQ = document.getElementById("statQuizzes");
  const statC = document.getElementById("statChallenges");
  if (statL) statL.textContent = `${doneCount}/${total}`;
  if (statQ) statQ.textContent = `${progress.completedQuizzes.length}/18`;
  if (statC) statC.textContent = `${progress.completedChallenges.length}/18`;

  const nextLesson = ALL_LESSONS.find((l) => l.id === progress.lastLessonId) || ALL_LESSONS[0];
  const btn = document.getElementById("continueCourseBtn");
  if (btn && nextLesson) {
    const verb = doneCount > 0 ? "Continue" : "Start";
    btn.querySelector("span").textContent = `${verb} ${nextLesson.num}: ${nextLesson.title.replace(/^HTML\s+/i, "")}`;
  }

  renderModules();
  renderPracticeList();
}

function renderModules() {
  const container = document.getElementById("modulesContainer");
  if (!container) return;
  const q = courseSearch.trim().toLowerCase();

  let visibleLessonsCount = 0;
  const html = HTML_MODULES.map((mod) => {
    const filtered = q
      ? mod.lessons.filter((l) => l.title.toLowerCase().includes(q) || mod.title.toLowerCase().includes(q))
      : mod.lessons;
    if (filtered.length === 0) return "";
    visibleLessonsCount += filtered.length;

    const doneInMod = mod.lessons.filter((l) => progress.completedLessons.includes(l.id)).length;
    const allDone = doneInMod === mod.lessons.length;

    const rows = filtered.map((lesson) => {
      const isDone = progress.completedLessons.includes(lesson.id);
      const quizDone = progress.completedQuizzes.includes(lesson.id);
      const chalDone = progress.completedChallenges.includes(lesson.id);
      return `
        <div class="lesson-row">
          <div class="lesson-main" data-open-lesson="${lesson.id}" data-mode="lesson">
            <div class="lesson-num ${isDone ? "done" : ""}">${isDone ? "✓" : lesson.num}</div>
            <div class="lesson-info">
              <div class="lesson-title">${esc(lesson.title)}</div>
              <div class="lesson-mins">${lesson.mins} min read${isDone ? " · Completed" : ""}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--ink-muted);flex-shrink:0;"><path d="m9 18 6-6-6-6"/></svg>
          </div>
          <div class="lesson-pills">
            <button class="chip-btn chip-read" data-open-lesson="${lesson.id}" data-mode="lesson">Read Lesson</button>
            ${lesson.ex ? `<button class="chip-btn chip-quiz" data-open-lesson="${lesson.id}" data-mode="quiz">${quizDone ? "✓ " : ""}Quiz</button>` : ""}
            ${lesson.ch ? `<button class="chip-btn chip-chal" data-open-lesson="${lesson.id}" data-mode="challenge">${chalDone ? "✓ " : ""}Challenge</button>` : `<button class="chip-btn chip-code" data-open-playground="2">Try in Lab</button>`}
          </div>
        </div>
      `;
    }).join("");

    return `
      <article class="module-card">
        <button class="module-header" type="button">
          <div>
            <div class="module-tag">${esc(mod.label)}</div>
            <h3 class="module-title">${esc(mod.title)}</h3>
            <p class="module-sub">${esc(mod.subtitle)}</p>
          </div>
          <div class="module-meta">
            <span class="module-count ${allDone ? "done" : ""}">${doneInMod}/${mod.lessons.length}</span>
            <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </button>
        <div class="lesson-list">${rows}</div>
      </article>
    `;
  }).join("");

  container.innerHTML = html || `<div class="empty-state"><strong>No lessons match “${esc(courseSearch)}”</strong><p style="margin:6px 0 0;font-size:13px;">Try searching for tags, colors, links, images, or tables.</p></div>`;
  const meta = document.getElementById("curriculumMeta");
  if (meta) meta.textContent = q ? `${visibleLessonsCount} matching lessons` : `4 Modules · 19 Lessons`;

  container.querySelectorAll(".module-header").forEach((hdr) => {
    hdr.addEventListener("click", () => {
      Native.haptic("tap");
      hdr.closest(".module-card").classList.toggle("collapsed");
    });
  });

  container.querySelectorAll("[data-open-lesson]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openLessonViewer(el.dataset.openLesson, el.dataset.mode || "lesson");
    });
  });

  container.querySelectorAll("[data-open-playground]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openPlayground(Number(el.dataset.openPlayground) || 0);
    });
  });
}

function renderUpcoming() {
  const container = document.getElementById("upcomingContainer");
  if (!container) return;
  container.innerHTML = UPCOMING_TRACKS.map((t) => `
    <article class="upcoming-card">
      <img src="${esc(t.image)}" alt="${esc(t.title)}" loading="lazy" />
      <div class="upcoming-body">
        <span class="upcoming-badge">${esc(t.tag)}</span>
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.desc)}</p>
      </div>
    </article>
  `).join("");
}

// ==================== PRACTICE HUB ====================
function renderPracticeList() {
  const listEl = document.getElementById("practiceList");
  if (!listEl) return;

  const items = [];
  ALL_LESSONS.forEach((l) => {
    if (l.ex) {
      items.push({
        lessonId: l.id,
        num: l.num,
        kind: "quiz",
        title: `${l.title} — Timed Quiz`,
        sub: "20s per question · Instant scoring",
        done: progress.completedQuizzes.includes(l.id)
      });
    }
    if (l.ch) {
      items.push({
        lessonId: l.id,
        num: l.num,
        kind: "challenge",
        title: `${l.title} — Code Challenge`,
        sub: "Interactive terminal HTML coding mission",
        done: progress.completedChallenges.includes(l.id)
      });
    }
  });

  const filtered = items.filter((it) => {
    if (practiceFilter === "quiz") return it.kind === "quiz";
    if (practiceFilter === "challenge") return it.kind === "challenge";
    if (practiceFilter === "done") return it.done;
    return true;
  });

  const label = document.getElementById("practiceCountLabel");
  if (label) label.textContent = `${filtered.length} Drills`;

  listEl.innerHTML = filtered.length
    ? filtered.map((it) => `
        <div class="practice-item" data-lesson="${it.lessonId}" data-mode="${it.kind}">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
              <span class="practice-badge ${it.kind === "quiz" ? "quiz" : "chal"}">${it.kind === "quiz" ? "Quiz" : "Challenge"}</span>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--ink-muted);">CH ${it.num}</span>
              ${it.done ? '<span style="font-size:11px;font-weight:700;color:var(--emerald);">✓ Done</span>' : ""}
            </div>
            <div style="font-weight:700;font-size:14.5px;line-height:1.3;">${esc(it.title)}</div>
            <div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">${esc(it.sub)}</div>
          </div>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="color:var(--ink-muted);flex-shrink:0;"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      `).join("")
    : `<div class="empty-state"><strong>No completed drills yet</strong><p style="margin:6px 0 0;font-size:13px;">Jump into any quiz or coding challenge to track your progress here.</p></div>`;

  listEl.querySelectorAll(".practice-item").forEach((el) => {
    el.addEventListener("click", () => openLessonViewer(el.dataset.lesson, el.dataset.mode));
  });
}

// ==================== LESSON / QUIZ / CHALLENGE OVERLAY ====================
function openLessonViewer(lessonId, mode = "lesson") {
  const lesson = ALL_LESSONS.find((l) => l.id === lessonId);
  if (!lesson) return;

  Native.haptic("tap");
  currentLessonObj = lesson;
  progress.lastLessonId = lesson.id;
  saveProgress();

  const sheet = document.getElementById("lessonSheet");
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");

  loadLessonMode(mode);
}

function loadLessonMode(mode) {
  if (!currentLessonObj) return;
  let targetUrl = currentLessonObj.file;
  if (mode === "quiz" && currentLessonObj.ex) targetUrl = currentLessonObj.ex;
  else if (mode === "challenge" && currentLessonObj.ch) targetUrl = currentLessonObj.ch;
  else mode = "lesson";

  currentLessonMode = mode;

  document.getElementById("lessonSheetTitle").textContent = `${currentLessonObj.num}. ${currentLessonObj.title}`;
  document.getElementById("lessonSheetSub").textContent =
    mode === "quiz" ? "Timed Exercise" : mode === "challenge" ? "Coding Challenge" : currentLessonObj.moduleTitle;

  const bLesson = document.getElementById("modeLessonBtn");
  const bQuiz = document.getElementById("modeQuizBtn");
  const bChal = document.getElementById("modeChalBtn");
  bLesson.classList.toggle("active", mode === "lesson");
  bQuiz.classList.toggle("active", mode === "quiz");
  bChal.classList.toggle("active", mode === "challenge");
  bQuiz.style.display = currentLessonObj.ex ? "inline-flex" : "none";
  bChal.style.display = currentLessonObj.ch ? "inline-flex" : "none";

  updateMarkDoneButton();

  const iframe = document.getElementById("lessonIframe");
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  iframe.src = `${targetUrl}?theme=${theme}&lessonId=${encodeURIComponent(currentLessonObj.id)}&mode=${mode}`;
}

function updateMarkDoneButton() {
  if (!currentLessonObj) return;
  const btn = document.getElementById("markCompleteBtn");
  const list = currentLessonMode === "quiz"
    ? progress.completedQuizzes
    : currentLessonMode === "challenge"
      ? progress.completedChallenges
      : progress.completedLessons;
  const isDone = list.includes(currentLessonObj.id);
  btn.textContent = isDone ? "✓ Completed" : "Mark Done";
  btn.style.background = isDone ? "var(--emerald)" : "var(--emerald-soft)";
  btn.style.color = isDone ? "#FFFFFF" : "var(--emerald)";
}

function toggleCurrentComplete() {
  if (!currentLessonObj) return;
  const key = currentLessonMode === "quiz"
    ? "completedQuizzes"
    : currentLessonMode === "challenge"
      ? "completedChallenges"
      : "completedLessons";
  const arr = progress[key];
  const idx = arr.indexOf(currentLessonObj.id);
  if (idx >= 0) {
    arr.splice(idx, 1);
    Native.haptic("tap");
    showToast("Marked as incomplete");
  } else {
    arr.push(currentLessonObj.id);
    Native.haptic("success");
    showToast("Great work! Progress saved.");
  }
  saveProgress();
  updateMarkDoneButton();
}

function closeLessonViewer() {
  const sheet = document.getElementById("lessonSheet");
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden", "true");
  document.getElementById("lessonIframe").src = "about:blank";
}

function goNextLesson() {
  if (!currentLessonObj) return;
  const idx = ALL_LESSONS.findIndex((l) => l.id === currentLessonObj.id);
  if (idx >= 0 && idx < ALL_LESSONS.length - 1) {
    openLessonViewer(ALL_LESSONS[idx + 1].id, "lesson");
  } else {
    showToast("You've reached the final HTML5 lesson!");
  }
}

// Listen for postMessage events from inside lesson/quiz/challenge iframes
window.addEventListener("message", (ev) => {
  const data = ev.data || {};
  if (data.type === "fosfle-close-lesson") {
    closeLessonViewer();
  } else if (data.type === "fosfle-complete" && data.lessonId) {
    const key = data.mode === "quiz" ? "completedQuizzes" : data.mode === "challenge" ? "completedChallenges" : "completedLessons";
    if (!progress[key].includes(data.lessonId)) {
      progress[key].push(data.lessonId);
      saveProgress();
      updateMarkDoneButton();
      Native.haptic("success");
    }
  }
});

// ==================== LIVE FIRESTORE BLOG ====================
function formatDate(ms) {
  try {
    return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function estimateReadMins(html) {
  const words = String(html || "").replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function loadBlogFeed() {
  const feed = document.getElementById("blogFeed");
  if (!feed) return;
  feed.innerHTML = `<div class="empty-state"><strong>Loading live articles from Fosfle Cloud...</strong><p style="margin:6px 0 0;font-size:13px;">Connecting to Firestore</p></div>`;

  const res = await fetchLiveArticles();
  blogLoaded = true;
  blogArticles = res.articles || [];
  if (res.source === "cache") {
    showToast("Showing cached articles (Offline)");
  }
  renderBlogCategories();
  renderBlogFeed(res.source === "error");
}

function renderBlogCategories() {
  const row = document.getElementById("blogCategoryRow");
  if (!row) return;
  const cats = [...new Set(blogArticles.map((a) => a.category).filter(Boolean))].sort();
  row.innerHTML = `<button class="filter-pill ${blogCategory === "all" ? "active" : ""}" data-cat="all">All</button>` +
    cats.map((c) => `<button class="filter-pill ${blogCategory === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  row.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      Native.haptic("tap");
      blogCategory = b.dataset.cat;
      renderBlogCategories();
      renderBlogFeed(false);
    });
  });
}

function renderBlogFeed(hadError) {
  const feed = document.getElementById("blogFeed");
  if (!feed) return;
  const q = blogSearch.trim().toLowerCase();
  const list = blogArticles.filter((a) => {
    const catOk = blogCategory === "all" || (a.category || "").toLowerCase() === blogCategory.toLowerCase();
    const searchOk = !q || [a.title, a.excerpt, a.category, ...(a.tags || [])].join(" ").toLowerCase().includes(q);
    return catOk && searchOk;
  });

  if (!list.length) {
    feed.innerHTML = hadError
      ? `<div class="empty-state"><strong>Unable to reach Fosfle Blog</strong><p style="margin:6px 0 12px;font-size:13px;">Check your internet connection and tap Refresh to load live articles.</p><button id="retryBlogBtn" class="chip-btn chip-read">Retry Connection</button></div>`
      : `<div class="empty-state"><strong>No published articles found</strong><p style="margin:6px 0 0;font-size:13px;">New posts published to Fosfle Firestore will appear here automatically.</p></div>`;
    document.getElementById("retryBlogBtn")?.addEventListener("click", loadBlogFeed);
    return;
  }

  const featured = (!q && blogCategory === "all") ? (list.find((x) => x.featured) || list[0]) : null;
  const rest = featured ? list.filter((x) => x.id !== featured.id) : list;

  let html = "";
  if (featured) {
    html += `
      <article class="blog-featured" data-article-id="${esc(featured.id)}">
        <img src="${esc(featured.coverImage)}" alt="${esc(featured.title)}" onerror="this.src='img/download.webp'" />
        <div class="blog-featured-body">
          <span class="blog-cat-tag">${esc(featured.category)}</span>
          <h3 style="margin:0 0 6px;font-size:18px;font-weight:800;line-height:1.25;">${esc(featured.title)}</h3>
          <p style="margin:0 0 10px;font-size:13.5px;color:var(--ink-secondary);">${esc(featured.excerpt || "Read this featured guide on Fosfle.")}</p>
          <div class="blog-meta">
            <span>${esc(featured.author)}</span><span>·</span>
            <span>${formatDate(featured.publishedMs)}</span><span>·</span>
            <span>${estimateReadMins(featured.content)} min read</span>
          </div>
        </div>
      </article>
    `;
  }

  html += rest.map((a) => `
    <article class="blog-card" data-article-id="${esc(a.id)}">
      <img src="${esc(a.coverImage)}" alt="${esc(a.title)}" loading="lazy" onerror="this.src='img/download.webp'" />
      <div style="min-width:0;flex:1;">
        <span class="blog-cat-tag" style="margin-bottom:2px;">${esc(a.category)}</span>
        <h3>${esc(a.title)}</h3>
        <div class="blog-meta">
          <span>${formatDate(a.publishedMs)}</span><span>·</span>
          <span>${estimateReadMins(a.content)} min</span>
        </div>
      </div>
    </article>
  `).join("");

  feed.innerHTML = html;
  feed.querySelectorAll("[data-article-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const art = blogArticles.find((x) => x.id === el.dataset.articleId);
      if (art) openArticleReader(art);
    });
  });
}

function openArticleReader(article) {
  Native.haptic("tap");
  currentArticleObj = article;
  document.getElementById("articleSheetTitle").textContent = article.title;
  document.getElementById("articleSheetSub").textContent = `${article.author} · ${formatDate(article.publishedMs)}`;

  const scroll = document.getElementById("articleScroll");
  scroll.innerHTML = `
    <span class="blog-cat-tag">${esc(article.category)}</span>
    <h1 style="margin:6px 0 8px;font-size:23px;font-weight:800;line-height:1.22;">${esc(article.title)}</h1>
    <div class="blog-meta" style="margin-bottom:12px;">
      <span>${esc(article.author)}</span><span>·</span>
      <span>${formatDate(article.publishedMs)}</span><span>·</span>
      <span>${estimateReadMins(article.content)} min read</span>
    </div>
    ${article.coverImage ? `<img class="article-cover" src="${esc(article.coverImage)}" alt="${esc(article.title)}" onerror="this.style.display='none'" />` : ""}
    <div id="articleBodyContent" class="article-body" style="font-size:${articleFontPx}px;">${article.content || "<p>No content available.</p>"}</div>
  `;
  scroll.scrollTop = 0;

  const sheet = document.getElementById("articleSheet");
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
}

function closeArticleReader() {
  const sheet = document.getElementById("articleSheet");
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden", "true");
}

// ==================== LIVE HTML/CSS PLAYGROUND ====================
function initPlayground() {
  const bar = document.getElementById("pgStarterBar");
  const editor = document.getElementById("pgEditor");
  const quickTags = ["<h1></h1>", "<p></p>", "<div class=\"\"></div>", "<a href=\"\"></a>", "<style></style>"];

  bar.innerHTML = PLAYGROUND_STARTERS.map((s, i) =>
    `<button class="snippet-chip" data-starter="${i}" style="border-color:var(--cobalt);color:var(--cobalt);">${esc(s.name)}</button>`
  ).join("") + quickTags.map((t) =>
    `<button class="snippet-chip" data-insert="${esc(t)}">${esc(t)}</button>`
  ).join("");

  editor.value = PLAYGROUND_STARTERS[0].code;

  bar.querySelectorAll("[data-starter]").forEach((b) => {
    b.addEventListener("click", () => {
      Native.haptic("tap");
      editor.value = PLAYGROUND_STARTERS[Number(b.dataset.starter)].code;
      updatePlaygroundPreview();
      showToast(`Loaded "${PLAYGROUND_STARTERS[Number(b.dataset.starter)].name}"`);
    });
  });

  bar.querySelectorAll("[data-insert]").forEach((b) => {
    b.addEventListener("click", () => {
      Native.haptic("tap");
      const tag = b.dataset.insert;
      const start = editor.selectionStart ?? editor.value.length;
      const end = editor.selectionEnd ?? editor.value.length;
      editor.value = editor.value.slice(0, start) + tag + editor.value.slice(end);
      editor.focus();
      editor.selectionStart = editor.selectionEnd = start + tag.length;
    });
  });
}

function updatePlaygroundPreview() {
  const editor = document.getElementById("pgEditor");
  const preview = document.getElementById("pgPreview");
  preview.srcdoc = editor.value;
}

function openPlayground(starterIdx = null) {
  Native.haptic("tap");
  if (starterIdx !== null && PLAYGROUND_STARTERS[starterIdx]) {
    document.getElementById("pgEditor").value = PLAYGROUND_STARTERS[starterIdx].code;
  }
  setPlaygroundMode("code");
  const sheet = document.getElementById("playgroundSheet");
  sheet.classList.add("open");
  sheet.setAttribute("aria-hidden", "false");
}

function setPlaygroundMode(mode) {
  const isPreview = mode === "preview";
  document.getElementById("pgCodeBtn").classList.toggle("active", !isPreview);
  document.getElementById("pgPreviewBtn").classList.toggle("active", isPreview);
  document.getElementById("pgEditor").style.display = isPreview ? "none" : "block";
  document.getElementById("pgPreview").style.display = isPreview ? "block" : "none";
  if (isPreview) updatePlaygroundPreview();
}

function closePlayground() {
  const sheet = document.getElementById("playgroundSheet");
  sheet.classList.remove("open");
  sheet.setAttribute("aria-hidden", "true");
}

// ==================== LIVE FIREBASE AUTH ====================
function renderAuthState(user) {
  currentUser = user;
  const loggedOut = document.getElementById("authLoggedOutBox");
  const loggedIn = document.getElementById("authLoggedInBox");
  const badge = document.getElementById("authSyncBadge");

  if (user) {
    loggedOut.style.display = "none";
    loggedIn.style.display = "block";
    const name = user.displayName || "Fosfle Learner";
    document.getElementById("profileName").textContent = name;
    document.getElementById("profileEmail").textContent = user.email || "";
    document.getElementById("profileAvatar").textContent = name.charAt(0).toUpperCase();
    if (badge) {
      badge.textContent = "Cloud Signed In";
      badge.style.color = "var(--emerald)";
    }
  } else {
    loggedOut.style.display = "block";
    loggedIn.style.display = "none";
    if (badge) {
      badge.textContent = "Local Mode";
      badge.style.color = "var(--ink-muted)";
    }
  }
}

function setAuthTab(mode) {
  authMode = mode;
  document.getElementById("authTabLogin").classList.toggle("active", mode === "login");
  document.getElementById("authTabRegister").classList.toggle("active", mode === "register");
  document.getElementById("nameFieldWrap").style.display = mode === "register" ? "block" : "none";
  document.getElementById("authSubmitBtn").textContent = mode === "register" ? "Create Fosfle Account" : "Sign In to Fosfle";
  document.getElementById("authErrorMsg").style.display = "none";
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const name = document.getElementById("authName").value.trim();
  const errEl = document.getElementById("authErrorMsg");
  const submitBtn = document.getElementById("authSubmitBtn");

  errEl.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = authMode === "register" ? "Creating account..." : "Signing in...";

  try {
    if (authMode === "register") {
      await registerWithEmail(name, email, password);
      Native.haptic("success");
      showToast(`Welcome to Fosfle, ${name || "Learner"}!`);
    } else {
      const user = await loginWithEmail(email, password);
      Native.haptic("success");
      showToast(`Welcome back, ${user.displayName || "Learner"}!`);
    }
    document.getElementById("authPassword").value = "";
  } catch (err) {
    Native.haptic("error");
    errEl.textContent = friendlyAuthError(err);
    errEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    setAuthTab(authMode);
  }
}

// ==================== ANDROID BACK BUTTON HANDLER ====================
window.fosfleHandleBack = function () {
  if (document.getElementById("lessonSheet").classList.contains("open")) {
    closeLessonViewer();
    return true;
  }
  if (document.getElementById("articleSheet").classList.contains("open")) {
    closeArticleReader();
    return true;
  }
  if (document.getElementById("playgroundSheet").classList.contains("open")) {
    closePlayground();
    return true;
  }
  if (activeTab !== "courses") {
    switchTab("courses");
    return true;
  }
  return false;
};

// ==================== BOOTSTRAP ====================
document.addEventListener("DOMContentLoaded", () => {
  initSplash();
  applyTheme(localStorage.getItem(STORAGE_THEME) || "light");
  updateNetworkUI(window.FosfleNative ? window.FosfleNative.isOnline() : navigator.onLine);

  renderUpcoming();
  renderProgressUI();
  initPlayground();

  // Bottom nav
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Topbar & Hero buttons
  document.getElementById("themeToggleBtn")?.addEventListener("click", toggleTheme);
  document.getElementById("settingsThemeBtn")?.addEventListener("click", toggleTheme);
  document.getElementById("openPlaygroundBtn")?.addEventListener("click", () => openPlayground());
  document.getElementById("heroPlaygroundBtn")?.addEventListener("click", () => openPlayground());
  document.getElementById("continueCourseBtn")?.addEventListener("click", () => {
    openLessonViewer(progress.lastLessonId || "intro_html", "lesson");
  });

  // Course search
  document.getElementById("courseSearchInput")?.addEventListener("input", (e) => {
    courseSearch = e.target.value;
    renderModules();
  });

  // Practice filters
  document.querySelectorAll("#practiceFilters .filter-pill").forEach((b) => {
    b.addEventListener("click", () => {
      Native.haptic("tap");
      practiceFilter = b.dataset.filter;
      document.querySelectorAll("#practiceFilters .filter-pill").forEach((x) => x.classList.toggle("active", x === b));
      renderPracticeList();
    });
  });

  // Lesson viewer controls
  document.getElementById("closeLessonBtn")?.addEventListener("click", closeLessonViewer);
  document.getElementById("markCompleteBtn")?.addEventListener("click", toggleCurrentComplete);
  document.getElementById("modeLessonBtn")?.addEventListener("click", () => loadLessonMode("lesson"));
  document.getElementById("modeQuizBtn")?.addEventListener("click", () => loadLessonMode("quiz"));
  document.getElementById("modeChalBtn")?.addEventListener("click", () => loadLessonMode("challenge"));
  document.getElementById("nextLessonBtn")?.addEventListener("click", goNextLesson);

  // Blog controls
  document.getElementById("refreshBlogBtn")?.addEventListener("click", () => {
    Native.haptic("tap");
    loadBlogFeed();
  });
  document.getElementById("blogSearchInput")?.addEventListener("input", (e) => {
    blogSearch = e.target.value;
    renderBlogFeed(false);
  });
  document.getElementById("closeArticleBtn")?.addEventListener("click", closeArticleReader);
  document.getElementById("fontMinusBtn")?.addEventListener("click", () => {
    articleFontPx = Math.max(13, articleFontPx - 1.5);
    const body = document.getElementById("articleBodyContent");
    if (body) body.style.fontSize = `${articleFontPx}px`;
  });
  document.getElementById("fontPlusBtn")?.addEventListener("click", () => {
    articleFontPx = Math.min(22, articleFontPx + 1.5);
    const body = document.getElementById("articleBodyContent");
    if (body) body.style.fontSize = `${articleFontPx}px`;
  });
  document.getElementById("shareArticleBtn")?.addEventListener("click", () => {
    if (!currentArticleObj) return;
    Native.share(
      currentArticleObj.title,
      currentArticleObj.excerpt || "Read on Fosfle",
      `https://fosfle.netlify.app/blog/article.html?slug=${encodeURIComponent(currentArticleObj.slug)}`
    );
  });

  // Playground controls
  document.getElementById("closePlaygroundBtn")?.addEventListener("click", closePlayground);
  document.getElementById("pgCodeBtn")?.addEventListener("click", () => setPlaygroundMode("code"));
  document.getElementById("pgPreviewBtn")?.addEventListener("click", () => setPlaygroundMode("preview"));

  // Auth controls
  document.getElementById("authTabLogin")?.addEventListener("click", () => setAuthTab("login"));
  document.getElementById("authTabRegister")?.addEventListener("click", () => setAuthTab("register"));
  document.getElementById("authForm")?.addEventListener("submit", handleAuthSubmit);
  document.getElementById("forgotPwdBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail").value.trim();
    if (!email) {
      showToast("Enter your email address above first.");
      return;
    }
    try {
      await sendPasswordReset(email);
      showToast("Password reset link sent to your email.");
    } catch (err) {
      showToast(friendlyAuthError(err));
    }
  });
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logoutUser();
    Native.haptic("tap");
    showToast("Signed out of Fosfle");
  });
  document.getElementById("resetProgressBtn")?.addEventListener("click", () => {
    if (confirm("Clear all completed lessons, quizzes, and challenges?")) {
      progress = {
        completedLessons: [],
        completedQuizzes: [],
        completedChallenges: [],
        lastLessonId: "intro_html",
        streakDays: 1,
        lastVisitDate: new Date().toISOString().slice(0, 10)
      };
      saveProgress();
      showToast("Course progress reset");
    }
  });

  // Connect live Firebase Auth observer in background
  subscribeAuth((user) => renderAuthState(user));

  // Pre-hydrate cached articles if available
  const cached = getCachedArticles();
  if (cached.length) {
    blogArticles = cached;
  }
});
