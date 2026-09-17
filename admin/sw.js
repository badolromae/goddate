// ============================================
//  서비스워커 — 앱 껍데기를 캐싱해서
//  빠르게 열리고 오프라인에서도 뜨게 합니다.
//  (공지 데이터는 항상 최신을 불러옵니다)
// ============================================

const CACHE_NAME = "notice-app-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // 관리자 앱(/admin/)은 자기 서비스워커가 따로 담당하므로 손대지 않음
  if (url.includes("/admin/")) return;

  // Firebase/구글 요청은 항상 네트워크 (최신 공지)
  if (url.includes("firestore") || url.includes("googleapis") || url.includes("gstatic")) {
    return;
  }

  // 앱 껍데기는 캐시 우선
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
