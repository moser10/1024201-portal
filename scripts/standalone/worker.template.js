import * as api from "./functions/api/index.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          hasDb: !!env?.DB,
          quotaDisabled: env?.QUOTA_DISABLED === "true",
          starRepo: env?.GITHUB_STAR_REPO || null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/github")) {
      return api.onRequest({ request, env, ctx });
    }

    return serveStatic(request, env);
  },
};

async function serveStatic(request, env) {
  const url = new URL(request.url);
  let { pathname } = url;
  if (!pathname.endsWith("/") && !pathname.includes(".")) {
    const u = new URL(request.url);
    u.pathname = `${pathname}/`;
    return Response.redirect(u.toString(), 301);
  }
  let res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;
  if (pathname.endsWith("/")) {
    const u = new URL(request.url);
    u.pathname = `${pathname}index.html`;
    res = await env.ASSETS.fetch(new Request(u, request));
  }
  return res;
}
