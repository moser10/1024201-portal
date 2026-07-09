import { ensureAddressSchema } from "./address.js";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function requireDb(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    const keys = Object.keys(env || {}).filter((k) => !/TOKEN|KEY|SECRET/i.test(k));
    throw new Error(
      `D1 未生效。请确认：① wrangler.toml 中 database_id 已填写；② Worker 名称与 wrangler.toml 的 name 一致；③ 重新部署。当前 env 键：${keys.join(", ") || "无"}`
    );
  }
  return env.DB;
}

async function hasColumn(db, table, column) {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all();
  return results.some((row) => row.name === column);
}

async function ensureColumn(db, table, column, alterSql) {
  if (await hasColumn(db, table, column)) return;
  await db.prepare(alterSql).run();
}

export async function ensureAppSchema(db) {
  await ensureColumn(db, "stories", "game_id", "ALTER TABLE stories ADD COLUMN game_id TEXT NOT NULL DEFAULT 'osn'");
  await ensureColumn(db, "stories", "chapters_json", "ALTER TABLE stories ADD COLUMN chapters_json TEXT");
  await ensureColumn(db, "stories", "writing_state_json", "ALTER TABLE stories ADD COLUMN writing_state_json TEXT");
  await ensureColumn(db, "users", "password_hash", "ALTER TABLE users ADD COLUMN password_hash TEXT");
  await ensureColumn(db, "users", "password_plain", "ALTER TABLE users ADD COLUMN password_plain TEXT");
  await ensureColumn(
    db,
    "users",
    "must_change_password",
    "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"
  );
  await ensureColumn(db, "users", "temp_password", "ALTER TABLE users ADD COLUMN temp_password TEXT");
  await ensureColumn(db, "users", "temp_password_expires", "ALTER TABLE users ADD COLUMN temp_password_expires TEXT");
  await ensureColumn(
    db,
    "users",
    "email_verified",
    "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1"
  );
  await ensureColumn(db, "users", "email_verify_token", "ALTER TABLE users ADD COLUMN email_verify_token TEXT");
  await ensureColumn(db, "users", "email_verify_expires", "ALTER TABLE users ADD COLUMN email_verify_expires TEXT");
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS pending_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        verify_token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
  await db.prepare("DELETE FROM users WHERE email_verified = 0").run();
  await ensureColumn(
    db,
    "pending_registrations",
    "verify_attempts",
    "ALTER TABLE pending_registrations ADD COLUMN verify_attempts INTEGER NOT NULL DEFAULT 0"
  );
  await ensureColumn(
    db,
    "pending_registrations",
    "register_channel",
    "ALTER TABLE pending_registrations ADD COLUMN register_channel TEXT NOT NULL DEFAULT 'web'"
  );
  await db.prepare("DELETE FROM pending_registrations WHERE expires_at <= datetime('now')").run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS room_presence (
        story_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        last_seen TEXT NOT NULL,
        PRIMARY KEY (story_id, user_id)
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS tool_usage_quota (
        quota_key TEXT NOT NULL,
        tool TEXT NOT NULL,
        day TEXT NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        ad_tier INTEGER NOT NULL DEFAULT 0,
        ad_progress INTEGER NOT NULL DEFAULT 0,
        bonus INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (quota_key, tool, day)
      )`
    )
    .run();
  await db.prepare(`ALTER TABLE tool_usage_quota ADD COLUMN last_refresh_query TEXT NOT NULL DEFAULT ''`).run().catch(() => {});
  await db.prepare(`ALTER TABLE tool_usage_quota ADD COLUMN last_counted_at INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS tool_pdf_quota (
        ip TEXT NOT NULL,
        day TEXT NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        ad_tier INTEGER NOT NULL DEFAULT 0,
        ad_progress INTEGER NOT NULL DEFAULT 0,
        bonus INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ip, day)
      )`
    )
    .run();
  await ensureSyncNoteSchema(db);
  await ensureCliTokenSchema(db);
  await ensureAddressSchema(db);
}

async function ensureCliTokenSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_cli_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_used TEXT
      )`
    )
    .run();
}

