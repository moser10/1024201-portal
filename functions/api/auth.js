import { corsHeaders, json, requireDb, generateUniqueName, ensureAppSchema, issueCliToken, verifyCliToken, revokeCliToken } from "./_shared.js";
import { hashPassword, verifyPassword, randomPassword, randomVerifyCode, randomCliVerifyCode } from "./_crypto.js";
import { sendSystemMail } from "./_mail.js";
import { parseUsername, parseNewEmail, parsePasswordPair } from "./authAccount.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function codeCaseLabel(code) {
  const hasUpper = /[A-Z]/.test(code);
  const hasLower = /[a-z]/.test(code);
  if (hasUpper && hasLower) {
    return { zh: "（其中包含大小写）", en: "(case-sensitive)" };
  }
  return { zh: "（其中不包含大小写）", en: "(not case-sensitive)" };
}

function welcomeEmailHtml(name, verifyCode, today, { cli = false } = {}) {
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(verifyCode);
  const caseNote = cli
    ? { zh: "（6 位数字，区分大小写不适用）", en: "(6-digit numeric code)" }
    : codeCaseLabel(verifyCode);
  const cliHintZh = cli
    ? "<p style=\"margin:0 0 8px;padding-left:1em;color:#636366;\">在终端执行：<code>1024 auth verify --email 你的邮箱 --code 注册码</code></p>"
    : "";
  const cliHintEn = cli
    ? "<p style=\"margin:0 0 8px;padding-left:1em;color:#636366;\">In terminal: <code>1024 auth verify --email your@email --code CODE</code></p>"
    : "";
  const pageZh = cli ? "在终端输入此注册码完成注册。" : "请在注册页面输入此验证码完成注册。";
  const pageEn = cli ? "Enter this code in the CLI to finish sign-up." : "Enter this code on the registration page to complete sign-up.";
  const codeLabelZh = cli ? "注册码" : "邮箱验证码";
  const codeLabelEn = cli ? "Registration code" : "Email verification code";
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.8;color:#1c1c1e;">
<p style="margin:0 0 14px;font-weight:600;color:#636366;">中文</p>
<p style="margin:0 0 12px;">欢迎 ${safeName}：</p>
<p style="margin:0 0 8px;padding-left:1em;">${codeLabelZh}：<strong style="font-size:18px;letter-spacing:2px;">${safeCode}</strong>${caseNote.zh}</p>
${cliHintZh}
<p style="margin:0 0 20px;padding-left:1em;">${pageZh}</p>
<p style="margin:0 0 14px;font-weight:600;color:#636366;">English</p>
<p style="margin:0 0 12px;">Welcome ${safeName},</p>
<p style="margin:0 0 8px;padding-left:1em;">${codeLabelEn}: <strong style="font-size:18px;letter-spacing:2px;">${safeCode}</strong> ${caseNote.en}</p>
${cliHintEn}
<p style="margin:0 0 20px;padding-left:1em;">${pageEn}</p>
<p style="margin:24px 0 0;"><strong>1024201</strong></p>
<p style="margin:0;">${today}</p>
</div>`;
}

function isCliClient(request, body) {
  return body?.client === "cli" || request.headers.get("X-1024201-Client") === "cli";
}

async function completePendingRegistration(db, pending) {
  if (await db.prepare("SELECT id FROM users WHERE email = ?").bind(pending.email).first()) {
    await db.prepare("DELETE FROM pending_registrations WHERE id = ?").bind(pending.id).run();
    return { ok: true, user: null, already: true };
  }
  if (await db.prepare("SELECT id FROM users WHERE username = ?").bind(pending.username).first()) {
    await db.prepare("DELETE FROM pending_registrations WHERE id = ?").bind(pending.id).run();
    return { ok: false, error: "昵称已被他人占用，请重新注册并更换昵称" };
  }
  const result = await db
    .prepare(
      `INSERT INTO users (email, username, password_hash, email_verified)
       VALUES (?, ?, ?, 1)`
    )
    .bind(pending.email, pending.username, pending.password_hash)
    .run();
  await db.prepare("DELETE FROM pending_registrations WHERE id = ?").bind(pending.id).run();
  if (pending.invitation_code) {
    await db
      .prepare("UPDATE registration_invitations SET used_at = datetime('now') WHERE code = ? AND used_at IS NULL")
      .bind(pending.invitation_code)
      .run();
  }
  const user = await db
    .prepare(
      `SELECT id, email, username, must_change_password, email_verified
       FROM users WHERE id = ?`
    )
    .bind(result.meta.last_row_id)
    .first();
  return { ok: true, user };
}

async function sendMail(env, to, subject, html) {
  return sendSystemMail(env, to, subject, html);
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    must_change_password: !!row.must_change_password,
    email_verified: true,
  };
}

function isValidEmail(email) {
  return EMAIL_RE.test(email);
}

function siteOrigin(request) {
  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin;
  return "https://1024201.com";
}

async function findUserByEmail(db, email) {
  return db
    .prepare(
      `SELECT id, email, username, password_hash, password_plain, temp_password, temp_password_expires,
              must_change_password, email_verified
       FROM users WHERE email = ?`
    )
    .bind(email)
    .first();
}

async function emailTaken(db, email) {
  return !!(await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first());
}

async function usernameTaken(db, username) {
  return !!(await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first());
}

async function validInvitation(db, code, email) {
  const cleanCode = String(code || "").trim();
  if (!cleanCode || !email) return null;
  return db
    .prepare(
      `SELECT code, email, is_special
       FROM registration_invitations
       WHERE code = ? AND lower(email) = lower(?) AND used_at IS NULL`
    )
    .bind(cleanCode, String(email).trim())
    .first();
}

async function verifyUserPassword(user, password) {
  if (user.password_hash && (await verifyPassword(password, user.password_hash))) return true;
  if (user.password_plain && password === user.password_plain) return true;
  if (user.temp_password && password === user.temp_password) {
    if (user.temp_password_expires && new Date(user.temp_password_expires) < new Date()) return false;
    return true;
  }
  return false;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = requireDb(env);

    if (request.method === "GET" && action === "me") {
      const id = Number(url.searchParams.get("user_id") || 0);
      if (!id) return json({ error: "account_gone" }, 401);
      try {
        const row = await db.prepare("SELECT id FROM users WHERE id = ?").bind(id).first();
        if (!row) return json({ error: "account_gone" }, 401);
        return json({ ok: true });
      } catch {
        await ensureAppSchema(db);
        const row = await db.prepare("SELECT id FROM users WHERE id = ?").bind(id).first();
        if (!row) return json({ error: "account_gone" }, 401);
        return json({ ok: true });
      }
    }

    await ensureAppSchema(db);

    if (request.method === "GET" && action === "verify") {
      return Response.redirect(`${siteOrigin(request)}/game/register/?verify=deprecated`, 302);
    }

    if (request.method === "POST" && action === "verify_code") {
      const body = await request.json();
      const { email, code } = body;
      const mail = email?.trim();
      let inputCode = code?.trim() || "";
      if (!mail || !inputCode) return json({ error: "邮箱和验证码不能为空" }, 400);

      const pending = await db
        .prepare(
          `SELECT * FROM pending_registrations
           WHERE email = ? AND expires_at > datetime('now')`
        )
        .bind(mail)
        .first();

      if (!pending) return json({ error: "验证码已过期，请重新发送注册邮件" }, 400);

      const cliChannel = pending.register_channel === "cli";
      if (cliChannel) {
        inputCode = inputCode.replace(/\s/g, "");
        if (!/^\d{6}$/.test(inputCode)) {
          return json({ error: "CLI 注册码为 6 位数字" }, 400);
        }
      }

      if ((pending.verify_attempts || 0) >= 5) {
        return json({ error: "验证码错误次数过多，请重新发送注册邮件", locked: true }, 403);
      }

      if (pending.verify_token !== inputCode) {
        const attempts = (pending.verify_attempts || 0) + 1;
        await db
          .prepare("UPDATE pending_registrations SET verify_attempts = ? WHERE id = ?")
          .bind(attempts, pending.id)
          .run();
        if (attempts >= 5) {
          return json({ error: "验证码错误次数过多，请重新发送注册邮件", locked: true }, 403);
        }
        return json({ error: "验证码错误", attempts_left: 5 - attempts, verify_attempts: attempts }, 400);
      }

      const done = await completePendingRegistration(db, pending);
      if (!done.ok) return json({ error: done.error }, 409);
      if (done.already) {
        const user = await findUserByEmail(db, mail);
        const payload = { success: true, user: publicUser(user) };
        if (cliChannel && isCliClient(request, body)) {
          payload.token = await issueCliToken(db, user.id);
        }
        return json(payload);
      }
      const payload = { success: true, user: publicUser(done.user) };
      if (cliChannel && isCliClient(request, body)) {
        payload.token = await issueCliToken(db, done.user.id);
      }
      return json(payload);
    }

    if (request.method === "POST" && action === "check") {
      const { username, email, invite_code } = await request.json();
      const name = username?.trim();
      if (!name) return json({ error: "昵称不能为空" }, 400);
      if (name.length < 6) {
        const invitation = await validInvitation(db, invite_code, email);
        if (!invitation) {
          return json({ error: "昵称至少需要 6 个字符" }, 400);
        }
      }
      if (await usernameTaken(db, name)) {
        const recommend = await generateUniqueName(db, name, "users", "username");
        return json({ available: false, recommend });
      }
      return json({ available: true });
    }

    if (request.method === "POST" && action === "check_email") {
      const { email } = await request.json();
      const mail = email?.trim();
      if (!mail) return json({ error: "邮箱不能为空" }, 400);
      if (!isValidEmail(mail)) return json({ available: false, error: "邮箱格式不正确" });
      return json({ available: !(await emailTaken(db, mail)) });
    }

    if (request.method === "POST" && action === "register") {
      const body = await request.json();
      const { email, username, password, invite_code } = body;
      const mail = email?.trim();
      const name = username?.trim();
      const pass = password?.trim();
      if (!mail || !name || !pass) return json({ error: "邮箱、昵称和密码不能为空" }, 400);
      if (!isValidEmail(mail)) return json({ error: "邮箱格式不正确" }, 400);
      if (pass.length < 6) return json({ error: "密码至少 6 位" }, 400);
      const inviteCode = String(invite_code || "").trim();
      const invitation = inviteCode ? await validInvitation(db, inviteCode, mail) : null;
      if (inviteCode && !invitation) {
        return json({ error: "邀请码无效、已使用或与当前邮箱不匹配" }, 400);
      }
      if (name.length < 6 && !invitation) {
        return json({ error: "昵称至少需要 6 个字符" }, 400);
      }

      const inUsers = await db.prepare("SELECT id FROM users WHERE email = ?").bind(mail).first();

      if (inUsers) {
        return json({ error: "该邮箱已被注册" }, 400);
      }
      if (await db.prepare("SELECT id FROM users WHERE username = ?").bind(name).first()) {
        return json({ error: "该昵称已被占用" }, 400);
      }

      const cliChannel = isCliClient(request, body);
      const passHash = await hashPassword(pass);
      const verifyCode = cliChannel ? randomCliVerifyCode() : randomVerifyCode(4);
      const channel = cliChannel ? "cli" : "web";

      await db.prepare("DELETE FROM pending_registrations WHERE email = ?").bind(mail).run();
      await db
        .prepare(
          `INSERT INTO pending_registrations
             (email, username, password_hash, verify_token, verify_attempts, expires_at, register_channel, invitation_code)
           VALUES (?, ?, ?, ?, 0, datetime('now', '+48 hours'), ?, ?)`
        )
        .bind(mail, name, passHash, verifyCode, channel, invitation?.code || null)
        .run();

      const today = new Date().toLocaleDateString("zh-CN");
      try {
        await sendMail(
          env,
          mail,
          cliChannel ? "1024201 · CLI 注册码 / CLI Registration Code" : "1024201 · 邮箱验证码 / Email Verification Code",
          welcomeEmailHtml(name, verifyCode, today, { cli: cliChannel })
        );
      } catch (err) {
        await db.prepare("DELETE FROM pending_registrations WHERE email = ?").bind(mail).run();
        throw err;
      }

      return json({
        success: true,
        verify_sent: true,
        channel,
        code_length: cliChannel ? 6 : 4,
        sent_at: new Date().toISOString(),
        verify_attempts: 0,
        message: cliChannel
          ? `注册邮件已发送至 ${mail}，请查收 6 位数字注册码，并执行 1024 auth verify。`
          : `注册邮件已发送至 ${mail}，请查收验证码并在页面输入完成注册。`,
      });
    }

    if (request.method === "POST" && action === "login") {
      const { email, password } = await request.json();
      const mail = email?.trim();
      const pass = password?.trim();
      if (!mail || !pass) return json({ error: "邮箱和密码不能为空" }, 400);

      const user = await findUserByEmail(db, mail);
      if (!user) return json({ error: "该邮箱尚未注册" }, 404);
      if (!(await verifyUserPassword(user, pass))) return json({ error: "密码错误" }, 401);

      if (user.temp_password && pass === user.temp_password) {
        await db.prepare("UPDATE users SET must_change_password = 1 WHERE id = ?").bind(user.id).run();
        user.must_change_password = 1;
      }
      if (user.password_plain && pass === user.password_plain) {
        const h = await hashPassword(pass);
        await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(h, user.id).run();
      }

      return json({ user: publicUser(user) });
    }

    if (request.method === "POST" && action === "cli_login") {
      const { email, password } = await request.json();
      const mail = email?.trim();
      const pass = password?.trim();
      if (!mail || !pass) return json({ error: "邮箱和密码不能为空" }, 400);

      const user = await findUserByEmail(db, mail);
      if (!user) return json({ error: "该邮箱尚未注册" }, 404);
      if (!(await verifyUserPassword(user, pass))) return json({ error: "密码错误" }, 401);

      const token = await issueCliToken(db, user.id);
      return json({ user: publicUser(user), token });
    }

    if (request.method === "GET" && action === "cli_whoami") {
      const auth = request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      const userId = await verifyCliToken(db, token);
      if (!userId) return json({ error: "login_required", needLogin: true }, 401);
      const user = await db
        .prepare("SELECT id, email, username, must_change_password, email_verified FROM users WHERE id = ?")
        .bind(userId)
        .first();
      if (!user) return json({ error: "login_required", needLogin: true }, 401);
      return json({ user: publicUser(user) });
    }

    if (request.method === "POST" && action === "cli_logout") {
      const auth = request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!token) return json({ error: "缺少令牌" }, 400);
      await revokeCliToken(db, token);
      return json({ ok: true });
    }

    if (request.method === "POST" && action === "cli_change_password") {
      const auth = request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      const userId = await verifyCliToken(db, token);
      if (!userId) return json({ error: "login_required", needLogin: true }, 401);

      const body = await request.json();
      const current = body?.current_password?.trim() || "";
      const password = body?.password?.trim() || "";
      const password2 = body?.password2?.trim() || "";
      if (!current) return json({ error: "请输入当前密码" }, 400);
      if (!password || password !== password2) return json({ error: "两次新密码不一致" }, 400);
      if (password.length < 6) return json({ error: "密码至少 6 位" }, 400);

      const user = await db
        .prepare("SELECT id, password_hash, password_plain, temp_password FROM users WHERE id = ?")
        .bind(userId)
        .first();
      if (!user) return json({ error: "login_required", needLogin: true }, 401);
      if (!(await verifyUserPassword(user, current))) return json({ error: "当前密码错误" }, 401);

      const passHash = await hashPassword(password);
      await db
        .prepare(
          `UPDATE users SET password_hash = ?, password_plain = ?, temp_password = NULL,
           temp_password_expires = NULL, must_change_password = 0 WHERE id = ?`
        )
        .bind(passHash, password, userId)
        .run();
      return json({
        success: true,
        message: "密码已更新。下次登录请使用新密码。",
      });
    }

    if (request.method === "POST" && action === "forgot") {
      const { email } = await request.json();
      const mail = email?.trim();
      if (!mail) return json({ error: "请输入注册邮箱" }, 400);
      const user = await findUserByEmail(db, mail);
      if (!user) return json({ error: "该邮箱尚未注册" }, 404);

      const temp = randomPassword(8);
      await db
        .prepare(
          "UPDATE users SET temp_password = ?, temp_password_expires = datetime('now', '+24 hours'), must_change_password = 1 WHERE id = ?"
        )
        .bind(temp, user.id)
        .run();

      await sendMail(
        env,
        mail,
        "1024201 · 临时密码 / Temporary Password",
        `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.8;color:#1c1c1e;">
<p style="margin:0 0 8px;">你的临时密码是：<strong>${temp}</strong></p>
<p style="margin:0 0 8px;">Your temporary password: <strong>${temp}</strong></p>
<p style="margin:0 0 8px;">请在 24 小时内使用临时密码登录，并按提示修改新密码。</p>
<p style="margin:0 0 16px;">Sign in within 24 hours using this password, then set a new one when prompted.</p>
<p style="margin:0;"><strong>1024201</strong></p>
</div>`
      );
      return json({ success: true, message: "临时密码已发送至邮箱" });
    }

    if (request.method === "POST" && action === "change_password") {
      const { user_id, password, password2, current_password } = await request.json();
      const parsed = parsePasswordPair(password, password2);
      if (parsed.error === "pass_mismatch") return json({ error: "两次密码不一致" }, 400);
      if (parsed.error) return json({ error: "密码至少 6 位" }, 400);
      const row = await db
        .prepare(
          "SELECT id, password_hash, password_plain, temp_password, temp_password_expires FROM users WHERE id = ?"
        )
        .bind(user_id)
        .first();
      if (!row) return json({ error: "login_required" }, 401);
      if (current_password != null && current_password !== "") {
        if (!(await verifyUserPassword(row, current_password))) return json({ error: "当前密码错误" }, 401);
      }

      const passHash = await hashPassword(parsed.password);
      await db
        .prepare(
          `UPDATE users SET password_hash = ?, password_plain = ?, temp_password = NULL,
           temp_password_expires = NULL, must_change_password = 0 WHERE id = ?`
        )
        .bind(passHash, parsed.password, user_id)
        .run();
      return json({
        success: true,
        message: "密码已更新。下次登录请使用新密码；本次无需退出，可继续游戏。",
      });
    }

    if (request.method === "POST" && action === "change_username") {
      const { user_id, username } = await request.json();
      const parsed = parseUsername(username);
      if (parsed.error === "empty_name") return json({ error: "昵称不能为空" }, 400);
      if (parsed.error) return json({ error: "昵称至少需要 6 个字符" }, 400);
      const row = await db.prepare("SELECT id, username FROM users WHERE id = ?").bind(user_id).first();
      if (!row) return json({ error: "login_required" }, 401);
      if (row.username !== parsed.username) {
        const taken = await db
          .prepare("SELECT id FROM users WHERE username = ? AND id != ?")
          .bind(parsed.username, user_id)
          .first();
        if (taken) {
          const recommend = await generateUniqueName(db, parsed.username, "users", "username");
          return json({ error: "昵称已被占用", recommend }, 409);
        }
        await db.prepare("UPDATE users SET username = ? WHERE id = ?").bind(parsed.username, user_id).run();
      }
      const user = await db
        .prepare("SELECT id, email, username, must_change_password, email_verified FROM users WHERE id = ?")
        .bind(user_id)
        .first();
      return json({ success: true, user: publicUser(user) });
    }

    if (request.method === "POST" && action === "request_email_change") {
      const { user_id, email, password } = await request.json();
      const row = await db
        .prepare(
          "SELECT id, email, password_hash, password_plain, temp_password, temp_password_expires FROM users WHERE id = ?"
        )
        .bind(user_id)
        .first();
      if (!row) return json({ error: "login_required" }, 401);
      if (!(await verifyUserPassword(row, password))) return json({ error: "当前密码错误" }, 401);
      const parsed = parseNewEmail(email, row.email);
      if (parsed.error === "same_email") return json({ error: "新邮箱与当前邮箱相同" }, 400);
      if (parsed.error) return json({ error: "邮箱格式不正确" }, 400);
      if (await emailTaken(db, parsed.email)) return json({ error: "该邮箱已被占用" }, 409);
      const code = randomVerifyCode(4);
      await db
        .prepare(
          `UPDATE users SET email_change_to = ?, email_change_code = ?, email_change_attempts = 0,
           email_change_expires = datetime('now', '+30 minutes') WHERE id = ?`
        )
        .bind(parsed.email, code, user_id)
        .run();
      await sendMail(
        env,
        parsed.email,
        "1024201 · 更换邮箱验证码 / Email change code",
        `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.8;color:#1c1c1e;">
<p style="margin:0 0 8px;">你的更换邮箱验证码：<strong style="font-size:18px;letter-spacing:2px;">${code}</strong></p>
<p style="margin:0 0 16px;">Your email-change code: <strong>${code}</strong></p>
<p style="margin:0;">30 分钟内在设置页输入即可。 / Enter it on Settings within 30 minutes.</p>
</div>`
      );
      return json({ success: true, sent: true, email: parsed.email });
    }

    if (request.method === "POST" && action === "confirm_email_change") {
      const { user_id, code } = await request.json();
      const input = String(code || "").trim();
      const row = await db
        .prepare(
          `SELECT id, email_change_to, email_change_code, email_change_expires, email_change_attempts
           FROM users WHERE id = ?`
        )
        .bind(user_id)
        .first();
      if (!row) return json({ error: "login_required" }, 401);
      if (!row.email_change_to || !row.email_change_code) return json({ error: "请先发送验证码" }, 400);
      if (row.email_change_expires && new Date(row.email_change_expires) < new Date()) {
        return json({ error: "验证码已过期" }, 400);
      }
      if ((row.email_change_attempts || 0) >= 5) return json({ error: "验证码错误次数过多" }, 403);
      if (row.email_change_code !== input) {
        const attempts = (row.email_change_attempts || 0) + 1;
        await db.prepare("UPDATE users SET email_change_attempts = ? WHERE id = ?").bind(attempts, user_id).run();
        return json({ error: "验证码错误", attempts_left: 5 - attempts }, 400);
      }
      if (await emailTaken(db, row.email_change_to)) return json({ error: "该邮箱已被占用" }, 409);
      await db
        .prepare(
          `UPDATE users SET email = ?, email_verified = 1, email_change_to = NULL, email_change_code = NULL,
           email_change_expires = NULL, email_change_attempts = 0 WHERE id = ?`
        )
        .bind(row.email_change_to, user_id)
        .run();
      const user = await db
        .prepare("SELECT id, email, username, must_change_password, email_verified FROM users WHERE id = ?")
        .bind(user_id)
        .first();
      return json({ success: true, user: publicUser(user) });
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
    const msg = err.message || "";
    if (msg.includes("no such column") && msg.includes("password")) {
      return json(
        { error: "数据库未升级：请在 D1 Console 执行 schema-migrate.sql，或重试请求以触发自动迁移" },
        503
      );
    }
    return json({ error: err.message }, 500);
  }
}
