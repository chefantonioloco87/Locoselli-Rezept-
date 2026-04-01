/* ═══════════════════════════════════════════════
   LOCOSELLI — sw.js (Service Worker)
   Cache-first per asset, network-first per pagine
   ═══════════════════════════════════════════════ */

const CACHE_NAME = "locoselli-v1";
const CORE_ASSETS = [
  "/app-ricette-Loco/",
  "/app-ricette-Loco/index.html",
  "/app-ricette-Loco/style.css",
  "/app-ricette-Loco/app.js",
  "/app-ricette-Loco/search_index.json",
  "/app-ricette-Loco/logo.PNG",
  "/app-ricette-Loco/logo-apple.png",
  "/app-ricette-Loco/manifest.json"
];

/* Install: cache core assets */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/* Activate: clean old caches */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch strategy:
   - Core assets (CSS, JS, images, JSON) → cache-first
   - HTML pages → network-first (fallback to cache)
   - External requests (GitHub API) → network only
*/
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Skip non-GET and external requests
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  const isPage = event.request.headers.get("accept")?.includes("text/html") ||
                 url.pathname.endsWith(".html");

  if (isPage) {
    // Network-first for HTML pages
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for assets
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