export function randomCliToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashCliToken(token) {
  const data = new TextEncoder().encode(`cli:${token}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueCliToken(db, userId) {
  const token = randomCliToken();
  const tokenHash = await hashCliToken(token);
  await db.prepare("INSERT INTO user_cli_tokens (token_hash, user_id) VALUES (?, ?)").bind(tokenHash, userId).run();
  return token;
}

export async function verifyCliToken(db, token) {
  if (!token) return null;
  const tokenHash = await hashCliToken(token);
  const row = await db.prepare("SELECT user_id FROM user_cli_tokens WHERE token_hash = ?").bind(tokenHash).first();
  if (!row) return null;
  await db
    .prepare("UPDATE user_cli_tokens SET last_used = datetime('now') WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
  return row.user_id;
}

export async function revokeCliToken(db, token) {
  if (!token) return false;
  const tokenHash = await hashCliToken(token);
  const result = await db.prepare("DELETE FROM user_cli_tokens WHERE token_hash = ?").bind(tokenHash).run();
  return (result.meta?.changes || 0) > 0;
}

export async function resolveUserId(request, env, url, body) {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      const db = requireDb(env);
      await ensureAppSchema(db);
      const userId = await verifyCliToken(db, token);
      if (userId) return userId;
    }
  }
  const raw = url.searchParams.get("user_id") ?? body?.user_id;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function ensureSyncNoteSchema(db) {
  const { results } = await db.prepare("PRAGMA table_info(user_sync_notes)").all();
  const hasTable = results.length > 0;
  const hasSlot = results.some((r) => r.name === "slot");

  if (!hasTable) {
    await db
      .prepare(
        `CREATE TABLE user_sync_notes (
          user_id INTEGER NOT NULL,
          slot INTEGER NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, slot)
        )`
      )
      .run();
    return;
  }

  if (!hasSlot) {
    await db
      .prepare(
        `CREATE TABLE user_sync_notes_v2 (
          user_id INTEGER NOT NULL,
          slot INTEGER NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, slot)
        )`
      )
      .run();
    await db
      .prepare(
        `INSERT INTO user_sync_notes_v2 (user_id, slot, content, updated_at)
         SELECT user_id, 0, content, updated_at FROM user_sync_notes`
      )
      .run();
    await db.prepare("DROP TABLE user_sync_notes").run();
    await db.prepare("ALTER TABLE user_sync_notes_v2 RENAME TO user_sync_notes").run();
  }
}

export async function generateUniqueName(db, baseName, table, column) {
  let finalName = "";
  for (let i = 0; i < 20; i++) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    finalName = `${baseName}_${randomNum}`;
    const existing = await db.prepare(`SELECT id FROM ${table} WHERE ${column} = ?`).bind(finalName).first();
    if (!existing) return finalName;
  }
  return `${baseName}_${Date.now()}`;
}

export async function isMember(db, storyId, userId) {
  return db
    .prepare("SELECT status, role FROM story_members WHERE story_id = ? AND user_id = ?")
    .bind(storyId, userId)
    .first();
}

export async function hasActiveOwner(db, storyId, ownerId) {
  return db
    .prepare(
      "SELECT 1 AS ok FROM story_members WHERE story_id = ? AND user_id = ? AND role = 'owner' AND status = 'active'"
    )
    .bind(storyId, ownerId)
    .first();
}

export async function touchPresence(db, storyId, userId) {
  await db
    .prepare(
      `INSERT INTO room_presence (story_id, user_id, last_seen) VALUES (?, ?, datetime('now'))
       ON CONFLICT(story_id, user_id) DO UPDATE SET last_seen = datetime('now')`
    )
    .bind(storyId, userId)
    .run();
}

export async function leavePresence(db, storyId, userId) {
  await db.prepare("DELETE FROM room_presence WHERE story_id = ? AND user_id = ?").bind(storyId, userId).run();
}

export async function cleanupInactiveChat(db, storyId) {
  const active = await db
    .prepare(
      `SELECT 1 AS ok FROM room_presence
       WHERE story_id = ? AND last_seen > datetime('now', '-2 minutes')`
    )
    .bind(storyId)
    .first();
  if (!active) {
    await db.prepare("DELETE FROM content_stream WHERE story_id = ? AND type = 'chat'").bind(storyId).run();
    await db.prepare("DELETE FROM room_presence WHERE story_id = ?").bind(storyId).run();
  }
}

const MAX_CHAPTER_CHARS = 3000;
export const MIN_CHAPTER_CHARS = 200;
export const MIN_CHAPTERS_COUNT = 2;

export function bookCharCount(bookItems) {
  return bookItems.reduce((sum, item) => sum + (item.text?.length || 0), 0);
}

export function canGenerateChapters(bookItems) {
  return Math.floor(bookCharCount(bookItems) / MIN_CHAPTER_CHARS) >= MIN_CHAPTERS_COUNT;
}

export function buildChaptersFromBook(bookItems) {
  const total = bookCharCount(bookItems);
  if (!canGenerateChapters(bookItems)) return [];

  const chapterCount = Math.floor(total / MIN_CHAPTER_CHARS);
  const targetSize = total / chapterCount;
  const chapters = [];
  let bucket = [];
  let chars = 0;

  const flush = () => {
    if (!bucket.length) return;
    const no = chapters.length + 1;
    const snippet = bucket[0].text.slice(0, 10);
    chapters.push({
      no,
      title: `第${no}章 ${snippet}${bucket[0].text.length > 10 ? "…" : ""}`,
      content_ids: bucket.map((b) => b.id),
      text: bucket.map((b) => b.text).join(""),
    });
    bucket = [];
    chars = 0;
  };

  for (const item of bookItems) {
    bucket.push(item);
    chars += item.text.length;

    if (chars > MAX_CHAPTER_CHARS && bucket.length > 1) {
      const last = bucket.pop();
      chars -= last.text.length;
      flush();
      bucket.push(last);
      chars += last.text.length;
    }

    const chaptersLeft = chapterCount - chapters.length;
    if (chaptersLeft > 1 && chars >= targetSize && chars >= MIN_CHAPTER_CHARS) {
      flush();
    }
  }
  flush();

  return chapters.length >= MIN_CHAPTERS_COUNT ? chapters : [];
}

export const WRITES_PER_TURN = 3;

export function parseWritingState(raw) {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return {
      round: s.round ?? 1,
      phase: s.phase === "writing" ? "writing" : "idle",
      holder_id: s.holder_id ?? null,
      holder_writes: s.holder_writes ?? 0,
      completed: Array.isArray(s.completed) ? s.completed.map(Number) : [],
      round_users: Array.isArray(s.round_users) ? s.round_users.map(Number) : [],
      deferred: Array.isArray(s.deferred) ? s.deferred.map(Number) : [],
    };
  } catch {
    return null;
  }
}

export function emptyWritingState(onlineIds = []) {
  return {
    round: 1,
    phase: "idle",
    holder_id: null,
    holder_writes: 0,
    completed: [],
    round_users: [...onlineIds],
    deferred: [],
  };
}

export async function getOnlineMembers(db, storyId) {
  const { results } = await db
    .prepare(
      `SELECT rp.user_id, u.username
       FROM room_presence rp
       JOIN story_members sm ON sm.story_id = rp.story_id AND sm.user_id = rp.user_id AND sm.status = 'active'
       JOIN users u ON u.id = rp.user_id
       WHERE rp.story_id = ? AND rp.last_seen > datetime('now', '-45 seconds')
       ORDER BY u.username`
    )
    .bind(storyId)
    .all();
  return results;
}

export function syncWritingPresence(state, userId, onlineIds) {
  if (!state.round_users.length && !state.completed.length && state.phase === "idle") {
    state.round_users = [...onlineIds];
    return state;
  }
  const roundActive = state.phase === "writing" || state.completed.length > 0;
  if (roundActive && !state.round_users.includes(userId) && !state.deferred.includes(userId)) {
    state.deferred.push(userId);
  }
  return state;
}

export function canUserWriteBook(state, userId, onlineIds) {
  if (!onlineIds.includes(userId)) {
    return { ok: false, reason: "仅在线成员可以写书" };
  }
  if (state.deferred.includes(userId)) {
    return { ok: false, reason: "新加入成员需等待本轮结束后才能写书" };
  }
  if (state.completed.includes(userId)) {
    return { ok: false, reason: "你本轮已写完，等待其他在线成员" };
  }
  if (state.phase === "writing" && state.holder_id !== userId) {
    return { ok: false, reason: "当前轮次其他人正在写书" };
  }
  return { ok: true };
}

export function afterBookPublish(state, userId, onlineIds) {
  if (!state.round_users.length) {
    state.round_users = [...onlineIds];
  }
  for (const id of onlineIds) {
    if (!state.round_users.includes(id) && !state.deferred.includes(id)) {
      const roundActive = state.phase === "writing" || state.completed.length > 0;
      if (roundActive) state.deferred.push(id);
      else state.round_users.push(id);
    }
  }

  if (state.phase === "idle") {
    state.phase = "writing";
    state.holder_id = userId;
    state.holder_writes = 1;
  } else if (state.holder_id === userId) {
    state.holder_writes += 1;
  }

  if (state.holder_writes >= WRITES_PER_TURN) {
    if (!state.completed.includes(userId)) state.completed.push(userId);
    state.phase = "idle";
    state.holder_id = null;
    state.holder_writes = 0;

    const eligible = state.round_users.filter((id) => !state.deferred.includes(id));
    if (eligible.length > 0 && eligible.every((id) => state.completed.includes(id))) {
      state.round += 1;
      state.completed = [];
      state.round_users = [...onlineIds];
      state.deferred = [];
      state.phase = "idle";
      state.holder_id = null;
      state.holder_writes = 0;
    }
  }
  return state;
}
