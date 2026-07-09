import * as lines from "./functions/api/lines.js";
import * as auth from "./functions/api/auth.js";
import * as room from "./functions/api/room.js";

import * as admin from "./functions/api/admin.js";
import * as portal from "./functions/api/portal.js";
import { refreshAddressData } from "./functions/api/address.js";

const API_ROUTES = {
  "/api/lines": lines,
  "/api/auth": auth,
  "/api/room": room,
  "/api/admin": admin,
  "/api/portal": portal,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          hasDb: !!(env?.DB && typeof env.DB.prepare === "function"),
          hasResendKey: !!env?.RESEND_API_KEY,
          registerFlow: "pending_v2",
          worker: "1024201-portal",
          host: new URL(request.url).hostname,
          bindings: Object.keys(env || {}).filter((k) => !/TOKEN|KEY|SECRET/i.test(k)),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const subdomainRedirect = maybeSubdomainRootRedirect(request);
    if (subdomainRedirect) return subdomainRedirect;

    const handler = API_ROUTES[pathname];
    if (handler) {
      return handler.onRequest({ request, env, ctx });
    }

    return serveStatic(request, env);
  },

  async scheduled(event, env, ctx) {
    if (!env?.DB) return;
    const run = async () => {
      try {
        const { ensureAddressSchema } = await import("./functions/api/address.js");
        await ensureAddressSchema(env.DB);
        await refreshAddressData(env.DB, env);
      } catch (e) {
        console.error("address daily refresh failed", e);
      }
    };
    ctx.waitUntil(run());
  },
};

async function serveStatic(request, env) {
  const url = new URL(request.url);
  let { pathname } = url;

  // /game/gamebgp → /game/gamebgp/
  if (!pathname.endsWith("/") && !pathname.includes(".")) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = `${pathname}/`;
    return Response.redirect(redirectUrl.toString(), 301);
  }

  let response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  if (pathname.endsWith("/")) {
    const indexUrl = new URL(request.url);
    indexUrl.pathname = `${pathname}index.html`;
    response = await env.ASSETS.fetch(new Request(indexUrl, request));
  }

  return response;
}

/**
 * 子域根路径 → 站内功能入口（方案 A：仅快捷映射，失败不影响 1024201.com/...）
 *
 * 新功能上线 checklist：
 * 1. 此处加 "name.1024201.com": "/tools/name/"（或 /game/ 等）
 * 2. wrangler.toml 加 [[routes]] pattern = "name.1024201.com/*"
 * 3. Cloudflare DNS：name → CNAME 1024201.com（代理开启）
 */
const SUBDOMAIN_ROOT = {
  "game.1024201.com": "/game/",
  "fx.1024201.com": "/fx/",
  "music.1024201.com": "/tools/music/",
  "syncnote.1024201.com": "/tools/syncnote/",
  "pdf.1024201.com": "/tools/pdf/",
  "lyrics.1024201.com": "/tools/lyrics/",
  "cli.1024201.com": "/tools/cli/",
  "address.1024201.com": "/tools/address/",
};

function maybeSubdomainRootRedirect(request) {
  const url = new URL(request.url);
  const target = SUBDOMAIN_ROOT[url.hostname.toLowerCase()];
  if (!target) return null;

  const path = url.pathname;
  if (path === "/" || path === "/index.html") {
    url.pathname = target;
    return Response.redirect(url.toString(), 301);
  }
  return null;
}
