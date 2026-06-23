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
