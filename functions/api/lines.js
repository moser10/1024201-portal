export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 【GET 请求】获取句子列表
  if (request.method === "GET") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id, text, author, datetime(created_at, 'localtime') as time FROM story_lines WHERE story_id = 1 AND status = 'approved' ORDER BY id ASC"
      ).all();
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  // 【POST 请求】提交新的一句话
  if (request.method === "POST") {
    try {
      const { text, author } = await request.json();

      if (!text || !author) {
        return new Response(JSON.stringify({ error: "内容或昵称不能为空" }), { status: 400, headers: corsHeaders });
      }

      const lastLine = await env.DB.prepare(
        "SELECT author FROM story_lines WHERE story_id = 1 ORDER BY id DESC LIMIT 1"
      ).first();

      if (lastLine && lastLine.author === author) {
        return new Response(JSON.stringify({ error: "不能连续接龙哦，等朋友接一句吧！" }), { status: 400, headers: corsHeaders });
      }

      await env.DB.prepare("INSERT INTO story_lines (story_id, text, author) VALUES (1, ?, ?)")
        .bind(text.trim(), author.trim())
        .run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}
