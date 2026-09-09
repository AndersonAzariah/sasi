/* ============================================================
   SASI service worker — the offline shell.
   ------------------------------------------------------------
   What it does (honestly):
   - Keeps an app-shell cache so the SPA reloads with NO network
     (cached HTML + hashed static chunks + icons).
   - Dev mode (registered with ?mode=dev): everything is
     network-first so HMR never serves stale code — offline
     fallback still works.
   - Prod mode: /_next/static is cache-first (content-hashed,
     immutable); navigation is network-first with cache +
     offline fallback.
   - /api/* is NEVER cached: civic data and AI answers must not
     be silently replayed from a cache when the network is gone.
     The app's own honest error states handle offline API calls.
   ============================================================ */

const VERSION = "v3";
const SHELL_CACHE = `sasi-shell-${VERSION}`;
const STATIC_CACHE = `sasi-static-${VERSION}`;

/* precached at install — the minimum to boot with no network */
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/sasi-icon-192.png",
  "/sasi-icon-512.png",
  "/sasi-icon-maskable-512.png",
  "/favicon-32.png",
];

/* dev mode = registered with ?mode=dev → network-first everywhere */
const IS_DEV = new URL(self.registration.scope).searchParams.get("mode") === "dev"
  || new URLSearchParams(self.location.search).get("mode") === "dev";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      /* individually — one 404 must not fail the whole install */
      await Promise.all(
        PRECACHE_URLS.map((u) =>
          cache.add(new Request(u, { cache: "reload" })).catch(() => undefined)
        )
      );
      /* activate immediately — the shell is ready to take over */
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      /* drop every cache that is not the current version */
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("sasi-") && k !== SHELL_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    /* the user accepted the update toast → swap in the new worker now */
    self.skipWaiting();
  }
});

/** cache-first for immutable hashed assets */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

/** network-first with cache + offline-shell fallback for navigations */
async function networkFirstNav(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put("/", res.clone()); // keyed at "/" so the fallback is stable
    return res;
  } catch {
    const hit = (await cache.match(request)) || (await cache.match("/"));
    if (hit) return hit;
    return new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>SASI — offline</title><body style=\"background:#050505;color:#a1a1aa;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0\"><p style=\"text-align:center;padding:24px\">SASI could not reach the network and this device has no cached copy yet.<br>Reconnect once and the offline shell will be saved.</p></body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

/** network-first for anything else cacheable (dev-safe) */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error("offline and not cached");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // POSTs (reports, chats, briefings) always hit the network
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: browser handles it

  /* never cache the API — data must be live or honestly failed */
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNav(request));
    return;
  }

  if (IS_DEV) {
    /* network-first in dev so HMR chunks are always fresh */
    event.respondWith(
      networkFirst(request, STATIC_CACHE).catch(
        () => new Response("", { status: 504 })
      )
    );
    return;
  }

  /* prod: hashed immutable assets → cache-first; everything else stale-while-revalidate-ish */
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  event.respondWith(
    networkFirst(request, STATIC_CACHE).catch(() => new Response("", { status: 504 }))
  );
});
