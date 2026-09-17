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
      // 목록이 너무 길어지지 않게 최근 300개만 유지
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-300)));
    }
  } catch {}
}
// 화면에 보인 공지는 모두 '봤음'으로 처리 → 배너 갱신
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

  // 상단 '새 공지 N개' 배너 갱신
  updateNewBar(unseenCount);

  // 목록을 본 시점에 배너를 눌러 '모두 읽음' 할 수 있게 연결
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
// innerHTML을 쓰지 않고 노드로 직접 구성해 안전합니다.
function linkify(text, container) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  let lastIndex = 0;
  let match;
  const src = text || "";
  while ((match = urlRegex.exec(src)) !== null) {
    // 링크 앞의 일반 글자
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(src.slice(lastIndex, match.index)));
    }
    let url = match[0];
    // 주소 끝에 붙은 문장부호는 링크에서 제외
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
  // 마지막 남은 글자
  if (lastIndex < src.length) {
    container.appendChild(document.createTextNode(src.slice(lastIndex)));
  }
}

// ---------- 모달 ----------
function openModal(n, cardEl) {
  // 이 공지를 '읽음'으로 표시하고 화면 갱신
  markSeen(n.id);
  if (cardEl) {
    cardEl.classList.remove("card--unseen");
    cardEl.querySelector(".card__dot")?.remove();
  }
  // 남은 안 읽은 공지 개수로 배너 갱신
  const remaining = document.querySelectorAll(".card--unseen").length;
  updateNewBar(remaining);

  modalDate.textContent = formatDate(n.date);
  modalTitle.textContent = n.title;

  // 본문 영역 초기화 후 안전하게 구성 (사진 → 글 → 링크 버튼)
  modalBody.innerHTML = "";

  if (n.imageUrl) {
    const img = document.createElement("img");
    img.src = n.imageUrl;              // Firebase 다운로드 주소를 그대로 사용
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => { img.style.display = "none"; };
    modalBody.appendChild(img);
  }

  const textEl = document.createElement("div");
  textEl.className = "modal__text";
  linkify(n.body, textEl);   // 줄바꿈 유지 + 본문 속 주소도 링크로
  modalBody.appendChild(textEl);

  // 링크 버튼들 (관리자가 넣은 제목+주소)
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
        imageUrl: d.imageUrl || "",
        links: Array.isArray(d.links) ? d.links : [],
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
