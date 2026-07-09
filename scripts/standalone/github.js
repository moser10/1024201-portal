import { json, requireDb, ensureSchema } from "./_shared.js";
import { parseSessionCookie, getSession, checkStarred, buildQuotaPayload } from "./quota.js";

function isSecure(request) {
  return new URL(request.url).protocol === "https:";
}

export async function githubRoutes(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/github/login") return startLogin(request, env, url);
  if (path === "/api/github/callback") return finishLogin(context, url);
  if (path === "/api/github/logout") return logout(request);
  if (path === "/api/github/status") return status(context);

  return json({ error: "not_found" }, 404);
}

function startLogin(request, env, url) {
  if (!env.GITHUB_CLIENT_ID) {
    return json({ error: "github_oauth_not_configured" }, 503);
  }
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/api/github/callback`;
  const auth = new URL("https://github.com/login/oauth/authorize");
  auth.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("scope", "read:user");
  auth.searchParams.set("state", state);

  const headers = new Headers({ Location: auth.toString() });
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${isSecure(request) ? "; Secure" : ""}`
  );
  return new Response(null, { status: 302, headers });
}

async function finishLogin(context, url) {
  const { request, env } = context;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = request.headers.get("Cookie") || "";
  const stateMatch = cookies.match(/(?:^|;\s*)oauth_state=([^;]+)/);
  const savedState = stateMatch?.[1];

  if (!code || !state || state !== savedState) {
    return redirectHome(url, "?star=error", request);
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return redirectHome(url, "?star=config", request);
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/github/callback`,
    }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) return redirectHome(url, "?star=denied", request);

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "standalone-tool",
    },
  });
  if (!userRes.ok) return redirectHome(url, "?star=user", request);
  const user = await userRes.json();

  const db = requireDb(env);
  await ensureSchema(db);
  const sessionId = crypto.randomUUID();
  const session = {
    session_id: sessionId,
    github_id: user.id,
    github_login: user.login,
    access_token: accessToken,
    starred: 0,
    checked_at: new Date(0).toISOString(),
  };
  await db
    .prepare(
      `INSERT INTO github_sessions (session_id, github_id, github_login, access_token, starred, checked_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`
    )
    .bind(sessionId, user.id, user.login, accessToken)
    .run();

  const starred = await checkStarred(session, env, db);
  const qs = starred ? "?star=ok" : "?star=need";
  const headers = new Headers({ Location: `${url.origin}/${qs}` });
  headers.append("Set-Cookie", sessionCookie(sessionId, isSecure(request)));
  headers.append(
    "Set-Cookie",
    `oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure(request) ? "; Secure" : ""}`
  );
  return new Response(null, { status: 302, headers });
}

function redirectHome(url, qs, request) {
  const headers = new Headers({ Location: `${url.origin}/${qs}` });
  return new Response(null, { status: 302, headers });
}

function logout(request) {
  const headers = new Headers({ Location: new URL(request.url).origin + "/" });
  headers.append("Set-Cookie", clearSessionCookie(isSecure(request)));
  return new Response(null, { status: 302, headers });
}

async function status(context) {
  const { request, env } = context;
  const db = requireDb(env);
  await ensureSchema(db);
  const sessionId = parseSessionCookie(request);
  const session = await getSession(db, sessionId);
  if (!session) return json({ loggedIn: false, starred: false });
  const starred = await checkStarred(session, env, db);
  return json({
    loggedIn: true,
    login: session.github_login,
    starred,
    ...buildQuotaPayload({ starred, githubLogin: session.github_login, unlimited: starred }),
  });
}
