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
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    const keys = Object.keys(env || {}).filter((k) => !/TOKEN|KEY|SECRET/i.test(k));
    throw new Error(
      `D1 未生效。请确认：① wrangler.toml 中 database_id 已填写；② Worker 名称与 wrangler.toml 的 name 一致；③ 重新部署。当前 env 键：${keys.join(", ") || "无"}`
    );
  }
  return env.DB;
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

const CHAPTER_CHARS = 3000;

export function buildChaptersFromBook(bookItems) {
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
    const len = item.text.length;
    if (chars + len > CHAPTER_CHARS && bucket.length) flush();
    bucket.push(item);
    chars += len;
  }
  flush();
  return chapters;
}
