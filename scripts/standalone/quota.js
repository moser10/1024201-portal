import { requireDb, ensureSchema } from "./_shared.js";

export const FREE_LIMIT = 32;
const STAR_RECHECK_MS = 6 * 60 * 60 * 1000;

export function quotaDisabled(env) {
  return env?.QUOTA_DISABLED === "true" || env?.QUOTA_DISABLED === "1";
}

export function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1"
  );
}

export function parseSessionCookie(request) {
  const raw = request.headers.get("Cookie") || "";
  const m = raw.match(/(?:^|;\s*)app_sess=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function sessionCookie(id, secure) {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=2592000"];
  if (secure) flags.push("Secure");
  return `app_sess=${encodeURIComponent(id)}; ${flags.join("; ")}`;
}

export function clearSessionCookie(secure) {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) flags.push("Secure");
  return `app_sess=; ${flags.join("; ")}`;
}

export async function getSession(db, sessionId) {
  if (!sessionId) return null;
  return db.prepare("SELECT * FROM github_sessions WHERE session_id = ?").bind(sessionId).first();
}

export async function checkStarred(session, env, db) {
  if (!session) return false;
  const checkedAt = new Date(session.checked_at).getTime();
  if (session.starred && Date.now() - checkedAt < STAR_RECHECK_MS) return true;

  const repo = env.GITHUB_STAR_REPO || "";
  const [owner, name] = repo.split("/");
  if (!owner || !name) return false;

  const res = await fetch(`https://api.github.com/user/starred/${owner}/${name}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "standalone-tool",
    },
  });
  const starred = res.status === 204;
  await db
    .prepare("UPDATE github_sessions SET starred = ?, checked_at = datetime('now') WHERE session_id = ?")
    .bind(starred ? 1 : 0, session.session_id)
    .run();
  session.starred = starred ? 1 : 0;
  return starred;
}

export function buildQuotaPayload({ uses = 0, starred = false, githubLogin = null, unlimited = false }) {
  if (unlimited || starred) {
    return {
      uses,
      allowed: FREE_LIMIT,
      remaining: null,
      unlimited: true,
      starred: true,
      githubLogin,
      needStar: false,
      freeLimit: FREE_LIMIT,
    };
  }
  const remaining = Math.max(0, FREE_LIMIT - uses);
  return {
    uses,
    allowed: FREE_LIMIT,
    remaining,
    unlimited: false,
    starred: false,
    githubLogin: null,
    needStar: remaining <= 0,
    freeLimit: FREE_LIMIT,
  };
}

export async function readIpUses(db, request) {
  const key = `ip:${clientIp(request)}`;
  const row = await db.prepare("SELECT uses FROM usage_quota WHERE quota_key = ?").bind(key).first();
  return { key, uses: row?.uses || 0 };
}

export async function incrementIpUse(db, key) {
  await db
    .prepare(
      `INSERT INTO usage_quota (quota_key, uses) VALUES (?, 1)
       ON CONFLICT(quota_key) DO UPDATE SET uses = uses + 1`
    )
    .bind(key)
    .run();
  const row = await db.prepare("SELECT uses FROM usage_quota WHERE quota_key = ?").bind(key).first();
  return row?.uses || 0;
}

/** @returns {{ ok: boolean, status?: number, body?: object, payload?: object }} */
export async function gateUse(request, env, { increment = false } = {}) {
  if (quotaDisabled(env)) {
    return { ok: true, payload: buildQuotaPayload({ unlimited: true }) };
  }

  const db = requireDb(env);
  await ensureSchema(db);

  const sessionId = parseSessionCookie(request);
  const session = await getSession(db, sessionId);
  if (session && (await checkStarred(session, env, db))) {
    return {
      ok: true,
      payload: buildQuotaPayload({
        starred: true,
        githubLogin: session.github_login,
        unlimited: true,
      }),
    };
  }

  const { key, uses } = await readIpUses(db, request);
  if (uses >= FREE_LIMIT) {
    return {
      ok: false,
      status: 403,
      body: { error: "star_required", ...buildQuotaPayload({ uses, needStar: true }) },
    };
  }

  if (increment) {
    const next = await incrementIpUse(db, key);
    return { ok: true, payload: buildQuotaPayload({ uses: next }) };
  }
  return { ok: true, payload: buildQuotaPayload({ uses }) };
}

export async function getQuotaPayload(request, env) {
  if (quotaDisabled(env)) return buildQuotaPayload({ unlimited: true });
  const db = requireDb(env);
  await ensureSchema(db);

  const sessionId = parseSessionCookie(request);
  const session = await getSession(db, sessionId);
  if (session && (await checkStarred(session, env, db))) {
    return buildQuotaPayload({
      starred: true,
      githubLogin: session.github_login,
      unlimited: true,
    });
  }

  const { uses } = await readIpUses(db, request);
  return buildQuotaPayload({ uses });
}
