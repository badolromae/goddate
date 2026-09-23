// ============================================
//  공지사항 앱 — 메인 로직
//  Firebase Firestore에서 공지를 읽어와 보여줍니다.
//  config.js 에 실제 설정을 넣으면 클라우드와 연결됩니다.
//  설정이 없으면 데모 데이터로 작동합니다.
// ============================================

// ---------- 데모 데이터 (Firebase 미설정 시 사용) ----------
const DEMO_NOTICES = [
  {
    id: "demo-1",
    title: "우리 공간에 오신 걸 환영해요 ☕",
    body: "안녕하세요! 이곳은 따뜻한 소식을 나누는 공지 공간이에요.\n\n앞으로 이곳에서 중요한 소식과 이야기를 전해드릴게요. 궁금한 점이나 나누고 싶은 이야기가 있다면 아래 '네이버 카페' 버튼을 눌러 편하게 이야기 나눠주세요.\n\n오늘도 좋은 하루 보내세요 🌼",
    date: "2026-09-15",
    pinned: true,
    imageUrl: "",
    links: [],
  },
  {
    id: "demo-2",
    title: "9월 모임 안내",
    body: "이번 달 모임은 9월 28일 토요일 오후 2시에 진행됩니다.\n\n장소와 준비물은 네이버 카페 게시판에서 확인해주세요. 많은 참여 부탁드려요!",
    date: "2026-09-12",
    pinned: false,
    imageUrl: "",
    links: [],
  },
  {
    id: "demo-3",
    title: "카페 이용 안내",
    body: "소통은 네이버 카페에서 이루어집니다. 아래 버튼을 눌러 카페에 가입하시면 다양한 이야기를 함께 나눌 수 있어요.\n\n앱에서는 공지를, 카페에서는 대화를 — 이렇게 나눠서 편하게 이용해주세요 💙",
    date: "2026-09-08",
    pinned: false,
    imageUrl: "",
    links: [],
  },
];

// ---------- 설정 읽기 ----------
const CONFIG = window.APP_CONFIG || {};
const CAFE_URL = CONFIG.cafeUrl || "https://cafe.naver.com";
const FOOTER_TEXT = CONFIG.footerText || "사랑을 담아 전합니다";
const HAS_FIREBASE =
  CONFIG.firebase &&
  CONFIG.firebase.projectId &&
  CONFIG.firebase.projectId !== "YOUR_PROJECT_ID";

// ---------- DOM ----------
const board = document.getElementById("board");
const skeleton = document.getElementById("skeleton");
const cafeBtn = document.getElementById("cafeBtn");
const footerText = document.getElementById("footerText");
const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalDate = document.getElementById("modalDate");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const newbar = document.getElementById("newbar");
const newbarText = document.getElementById("newbarText");

cafeBtn.href = CAFE_URL;
footerText.textContent = FOOTER_TEXT;

// ---------- 읽음 관리 (localStorage) ----------
// 유저가 이미 열어본 공지의 id를 기기에 저장해 둡니다.
// 저장된 목록에 없는 공지 = 아직 안 본 '새 공지'.
const SEEN_KEY = "seenNoticeIds";

function getSeenIds() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch { return []; }
}
function isSeen(id) {
  return getSeenIds().includes(id);
}
function markSeen(id) {
  try {
    const seen = getSeenIds();
    if (!seen.includes(id)) {
      seen.push(id);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-300)));
    }
  } catch {}
}
function markAllSeen(notices) {
  try {
    const ids = notices.map((n) => n.id);
    const merged = Array.from(new Set([...getSeenIds(), ...ids]));
    localStorage.setItem(SEEN_KEY, JSON.stringify(merged.slice(-300)));
  } catch {}
}
function updateNewBar(unseenCount) {
  if (!newbar) return;
  if (unseenCount > 0) {
    newbarText.textContent = `새 공지가 ${unseenCount}개 있어요`;
    newbar.hidden = false;
  } else {
    newbar.hidden = true;
  }
}

