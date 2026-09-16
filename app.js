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
  },
  {
    id: "demo-2",
    title: "9월 모임 안내",
    body: "이번 달 모임은 9월 28일 토요일 오후 2시에 진행됩니다.\n\n장소와 준비물은 네이버 카페 게시판에서 확인해주세요. 많은 참여 부탁드려요!",
    date: "2026-09-12",
    pinned: false,
  },
  {
    id: "demo-3",
    title: "카페 이용 안내",
    body: "소통은 네이버 카페에서 이루어집니다. 아래 버튼을 눌러 카페에 가입하시면 다양한 이야기를 함께 나눌 수 있어요.\n\n앱에서는 공지를, 카페에서는 대화를 — 이렇게 나눠서 편하게 이용해주세요 💙",
    date: "2026-09-08",
    pinned: false,
  },
];

// ---------- 설정 읽기 ----------
const CONFIG = window.APP_CONFIG || {};
const CAFE_URL = CONFIG.cafeUrl || "https://cafe.naver.com";
const FOOTER_TEXT = CONFIG.footerText || "사랑을 담아 전합니다";

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

cafeBtn.href = CAFE_URL;
footerText.textContent = FOOTER_TEXT;

// ---------- 날짜 포맷 ----------
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

// ---------- 공지 렌더링 ----------
function renderNotices(notices) {
  skeleton?.remove();

  if (!notices || notices.length === 0) {
    board.innerHTML = `
      <div class="empty">
        <span class="empty__emoji">🌱</span>
        <p class="empty__text">아직 등록된 공지가 없어요.<br>곧 첫 소식을 전해드릴게요!</p>
      </div>`;
    return;
  }

  // 고정 공지 먼저, 그다음 최신순
  notices.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.date) - new Date(a.date);
  });

  board.innerHTML = "";
  notices.forEach((n) => {
    const card = document.createElement("article");
    card.className = "card" + (isNew(n.date) ? " card--new" : "");
    card.innerHTML = `
      ${isNew(n.date) ? '<span class="card__ribbon">NEW</span>' : ""}
      ${n.pinned ? '<span class="card__pin">📌</span>' : ""}
      <p class="card__date">${formatDate(n.date)}</p>
      <h2 class="card__title">${escapeHtml(n.title)}</h2>
      <p class="card__preview">${escapeHtml(stripToText(n.body))}</p>
      <span class="card__more">자세히 보기 →</span>
    `;
    card.addEventListener("click", () => openModal(n));
    board.appendChild(card);
  });
}

function stripToText(body) {
  return (body || "").replace(/<[^>]*>/g, "").replace(/\n/g, " ");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- 모달 ----------
function openModal(n) {
  modalDate.textContent = formatDate(n.date);
  modalTitle.textContent = n.title;
  // 본문: 줄바꿈 유지, HTML 태그는 escape (안전)
  modalBody.textContent = n.body;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}
modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ---------- 데이터 로드 ----------
async function loadNotices() {
  const hasFirebase =
    CONFIG.firebase &&
    CONFIG.firebase.projectId &&
    CONFIG.firebase.projectId !== "YOUR_PROJECT_ID";

  if (!hasFirebase) {
    // 데모 모드
    console.info("[공지앱] Firebase 미설정 → 데모 데이터로 실행 중입니다. config.js 를 채우면 클라우드와 연결됩니다.");
    setTimeout(() => renderNotices(DEMO_NOTICES), 500);
    return;
  }

  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const { getFirestore, collection, getDocs, query, orderBy } =
      await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    const fbApp = initializeApp(CONFIG.firebase);
    const db = getFirestore(fbApp);

    const q = query(collection(db, "notices"), orderBy("date", "desc"));
    const snap = await getDocs(q);

    const notices = [];
    snap.forEach((doc) => {
      const d = doc.data();
      notices.push({
        id: doc.id,
        title: d.title || "(제목 없음)",
        body: d.body || "",
        date: d.date || "",
        pinned: !!d.pinned,
      });
    });

    renderNotices(notices);
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

loadNotices();

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

  // 안드로이드/크롬 설치 프롬프트
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
