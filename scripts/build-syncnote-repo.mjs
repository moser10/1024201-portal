#!/usr/bin/env node
import { cpSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "..", "syncNote");

mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "functions/api"), { recursive: true });
mkdirSync(join(OUT, "js"), { recursive: true });

function cp(s, d) {
  mkdirSync(dirname(d), { recursive: true });
  cpSync(s, d);
}

cp(join(ROOT, "js/langTabs.js"), join(OUT, "js/langTabs.js"));
cp(join(ROOT, "js/langTabs.css"), join(OUT, "js/langTabs.css"));
cp(join(ROOT, "js/featurePage.css"), join(OUT, "js/featurePage.css"));
cp(join(ROOT, "game/js/store.js"), join(OUT, "js/store.js"));
cp(join(ROOT, "tools/syncnote/syncnote.css"), join(OUT, "syncnote.css"));

writeFileSync(
  join(OUT, "js/authClient.js"),
  `import { getUser } from "./store.js";

export function currentUserId() {
  const u = getUser();
  return u?.id ? String(u.id) : "";
}

export function loginHref(returnPath) {
  const base = typeof window !== "undefined" && window.__REGISTER_URL__
    ? window.__REGISTER_URL__
    : "https://1024201.com/game/register/";
  const sep = base.includes("?") ? "&" : "?";
  return \`\${base}\${sep}return=\${encodeURIComponent(returnPath)}\`;
}
`
);

let js = readFileSync(join(ROOT, "tools/syncnote/syncnote.js"), "utf8");
js = js
  .replace('from "/js/langTabs.js"', 'from "./js/langTabs.js"')
  .replace('from "/game/js/store.js"', 'from "./js/store.js"')
  .replace('from "../js/quotaClient.js"', 'from "./js/authClient.js"')
  .replace(/\/api\/portal/g, "/api")
  .replace(
    "function boot() {",
    `function boot() {
  if (!getUser()?.id && /localhost|127\\.0\\.0\\.1/.test(location.hostname)) {
    localStorage.setItem("osn_user", JSON.stringify({ id: 1, username: "dev" }));
  }`
  );
writeFileSync(join(OUT, "syncnote.js"), js);

let html = readFileSync(join(ROOT, "tools/syncnote/index.html"), "utf8");
html = html.replace("| 1024201", "").replace('href="/tools/"', 'href="#" hidden');
writeFileSync(join(OUT, "index.html"), html);

writeFileSync(
  join(OUT, "functions/api/_shared.js"),
  `export const corsHeaders = {
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
  if (!env?.DB?.prepare) throw new Error("D1 not bound");
  return env.DB;
}

export async function ensureSchema(db) {
  const { results } = await db.prepare("PRAGMA table_info(user_sync_notes)").all();
  const hasTable = results.length > 0;
  const hasSlot = results.some((r) => r.name === "slot");

  if (!hasTable) {
    await db.prepare(\`CREATE TABLE user_sync_notes (
      user_id INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, slot)
    )\`).run();
    return;
  }

  if (!hasSlot) {
    await db.prepare(\`CREATE TABLE user_sync_notes_v2 (
      user_id INTEGER NOT NULL,
      slot INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, slot)
    )\`).run();
    await db.prepare(
      \`INSERT INTO user_sync_notes_v2 (user_id, slot, content, updated_at)
       SELECT user_id, 0, content, updated_at FROM user_sync_notes\`
    ).run();
    await db.prepare("DROP TABLE user_sync_notes").run();
    await db.prepare("ALTER TABLE user_sync_notes_v2 RENAME TO user_sync_notes").run();
  }
}
`
);

