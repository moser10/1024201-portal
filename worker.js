import * as lines from "./functions/api/lines.js";
import * as auth from "./functions/api/auth.js";
import * as room from "./functions/api/room.js";

import * as admin from "./functions/api/admin.js";

const API_ROUTES = {
  "/api/lines": lines,
  "/api/auth": auth,
  "/api/room": room,
  "/api/admin": admin,
};

export default {
  async fetch(request, env, ctx) {
    const apexRedirect = maybeRedirectApex(request);
    if (apexRedirect) return apexRedirect;

    const gameRedirect = maybeGameSubdomain(request);
    if (gameRedirect) return gameRedirect;

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/api/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          hasDb: !!(env?.DB && typeof env.DB.prepare === "function"),
          hasResendKey: !!env?.RESEND_API_KEY,
          registerFlow: "pending_v2",
          worker: "one-sentence-novel",
          host: new URL(request.url).hostname,
          bindings: Object.keys(env || {}).filter((k) => !/TOKEN|KEY|SECRET/i.test(k)),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const handler = API_ROUTES[pathname];
    if (handler) {
      return handler.onRequest({ request, env, ctx });
    }

    return serveStatic(request, env);
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

function maybeRedirectApex(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (host === "1024201.com") {
    url.hostname = "www.1024201.com";
    return Response.redirect(url.toString(), 301);
  }
  return null;
}

/** game.1024201.com 根路径 → 游戏大厅，不走门户 */
function maybeGameSubdomain(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (host !== "game.1024201.com") return null;

  const path = url.pathname;
  if (path === "/" || path === "/index.html") {
    url.pathname = "/game/";
    return Response.redirect(url.toString(), 301);
  }
  return null;
}
