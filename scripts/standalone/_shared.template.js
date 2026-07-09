export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function requireDb(env) {
  if (!env?.DB?.prepare) {
    throw new Error("D1 not bound — create a database and set database_id in wrangler.toml");
  }
  return env.DB;
}

export async function ensureSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS usage_quota (
        quota_key TEXT PRIMARY KEY,
        uses INTEGER NOT NULL DEFAULT 0
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS github_sessions (
        session_id TEXT PRIMARY KEY,
        github_id INTEGER NOT NULL,
        github_login TEXT NOT NULL,
        access_token TEXT NOT NULL,
        starred INTEGER NOT NULL DEFAULT 0,
        checked_at TEXT NOT NULL
      )`
    )
    .run();
}
