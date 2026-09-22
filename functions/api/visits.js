import { json, requireDb, corsHeaders } from "./_shared.js";

let visitSchemaJob = null;

async function ensureVisitSchemaInner(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS portal_stats (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '0',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS portal_visitors (
        visitor_key TEXT PRIMARY KEY,
        first_seen TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO portal_stats (key, value) VALUES ('unique_visitors', '0')`
    )
    .run();
}

export async function ensureVisitSchema(db) {
  if (!visitSchemaJob) {
    visitSchemaJob = ensureVisitSchemaInner(db).catch((err) => {
      visitSchemaJob = null;
      throw err;
    });
  }
  return visitSchemaJob;
}

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "0.0.0.0"
  );
}

async function hashKey(raw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** GoatCounter/Plausible-style: count people, not pageviews. Same IP or same logged-in user = 1. */
export async function visitCountGet(env) {
  const db = requireDb(env);
  await ensureVisitSchema(db);
  const row = await db.prepare("SELECT value FROM portal_stats WHERE key = 'unique_visitors'").first();
  const n = parseInt(row?.value || "0", 10) || 0;
  return new Response(JSON.stringify({ n }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=5",
    },
  });
}

export async function visitHit(env, request, url) {
  const db = requireDb(env);
  await ensureVisitSchema(db);

  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const userIdRaw = url.searchParams.get("user_id") ?? body?.user_id;
  const userId = parseInt(userIdRaw, 10);
  const hasUser = Number.isFinite(userId) && userId > 0;

  const ipKey = `ip:${await hashKey(`portal-visit:${clientIp(request)}`)}`;
  const keys = [ipKey];
  if (hasUser) keys.push(`u:${userId}`);

  // If any identity already counted, link the rest without incrementing (real uniques, not vanity hits)
  const existing = [];
  for (const k of keys) {
    const row = await db.prepare("SELECT 1 AS ok FROM portal_visitors WHERE visitor_key = ?").bind(k).first();
    if (row) existing.push(k);
  }

  for (const k of keys) {
    await db.prepare("INSERT OR IGNORE INTO portal_visitors (visitor_key) VALUES (?)").bind(k).run();
  }

  let n;
  if (existing.length === 0) {
    await db
      .prepare(
        `UPDATE portal_stats
         SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT),
             updated_at = datetime('now')
         WHERE key = 'unique_visitors'`
      )
      .run();
  }
  const row = await db.prepare("SELECT value FROM portal_stats WHERE key = 'unique_visitors'").first();
  n = parseInt(row?.value || "0", 10) || 0;
  return json({ n, counted: existing.length === 0 });
}
