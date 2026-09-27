/** Same-origin post-login destination. Blocks open redirects and the register loop. */

const ALIAS = Object.freeze({
  "/onesentence": "/game/onesentence/",
  "/onesentence/": "/game/onesentence/",
  "/paddlemaze": "/game/paddlemaze/",
  "/paddlemaze/": "/game/paddlemaze/",
  "/dua": "/game/dua/",
  "/dua/": "/game/dua/",
});

export function safeAuthDest(raw) {
  let dest = String(raw ?? "").trim() || "/";
  try {
    dest = decodeURIComponent(dest);
  } catch {
    return "/";
  }
  dest = dest.replace(/\\/g, "/");
  if (/^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith("//") || dest.includes("..")) return "/";
  if (!dest.startsWith("/")) dest = `/${dest}`;
  if (dest.includes("/register")) return "/";
  if (dest === "/index.html") return "/";
  if (ALIAS[dest]) return ALIAS[dest];
  return dest;
}

export function leaveAuthTo(raw) {
  const dest = safeAuthDest(raw);
  const url = new URL(dest, location.origin);
  if (url.origin !== location.origin) {
    location.assign("/");
    return "/";
  }
  location.assign(`${url.pathname}${url.search}${url.hash}`);
  return `${url.pathname}${url.search}${url.hash}`;
}