// ---------- 날짜 도우미 ----------
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  } catch { return dateStr; }
}
function isNew(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return days <= 3;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- 공지 렌더링 ----------
function renderNotices(notices) {
  skeleton?.remove();

  if (!notices || notices.length === 0) {
    board.innerHTML = `
      <div class="empty">
        <span class="empty__emoji">🌱</span>
        <p class="empty__text">아직 등록된 공지가 없어요.<br>곧 첫 소식을 전해드릴게요!</p>
      </div>`;
    updateNewBar(0);
    return;
  }

  // 고정 공지 먼저, 그다음 최신순
  notices.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.date) - new Date(a.date);
  });

  board.innerHTML = "";
  let unseenCount = 0;
  notices.forEach((n) => {
    const unseen = !isSeen(n.id);
    if (unseen) unseenCount++;
    const card = document.createElement("article");
    card.className = "card" + (isNew(n.date) ? " card--new" : "") + (unseen ? " card--unseen" : "");
    card.innerHTML = `
      ${isNew(n.date) ? '<span class="card__ribbon">NEW</span>' : ""}
      ${n.pinned ? '<span class="card__pin">📌</span>' : ""}
      ${unseen ? '<span class="card__dot" title="새 공지"></span>' : ""}
      <p class="card__date">${formatDate(n.date)}</p>
      <h2 class="card__title">${escapeHtml(n.title)}</h2>
      ${n.imageUrl ? `<img class="card__thumb" src="${n.imageUrl.replace(/"/g, "&quot;")}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ""}
      <p class="card__preview">${escapeHtml(stripToText(n.body))}</p>
      <span class="card__more">자세히 보기 →</span>
    `;
    card.addEventListener("click", () => openModal(n, card));
    board.appendChild(card);
  });

  updateNewBar(unseenCount);

  if (newbar) {
    newbar.onclick = () => {
      markAllSeen(notices);
      updateNewBar(0);
      document.querySelectorAll(".card--unseen").forEach((c) => {
        c.classList.remove("card--unseen");
        c.querySelector(".card__dot")?.remove();
      });
    };
  }
}

function stripToText(body) {
  return (body || "").replace(/<[^>]*>/g, "").replace(/\n/g, " ");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// 본문 안의 주소(http/https, www)를 눌러지는 링크로 만들어 담습니다.
function linkify(text, container) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  let lastIndex = 0;
  let match;
  const src = text || "";
  while ((match = urlRegex.exec(src)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(src.slice(lastIndex, match.index)));
    }
    let url = match[0];
    let trailing = "";
    const m2 = url.match(/[),.!?]+$/);
    if (m2) { trailing = m2[0]; url = url.slice(0, -trailing.length); }

    const a = document.createElement("a");
    a.href = url.startsWith("www.") ? "https://" + url : url;
    a.textContent = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "body-link";
    container.appendChild(a);

    if (trailing) container.appendChild(document.createTextNode(trailing));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < src.length) {
    container.appendChild(document.createTextNode(src.slice(lastIndex)));
  }
}

// ---------- 모달 ----------
function openModal(n, cardEl) {
  markSeen(n.id);
  trackRead(n.id);   // 관리자 통계용 '읽은 횟수' +1
  if (cardEl) {
    cardEl.classList.remove("card--unseen");
    cardEl.querySelector(".card__dot")?.remove();
  }
  const remaining = document.querySelectorAll(".card--unseen").length;
  updateNewBar(remaining);

  modalDate.textContent = formatDate(n.date);
  modalTitle.textContent = n.title;

  modalBody.innerHTML = "";

  if (n.imageUrl) {
    const img = document.createElement("img");
    img.src = n.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => { img.style.display = "none"; };
    modalBody.appendChild(img);
  }

  const textEl = document.createElement("div");
  textEl.className = "modal__text";
  linkify(n.body, textEl);
  modalBody.appendChild(textEl);

  if (Array.isArray(n.links) && n.links.length > 0) {
    const box = document.createElement("div");
    box.className = "modal__links";
    n.links.forEach((lk) => {
      if (!lk || !lk.url) return;
      const a = document.createElement("a");
      let url = lk.url;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "link-btn";
      a.textContent = "🔗 " + (lk.title || "링크 열기");
      box.appendChild(a);
    });
    modalBody.appendChild(box);
  }

  // 댓글 영역
  openNoticeId = n.id;
  $id("commentInput").value = "";
  refreshMemberUI();
  loadComments(n.id);

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.hidden = true;
  openNoticeId = null;
  document.body.style.overflow = "";
}
modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ---------- Firebase (한 번만 켜서 모든 기능이 같이 씀) ----------
const FB_VER = "10.12.2";
let FB = null;   // { db, auth, fs:{...}, au:{...} }
async function fb() {
  if (FB) return FB;
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`);
  const au = await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`);
  const app = initializeApp(CONFIG.firebase);
  FB = { db: fs.getFirestore(app), auth: au.getAuth(app), fs, au };
  return FB;
}

// ---------- 데이터 로드 ----------
async function loadNotices() {
  if (!HAS_FIREBASE) {
    console.info("[공지앱] Firebase 미설정 → 데모 데이터로 실행 중입니다.");
    setTimeout(() => renderNotices(DEMO_NOTICES), 500);
    return;
  }
  try {
    const { db, fs } = await fb();
    const snap = await fs.getDocs(fs.query(fs.collection(db, "notices"), fs.orderBy("date", "desc")));
    const notices = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.completed) return;   // 완료 처리된 공지는 유저 화면에서 숨김
      notices.push({
        id: docSnap.id,
        title: d.title || "(제목 없음)",
        body: d.body || "",
        imageUrl: d.imageUrl || "",
        links: Array.isArray(d.links) ? d.links : [],
        date: d.date || "",
        pinned: !!d.pinned,
      });
    });
    renderNotices(notices);
    trackVisit();
  } catch (err) {
    console.error("[공지앱] 공지를 불러오지 못했어요:", err);
    skeleton?.remove();
    board.innerHTML = `
      <div class="empty">
        <span class="empty__emoji">🌧️</span>
        <p class="empty__text">소식을 불러오지 못했어요.<br>잠시 후 다시 열어주세요.</p>
      </div>`;
  }
}

// ---------- 방문자 / 읽은 횟수 기록 ----------
function getVisitorId() {
  let id = localStorage.getItem("visitorId");
  if (!id) {
    id = "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("visitorId", id);
  }
  return id;
}
async function trackVisit() {
  const today = todayStr();
  if (localStorage.getItem("lastVisitDate") === today) return;  // 오늘은 이미 셌음
  try {
    const { db, fs } = await fb();
    const logRef = fs.doc(db, "visit_log", `${today}_${getVisitorId()}`);
    const statsRef = fs.doc(db, "stats_daily", today);
    await fs.runTransaction(db, async (tx) => {
      const logSnap = await tx.get(logRef);
      if (logSnap.exists()) return;
      tx.set(logRef, { ts: fs.serverTimestamp() });
      tx.set(statsRef, { visitors: fs.increment(1), date: today }, { merge: true });
    });
    localStorage.setItem("lastVisitDate", today);
  } catch (e) {
    console.warn("[공지앱] 방문 기록 실패(무시):", e.message);
  }
}
async function trackRead() {
  if (!HAS_FIREBASE) return;
  try {
    const { db, fs } = await fb();
    const today = todayStr();
    await fs.setDoc(fs.doc(db, "stats_daily", today), { reads: fs.increment(1), date: today }, { merge: true });
  } catch (e) {
    console.warn("[공지앱] 읽은 횟수 기록 실패(무시):", e.message);
  }
}

// ============================================
//  회원 (로그인 · 회원가입)
// ============================================
let currentUser = null;
const memberBtn = document.getElementById("memberBtn");
const memberName = document.getElementById("memberName");
const authModal = document.getElementById("authModal");
const authMsg = document.getElementById("authMsg");
const $id = (x) => document.getElementById(x);

function displayNameOf(u) {
  return (u && (u.displayName || (u.email || "").split("@")[0])) || "회원";
}
function refreshMemberUI() {
  if (currentUser) {
    memberName.textContent = displayNameOf(currentUser) + "님";
    memberBtn.textContent = "로그아웃";
  } else {
    memberName.textContent = "";
    memberBtn.textContent = "로그인 · 회원가입";
  }
  $id("commentWrite").hidden = !currentUser;
  $id("commentLocked").hidden = !!currentUser;
}
function authSay(text, ok) {
  authMsg.textContent = text;
  authMsg.className = "auth__msg " + (ok ? "ok" : "err");
}
function openAuth(tab = "login") {
  if (!HAS_FIREBASE) { alert("아직 준비 중이에요."); return; }
  switchTab(tab);
  authSay("", true);
  authModal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeAuth() {
  authModal.hidden = true;
  if (modal.hidden) document.body.style.overflow = "";
}
function switchTab(tab) {
  document.querySelectorAll(".auth__tab").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === tab));
  $id("loginForm").hidden = tab !== "login";
  $id("signupForm").hidden = tab !== "signup";
  authSay("", true);
}
function authErrorText(code) {
  const map = {
    "auth/invalid-email": "이메일 형식이 올바르지 않아요.",
    "auth/email-already-in-use": "이미 가입된 이메일이에요. 로그인해 주세요.",
    "auth/weak-password": "비밀번호는 6자 이상이어야 해요.",
    "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않아요.",
    "auth/wrong-password": "이메일 또는 비밀번호가 맞지 않아요.",
    "auth/user-not-found": "가입되지 않은 이메일이에요.",
    "auth/too-many-requests": "시도가 너무 많아요. 잠시 후 다시 해주세요.",
    "auth/network-request-failed": "인터넷 연결을 확인해 주세요.",
  };
  return map[code] || "문제가 생겼어요. 다시 시도해 주세요.";
}

document.querySelectorAll(".auth__tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
$id("authClose").addEventListener("click", closeAuth);
$id("authBackdrop").addEventListener("click", closeAuth);
$id("commentLoginBtn").addEventListener("click", () => openAuth("login"));

memberBtn.addEventListener("click", async () => {
  if (currentUser) {
    if (!confirm("로그아웃할까요?")) return;
    const { auth, au } = await fb();
    await au.signOut(auth);
  } else {
    openAuth("login");
  }
});

$id("loginSubmit").addEventListener("click", async () => {
  const email = $id("loginEmail").value.trim();
  const pw = $id("loginPw").value;
  if (!email || !pw) return authSay("이메일과 비밀번호를 입력해 주세요.", false);
  try {
    const { auth, au } = await fb();
    await au.signInWithEmailAndPassword(auth, email, pw);
    authSay("로그인됐어요!", true);
    setTimeout(closeAuth, 500);
  } catch (e) { authSay(authErrorText(e.code), false); }
});

$id("signupSubmit").addEventListener("click", async () => {
  const name = $id("signName").value.trim();
  const email = $id("signEmail").value.trim();
  const pw = $id("signPw").value;
  const pw2 = $id("signPw2").value;
  if (!name) return authSay("이름을 입력해 주세요.", false);
  if (!email) return authSay("이메일을 입력해 주세요.", false);
  if (pw.length < 6) return authSay("비밀번호는 6자 이상이어야 해요.", false);
  if (pw !== pw2) return authSay("비밀번호가 서로 달라요.", false);
  try {
    const { auth, au, db, fs } = await fb();
    const cred = await au.createUserWithEmailAndPassword(auth, email, pw);
    await au.updateProfile(cred.user, { displayName: name });
    await fs.setDoc(fs.doc(db, "users", cred.user.uid), {
      name, email: cred.user.email, createdAt: fs.serverTimestamp(),
    });
    currentUser = auth.currentUser;
    refreshMemberUI();
    authSay("가입을 환영해요! 🎉", true);
    setTimeout(closeAuth, 700);
  } catch (e) { authSay(authErrorText(e.code), false); }
});

$id("resetPwBtn").addEventListener("click", async () => {
  const email = $id("loginEmail").value.trim();
  if (!email) return authSay("위 칸에 가입한 이메일을 먼저 적어주세요.", false);
  try {
    const { auth, au } = await fb();
    await au.sendPasswordResetEmail(auth, email);
    authSay("비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.", true);
  } catch (e) { authSay(authErrorText(e.code), false); }
});

async function watchAuth() {
  if (!HAS_FIREBASE) { refreshMemberUI(); return; }
  const { auth, au } = await fb();
  au.onAuthStateChanged(auth, (u) => {
    currentUser = u;
    refreshMemberUI();
    if (!modal.hidden && openNoticeId) loadComments(openNoticeId);
  });
}

// ============================================
//  댓글
// ============================================
let openNoticeId = null;

function fmtTime(ts) {
  try {
    const d = ts && ts.toDate ? ts.toDate() : new Date();
    return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch { return ""; }
}

async function loadComments(noticeId) {
  const list = $id("commentList");
  const countEl = $id("commentCount");
  if (!HAS_FIREBASE) {
    list.innerHTML = `<p class="comments__empty">댓글은 준비 중이에요.</p>`;
    countEl.textContent = "";
    return;
  }
  list.innerHTML = `<p class="comments__empty">불러오는 중…</p>`;
  try {
    const { db, fs } = await fb();
    const snap = await fs.getDocs(fs.query(
      fs.collection(db, "notices", noticeId, "comments"),
      fs.orderBy("createdAt", "asc"),
      fs.limit(100)
    ));
    if (openNoticeId !== noticeId) return;   // 그사이 다른 공지를 열었으면 무시
    list.innerHTML = "";
    countEl.textContent = snap.size ? snap.size : "";
    if (snap.empty) {
      list.innerHTML = `<p class="comments__empty">첫 댓글을 남겨보세요 🌱</p>`;
      return;
    }
    snap.forEach((c) => {
      const d = c.data();
      const el = document.createElement("div");
      el.className = "comment";
      const mine = currentUser && d.uid === currentUser.uid;
      el.innerHTML = `
        <div class="comment__head">
          <span class="comment__name"></span>
          <span><span class="comment__date">${fmtTime(d.createdAt)}</span>${mine ? '<button class="comment__del">삭제</button>' : ""}</span>
        </div>
        <div class="comment__text"></div>`;
      el.querySelector(".comment__name").textContent = d.name || "회원";
      el.querySelector(".comment__text").textContent = d.text || "";
      if (mine) {
        el.querySelector(".comment__del").addEventListener("click", async () => {
          if (!confirm("내 댓글을 삭제할까요?")) return;
          try {
            await fs.deleteDoc(fs.doc(db, "notices", noticeId, "comments", c.id));
            loadComments(noticeId);
          } catch (e) { alert("삭제하지 못했어요."); }
        });
      }
      list.appendChild(el);
    });
  } catch (e) {
    console.warn("[공지앱] 댓글 불러오기 실패:", e.message);
    list.innerHTML = `<p class="comments__empty">댓글을 불러오지 못했어요.</p>`;
  }
}

$id("commentSubmit").addEventListener("click", async () => {
  if (!currentUser) return openAuth("login");
  const input = $id("commentInput");
  const text = input.value.trim();
  if (!text) return;
  if (!openNoticeId) return;
  const btn = $id("commentSubmit");
  btn.disabled = true;
  try {
    const { db, fs } = await fb();
    await fs.addDoc(fs.collection(db, "notices", openNoticeId, "comments"), {
      uid: currentUser.uid,
      name: displayNameOf(currentUser).slice(0, 30),
      text: text.slice(0, 500),
      createdAt: fs.serverTimestamp(),
    });
    input.value = "";
    loadComments(openNoticeId);
  } catch (e) {
    alert("댓글을 등록하지 못했어요. 잠시 후 다시 해주세요.");
  } finally {
    btn.disabled = false;
  }
});

loadNotices();
watchAuth();

// ---------- PWA 서비스워커 ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- 설치 힌트 (아이폰 사파리) ----------
(function installHint() {
  const hint = document.getElementById("installHint");
  const closeBtn = document.getElementById("installHintClose");
  const hintText = document.getElementById("installHintText");
  if (!hint) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const dismissed = localStorage.getItem("installHintDismissed");

  if (isIOS && !isStandalone && !dismissed) {
    hintText.textContent = "공유 버튼 → '홈 화면에 추가'로 앱처럼 쓸 수 있어요";
    setTimeout(() => { hint.hidden = false; }, 2000);
  }

  closeBtn?.addEventListener("click", () => {
    hint.hidden = true;
    localStorage.setItem("installHintDismissed", "1");
  });

  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!dismissed) {
      hintText.textContent = "홈 화면에 추가하면 앱처럼 쓸 수 있어요";
      hint.hidden = false;
      hint.style.cursor = "pointer";
      hint.addEventListener("click", async (ev) => {
        if (ev.target === closeBtn) return;
        hint.hidden = true;
        deferredPrompt.prompt();
        deferredPrompt = null;
      });
    }
  });
})();
