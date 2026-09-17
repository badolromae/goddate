// ============================================
//  관리자 앱 전용 서비스워커 (admin 폴더)
//  이 폴더(/admin/)만 담당해서 독립 앱으로 동작합니다.
// ============================================

const CACHE_NAME = "notice-admin-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.js",
  "./manifest.json",
  "../config.js",
  "../icons/admin-192.png",
  "../icons/admin-512.png",
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
  // Firebase/구글 요청은 항상 네트워크 (최신 데이터)
  if (url.includes("firestore") || url.includes("googleapis") ||
      url.includes("gstatic") || url.includes("firebasestorage")) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
