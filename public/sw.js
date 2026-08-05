/* Tally service worker.
 *
 * Scope is deliberately narrow: make the app shell open with no network. The
 * *data* is already offline-safe — it lives in localStorage and the store is
 * the source of truth — so this only has to guarantee that the HTML, JS and
 * CSS needed to boot are on the device.
 *
 * Strategy per request type:
 *   navigations  → network-first, falling back to the cached shell. A user on
 *                  a good connection always gets fresh markup; a user in a lift
 *                  still gets the app.
 *   static assets→ stale-while-revalidate. Instant paint, quiet refresh.
 *   API calls    → never touched. A cached POST would be a lie, and reads must
 *                  not serve stale money figures behind the store's back.
 */

const VERSION = "tally-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]))
      // A failed precache must not block activation — the app still works,
      // it just won't open offline until the first successful navigation.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only; never intercept the API or any third party.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(OFFLINE_URL, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  const isAsset =
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(css|js|woff2?|png|svg|jpg|jpeg|webp|ico)$/.test(url.pathname);

  if (!isAsset) return;

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);

      // Serve what we have immediately; refresh in the background.
      return cached || network;
    })
  );
});

// Lets the page ask a waiting worker to take over straight away.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
