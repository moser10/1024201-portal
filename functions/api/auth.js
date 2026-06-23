import { corsHeaders, json, requireDb, generateUniqueName } from "./_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = requireDb(env);

    if (request.method === "POST" && action === "check") {
      const { username } = await request.json();
      const name = username?.trim();
      if (!name) return json({ error: "昵称不能为空" }, 400);

      const existing = await db.prepare("SELECT id FROM users WHERE username = ?").bind(name).first();
      if (existing) {
        const recommend = await generateUniqueName(db, name, "users", "username");
        return json({ available: false, recommend });
      }
      return json({ available: true });
    }

    if (request.method === "POST" && action === "register") {
      const { email, username } = await request.json();
      const mail = email?.trim();
      const name = username?.trim();
      if (!mail || !name) return json({ error: "邮箱和昵称不能为空" }, 400);

      const checkEmail = await db.prepare("SELECT id FROM users WHERE email = ?").bind(mail).first();
      if (checkEmail) return json({ error: "该邮箱已被注册" }, 400);

      const checkName = await db.prepare("SELECT id FROM users WHERE username = ?").bind(name).first();
      if (checkName) return json({ error: "该昵称已被占用" }, 400);

      const result = await db.prepare("INSERT INTO users (email, username) VALUES (?, ?)").bind(mail, name).run();
      const userId = result.meta.last_row_id;

      const today = new Date().toLocaleDateString("zh-CN");
      if (env.RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "game@1024201.com",
            to: mail,
            subject: "欢迎来到 1024201 游戏中心",
            html: `<p>欢迎 <strong>${name}</strong> 来到1024201的游戏中心，请开心。</p><br><p>落款 1024201<br>${today}</p>`,
          }),
        });
      }

      return json({ success: true, user: { id: userId, email: mail, username: name } });
    }

    if (request.method === "POST" && action === "login") {
      const { email } = await request.json();
      const mail = email?.trim();
      if (!mail) return json({ error: "邮箱不能为空" }, 400);

      const user = await db.prepare("SELECT id, email, username FROM users WHERE email = ?").bind(mail).first();
      if (!user) return json({ error: "该邮箱尚未注册" }, 404);
      return json({ user });
    }

    if (request.method === "GET" && action === "search") {
      const q = url.searchParams.get("q")?.trim();
      if (!q) return json({ users: [] });

      const { results } = await db
        .prepare("SELECT id, username, email FROM users WHERE username LIKE ? LIMIT 20")
        .bind(`%${q}%`)
        .all();
      return json({ users: results });
    }

    return json({ error: "未知操作" }, 404);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