writeFileSync(
  join(OUT, "functions/api/index.js"),
  `import { corsHeaders, json, requireDb, ensureSchema } from "./_shared.js";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (url.pathname !== "/api") return json({ error: "not_found" }, 404);
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const action = url.searchParams.get("action");
  if (action === "syncnote_get" && request.method === "GET") return syncGet(context);
  if (action === "syncnote_save" && request.method === "POST") return syncSave(context);
  if (action === "syncnote_clear" && request.method === "POST") return syncClear(context);
  return json({ error: "unknown_action" }, 404);
}

function parseUserId(url, body) {
  const raw = url.searchParams.get("user_id") ?? body?.user_id;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function requireUser(db, env, userId) {
  if (env.BYPASS_AUTH === "true") {
    return { ok: true, user: { id: userId || 1, username: "dev" } };
  }
  if (!userId) return { ok: false, status: 403, body: { error: "login_required", needLogin: true } };
  const row = await db.prepare("SELECT id, username FROM users WHERE id = ?").bind(userId).first();
  if (!row) return { ok: false, status: 403, body: { error: "login_required", needLogin: true } };
  return { ok: true, user: row };
}

async function syncGet({ request, env }) {
  const db = requireDb(env);
  await ensureSchema(db);
  const url = new URL(request.url);
  const userId = parseUserId(url);
  const auth = await requireUser(db, env, userId);
  if (!auth.ok) return json(auth.body, auth.status);
  const { results } = await db
    .prepare("SELECT slot, content, updated_at FROM user_sync_notes WHERE user_id = ? ORDER BY slot")
    .bind(userId)
    .all();
  const bySlot = new Map(results.map((r) => [r.slot, r]));
  const slots = [0, 1, 2].map((slot) => {
    const row = bySlot.get(slot);
    return { slot, content: row?.content ?? "", updatedAt: row?.updated_at ?? null };
  });
  return json({ slots, username: auth.user.username });
}

function parseSlot(body, url) {
  const raw = body?.slot ?? url.searchParams.get("slot");
  const slot = parseInt(raw, 10);
  if (!Number.isFinite(slot) || slot < 0 || slot > 2) return null;
  return slot;
}

async function syncSave({ request, env }) {
  const db = requireDb(env);
  await ensureSchema(db);
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const userId = parseUserId(url, body);
  const slot = parseSlot(body, url);
  if (slot === null) return json({ error: "invalid_slot" }, 400);
  const auth = await requireUser(db, env, userId);
  if (!auth.ok) return json(auth.body, auth.status);
  const content = String(body?.content ?? "");
  if (content.length > 65536) return json({ error: "content_too_large" }, 413);
  await db
    .prepare(
      \`INSERT INTO user_sync_notes (user_id, slot, content, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, slot) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at\`
    )
    .bind(userId, slot, content)
    .run();
  const row = await db
    .prepare("SELECT updated_at FROM user_sync_notes WHERE user_id = ? AND slot = ?")
    .bind(userId, slot)
    .first();
  return json({ ok: true, slot, updatedAt: row?.updated_at ?? null });
}

async function syncClear({ request, env }) {
  const db = requireDb(env);
  await ensureSchema(db);
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const userId = parseUserId(url, body);
  const slot = parseSlot(body, url);
  if (slot === null) return json({ error: "invalid_slot" }, 400);
  const auth = await requireUser(db, env, userId);
  if (!auth.ok) return json(auth.body, auth.status);
  await db.prepare("DELETE FROM user_sync_notes WHERE user_id = ? AND slot = ?").bind(userId, slot).run();
  return json({ ok: true, slot });
}
`
);

cp(join(ROOT, "scripts/standalone/worker.template.js"), join(OUT, "worker.js"));

writeFileSync(
  join(OUT, "wrangler.toml"),
  `name = "sync-note"
main = "worker.js"
compatibility_date = "2024-09-23"
workers_dev = true

[assets]
directory = "."
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "sync-note-db"
database_id = "REPLACE_WITH_YOUR_D1_ID"

[vars]
BYPASS_AUTH = "true"
`
);

writeFileSync(
  join(OUT, "package.json"),
  JSON.stringify(
    { name: "syncnote", private: false, description: "Login-only cross-device text sync", type: "module", scripts: { dev: "wrangler dev", deploy: "wrangler deploy" }, license: "MIT" },
    null,
    2
  )
);

writeFileSync(join(OUT, ".gitignore"), ".wrangler/\nnode_modules/\n");
writeFileSync(join(OUT, "LICENSE"), "MIT License\n");
writeFileSync(join(OUT, "README.md"), readFileSync(join(ROOT, "tools/syncnote/README.md"), "utf8"));

writeFileSync(
  join(OUT, "schema.sql"),
  `CREATE TABLE IF NOT EXISTS user_sync_notes (
  user_id INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, slot)
);
`
);

console.log("syncNote repo →", OUT);
