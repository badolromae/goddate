// ============================================
//  관리자 페이지 로직
//  - Firebase 로그인(관리자만)
//  - 공지 작성 / 삭제
// ============================================

const CONFIG = window.APP_CONFIG || {};
const hasFirebase =
  CONFIG.firebase &&
  CONFIG.firebase.projectId &&
  CONFIG.firebase.projectId !== "YOUR_PROJECT_ID";

const $ = (id) => document.getElementById(id);

// 데모(미연결) 상태 안내
if (!hasFirebase) {
  $("demoWarn").classList.remove("hidden");
}

// 오늘 날짜 기본값
$("nDate").value = new Date().toISOString().slice(0, 10);

function showMsg(el, text, ok) {
  el.className = "msg " + (ok ? "ok" : "err");
  el.textContent = text;
}

async function start() {
  if (!hasFirebase) {
    // 데모 모드: 버튼 눌러도 안내만
    $("loginBtn").addEventListener("click", () =>
      showMsg($("loginMsg"), "Firebase 연결 후 사용할 수 있어요.", false)
    );
    return;
  }

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const {
    getFirestore, collection, addDoc, deleteDoc, doc,
    getDocs, query, orderBy, serverTimestamp,
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  const app = initializeApp(CONFIG.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // 로그인 상태 감지
  onAuthStateChanged(auth, (user) => {
    if (user) {
      $("loginPanel").classList.add("hidden");
      $("adminPanel").classList.remove("hidden");
      loadList();
    } else {
      $("loginPanel").classList.remove("hidden");
      $("adminPanel").classList.add("hidden");
    }
  });

  // 로그인
  $("loginBtn").addEventListener("click", async () => {
    const email = $("email").value.trim();
    const pw = $("password").value;
    if (!email || !pw) return showMsg($("loginMsg"), "이메일과 비밀번호를 입력하세요.", false);
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
      showMsg($("loginMsg"), "로그인에 실패했어요. 정보를 확인해주세요.", false);
    }
  });

  // 로그아웃
  $("logoutBtn").addEventListener("click", () => signOut(auth));

  // 공지 저장
  $("saveBtn").addEventListener("click", async () => {
    const title = $("nTitle").value.trim();
    const body = $("nBody").value.trim();
    const imageUrl = $("nImage").value.trim();
    const date = $("nDate").value;
    const pinned = $("nPinned").checked;

    if (!title || !body) return showMsg($("saveMsg"), "제목과 내용을 입력하세요.", false);

    try {
      await addDoc(collection(db, "notices"), {
        title, body, imageUrl, date, pinned,
        createdAt: serverTimestamp(),
      });
      showMsg($("saveMsg"), "공지를 올렸어요! 🎉", true);
      $("nTitle").value = "";
      $("nBody").value = "";
      $("nImage").value = "";
      $("imgPreview").innerHTML = "";
      $("nPinned").checked = false;
      loadList();
    } catch (e) {
      showMsg($("saveMsg"), "저장에 실패했어요: " + e.message, false);
    }
  });

  // 목록 로드
  async function loadList() {
    const listEl = $("list");
    listEl.textContent = "불러오는 중…";
    try {
      const q = query(collection(db, "notices"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      if (snap.empty) { listEl.textContent = "아직 올린 공지가 없어요."; return; }

      listEl.innerHTML = "";
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const item = document.createElement("div");
        item.className = "notice-item";
        item.innerHTML = `
          <div>
            <h3>${d.pinned ? "📌 " : ""}${d.imageUrl ? "🖼️ " : ""}${escapeHtml(d.title)}</h3>
            <p class="meta">${escapeHtml(d.date || "")}</p>
          </div>
          <button class="btn-danger">삭제</button>
        `;
        item.querySelector("button").addEventListener("click", async () => {
          if (!confirm("이 공지를 삭제할까요?")) return;
          await deleteDoc(doc(db, "notices", docSnap.id));
          loadList();
        });
        listEl.appendChild(item);
      });
    } catch (e) {
      listEl.textContent = "목록을 불러오지 못했어요: " + e.message;
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- 사진 주소 미리보기 ----------
// 관리자가 이미지 주소를 붙여넣으면 바로 미리 보여줍니다.
(function imagePreview() {
  const input = $("nImage");
  const box = $("imgPreview");
  if (!input || !box) return;

  function update() {
    const url = input.value.trim();
    if (!url) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <img src="${encodeURI(url)}" alt="미리보기"
        style="max-width:100%;border-radius:14px;border:2px solid #e5ddcb;"
        onload="this.nextElementSibling.style.display='none'"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
      <p style="display:none;font-size:14px;color:#b93b3b;margin-top:6px;">
        ⚠️ 이 주소로는 사진이 안 보여요. 이미지 링크가 맞는지 확인해주세요.
      </p>`;
  }
  input.addEventListener("input", update);
  input.addEventListener("blur", update);
})();

start();
