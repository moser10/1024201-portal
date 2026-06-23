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
  if (!env.DB) {
    throw new Error("D1 未绑定：请在 Worker Settings → Bindings 添加 D1，变量名 DB");
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
    .prepare("SELECT id, status, role FROM story_members WHERE story_id = ? AND user_id = ?")
    .bind(storyId, userId)
    .first();
}
