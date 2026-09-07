import { corsHeaders, json, requireDb, ensureAppSchema } from "./_shared.js";
import { hashPassword, verifyPassword } from "./_crypto.js";

const SESSION_HOURS = 12;
const DEFAULT_ADMIN_USER = "sa";
const DEFAULT_ADMIN_PASS = "1qaz2wsx";
const DEFAULT_ADMIN_MAIL = "admin@1024201.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ensureAdminSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_auth (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        username TEXT NOT NULL DEFAULT 'sa',
        password_hash TEXT,
        password_plain TEXT,
        temp_password TEXT,
        temp_password_used_at TEXT,
        adminmail TEXT,
        must_change_password INTEGER NOT NULL DEFAULT 0
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        expires_at TEXT NOT NULL
      )`
    )
    .run();

  const cols = await db.prepare("PRAGMA table_info(admin_auth)").all();
  const names = new Set((cols.results || []).map((c) => c.name));
  if (!names.has("must_change_password")) {
    await db
      .prepare("ALTER TABLE admin_auth ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0")
      .run()
      .catch(() => {});
  }
  if (!names.has("adminmail")) {
    await db.prepare("ALTER TABLE admin_auth ADD COLUMN adminmail TEXT").run().catch(() => {});
  }

  const row = await db.prepare("SELECT id, adminmail FROM admin_auth WHERE id = 1").first();
  if (!row) {
    const h = await hashPassword(DEFAULT_ADMIN_PASS);
    await db
      .prepare(
        `INSERT INTO admin_auth (id, username, password_hash, password_plain, adminmail, must_change_password)
         VALUES (1, ?, ?, NULL, ?, 1)`
      )
      .bind(DEFAULT_ADMIN_USER, h, DEFAULT_ADMIN_MAIL)
      .run();
  } else if (!row.adminmail) {
    await db
      .prepare("UPDATE admin_auth SET adminmail = ? WHERE id = 1 AND (adminmail IS NULL OR adminmail = '')")
      .bind(DEFAULT_ADMIN_MAIL)
      .run();
  }
}

async function sendAdminMail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) {
    throw new Error("邮件服务未配置（RESEND_API_KEY）");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: "admin@1024201.com", to, subject, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`邮件发送失败 (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getAdminRow(db) {
  return db.prepare("SELECT * FROM admin_auth WHERE id = 1").first();
}

async function verifyAdminLogin(db, username, password) {
  const row = await getAdminRow(db);
  if (!row || row.username !== username) return { ok: false };

  if (row.password_hash && (await verifyPassword(password, row.password_hash))) {
    return { ok: true, row, via: "hash" };
  }
  if (row.password_plain && password === row.password_plain) {
    const h = await hashPassword(password);
    await db
      .prepare("UPDATE admin_auth SET password_hash = ?, password_plain = NULL WHERE id = 1")
      .bind(h)
      .run();
    return { ok: true, row, via: "plain" };
  }
  if (row.temp_password && password === row.temp_password) {
    const used = row.temp_password_used_at ? new Date(row.temp_password_used_at).getTime() : 0;
    if (used && Date.now() - used > 24 * 3600 * 1000) return { ok: false };
    if (!row.temp_password_used_at) {
      await db.prepare("UPDATE admin_auth SET temp_password_used_at = datetime('now') WHERE id = 1").run();
    }
    return { ok: true, row, via: "temp" };
  }
  return { ok: false };
}

function needsPasswordChange(row, via) {
  if (via === "temp") return true;
  if (Number(row.must_change_password) === 1) return true;
  return false;
}

async function requireAdmin(request, db) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("未登录管理后台"), { status: 401 });
  const session = await db
    .prepare("SELECT * FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')")
    .bind(token)
    .first();
  if (!session) throw Object.assign(new Error("管理会话已过期，请重新登录"), { status: 401 });
  return token;
}

async function deleteRoomCompletely(db, storyId) {
  await db.prepare("DELETE FROM content_stream WHERE story_id = ?").bind(storyId).run();
  await db.prepare("DELETE FROM story_members WHERE story_id = ?").bind(storyId).run();
  await db.prepare("DELETE FROM room_presence WHERE story_id = ?").bind(storyId).run();
  await db.prepare("DELETE FROM stories WHERE id = ?").bind(storyId).run();
}

