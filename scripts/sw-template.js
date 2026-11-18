/**
 * Service worker source. The build id and the precache list are substituted in
 * by the pwa() plugin in vite.config.js — this file is never served as-is, and
 * editing dist/sw.js directly will be overwritten by the next build.
 *
 * Why hand-written rather than Workbox: the app is one HTML file, one JS
 * bundle, one stylesheet and four icons. The whole caching policy fits on a
 * screen, and for a tool parents may rely on at 3 a.m. with no signal, being
 * able to read every line of what decides "is this cached or not" is worth
 * more than the features a generated worker would add.
 */

const BUILD_ID = "__BUILD_ID__";
/** The path the app is served from, with a trailing slash. */
const BASE = __BASE__;
const CACHE = `ba-stool-${BUILD_ID}`;
const PRECACHE = __PRECACHE__;

/** How long to wait for the network on a navigation before serving the shell. */
const NAVIGATION_TIMEOUT_MS = 3000;

/**
 * Every cache lookup ignores Vary, and it has to.
 *
 * Vite marks its module script and stylesheet `crossorigin`, so the browser
 * sends those requests in CORS mode with an `Origin` header. The precache
 * requests this worker issues are plain same-origin fetches and carry no
 * `Origin`. When the server attaches `Vary: Origin` to a response — vite
 * preview does, and many static hosts do — the stored and incoming requests
 * disagree on a header named in Vary, so `cache.match` misses and the asset
 * falls through to a network that is not there.
 *
 * The failure is invisible online and total offline: the shell loads from
 * cache and then renders nothing, because its script and stylesheet are the
 * two files `crossorigin` applies to. Ignoring Vary is safe here — every
 * cached URL is either the shell or a content-hashed asset, so one URL has
 * exactly one correct body regardless of request headers.
 */
const MATCH_OPTIONS = { ignoreVary: true };

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // `reload` bypasses the HTTP cache so a precache can never pick up a
      // stale copy of a file the browser happens to be holding.
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })))
    )
  );
  // Deliberately NOT skipWaiting(). A new worker taking over mid-measurement
  // would swap the JS under a parent who is part-way through tapping the white
  // paper and the stool, losing that capture. The page asks the user instead,
  // and only when they are not in the middle of a reading — see src/lib/pwa.js.
});

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("ba-stool-") && n !== CACHE)
          .map((n) => caches.delete(n))
      );
      // Navigation preload shaves the worker startup off the first request.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable, and anything cross-origin is left alone — the app
  // makes no third-party requests, so a cross-origin GET here is not ours.
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  event.respondWith(cacheFirst(request));
});

/**
 * Navigation: network first, shell second.
 *
 * Network-first means a fresh deploy is picked up on the next launch rather
 * than whenever the worker happens to update. The timeout matters because a
 * connection that is present but useless (hospital wifi, a captive portal) is
 * worse than no connection at all — without it the app would hang rather than
 * fall back to the cached shell it already has.
 */
async function handleNavigation(event) {
  const cache = await caches.open(CACHE);

  try {
    const preloaded = await event.preloadResponse;
    if (preloaded && preloaded.ok) {
      cache.put(`${BASE}index.html`, preloaded.clone());
      return preloaded;
    }

    const response = await withTimeout(fetch(event.request), NAVIGATION_TIMEOUT_MS);
    if (response && response.ok) {
      cache.put(`${BASE}index.html`, response.clone());
      return response;
    }
  } catch {
    // Fall through to the cached shell.
  }

  return (
    (await cache.match(`${BASE}index.html`, MATCH_OPTIONS)) ||
    (await cache.match(BASE, MATCH_OPTIONS)) ||
    new Response(
      "<!doctype html><meta charset=utf-8><p>離線中，且尚未快取此頁。請連線後重新開啟。",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
    )
  );
}

/**
 * Assets: cache first.
 *
 * Vite gives every bundle a content hash, so a cached asset URL can never be
 * stale — a changed file is a different URL. Anything fetched that is not
 * already precached (an icon, say) is added on the way past.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, MATCH_OPTIONS);
  if (hit) return hit;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await cache.match(request, {
      ...MATCH_OPTIONS,
      ignoreSearch: true,
    });
    if (fallback) return fallback;
    throw error;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("network timeout")), ms)
    ),
  ]);
}

// ── Update handshake ─────────────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "GET_BUILD_ID") {
    event.ports[0]?.postMessage({ buildId: BUILD_ID, base: BASE });
  }
});
