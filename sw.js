const CACHE = "1042-pwa-v108";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa.js",
  "/js/langTabs.css",
  "/js/langTabs.js",
  "/js/accountChrome.js",
  "/js/accountChrome.css",
  "/js/device.js",
  "/js/featurePage.css",
  "/js/featurePage.css?v=3",
  "/js/geoDisplay.js?v=3",
  "/game/css/userBar.css?v=7",
  "/game/",
  "/game/index.html",
  "/game/css/hub.css?v=8",
  "/game/js/hub.js?v=5",
  "/tools/",
  "/tools/index.html",
  "/tools/css/icons.css",
  "/tools/js/hub.js?v=6",
  "/game/register/",
  "/game/register/index.html",
  "/game/register/auth.css?v=3",
  "/game/register/auth.js?v=14",
  "/game/paddlemaze/",
  "/game/paddlemaze/index.html",
  "/game/paddlemaze/game.css?v=27",
  "/game/paddlemaze/game.js?v=27",
  "/game/paddlemaze/levels.js?v=25",
  "/game/paddlemaze/walls.js?v=27",
  "/game/paddlemaze/paddleCap.js?v=25",
  "/game/paddlemaze/resources.js?v=25",
  "/game/paddlemaze/welfare.js?v=25",
  "/game/paddlemaze/stallRelief.js?v=27",
  "/game/dua/",
  "/game/dua/index.html",
  "/game/dua/game.css?v=7",
  "/game/dua/game.js?v=7",
  "/game/dua/duel.js?v=7",
  "/game/dua/copy.js?v=4",
  "/blog/",
  "/blog/index.html",
  "/blog/blog.css?v=5",
  "/blog/blog-app.js?v=3",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
];

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

function shouldCache(url, request) {
  if (isApi(url)) return false;
  if (request.mode === "navigate") return true;
  const p = url.pathname;
  return (
    p.endsWith(".css") ||
    p.endsWith(".js") ||
    p.endsWith(".webmanifest") ||
    p.endsWith(".png") ||
    p.endsWith(".svg") ||
    p.endsWith(".ico") ||
    p.endsWith(".woff2") ||
    p === "/" ||
    p.endsWith(".html") ||
    p.endsWith("/")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Cache-first / stale-while-revalidate so home-screen launches paint instantly. */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApi(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);

      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok && shouldCache(url, request)) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => null);

      // Authentication navigations must use the latest HTML on iOS standalone.
      // Fall back to cache only when offline; never keep a stale/blank auth shell.
      if (request.mode === "navigate" && url.pathname.startsWith("/game/register")) {
        const fresh = await networkPromise;
        if (fresh) return fresh;
        return cached || (await cache.match("/game/register/index.html")) ||
          new Response("Offline", { status: 503 });
      }

      if (url.pathname.startsWith("/game/paddlemaze")) {
        const fresh = await networkPromise;
        if (fresh) return fresh;
        return cached || new Response("", { status: 504, statusText: "Offline" });
      }

      // Instant paint from cache; refresh in background
      if (cached) {
        networkPromise.catch(() => {});
        return cached;
      }

      const fresh = await networkPromise;
      if (fresh) return fresh;
      if (request.mode === "navigate") {
        return (await cache.match("/index.html")) || (await cache.match("/"));
      }
      return new Response("", { status: 504, statusText: "Offline" });
    })()
  );
});
