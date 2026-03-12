// CURTIS Service Worker
// Strategy: network-first for navigation, cache-first for static assets,
//            offline.html fallback when navigation fails.

const CACHE_NAME    = "curtis-v1";
const OFFLINE_URL   = "/offline.html";

// ─── INSTALL ──────────────────────────────────────────────────────────────────
// Pre-cache only the offline fallback page — everything else is fetched live.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
// Delete stale caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith("curtis-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== "GET") return;

  // Skip cross-origin requests (Supabase, API-Football, fonts, etc.)
  if (!request.url.startsWith(self.location.origin)) return;

  // ── Navigation (page loads) ─────────────────────────────────────────────
  // Network first — if offline, serve the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) => cached ?? new Response("Offline", { status: 503 })
        )
      )
    );
    return;
  }

  // ── Static assets (JS chunks, CSS, images, fonts) ──────────────────────
  // Cache first — stale assets are OK; Next.js busts with content hashes.
  const url = new URL(request.url);
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|otf)$/);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            // Only cache successful responses.
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else: plain network (API routes, Supabase calls, etc.)
});
