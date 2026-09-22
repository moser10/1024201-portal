const CACHE = "1042-pwa-v147";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa.js",
  "/js/langTabs.css",
  "/js/langTabs.css?v=4",
  "/js/langTabs.css?v=5",
  "/js/langTabs.js",
  "/js/accountChrome.js",
  "/js/accountChrome.js?v=3",
  "/js/accountChrome.js?v=4",
  "/js/accountChrome.js?v=5",
  "/js/authNav.js?v=1",
  "/js/accountChrome.css",
  "/js/accountChrome.css?v=2",
  "/js/device.js",
  "/js/featurePage.css",
  "/js/featurePage.css?v=7",
  "/js/featurePage.css?v=8",
  "/js/featurePage.css?v=9",
  "/js/portalModal.js?v=1",
  "/js/navBack.js?v=1",
  "/js/navBack.js?v=2",
  "/js/navBack.js?v=3",
  "/js/navBack.js?v=4",
  "/js/navBack.js?v=5",
  "/js/geoDisplay.js?v=3",
  "/game/css/userBar.css?v=12",
  "/game/",
  "/game/index.html",
  "/game/css/hub.css?v=13",
  "/game/js/hub.js?v=7",
  "/game/js/hub.js?v=8",
  "/game/js/hub.js?v=9",
  "/game/js/hub.js?v=10",
  "/game/js/gameNames.js?v=1",
  "/tools/",
  "/tools/index.html",
  "/tools/css/icons.css",
  "/tools/js/hub.js?v=8",
  "/tools/js/hub.js?v=9",
  "/tools/js/hub.js?v=10",
  "/game/register/",
  "/game/register/index.html",
  "/game/register/auth.css?v=7",
  "/game/register/auth.css?v=8",
  "/game/register/auth.js?v=15",
  "/game/register/auth.js?v=16",
  "/game/register/auth.js?v=17",
  "/game/register/auth.js?v=18",
  "/game/paddlemaze/",
  "/game/paddlemaze/index.html",
  "/game/paddlemaze/game.css?v=27",
  "/game/paddlemaze/game.css?v=28",
  "/game/paddlemaze/game.css?v=29",
  "/game/paddlemaze/game.js?v=27",
  "/game/paddlemaze/game.js?v=28",
  "/game/paddlemaze/game.js?v=29",
  "/game/paddlemaze/game.js?v=30",
  "/game/paddlemaze/game.js?v=31",
  "/game/paddlemaze/game.js?v=32",
  "/game/paddlemaze/game.js?v=33",
  "/game/paddlemaze/game.js?v=34",
  "/game/paddlemaze/game.js?v=35",
  "/game/paddlemaze/game.js?v=36",
  "/game/paddlemaze/game.js?v=37",
  "/game/paddlemaze/copy.js?v=1",
  "/game/paddlemaze/serve.js?v=1",
  "/game/paddlemaze/levels.js?v=25",
  "/game/paddlemaze/levels.js?v=26",
  "/game/paddlemaze/levels.js?v=27",
  "/game/paddlemaze/levels.js?v=28",
  "/game/paddlemaze/handMaps.js",
  "/game/paddlemaze/maps-preview.txt",
  "/game/paddlemaze/walls.js?v=27",
  "/game/paddlemaze/walls.js?v=28",
  "/game/paddlemaze/paddleCap.js?v=25",
  "/game/paddlemaze/paddleCap.js?v=26",
  "/game/paddlemaze/resources.js?v=25",
  "/game/paddlemaze/resources.js?v=26",
  "/game/paddlemaze/resources.js?v=27",
  "/game/paddlemaze/bounce.js?v=1",
  "/game/paddlemaze/bounce.js?v=2",
  "/game/paddlemaze/welfare.js?v=25",
  "/game/paddlemaze/stallRelief.js?v=27",
  "/game/paddlemaze/stallRelief.js?v=28",
  "/game/dua/",
  "/game/dua/index.html",
  "/game/dua/game.css?v=10",
  "/game/dua/game.css?v=11",
  "/game/dua/game.css?v=12",
  "/game/dua/game.js?v=14",
  "/game/dua/game.js?v=15",
  "/game/dua/game.js?v=16",
  "/game/dua/game.js?v=17",
  "/game/dua/game.js?v=18",
  "/game/dua/game.js?v=19",
  "/game/dua/game.js?v=20",
  "/game/dua/game.js?v=21",
  "/game/dua/game.js?v=22",
  "/game/dua/game.js?v=23",
  "/game/dua/duel.js?v=12",
  "/game/dua/duel.js?v=13",
  "/game/dua/duel.js?v=14",
  "/game/dua/copy.js?v=4",
  "/game/dua/copy.js?v=5",
  "/game/dua/copy.js?v=6",
  "/game/dua/copy.js?v=7",
  "/game/dua/copy.js?v=8",
  "/game/dua/stick.js?v=2",
  "/fx/",
  "/fx/index.html",
  "/fx/fx.css?v=3",
  "/blog/",
  "/blog/index.html",
  "/blog/blog.css?v=9",
  "/blog/blog.css?v=10",
  "/blog/blog.css?v=11",
  "/blog/blog-app.js?v=3",
  "/blog/blog-app.js?v=4",
  "/blog/blog-app.js?v=5",
  "/blog/md.js",
  "/rooms/",
  "/rooms/index.html",
  "/rooms/rooms.css?v=3",
  "/rooms/rooms.css?v=4",
  "/rooms/rooms.css?v=5",
  "/rooms/rooms.css?v=6",
  "/rooms/rooms.css?v=7",
  "/rooms/rooms.css?v=8",
  "/rooms/rooms.css?v=9",
  "/rooms/rooms.css?v=10",
  "/rooms/rooms.js?v=14",
  "/rooms/rooms.js?v=15",
  "/rooms/rooms.js?v=16",
  "/rooms/copy.js?v=8",
  "/rooms/copy.js?v=9",
  "/icons/apps/rooms.svg",
  "/account/",
  "/account/index.html",
  "/account/account.css?v=2",
  "/account/account.css?v=3",
  "/account/account.js?v=2",
  "/account/account.js?v=3",
  "/account/account.js?v=4",
  "/account/copy.js?v=2",
  "/account/copy.js?v=3",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
  "/icons/apps/mail.svg",
  "/icons/apps/game.svg",
  "/icons/apps/fx.svg",
  "/icons/apps/tools.svg",
  "/icons/apps/blog.svg",
  "/icons/apps/osn.svg",
  "/icons/apps/pbm.svg",
  "/icons/apps/dua.svg",
  "/icons/apps/showcase.svg",
  "/icons/apps/syncnote.svg",
  "/icons/apps/music.svg",
  "/icons/apps/pdf.svg",
  "/icons/apps/lyrics.svg",
  "/icons/apps/cli.svg",
  "/icons/apps/address.svg",
  "/icons/apps/clock.svg",
  "/icons/apps/ip.svg",
  "/icons/apps/login.svg",
  "/icons/apps/logo.svg",
  "/icons/weapon/pistol.png",
  "/icons/weapon/ak.png",
  "/icons/weapon/rpg.png",
  "/icons/weapon/sg.png",
  "/icons/weapon/knife.png",
  "/icons/weapon/heart.png",
  "/icons/weapon/boost.png",
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

      // HTML navigations: network-first so login/home-screen never paints a stale white shell.
      if (request.mode === "navigate") {
        const fresh = await networkPromise;
        if (fresh) return fresh;
        if (url.pathname.startsWith("/game/register")) {
          return cached || (await cache.match("/game/register/index.html")) ||
            new Response("Offline", { status: 503 });
        }
        return cached || (await cache.match("/index.html")) || (await cache.match("/")) ||
          new Response("", { status: 504, statusText: "Offline" });
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
