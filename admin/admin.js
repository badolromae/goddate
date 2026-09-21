// ============================================
//  관리자 페이지 로직
//  - Firebase 로그인(관리자만)
//  - 공지 작성 / 수정 / 삭제
//  - 사진 파일 업로드 (Firebase Storage)
// ============================================

const CONFIG = window.APP_CONFIG || {};
const hasFirebase =
  CONFIG.firebase &&
  CONFIG.firebase.projectId &&
  CONFIG.firebase.projectId !== "YOUR_PROJECT_ID";

const $ = (id) => document.getElementById(id);

if (!hasFirebase) {
  $("demoWarn").classList.remove("hidden");
}

$("nDate").value = new Date().toISOString().slice(0, 10);

function showMsg(el, text, ok) {
  el.className = "msg " + (ok ? "ok" : "err");
  el.textContent = text;
}

// 지금 수정 중인 공지 정보 (없으면 새 글 작성)
let editingId = null;
let editingImageUrl = "";
let pickedFile = null;

async function start() {
  if (!hasFirebase) {
    $("loginBtn").addEventListener("click", () =>
      showMsg($("loginMsg"), "Firebase 연결 후 사용할 수 있어요.", false)
    );
    return;
  }

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
          setPersistence, browserLocalPersistence, browserSessionPersistence } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const {
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
    getDocs, query, orderBy, serverTimestamp, getDoc,
    where, documentId,
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } =
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");

  const app = initializeApp(CONFIG.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      $("loginPanel").classList.add("hidden");
      $("adminPanel").classList.remove("hidden");
      loadList();
      loadSummaryStats();
    } else {
      $("loginPanel").classList.remove("hidden");
      $("adminPanel").classList.add("hidden");
    }
  });

  $("loginBtn").addEventListener("click", async () => {
    const email = $("email").value.trim();
    const pw = $("password").value;
    const keep = $("keepLogin").checked;
    if (!email || !pw) return showMsg($("loginMsg"), "이메일과 비밀번호를 입력하세요.", false);
    try {
      // 자동 로그인 체크 → 이 기기에 계속 로그인 유지(local)
      // 체크 안 함 → 창/앱을 닫으면 자동 로그아웃(session)
      await setPersistence(auth, keep ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
      showMsg($("loginMsg"), "로그인에 실패했어요. 정보를 확인해주세요.", false);
    }
  });

  $("logoutBtn").addEventListener("click", () => signOut(auth));

  // 사진 파일 고르면 미리보기
  $("nImageFile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    pickedFile = file || null;
    const box = $("imgPreview");
    if (!file) { box.innerHTML = editingImageUrl ? previewImg(editingImageUrl) : ""; return; }
    box.innerHTML = previewImg(URL.createObjectURL(file));
  });

  function previewImg(src) {
    return `<img src="${src}" alt="미리보기" style="max-width:100%;border-radius:14px;border:2px solid #e5ddcb;" />`;
  }

  async function uploadImage(file) {
    const safeName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "");
    const storageRef = ref(storage, "notices/" + safeName);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  $("saveBtn").addEventListener("click", async () => {
    const title = $("nTitle").value.trim();
    const body = $("nBody").value.trim();
    const date = $("nDate").value;
    const pinned = $("nPinned").checked;
    const links = collectLinks();

    if (!title || !body) return showMsg($("saveMsg"), "제목과 내용을 입력하세요.", false);

    $("saveBtn").disabled = true;
    showMsg($("saveMsg"), pickedFile ? "사진을 올리는 중이에요…" : "저장하는 중이에요…", true);

    try {
      let imageUrl = editingImageUrl;
      if (pickedFile) imageUrl = await uploadImage(pickedFile);

      if (editingId) {
        await updateDoc(doc(db, "notices", editingId), {
          title, body, imageUrl, links, date, pinned, updatedAt: serverTimestamp(),
        });
        showMsg($("saveMsg"), "공지를 수정했어요! ✏️", true);
      } else {
        await addDoc(collection(db, "notices"), {
          title, body, imageUrl, links, date, pinned, createdAt: serverTimestamp(),
        });
        showMsg($("saveMsg"), "공지를 올렸어요! 🎉", true);
      }
      resetForm();
      loadList();
    } catch (e) {
      showMsg($("saveMsg"), "저장에 실패했어요: " + e.message, false);
    } finally {
      $("saveBtn").disabled = false;
    }
  });

  // 링크 입력칸에서 제목+주소가 둘 다 있는 것만 모으기
  function collectLinks() {
    const titles = document.querySelectorAll(".linkTitle");
    const urls = document.querySelectorAll(".linkUrl");
    const links = [];
    for (let i = 0; i < titles.length; i++) {
      const t = titles[i].value.trim();
      let u = urls[i].value.trim();
      if (t && u) {
        if (!/^https?:\/\//i.test(u)) u = "https://" + u;  // http 빠뜨려도 보정
        links.push({ title: t, url: u });
      }
    }
    return links;
  }
  // 링크 입력칸 채우기 / 비우기
  function fillLinks(links) {
    const titles = document.querySelectorAll(".linkTitle");
    const urls = document.querySelectorAll(".linkUrl");
    titles.forEach((el) => (el.value = ""));
    urls.forEach((el) => (el.value = ""));
    (links || []).forEach((lk, i) => {
      if (titles[i]) titles[i].value = lk.title || "";
      if (urls[i]) urls[i].value = lk.url || "";
    });
  }

  $("cancelEditBtn").addEventListener("click", resetForm);

  function resetForm() {
    editingId = null;
    editingImageUrl = "";
    pickedFile = null;
    $("nTitle").value = "";
    $("nBody").value = "";
    $("nImageFile").value = "";
    $("nPinned").checked = false;
    $("nDate").value = new Date().toISOString().slice(0, 10);
    $("imgPreview").innerHTML = "";
    fillLinks([]);
    $("formTitle").textContent = "새 공지 쓰기 ✍️";
    $("saveBtn").textContent = "공지 올리기";
    $("cancelEditBtn").style.display = "none";
  }

  function fillFormForEdit(id, d) {
    editingId = id;
    editingImageUrl = d.imageUrl || "";
    pickedFile = null;
    $("nTitle").value = d.title || "";
    $("nBody").value = d.body || "";
    $("nDate").value = d.date || new Date().toISOString().slice(0, 10);
    $("nPinned").checked = !!d.pinned;
    $("nImageFile").value = "";
    $("imgPreview").innerHTML = editingImageUrl ? previewImg(editingImageUrl) : "";
    fillLinks(d.links || []);
    $("formTitle").textContent = "공지 수정 ✏️";
    $("saveBtn").textContent = "수정 완료";
    $("cancelEditBtn").style.display = "block";
    $("formTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
        const done = !!d.completed;
        const item = document.createElement("div");
        item.className = "notice-item" + (done ? " notice-item--done" : "");
        item.innerHTML = `
          <div style="flex:1;">
            <h3>${done ? "✅ " : ""}${d.pinned ? "📌 " : ""}${d.imageUrl ? "🖼️ " : ""}${escapeHtml(d.title)}</h3>
            <p class="meta">${escapeHtml(d.date || "")}${done ? " · 완료됨(유저 화면에서 숨김)" : ""}</p>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn-done">${done ? "완료 취소" : "완료"}</button>
            <button class="btn-edit">수정</button>
            <button class="btn-danger">삭제</button>
          </div>
        `;
        item.querySelector(".btn-done").addEventListener("click", async () => {
          try {
            await updateDoc(doc(db, "notices", docSnap.id), { completed: !done });
            loadList();
          } catch (e) {
            alert("처리에 실패했어요: " + e.message);
          }
        });
        item.querySelector(".btn-edit").addEventListener("click", () => fillFormForEdit(docSnap.id, d));
        item.querySelector(".btn-danger").addEventListener("click", async () => {
          if (!confirm("이 공지를 삭제할까요?")) return;
          try {
            if (d.imageUrl && d.imageUrl.includes("firebasestorage")) {
              try {
                const path = decodeURIComponent(d.imageUrl.split("/o/")[1].split("?")[0]);
                await deleteObject(ref(storage, path));
              } catch (_) {}
            }
            await deleteDoc(doc(db, "notices", docSnap.id));
            if (editingId === docSnap.id) resetForm();
            loadList();
          } catch (e) {
            alert("삭제에 실패했어요: " + e.message);
          }
        });
        listEl.appendChild(item);
      });
    } catch (e) {
      listEl.textContent = "목록을 불러오지 못했어요: " + e.message;
    }
  }

  // ================= 방문 · 조회 통계 =================
  function pad2(n) { return String(n).padStart(2, "0"); }
  function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  // 오늘 요약 카드 (로그인 직후 자동 표시)
  async function loadSummaryStats() {
    const today = ymd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    try {
      const snap = await getDoc(doc(db, "stats_daily", today));
      const v = snap.exists() ? (snap.data().visitors || 0) : 0;
      const r = snap.exists() ? (snap.data().reads || 0) : 0;
      $("todayVisitors").textContent = v;
      $("todayReads").textContent = r;
    } catch (e) {
      $("todayVisitors").textContent = "-";
      $("todayReads").textContent = "-";
    }
  }

  // 특정 기간(연/월) 통계 검색
  async function searchStats(year, month) {
    const resultEl = $("statsResult");
    resultEl.innerHTML = "불러오는 중…";
    try {
      let startId, endId, groupByMonth;
      if (month) {
        // 특정 달의 하루하루
        startId = ymd(year, month, 1);
        endId = ymd(year, month, daysInMonth(year, month));
        groupByMonth = false;
      } else {
        // 한 해의 달별 합계
        startId = ymd(year, 1, 1);
        endId = ymd(year, 12, 31);
        groupByMonth = true;
      }

      const q = query(
        collection(db, "stats_daily"),
        where(documentId(), ">=", startId),
        where(documentId(), "<=", endId)
      );
      const snap = await getDocs(q);

      let totalV = 0, totalR = 0;
      const rows = {}; // key: date 또는 "YYYY-MM" → {v,r}
      snap.forEach((d) => {
        const data = d.data();
        const v = data.visitors || 0, r = data.reads || 0;
        totalV += v; totalR += r;
        const key = groupByMonth ? d.id.slice(0, 7) : d.id;
        if (!rows[key]) rows[key] = { v: 0, r: 0 };
        rows[key].v += v; rows[key].r += r;
      });

      const keys = Object.keys(rows).sort();
      let html = `
        <div class="stats-total">
          <b>${month ? `${year}년 ${month}월` : `${year}년`} 합계</b>
          <span>👀 방문자 ${totalV}명 · 📖 읽은 횟수 ${totalR}회</span>
        </div>`;

      if (keys.length === 0) {
        html += `<p class="stats-empty">해당 기간에 기록된 데이터가 없어요.</p>`;
      } else {
        html += `<table class="stats-table"><thead><tr>
          <th>${groupByMonth ? "월" : "날짜"}</th><th>방문자</th><th>읽은 횟수</th>
        </tr></thead><tbody>`;
        keys.forEach((k) => {
          const label = groupByMonth ? k.slice(5, 7) + "월" : k;
          html += `<tr><td>${label}</td><td>${rows[k].v}</td><td>${rows[k].r}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
      resultEl.innerHTML = html;
    } catch (e) {
      resultEl.innerHTML = `<p class="stats-empty">불러오지 못했어요: ${e.message}</p>`;
    }
  }

  // 통계 패널 열기/닫기 + 검색 버튼 연결
  $("statsToggle")?.addEventListener("click", () => {
    const panel = $("statsPanel");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden") && !panel.dataset.loaded) {
      panel.dataset.loaded = "1";
      const now = new Date();
      $("statsYear").value = now.getFullYear();
      $("statsMonth").value = now.getMonth() + 1;
      searchStats(now.getFullYear(), now.getMonth() + 1);
    }
  });
  $("statsSearchBtn")?.addEventListener("click", () => {
    const year = parseInt($("statsYear").value, 10);
    const monthVal = $("statsMonth").value;
    const month = monthVal ? parseInt(monthVal, 10) : null;
    if (!year) return;
    searchStats(year, month);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

start();
