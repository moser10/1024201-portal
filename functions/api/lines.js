import { corsHeaders, json, requireDb } from "./_shared.js";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = requireDb(context.env);

    if (request.method === "GET") {
      const { results } = await db
        .prepare(
          "SELECT id, text, author, datetime(created_at, 'localtime') AS time FROM story_lines WHERE story_id = 1 AND status = 'approved' ORDER BY id ASC"
        )
        .all();
      return json(results);
    }

    if (request.method === "POST") {
      const { text, author } = await request.json();
      if (!text || !author) return json({ error: "内容或昵称不能为空" }, 400);

      const lastLine = await db
        .prepare("SELECT author FROM story_lines WHERE story_id = 1 ORDER BY id DESC LIMIT 1")
        .first();

      if (lastLine && lastLine.author === author) {
        return json({ error: "不能连续接龙哦，等朋友接一句吧！" }, 400);
      }

      await db
        .prepare("INSERT INTO story_lines (story_id, text, author) VALUES (1, ?, ?)")
        .bind(text.trim(), author.trim())
        .run();

      return json({ success: true });
    }

    return json({ error: "Method Not Allowed" }, 405);
  } catch (err) {
    return json({ error: err.message }, err.message.includes("D1 未") ? 503 : 500);
  }
}
