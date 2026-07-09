import { ApiError, authPost } from "./api.js";
import { loadConfig, saveConfig } from "./config.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASS_MISMATCH = 5;
const MAX_CODE_ATTEMPTS = 5;

export async function promptAvailableEmail(prompt) {
  while (true) {
    const email = await prompt("请输入注册邮箱：");
    if (!email) {
      console.log("邮箱不能为空，请重新输入。");
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      console.log("邮箱格式不正确，请重新输入。");
      continue;
    }
    try {
      const data = await authPost("check_email", { email }, { auth: false });
      if (data.available) return email;
      console.log("该邮箱已被注册，请换一个邮箱。");
    } catch (err) {
      throw friendlyApiError(err, "邮箱校验失败");
    }
  }
}

export async function promptAvailableUsername(prompt) {
  while (true) {
    const username = await prompt("请输入昵称（唯一，将显示为 @昵称）：");
    if (!username) {
      console.log("昵称不能为空，请重新输入。");
      continue;
    }
    if (username.length > 20) {
      console.log("昵称不能超过 20 个字符，请重新输入。");
      continue;
    }
    try {
      const data = await authPost("check", { username }, { auth: false });
      if (data.available) return username;
      const tip = data.recommend ? `推荐昵称：${data.recommend}` : "请换一个昵称";
      console.log(`昵称「${username}」已被占用。${tip}`);
    } catch (err) {
      throw friendlyApiError(err, "昵称校验失败");
    }
  }
}

export async function promptPasswordPair(prompt, labels = {}) {
  const {
    first = "请设置登录密码（至少 6 位）：",
    second = "请再次输入密码确认：",
    retryHint = "两次输入的密码不一致，请重新输入。",
    exhausted = "两次密码不一致次数过多，请重新执行命令。",
  } = labels;
  let mismatch = 0;
  while (mismatch < MAX_PASS_MISMATCH) {
    const password = await prompt(first, { secret: true });
    if (!password || password.length < 6) {
      console.log("密码至少需要 6 位，请重新设置。");
      continue;
    }
    const password2 = await prompt(second, { secret: true });
    if (password === password2) return password;
    mismatch += 1;
    const left = MAX_PASS_MISMATCH - mismatch;
    if (left <= 0) throw new Error(exhausted);
    console.log(`${retryHint}（还剩 ${left} 次机会）`);
  }
  throw new Error("无法设置密码，请稍后重试。");
}

export async function promptRegistrationCode(prompt, email) {
  let attempts = 0;
  while (attempts < MAX_CODE_ATTEMPTS) {
    let code = await prompt(`注册码已发送至 ${email}，请输入邮件中的 6 位注册码：`);
    code = String(code).replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) {
      console.log("注册码须为 6 位数字，请重新输入。");
      continue;
    }
    try {
      const data = await authPost("verify_code", { email, code }, { auth: false });
      return data;
    } catch (err) {
      if (err instanceof ApiError) {
        attempts += 1;
        const left = err.body?.attempts_left ?? MAX_CODE_ATTEMPTS - attempts;
        if (err.body?.locked || left <= 0) {
          throw new Error("注册码错误次数过多，请重新执行 1024 auth register 获取新邮件。");
        }
        console.log(`注册码错误，请重新输入。（还剩 ${left} 次机会）`);
        continue;
      }
      throw err;
    }
  }
  throw new Error("注册码验证失败次数过多，请重新注册。");
}

export async function runInteractiveRegister(prompt, { email: presetEmail, username: presetUser, password: presetPass } = {}) {
  console.log("1024201 命令行注册 — 按提示逐步完成\n");

  const email = presetEmail || (await promptAvailableEmail(prompt));
  if (presetEmail) await ensureEmailAvailable(presetEmail);

  const username = presetUser || (await promptAvailableUsername(prompt));
  if (presetUser) await ensureUsernameAvailable(presetUser);

  const password = presetPass || (await promptPasswordPair(prompt));
  if (presetPass && presetPass.length < 6) throw new Error("密码至少需要 6 位");

  const reg = await authPost("register", { email, username, password }, { auth: false });
  console.log(`\n${reg.message || "注册邮件已发送。"}`);

  const verified = await promptRegistrationCode(prompt, email);
  if (verified.token) {
    saveConfig({
      token: verified.token,
      user_id: verified.user.id,
      username: verified.user.username,
    });
  }

  console.log(`\n注册成功！当前账户：@${verified.user.username}`);
  console.log("可使用以下命令查看登录状态：");
  console.log("  1024 auth whoami");
  return verified;
}

export async function runInteractivePasswd(prompt, { requireLogin = true } = {}) {
  const cfg = loadConfig();
  if (requireLogin && !cfg.token) {
    throw new Error("请先登录：1024 auth login");
  }

  console.log("修改登录密码 — 按提示完成\n");
  const current = await prompt("请输入当前密码：", { secret: true });
  const password = await promptPasswordPair(prompt, {
    first: "请设置新密码（至少 6 位）：",
    second: "请再次输入新密码确认：",
    retryHint: "两次输入的新密码不一致，请重新输入。",
    exhausted: "两次新密码不一致次数过多，请重新执行 1024 auth passwd。",
  });

  const data = await authPost(
    "cli_change_password",
    { current_password: current, password, password2: password },
    { auth: true }
  );

  console.log(`\n${data.message || "密码已更新。"}`);
  console.log("下次登录请使用新密码。可用 1024 auth whoami 确认当前账户。");
  return data;
}

async function ensureEmailAvailable(email) {
  const data = await authPost("check_email", { email }, { auth: false });
  if (!data.available) throw new Error("该邮箱已被注册，请换一个邮箱。");
}

async function ensureUsernameAvailable(username) {
  const data = await authPost("check", { username }, { auth: false });
  if (!data.available) {
    const tip = data.recommend ? `推荐：${data.recommend}` : "";
    throw new Error(`昵称「${username}」已被占用。${tip}`);
  }
}

function friendlyApiError(err, fallback) {
  if (err instanceof ApiError) return new Error(err.message || fallback);
  return err;
}

/** 非交互：带校验的快速注册（仍须单独 verify） */
export async function registerWithChecks({ email, username, password }) {
  await ensureEmailAvailable(email);
  await ensureUsernameAvailable(username);
  if (!password || password.length < 6) throw new Error("密码至少需要 6 位");
  return authPost("register", { email, username, password }, { auth: false });
}