/** Soft-close room: players cannot join/play; novel content is preserved for restore. */
async function closeRoom(db, storyId) {
  const story = await db.prepare("SELECT id, room_deleted_at FROM stories WHERE id = ?").bind(storyId).first();
  if (!story) throw Object.assign(new Error("房间不存在"), { status: 404 });
  if (story.room_deleted_at) return;
  await db.prepare("UPDATE stories SET room_deleted_at = datetime('now') WHERE id = ?").bind(storyId).run();
  await db.prepare("DELETE FROM room_presence WHERE story_id = ?").bind(storyId).run();
}

async function restoreRoom(db, storyId) {
  const story = await db.prepare("SELECT id, room_deleted_at FROM stories WHERE id = ?").bind(storyId).first();
  if (!story) throw Object.assign(new Error("房间不存在"), { status: 404 });
  if (!story.room_deleted_at) return;
  await db.prepare("UPDATE stories SET room_deleted_at = NULL WHERE id = ?").bind(storyId).run();
}

/** Permanently wipe novel writing content; room shell / members stay. */
async function deleteNovelContent(db, storyId) {
  const story = await db.prepare("SELECT id FROM stories WHERE id = ?").bind(storyId).first();
  if (!story) throw Object.assign(new Error("小说不存在"), { status: 404 });
  await db.prepare("DELETE FROM content_stream WHERE story_id = ?").bind(storyId).run();
  await db
    .prepare("UPDATE stories SET chapters_json = NULL, writing_state_json = NULL WHERE id = ?")
    .bind(storyId)
    .run();
}

async function deleteUserCompletely(db, userId) {
  if (userId === null || userId === undefined || !Number.isFinite(Number(userId))) {
    throw new Error("无效用户 ID");
  }
  const uid = Number(userId);
  const { results: owned } = await db.prepare("SELECT id FROM stories WHERE owner_id = ?").bind(uid).all();
  for (const row of owned) {
    await deleteRoomCompletely(db, row.id);
  }
  await db.prepare("DELETE FROM content_stream WHERE user_id = ?").bind(uid).run();
  await db.prepare("DELETE FROM recall_logs WHERE user_id = ?").bind(uid).run();
  await db.prepare("DELETE FROM room_presence WHERE user_id = ?").bind(uid).run();
  await db.prepare("DELETE FROM story_members WHERE user_id = ?").bind(uid).run();
  await db.prepare("DELETE FROM user_sync_notes WHERE user_id = ?").bind(uid).run();
  await db.prepare("DELETE FROM tool_usage_quota WHERE quota_key = ?").bind(String(uid)).run();
  const user = await db.prepare("SELECT email FROM users WHERE id = ?").bind(uid).first();
  if (user?.email) {
    await db.prepare("DELETE FROM pending_registrations WHERE email = ?").bind(user.email).run();
  }
  await db.prepare("DELETE FROM users WHERE id = ?").bind(uid).run();
}

function gameLabel(gameId, title) {
  const map = { osn: "OSN" };
  const prefix = map[gameId] || gameId?.toUpperCase() || "GAME";
  return `${prefix}-${title}`;
}

function randomTempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = requireDb(env);
    await ensureAdminSchema(db);
    await ensureAppSchema(db);

    if (request.method === "POST" && action === "login") {
      const { username, password } = await request.json();
      const result = await verifyAdminLogin(db, username?.trim(), password);
      if (!result.ok) return json({ error: "用户名或密码错误" }, 401);

      const token = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO admin_sessions (token, expires_at)
           VALUES (?, datetime('now', '+${SESSION_HOURS} hours'))`
        )
        .bind(token)
        .run();
      const mustChange =
        needsPasswordChange(result.row, result.via) ||
        (result.via === "plain" && password === DEFAULT_ADMIN_PASS) ||
        (result.via === "hash" && password === DEFAULT_ADMIN_PASS);
      if (mustChange && Number(result.row.must_change_password) !== 1) {
        await db.prepare("UPDATE admin_auth SET must_change_password = 1 WHERE id = 1").run();
      }
      return json({
        success: true,
        token,
        username: result.row.username,
        adminmail: result.row.adminmail || DEFAULT_ADMIN_MAIL,
        mustChangePassword: mustChange,
        sessionHours: SESSION_HOURS,
      });
    }

    const token = await requireAdmin(request, db);
    const admin = await getAdminRow(db);

    if (request.method === "GET" && action === "me") {
      return json({
        username: admin?.username || DEFAULT_ADMIN_USER,
        adminmail: admin?.adminmail || "",
        mustChangePassword: Number(admin?.must_change_password) === 1 || !!admin?.temp_password,
        sessionHours: SESSION_HOURS,
        loginUrl: "https://1024201.com/game/gamebgp/",
      });
    }

    if (request.method === "POST" && action === "logout") {
      await db.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(token).run();
      return json({ success: true });
    }

    if (request.method === "POST" && action === "save_adminmail") {
      const body = await request.json().catch(() => ({}));
      const mail = String(body?.adminmail || "").trim().toLowerCase();
      if (!EMAIL_RE.test(mail)) return json({ error: "管理员邮箱格式不正确" }, 400);
      await db.prepare("UPDATE admin_auth SET adminmail = ? WHERE id = 1").bind(mail).run();
      return json({ success: true, adminmail: mail });
    }

    if (request.method === "POST" && action === "change_password") {
      const body = await request.json().catch(() => ({}));
      const current = String(body?.current_password || "");
      const next = String(body?.password || "").trim();
      const next2 = String(body?.password2 || "").trim();
      if (next.length < 8) return json({ error: "新密码至少 8 位" }, 400);
      if (next !== next2) return json({ error: "两次新密码不一致" }, 400);
      if (next === current) return json({ error: "新密码不能与当前密码相同" }, 400);
      if (next === DEFAULT_ADMIN_PASS) return json({ error: "请勿使用系统默认密码" }, 400);

      const mail = String(admin?.adminmail || "").trim();
      if (!EMAIL_RE.test(mail)) {
        return json({ error: "请先在设置中填写管理员邮箱（adminmail），改密后将发邮件通知" }, 400);
      }

      const check = await verifyAdminLogin(db, admin.username, current);
      if (!check.ok) return json({ error: "当前密码不正确" }, 401);

      const h = await hashPassword(next);
      await db
        .prepare(
          `UPDATE admin_auth SET
             password_hash = ?,
             password_plain = ?,
             temp_password = NULL,
             temp_password_used_at = NULL,
             must_change_password = 0
           WHERE id = 1`
        )
        .bind(h, next)
        .run();
      await db.prepare("DELETE FROM admin_sessions WHERE token != ?").bind(token).run();

      const when = new Date().toISOString();
      let emailSent = false;
      let emailError = "";
      try {
        await sendAdminMail(
          env,
          mail,
          "【1024201】管理后台密码已更改",
          `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.6;color:#1d1d1f">
<p>你好，</p>
<p>管理后台账号 <strong>${escHtml(admin.username)}</strong> 的密码已更改。</p>
<p style="margin:16px 0;padding:12px 14px;background:#f5f5f7;border-radius:10px">
  <strong>新密码（明文）：</strong><code style="font-size:16px">${escHtml(next)}</code>
</p>
<p>登录地址：<a href="https://1024201.com/game/gamebgp/">https://1024201.com/game/gamebgp/</a></p>
<p style="color:#6e6e73;font-size:13px">时间（UTC）：${escHtml(when)}<br>若非本人操作，请立即登录后台再次修改密码。</p>
</div>`
        );
        emailSent = true;
      } catch (e) {
        emailError = e.message || "邮件发送失败";
      }

      return json({ success: true, emailSent, emailError, adminmail: mail });
    }

    if (request.method === "GET" && action === "overview") {
      const users = await db.prepare("SELECT COUNT(*) AS n FROM users").first();
      const rooms = await db
        .prepare("SELECT COUNT(*) AS n FROM stories WHERE room_deleted_at IS NULL")
        .first();
      const pending = await db.prepare("SELECT COUNT(*) AS n FROM pending_registrations").first().catch(() => ({ n: 0 }));
      return json({
        users: users?.n || 0,
        rooms: rooms?.n || 0,
        pending: pending?.n || 0,
      });
    }

    if (request.method === "GET" && action === "users") {
      const q = (url.searchParams.get("q") || "").trim();
      let results;
      if (q) {
        const like = `%${q}%`;
        ({ results } = await db
          .prepare(
            `SELECT id, username, email, datetime(created_at, 'localtime') AS created_at,
                    must_change_password,
                    CASE WHEN temp_password IS NOT NULL THEN 1 ELSE 0 END AS has_temp_password
             FROM users
             WHERE username LIKE ? OR email LIKE ?
             ORDER BY id DESC
             LIMIT 200`
          )
          .bind(like, like)
          .all());
      } else {
        ({ results } = await db
          .prepare(
            `SELECT id, username, email, datetime(created_at, 'localtime') AS created_at,
                    must_change_password,
                    CASE WHEN temp_password IS NOT NULL THEN 1 ELSE 0 END AS has_temp_password
             FROM users ORDER BY id DESC LIMIT 200`
          )
          .all());
      }
      return json({ users: results });
    }

    if (request.method === "POST" && action === "reset_user_password") {
      const { user_id } = await request.json();
      const uid = Number(user_id);
      if (!Number.isFinite(uid)) return json({ error: "无效用户 ID" }, 400);
      const user = await db.prepare("SELECT id, username, email FROM users WHERE id = ?").bind(uid).first();
      if (!user) return json({ error: "用户不存在" }, 404);
      const temp = randomTempPassword();
      await db
        .prepare(
          `UPDATE users SET
             temp_password = ?,
             temp_password_expires = datetime('now', '+24 hours'),
             must_change_password = 1
           WHERE id = ?`
        )
        .bind(temp, uid)
        .run();
      return json({
        success: true,
        user_id: uid,
        username: user.username,
        email: user.email,
        temp_password: temp,
        expires_in_hours: 24,
      });
    }

    if (request.method === "GET" && action === "rooms") {
      const q = (url.searchParams.get("q") || "").trim();
      let results;
      if (q) {
        const like = `%${q}%`;
        ({ results } = await db
          .prepare(
            `SELECT s.id, s.game_id, s.title, s.invite_code, s.room_deleted_at,
                    datetime(s.created_at, 'localtime') AS created_at,
                    CASE WHEN s.chapters_json IS NOT NULL AND length(s.chapters_json) > 2 THEN 1
                         WHEN EXISTS (SELECT 1 FROM content_stream c WHERE c.story_id = s.id AND c.type = 'book' AND c.status = 'active') THEN 1
                         ELSE 0 END AS has_novel,
                    u.username AS owner_name
             FROM stories s JOIN users u ON s.owner_id = u.id
             WHERE s.title LIKE ? OR s.invite_code LIKE ? OR u.username LIKE ?
             ORDER BY s.id DESC
             LIMIT 200`
          )
          .bind(like, like, like)
          .all());
      } else {
        ({ results } = await db
          .prepare(
            `SELECT s.id, s.game_id, s.title, s.invite_code, s.room_deleted_at,
                    datetime(s.created_at, 'localtime') AS created_at,
                    CASE WHEN s.chapters_json IS NOT NULL AND length(s.chapters_json) > 2 THEN 1
                         WHEN EXISTS (SELECT 1 FROM content_stream c WHERE c.story_id = s.id AND c.type = 'book' AND c.status = 'active') THEN 1
                         ELSE 0 END AS has_novel,
                    u.username AS owner_name
             FROM stories s JOIN users u ON s.owner_id = u.id
             ORDER BY s.id DESC
             LIMIT 200`
          )
          .all());
      }
      return json({
        rooms: results.map((r) => ({
          ...r,
          room_closed: !!r.room_deleted_at,
          has_novel: !!r.has_novel,
          display_name: gameLabel(r.game_id, r.title),
          full_name: r.game_id === "osn" ? "One Sentence Novel" : r.title,
        })),
      });
    }

    if (request.method === "POST" && action === "delete_user") {
      const { user_id } = await request.json();
      await deleteUserCompletely(db, user_id);
      return json({ success: true });
    }

    if (request.method === "POST" && action === "delete_room") {
      const { story_id } = await request.json();
      if (story_id === null || story_id === undefined || !Number.isFinite(Number(story_id))) {
        return json({ error: "无效房间 ID" }, 400);
      }
      await closeRoom(db, Number(story_id));
      return json({ success: true, closed: true });
    }

    if (request.method === "POST" && action === "restore_room") {
      const { story_id } = await request.json();
      if (story_id === null || story_id === undefined || !Number.isFinite(Number(story_id))) {
        return json({ error: "无效房间 ID" }, 400);
      }
      await restoreRoom(db, Number(story_id));
      return json({ success: true, restored: true });
    }

    if (request.method === "POST" && action === "delete_novel") {
      const { story_id } = await request.json();
      if (story_id === null || story_id === undefined || !Number.isFinite(Number(story_id))) {
        return json({ error: "无效小说 ID" }, 400);
      }
      await deleteNovelContent(db, Number(story_id));
      return json({ success: true });
    }

    return json({ error: "未知操作" }, 404);
  } catch (err) {
    const status = err.status || (String(err.message || "").includes("未登录") || String(err.message || "").includes("会话") ? 401 : 500);
    return json({ error: err.message }, status);
  }
}
