import { LESSONS } from './course-data.js';

/* ───────── helpers ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SITE = 'https://fosfle.netlify.app';
const nativeBridge = window.FosfleNative || null;
const pad = n => String(n).padStart(2, '0');
const today = () => new Date().toISOString().slice(0, 10);
const abs = u => !u ? '' : u.startsWith('/img/') ? u : u.startsWith('/') ? SITE + u : u;
const base = '/menu/courses/html/chapters/';
const COURSE = 'HTML from zero';

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); }
const buzz = (type = 'tap') => { try { nativeBridge?.haptic(type); } catch {} };

/* ───────── local state ───────── */
const KEY = 'fosfle.v1';
let S = (() => {
  try {
    return {
      done: {},
      saved: {},
      days: [],
      last: null,
      theme: 'system',
      blogNotifs: true,
      lastSeenBlogSlug: null,
      fontPx: 17,
      ...JSON.parse(localStorage.getItem(KEY) || '{}')
    };
  } catch {
    return { done: {}, saved: {}, days: [], last: null, theme: 'system', blogNotifs: true, lastSeenBlogSlug: null, fontPx: 17 };
  }
})();
const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } };
function save() { saveLocal(); queuePush(); }
function touchDay() { const d = today(); if (!S.days.includes(d)) { S.days = [...S.days, d].slice(-120); } }
function streak() {
  const set = new Set(S.days); let n = 0; const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const doneCount = () => LESSONS.filter(l => S.done[l.id]).length;
const pct = () => Math.round(doneCount() / LESSONS.length * 100);
const nextLesson = () => (S.last && !S.done[S.last.id] && LESSONS.find(l => l.id === S.last.id)) || LESSONS.find(l => !S.done[l.id]) || LESSONS[0];

function applyTheme() {
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('meta[name=theme-color]').content = dark ? '#050b1f' : '#f3efe6';
  try { nativeBridge?.setStatusBar(dark); } catch {}
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ───────── Firebase (same project as fosfle website) ───────── */
const G = 'https://www.gstatic.com/firebasejs/10.12.0/';
const FB_CFG = {
  apiKey: 'AIzaSyD-6quaikt4JwOVNjC_w63GviAuoE1AzII',
  authDomain: 'fosfle.firebaseapp.com',
  projectId: 'fosfle',
  storageBucket: 'fosfle.firebasestorage.app',
  messagingSenderId: '258985436515',
  appId: '1:258985436515:web:f41c2d7e7253a63bf2df56'
};
let appP, authP, dbP, user = null;
const fbApp = () => appP ||= import(G + 'firebase-app.js').then(m => m.getApps().length ? m.getApps()[0] : m.initializeApp(FB_CFG));
const fbAuth = () => authP ||= Promise.all([fbApp(), import(G + 'firebase-auth.js')]).then(([app, A]) => ({ A, auth: A.getAuth(app) }));
const fbDb = () => dbP ||= Promise.all([fbApp(), import(G + 'firebase-firestore.js')]).then(([app, F]) => ({ F, db: F.getFirestore(app) }));

let authReadyRes; const authReady = new Promise(r => authReadyRes = r);
async function initAuth() {
  try {
    const { A, auth } = await fbAuth();
    A.onAuthStateChanged(auth, u => {
      user = u; authReadyRes();
      if (u) pull().catch(() => { });
      if (['me', 'home', 'course'].includes(route().name)) render();
    });
  } catch (e) { console.warn('auth offline', e); authReadyRes(); }
}

/* progress sync -> users/{uid} */
let pushT;
function queuePush() { if (!user) return; clearTimeout(pushT); pushT = setTimeout(() => push().catch(() => { }), 900); }
async function push() {
  if (!user) return; const { F, db } = await fbDb();
  await F.setDoc(F.doc(db, 'users', user.uid), {
    done: S.done,
    saved: S.saved || {},
    days: S.days,
    name: user.displayName || null,
    updatedAt: F.serverTimestamp()
  }, { merge: true });
}
async function pull() {
  const { F, db } = await fbDb(); const snap = await F.getDoc(F.doc(db, 'users', user.uid));
  if (snap.exists()) {
    const r = snap.data();
    for (const [id, ts] of Object.entries(r.done || {})) if (!S.done[id] || ts < S.done[id]) S.done[id] = ts;
    S.saved = { ...(r.saved || {}), ...(S.saved || {}) };
    S.days = [...new Set([...(S.days || []), ...(r.days || [])])].sort().slice(-120);
    saveLocal();
  }
  await push(); render();
}

const AUTH_ERR = {
  'auth/invalid-credential': 'Email or password is wrong.',
  'auth/wrong-password': 'Email or password is wrong.',
  'auth/user-not-found': 'No account with that email.',
  'auth/email-already-in-use': 'That email already has an account — try signing in.',
  'auth/weak-password': 'Use at least 6 characters.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/network-request-failed': 'No connection. Check your internet and retry.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and retry.',
  'auth/popup-closed-by-user': 'Google sign-in was closed.',
  'auth/unauthorized-domain': 'Add appassets.androidplatform.net to Firebase Authorized Domains.'
};
let authMode = 'login';
function openAuth(mode = 'login') { setAuthMode(mode); $('#authErr').textContent = ''; document.body.classList.add('auth'); }
function closeAuth() { document.body.classList.remove('auth'); document.activeElement?.blur?.(); }
function setAuthMode(m) {
  authMode = m; const reg = m === 'register';
  $('#authTitle').textContent = reg ? 'Join Fosfle' : 'Welcome back';
  $('#authSub').textContent = reg ? 'Free forever. Your progress follows you across devices.' : 'Sign in to keep your progress on every device.';
  $('#authGo').textContent = reg ? 'Create account' : 'Sign in';
  $('.f-name').hidden = !reg; $('#authReset').hidden = reg;
  $$('#authSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#aPass').autocomplete = reg ? 'new-password' : 'current-password';
}
async function submitAuth(e) {
  e.preventDefault(); const err = $('#authErr'), goBtn = $('#authGo'); err.textContent = '';
  const email = $('#aEmail').value.trim(), pass = $('#aPass').value, name = $('#aName').value.trim();
  if (!email || !pass) { err.textContent = 'Enter your email and password.'; return; }
  if (pass.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  goBtn.disabled = true; const label = goBtn.textContent; goBtn.textContent = 'Please wait…';
  try {
    const { A, auth } = await fbAuth();
    if (authMode === 'register') {
      const c = await A.createUserWithEmailAndPassword(auth, email, pass);
      if (name) await A.updateProfile(c.user, { displayName: name });
    } else {
      await A.signInWithEmailAndPassword(auth, email, pass);
    }
    buzz('success');
    closeAuth(); toast(authMode === 'register' ? 'Account created. Welcome!' : 'Signed in'); $('#authForm').reset();
    render();
  } catch (x) {
    console.warn('Auth error', x);
    err.textContent = AUTH_ERR[x.code] || x.message || 'Something went wrong. Try again.';
  }
  goBtn.disabled = false; goBtn.textContent = label;
}
async function resetPw() {
  const email = $('#aEmail').value.trim(), err = $('#authErr');
  if (!email) { err.textContent = 'Type your email above first, then tap “Forgot password?”.'; return; }
  try { const { A, auth } = await fbAuth(); await A.sendPasswordResetEmail(auth, email); err.textContent = ''; toast('Reset link sent — check your inbox'); }
  catch (x) { err.textContent = AUTH_ERR[x.code] || 'Could not send the email.'; }
}
async function googleSignIn() {
  const btn = $('#googleBtn'), err = $('#authErr');
  err.textContent = '';
  btn.disabled = true;
  try {
    const { A, auth } = await fbAuth();
    const provider = new A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await A.signInWithPopup(auth, provider);
    buzz('success');
    closeAuth();
    toast('Signed in with Google');
    render();
  } catch (x) {
    console.warn('Google OAuth error', x);
    err.textContent = AUTH_ERR[x.code] || 'Google sign-in failed. Check connection or Firebase Authorized Domains.';
  }
  btn.disabled = false;
}
async function logout() { const { A, auth } = await fbAuth(); await A.signOut(auth); toast('Signed out'); render(); }

/* ───────── blog & new-post notifications ───────── */
let posts = null, postsP, hasUnreadBlog = false;
const BK = 'fosfle.blog.v1';
const cached = () => { try { return JSON.parse(localStorage.getItem(BK) || 'null'); } catch { return null; } };
const toDate = v => v?.toDate ? v.toDate() : v ? new Date(v) : null;
const fmtDate = v => { try { return toDate(v)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || ''; } catch { return ''; } };
const mins = h => Math.max(1, Math.ceil(String(h || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length / 200));

function checkNewBlogNotification(list) {
  if (!list || !list.length) return;
  const newest = list[0];
  if (!S.lastSeenBlogSlug) {
    S.lastSeenBlogSlug = newest.slug;
    saveLocal();
    return;
  }
  if (newest.slug && newest.slug !== S.lastSeenBlogSlug) {
    hasUnreadBlog = true;
    $('#blogDot')?.removeAttribute('hidden');
    if (S.blogNotifs !== false) {
      toast('New blog: ' + newest.title);
      try { nativeBridge?.notifyNewBlog(newest.title, newest.excerpt || '', newest.slug); } catch {}
    }
  }
}

function markBlogRead() {
  if (posts && posts.length) {
    S.lastSeenBlogSlug = posts[0].slug;
    hasUnreadBlog = false;
    $('#blogDot')?.setAttribute('hidden', '');
    saveLocal();
  }
}

function loadPosts(force = false) {
  if (posts && !force) return Promise.resolve(posts);
  return postsP ||= (async () => {
    try {
      const { F, db } = await fbDb();
      const snap = await F.getDocs(F.query(F.collection(db, 'articles'), F.where('status', '==', 'published'), F.orderBy('publishedAt', 'desc'), F.limit(40)));
      posts = snap.docs.map(d => { const x = d.data(); return { id: d.id, ...x, publishedAt: toDate(x.publishedAt)?.toISOString() || null, updatedAt: undefined, createdAt: undefined }; });
      try { localStorage.setItem(BK, JSON.stringify(posts)); } catch { }
      checkNewBlogNotification(posts);
    } catch (e) { console.warn('blog', e); posts = cached() || []; posts.offline = true; }
    postsP = null; return posts;
  })();
}

// Poll live Firestore every 3 minutes for new blog posts while app is open
setInterval(() => {
  if (navigator.onLine) loadPosts(true).catch(() => {});
}, 180000);

window.onFosfleNet = (online) => {
  if (online && (!posts || posts.offline)) loadPosts(true).then(() => { if (['home', 'blog'].includes(route().name)) render(); });
};

/* ───────── Playground Starters ───────── */
const LAB_STARTERS = [
  {
    name: 'Card',
    code: `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: system-ui; background: #f3efe6; padding: 20px; }
  .card { background: #fff; padding: 20px; border-radius: 16px; border: 1px solid #ddd6c6; }
  .tag { background: #b8f23a; color: #16210a; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; }
</style></head>
<body>
  <div class="card">
    <span class="tag">HTML5</span>
    <h2>Hello Fosfle!</h2>
    <p>Edit this code and tap <strong>Preview</strong>.</p>
  </div>
</body>
</html>`
  },
  {
    name: 'Table',
    code: `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: system-ui; padding: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
  th { background: #0a1330; color: #fff; }
</style></head>
<body>
  <h3>Study Schedule</h3>
  <table>
    <tr><th>Day</th><th>Lesson</th></tr>
    <tr><td>Mon</td><td>HTML Tags</td></tr>
    <tr><td>Wed</td><td>Colors & CSS</td></tr>
  </table>
</body>
</html>`
  }
];
let labCode = LAB_STARTERS[0].code;
let labPreview = false;

/* ───────── routing ───────── */
const route = () => { const [name = 'home', a, b] = location.hash.replace(/^#\//, '').split('/'); return { name: name || 'home', a: a && decodeURIComponent(a), b }; };
const go = h => { location.hash = h; };
let lastName = null;
function render() {
  const r = route(), v = $('#view'), full = r.name === 'lesson' || r.name === 'lab';
  document.body.classList.toggle('full', full);
  const fn = { home: vHome, course: vCourse, lesson: vLesson, blog: vBlog, post: vPost, me: vMe, lab: vLab }[r.name] || vHome;
  const keepScroll = lastName === r.name && !full && r.name !== 'post';
  const y = v.scrollTop;
  v.innerHTML = fn(r);
  if (!keepScroll) v.scrollTop = 0; else v.scrollTop = y;
  if (lastName !== r.name || full) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
  lastName = r.name;
  const tab = { post: 'blog', lab: 'course' }[r.name] || r.name;
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  after(r);
}

/* ───────── views ───────── */
const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const initial = () => (user?.displayName || user?.email || '?')[0].toUpperCase();
const num = l => pad(LESSONS.indexOf(l) + 1);
const kinds = l => ['Read', l.ex && 'Quiz', l.ch && 'Challenge'].filter(Boolean).join(' · ');

function vHome() {
  const n = nextLesson(), started = doneCount() > 0 || S.last;
  const first = user?.displayName?.split(' ')[0];
  return `
  <header class="top">
    <div class="brand-row">
      <img src="/favicon/web-app-manifest-192x192.png" alt="Fosfle" class="brand-logo">
      <div><span class="kicker">${greet()}</span><h1 class="h-big" style="margin:2px 0 0;font-size:28px;">${first ? esc(first) : 'Fosfle'}</h1></div>
    </div>
    ${user ? `<a class="avatar" href="#/me">${esc(initial())}</a>` : `<button class="btn ghost sm" data-act="openAuth">Sign in</button>`}
  </header>
  <a class="resume" href="#/lesson/${n.id}/read"><span class="kicker">${started ? 'Pick up where you left' : 'Start here'}</span>
    <h2>${esc(n.title)}</h2><span class="go">${started ? 'Resume' : 'Begin'} <i class="bi bi-arrow-right"></i></span><span class="ghost-n">${num(n)}</span></a>
  <div class="stats">
    <div class="card stat"><b>${doneCount()}<small style="font-size:14px;color:var(--muted)">/${LESSONS.length}</small></b><span>lessons done</span></div>
    <div class="card stat"><b>${streak()}</b><span>day streak</span></div>
    <div class="card stat"><b>${pct()}%</b><span>complete</span></div></div>
  <div class="sec"><h2>Your course</h2><a href="#/course">Open course</a></div>
  <a class="card" href="#/course" style="display:block"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b style="font:700 19px var(--display)">${COURSE}</b><i class="bi bi-arrow-right"></i></div>
    <div class="bar" style="--w:${pct()}%"><i></i></div><p class="sub" style="margin-top:10px;font-size:14px">${LESSONS.length} lessons · 18 quizzes · 18 challenges</p></a>
  <div class="sec"><h2>From the blog</h2><a href="#/blog">See all</a></div><div id="homeBlog">${'<div class="sk" style="height:84px;margin-bottom:10px"></div>'.repeat(2)}</div>
  <div class="sec"><h2>Tools &amp; upcoming</h2></div>
  <div class="soon">
    <a class="pill on" href="#/lab"><i class="bi bi-code-slash"></i> HTML Code Lab</a>
    ${['CSS', 'JavaScript', 'Python'].map(c => `<span class="pill lock"><i class="bi bi-lock"></i>${c}</span>`).join('')}
  </div>`;
}

/* Course tab: FIRST show Course Card, THEN upcoming cards, THEN lessons */
function vCourse() {
  const n = nextLesson(), started = doneCount() > 0 || S.last;
  return `
  <span class="kicker">Courses</span><h1 class="h-big">Learn Web Dev</h1>
  <article class="course-hero">
    <img class="hero-img" src="/img/html-css.webp" alt="HTML from zero">
    <div class="hero-body">
      <span class="kicker">Active Course · Free</span>
      <h2>${COURSE}</h2>
      <p class="sub">${doneCount()} of ${LESSONS.length} lessons complete · 18 quizzes · 18 challenges</p>
      <div class="bar" style="--w:${pct()}%"><i></i></div>
      <div class="hero-foot">
        <a class="btn glow sm" href="#/lesson/${n.id}/read">${started ? 'Continue Lesson ' + num(n) : 'Start Lesson 01'} <i class="bi bi-arrow-right"></i></a>
        <a class="btn ghost sm" href="#/lab"><i class="bi bi-code-slash"></i> Code Lab</a>
      </div>
    </div>
  </article>

  <div class="soon" style="margin-top:12px">
    <span class="pill lock"><i class="bi bi-lock"></i> Advanced CSS (Soon)</span>
    <span class="pill lock"><i class="bi bi-lock"></i> Python (Soon)</span>
  </div>

  <div class="sec" style="margin-top:22px">
    <h2>All Lessons (${LESSONS.length})</h2>
    <button class="pill" id="savedFilterBtn" data-act="toggleSavedFilter"><i class="bi bi-bookmark"></i> Saved</button>
  </div>
  <label class="search" style="margin-top:8px"><i class="bi bi-search"></i><input id="q" type="search" placeholder="Search lessons" autocomplete="off"></label>
  <div class="rows" id="rows">${LESSONS.map(l => {
    const isSaved = !!(S.saved && S.saved[l.id]);
    return `
    <div class="row ${S.done[l.id] ? 'done' : ''}" data-id="${l.id}" data-t="${esc(l.title.toLowerCase())}" data-saved="${isSaved ? '1' : '0'}">
      <a href="#/lesson/${l.id}/read" style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
        <span class="num">${num(l)}</span><span class="ttl"><b>${esc(l.title)}</b><small>${kinds(l)}</small></span>
      </a>
      <button type="button" class="row-star ${isSaved ? 'on' : ''}" data-act="star" data-id="${l.id}" aria-label="Save lesson"><i class="bi ${isSaved ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i></button>
      <a href="#/lesson/${l.id}/read" class="tick"><i class="bi ${S.done[l.id] ? 'bi-check-lg' : 'bi-chevron-right'}"></i></a>
    </div>`;
  }).join('')}</div>
  <p class="empty" id="noMatch" hidden>No lesson matches that.</p>`;
}

function vLesson(r) {
  const i = LESSONS.findIndex(l => l.id === r.a); if (i < 0) return `<div class="empty">Lesson not found. <a class="link" href="#/course">Back to course</a></div>`;
  const l = LESSONS[i]; let mode = ['read', 'ex', 'ch'].includes(r.b) && (r.b === 'read' || l[r.b]) ? r.b : 'read';
  const src = base + (mode === 'read' ? l.read : mode === 'ex' ? 'excercises/' + l.ex : 'challenges/' + l.ch);
  const prev = LESSONS[i - 1], next = LESSONS[i + 1], d = !!S.done[l.id];
  return `<div class="reader">
    <div class="rbar"><a class="ib" href="#/course" aria-label="Back to course"><i class="bi bi-chevron-left"></i></a>
      <div class="t"><b>${esc(l.title)}</b><small>LESSON ${num(l)} / ${pad(LESSONS.length)}</small></div>
      <a class="ib" href="#/lab" aria-label="Open Code Lab" title="Code Lab"><i class="bi bi-code-slash"></i></a></div>
    <div class="seg" data-lesson="${l.id}">
      <button data-act="mode" data-m="read" class="${mode === 'read' ? 'on' : ''}"><i class="bi bi-book"></i>Read</button>
      <button data-act="mode" data-m="ex" class="${mode === 'ex' ? 'on' : ''}" ${l.ex ? '' : 'disabled'}><i class="bi bi-ui-checks"></i>Quiz</button>
      <button data-act="mode" data-m="ch" class="${mode === 'ch' ? 'on' : ''}" ${l.ch ? '' : 'disabled'}><i class="bi bi-lightning-charge"></i>Challenge</button></div>
    <div class="frame"><div class="ld" id="ld"><i></i></div><iframe id="fr" title="${esc(l.title)}" src="${src}" loading="eager"></iframe></div>
    <div class="rfoot">
      <a class="btn ghost sq" ${prev ? `href="#/lesson/${prev.id}/read"` : 'style="opacity:.35;pointer-events:none"'} aria-label="Previous lesson"><i class="bi bi-arrow-left"></i></a>
      <button class="btn ${d ? 'ghost' : 'glow'}" data-act="complete" data-id="${l.id}">${d ? '<i class="bi bi-check2-circle"></i> Completed' : 'Mark complete'}</button>
      <a class="btn ghost sq" ${next ? `href="#/lesson/${next.id}/read"` : 'style="opacity:.35;pointer-events:none"'} aria-label="Next lesson"><i class="bi bi-arrow-right"></i></a></div></div>`;
}

function vLab() {
  return `<div class="lab-wrap">
    <div class="lab-bar">
      <a class="ib" href="#/course" aria-label="Back"><i class="bi bi-chevron-left"></i></a>
      <div class="t"><b>HTML Code Lab</b><small>LIVE SANDBOX</small></div>
      <div class="seg" style="margin:0;width:auto;">
        <button type="button" data-act="labMode" data-m="code" class="${!labPreview ? 'on' : ''}" style="padding:0 12px;">Code</button>
        <button type="button" data-act="labMode" data-m="prev" class="${labPreview ? 'on' : ''}" style="padding:0 12px;">Preview</button>
      </div>
    </div>
    <div class="lab-chips">
      ${LAB_STARTERS.map((s, idx) => `<button type="button" class="pill" data-act="labStarter" data-i="${idx}">${esc(s.name)}</button>`).join('')}
      ${['<h1></h1>', '<p></p>', '<a href=""></a>', '<style></style>'].map(tag => `<button type="button" class="pill" data-act="labTag" data-tag="${esc(tag)}">${esc(tag)}</button>`).join('')}
    </div>
    <textarea id="labEd" class="lab-ed" spellcheck="false" ${labPreview ? 'hidden' : ''}>${esc(labCode)}</textarea>
    <iframe id="labPrev" class="lab-prev" sandbox="allow-scripts" ${labPreview ? '' : 'hidden'}></iframe>
  </div>`;
}

function vBlog() {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-end;">
    <div><span class="kicker">Blog</span><h1 class="h-big">Fresh from Fosfle</h1></div>
    <button class="btn ghost sm" data-act="refreshBlog" aria-label="Refresh"><i class="bi bi-arrow-clockwise"></i></button>
  </div>
  <label class="search"><i class="bi bi-search"></i><input id="bq" type="search" placeholder="Search articles" autocomplete="off"></label>
  <div class="chips" id="chips"></div><div id="plist">${'<div class="sk" style="height:250px;margin-top:14px;border-radius:18px"></div>'.repeat(2)}</div>`;
}
function postCard(p) {
  return `<a class="card post" href="#/post/${encodeURIComponent(p.slug)}"><img loading="lazy" src="${esc(abs(p.coverImage) || '/img/download.webp')}" alt="" onerror="this.src='/img/download.webp'">
  <div class="b"><span class="tag">${esc(p.category || 'Learning')}</span><h3>${esc(p.title)}</h3><p>${esc(p.excerpt || '')}</p>
  <div class="meta">${esc(p.author || 'Fosfle')} · ${fmtDate(p.publishedAt)} · ${mins(p.content)} min read</div></div></a>`;
}
function vPost() { return `<div id="art"><div class="sk" style="height:34px;width:60%;margin-top:30px"></div><div class="sk" style="height:200px;margin-top:20px"></div></div>`; }

function vMe() {
  const row = (icon, label, act, extra = '') => `<button data-act="${act}" ${extra}><i class="bi bi-${icon}"></i><span>${label}</span><i class="bi bi-chevron-right" style="font-size:14px;width:auto"></i></button>`;
  return `<div class="brand-row" style="margin-bottom:8px;"><img src="/favicon/web-app-manifest-192x192.png" alt="Fosfle" class="brand-logo"><span class="kicker">Fosfle Account</span></div>
  ${user ? `<div class="who"><div class="avatar">${esc(initial())}</div><div><b>${esc(user.displayName || 'Learner')}</b><small>${esc(user.email)}</small></div></div>
     <p class="sub" style="margin-top:14px;font-size:14px"><i class="bi bi-cloud-check"></i> Progress &amp; bookmarks are syncing to your account.</p>`
      : `<div class="card" style="margin-top:14px"><h2 style="font-size:24px">Save your progress</h2><p class="sub" style="margin:8px 0 16px">Sign in with Email or Google to sync your lessons across devices.</p>
     <button class="btn primary block" data-act="openAuth">Sign in or create account</button></div>`}
  <div class="stats"><div class="card stat"><b>${doneCount()}</b><span>lessons</span></div><div class="card stat"><b>${streak()}</b><span>day streak</span></div><div class="card stat"><b>${pct()}%</b><span>complete</span></div></div>
  <div class="sec"><h2>Appearance</h2></div>
  <div class="seg" style="margin:0">${['system', 'light', 'dark'].map(t => `<button data-act="theme" data-t="${t}" class="${S.theme === t ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
  <div class="sec"><h2>Notifications &amp; Tools</h2></div>
  <div class="list">
    <button data-act="toggleBlogNotif"><i class="bi bi-bell"></i><span>New blog post alerts</span><em>${S.blogNotifs !== false ? 'On' : 'Off'}</em></button>
    ${row('send', 'Test blog notification', 'testNotif')}
    <a href="#/lab"><i class="bi bi-code-slash"></i><span>HTML Code Lab</span><i class="bi bi-chevron-right" style="font-size:14px;width:auto"></i></a>
    ${row('arrow-counterclockwise', 'Reset my progress', 'reset', 'class="danger"')}
    ${user ? row('box-arrow-right', 'Sign out', 'logout') : ''}
  </div>
  <p class="sub" style="text-align:center;margin-top:26px;font-size:12px;font-family:var(--mono)">FOSFLE · v2.1.0</p>`;
}

/* ───────── per-view async work ───────── */
let savedOnly = false;
function filterCourseRows() {
  const q = ($('#q')?.value || '').trim().toLowerCase();
  let n = 0;
  $$('#rows .row').forEach(x => {
    const okQ = !q || x.dataset.t.includes(q);
    const okS = !savedOnly || x.dataset.saved === '1';
    const show = okQ && okS;
    x.hidden = !show;
    if (show) n++;
  });
  const nm = $('#noMatch');
  if (nm) nm.hidden = n > 0;
}

async function after(r) {
  if (r.name === 'course') {
    const btn = $('#savedFilterBtn');
    if (btn) btn.classList.toggle('on', savedOnly);
    $('#q')?.addEventListener('input', filterCourseRows);
    filterCourseRows();
  }
  if (r.name === 'lesson') {
    const l = LESSONS.find(x => x.id === r.a); if (l) { S.last = { id: l.id }; touchDay(); saveLocal(); }
    const fr = $('#fr'); fr?.addEventListener('load', () => {
      const ld = $('#ld'); if (ld) { ld.style.opacity = 0; setTimeout(() => ld.remove(), 260); }
      try {
        const d = fr.contentDocument, st = d.createElement('style'), reading = !/excercises|challenges/.test(fr.getAttribute('src'));
        st.textContent = '[onclick*="history.back"]{display:none!important}html{-webkit-text-size-adjust:100%}' + (reading ? '.display-4{font-size:2rem!important}.lead{font-size:1.05rem!important}.container-fluid{padding-left:1rem!important;padding-right:1rem!important}' : '');
        d.head.appendChild(st);
      } catch { }
    });
  }
  if (r.name === 'lab') {
    const ed = $('#labEd'), prev = $('#labPrev');
    ed?.addEventListener('input', () => { labCode = ed.value; });
    if (labPreview && prev) prev.srcdoc = labCode;
  }
  if (r.name === 'home') {
    const list = await loadPosts(); const el = $('#homeBlog'); if (!el || route().name !== 'home') return;
    el.innerHTML = list.length ? list.slice(0, 2).map(p => `<a class="card post-mini" href="#/post/${encodeURIComponent(p.slug)}" style="margin-bottom:10px"><img loading="lazy" src="${esc(abs(p.coverImage) || '/img/download.webp')}" alt="" onerror="this.src='/img/download.webp'"><div><b>${esc(p.title)}</b><small>${esc(p.category || 'Learning')} · ${mins(p.content)} min</small></div></a>`).join('') : '<p class="sub">New articles are on the way.</p>';
  }
  if (r.name === 'blog') {
    const list = await loadPosts(); if (route().name !== 'blog') return;
    markBlogRead();
    let cat = 'all', term = '';
    const draw = () => {
      const cats = [...new Set(list.map(p => p.category).filter(Boolean))].sort();
      $('#chips').innerHTML = ['all', ...cats].map(c => `<button class="pill ${c === cat ? 'on' : ''}" data-c="${esc(c)}">${c === 'all' ? 'All' : esc(c)}</button>`).join('');
      const f = list.filter(p => (cat === 'all' || p.category === cat) && (!term || [p.title, p.excerpt, p.category, ...(p.tags || [])].join(' ').toLowerCase().includes(term)));
      $('#plist').innerHTML = (list.offline ? '<p class="sub" style="margin-top:14px"><i class="bi bi-wifi-off"></i> Offline — showing saved articles.</p>' : '') + (f.length ? f.map(postCard).join('') : '<div class="empty"><i class="bi bi-journal-x" style="font-size:34px"></i><p>No articles found.</p></div>');
    };
    draw();
    $('#chips').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { cat = b.dataset.c; draw(); } };
    $('#bq').oninput = e => { term = e.target.value.trim().toLowerCase(); draw(); };
  }
  if (r.name === 'post') {
    const list = await loadPosts(); const p = list.find(x => x.slug === r.a); const el = $('#art'); if (!el || route().name !== 'post') return;
    if (!p) { el.innerHTML = '<div class="empty">Article not found.<a class="link" href="#/blog">Back to blog</a></div>'; return; }
    markBlogRead();
    let html = p.content || '';
    if (!window.DOMPurify) await new Promise(res => { const s = document.createElement('script'); s.src = '/vendor/purify.min.js'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
    html = window.DOMPurify ? DOMPurify.sanitize(html) : esc(html);
    html = html.replace(/(<img[^>]+src=")\//g, `$1${SITE}/`);
    el.className = 'article';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
        <a class="link" style="margin:0 0 0 -2px;display:inline-flex;gap:6px;align-items:center" href="#/blog"><i class="bi bi-arrow-left"></i>All articles</a>
        <div class="font-ctl">
          <button type="button" class="pill" data-act="fontSz" data-d="-1.5">A-</button>
          <button type="button" class="pill" data-act="fontSz" data-d="1.5">A+</button>
        </div>
      </div>
      <div style="margin-top:14px"><span class="tag">${esc(p.category || 'Fosfle Blog')}</span></div><h1>${esc(p.title)}</h1>
      ${p.excerpt ? `<p class="sub" style="font-size:18px">${esc(p.excerpt)}</p>` : ''}
      <div class="meta">${esc(p.author || 'Fosfle')} · ${fmtDate(p.publishedAt)} · ${mins(p.content)} min read</div>
      ${p.coverImage ? `<img class="cover" src="${esc(abs(p.coverImage))}" alt="" onerror="this.remove()">` : ''}
      <div class="prose" id="artProse" style="font-size:${S.fontPx || 17}px">${html}</div>
      <button class="btn glow block" style="margin-top:28px" data-act="share" data-t="${esc(p.title)}" data-u="${esc(SITE + '/blog/article.html?slug=' + encodeURIComponent(p.slug))}"><i class="bi bi-share"></i> Share article</button>`;
    $$('.prose a', el).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  }
}

/* ───────── actions ───────── */
const ACT = {
  openAuth: () => openAuth('login'),
  closeAuth,
  authMode: t => setAuthMode(t.dataset.mode),
  resetPw,
  google: googleSignIn,
  logout,
  togglePw: t => { const i = $('#aPass'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; t.innerHTML = `<i class="bi bi-eye${show ? '-slash' : ''}"></i>`; },
  mode: t => { const id = t.closest('[data-lesson]').dataset.lesson; history.replaceState(null, '', `#/lesson/${id}/${t.dataset.m}`); render(); },
  complete: t => {
    const id = t.dataset.id;
    if (S.done[id]) { delete S.done[id]; toast('Marked as not done'); }
    else { S.done[id] = Date.now(); touchDay(); buzz('success'); const i = LESSONS.findIndex(l => l.id === id); toast(i < LESSONS.length - 1 ? 'Lesson complete 🎉' : 'Course complete — amazing work! 🎓'); }
    save(); render();
  },
  star: t => {
    const id = t.dataset.id;
    S.saved = S.saved || {};
    if (S.saved[id]) { delete S.saved[id]; toast('Removed from saved'); }
    else { S.saved[id] = true; buzz(); toast('Saved lesson'); }
    save();
    const row = t.closest('.row');
    if (row) row.dataset.saved = S.saved[id] ? '1' : '0';
    t.classList.toggle('on', !!S.saved[id]);
    t.innerHTML = `<i class="bi ${S.saved[id] ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i>`;
    filterCourseRows();
  },
  toggleSavedFilter: () => { savedOnly = !savedOnly; $('#savedFilterBtn')?.classList.toggle('on', savedOnly); filterCourseRows(); },
  labMode: t => { labPreview = t.dataset.m === 'prev'; render(); },
  labStarter: t => { labCode = LAB_STARTERS[Number(t.dataset.i)].code; labPreview = false; render(); toast('Loaded template'); },
  labTag: t => {
    const ed = $('#labEd'); if (!ed || labPreview) return;
    const tag = t.dataset.tag, s = ed.selectionStart ?? ed.value.length, e = ed.selectionEnd ?? ed.value.length;
    ed.value = ed.value.slice(0, s) + tag + ed.value.slice(e); labCode = ed.value; ed.focus();
  },
  refreshBlog: () => { toast('Checking for new articles…'); loadPosts(true).then(() => render()); },
  toggleBlogNotif: () => { S.blogNotifs = !(S.blogNotifs !== false); saveLocal(); render(); toast(S.blogNotifs ? 'Blog alerts enabled' : 'Blog alerts muted'); },
  testNotif: () => {
    const sample = (posts && posts[0]) || { title: 'HTML5 Updates on Fosfle', excerpt: 'Tap to explore the latest guide on Fosfle Blog.', slug: '' };
    if (nativeBridge?.notifyNewBlog) {
      nativeBridge.notifyNewBlog(sample.title, sample.excerpt || '', sample.slug || '');
      toast('Notification sent!');
    } else {
      toast('New blog: ' + sample.title);
    }
  },
  fontSz: t => {
    S.fontPx = Math.min(22, Math.max(13, (S.fontPx || 17) + Number(t.dataset.d)));
    saveLocal();
    const p = $('#artProse'); if (p) p.style.fontSize = S.fontPx + 'px';
  },
  theme: t => { S.theme = t.dataset.t; saveLocal(); applyTheme(); render(); },
  reset: () => { if (confirm('Reset all lesson progress? This cannot be undone.')) { S.done = {}; S.saved = {}; S.days = []; S.last = null; save(); render(); toast('Progress reset'); } },
  share: async t => {
    const title = t.dataset.t, url = t.dataset.u;
    try { if (nativeBridge?.share) nativeBridge.share(title, url); else if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { }
  }
};
document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t && ACT[t.dataset.act]) { e.preventDefault(); ACT[t.dataset.act](t); } });
$('#authForm').addEventListener('submit', submitAuth);
window.addEventListener('hashchange', render);

/* Android hardware back button */
window.fosfleBack = () => {
  if (document.body.classList.contains('auth')) { closeAuth(); return true; }
  const n = route().name;
  if (n === 'lesson' || n === 'lab') { go('#/course'); return true; }
  if (n === 'post') { go('#/blog'); return true; }
  if (n !== 'home') { go('#/home'); return true; }
  return false;
};

/* ───────── boot + splash (exact phosphor tube warmup) ───────── */
async function boot() {
  const t0 = performance.now(), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sp = $('#splash'), pctEl = $('#spPct'), st = $('#spStatus');
  const setP = (p, msg) => { sp.style.setProperty('--p', p); pctEl.textContent = Math.round(p * 100) + '%'; if (msg) st.textContent = msg; };
  $('#googleWrap').hidden = false;
  applyTheme(); setAuthMode('login'); setP(.12, 'warming up');
  render();
  const steps = [
    document.fonts?.ready?.then(() => setP(.45, 'loading type')) ?? Promise.resolve(),
    Promise.race([initAuth().then(() => authReady), new Promise(r => setTimeout(r, 2600))]).then(() => setP(.8, 'connecting')),
    Promise.race([loadPosts().catch(() => { }), new Promise(r => setTimeout(r, 3000))])
  ];
  await Promise.allSettled(steps);
  setP(1, 'ready');
  const min = reduce ? 500 : 2300, wait = Math.max(0, min - (performance.now() - t0));
  await new Promise(r => setTimeout(r, wait));
  sp.classList.add('out'); setTimeout(() => sp.classList.add('gone'), 760);
}
boot();
