import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ApiError, authGet, authPost, portalGet, portalPost } from "./api.js";
import { clearAuth, configPath, loadConfig, saveConfig, VERSION } from "./config.js";
import {
  promptRegistrationCode,
  registerWithChecks,
  runInteractivePasswd,
  runInteractiveRegister,
} from "./authFlow.js";
import { parseArgs } from "./parse.js";

function print(data, asJson) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (typeof data === "string") {
    console.log(data);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

function printQuota(label, q, asJson) {
  if (asJson) {
    print({ tool: label, ...q }, true);
    return;
  }
  const who = q.loggedIn ? "registered" : "guest";
  console.log(`${label}: ${q.remaining}/${q.allowed} left today (${who}, used ${q.uses})`);
}

async function promptLine(question, { secret = false } = {}) {
  if (!secret || !input.isTTY) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  }
  process.stdout.write(question);
  return new Promise((resolve) => {
    let buf = "";
    const onData = (chunk) => {
      const s = chunk.toString("utf8");
      for (const ch of s) {
        if (ch === "\n" || ch === "\r") {
          input.off("data", onData);
          if (input.isTTY) input.setRawMode(false);
          process.stdout.write("\n");
          resolve(buf.trim());
          return;
        }
        if (ch === "\u0003") {
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (buf.length) buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function cmdAuth(sub, flags, asJson) {
  if (sub === "logout") {
    const cfg = loadConfig();
    if (cfg.token) {
      try {
        await authPost("cli_logout", {}, { auth: true });
      } catch {
        /* local clear even if remote fails */
      }
    }
    clearAuth();
    print(asJson ? { ok: true } : "Logged out.", asJson);
    return;
  }

  if (sub === "whoami") {
    const data = await authGet("cli_whoami", { auth: true });
    print(asJson ? data : `@${data.user.username} (id ${data.user.id})`, asJson);
    return;
  }

  if (sub === "token") {
    const cfg = loadConfig();
    if (!cfg.token) throw new Error("Not logged in. Run: 1024 auth login");
    const masked = `${cfg.token.slice(0, 6)}…${cfg.token.slice(-4)}`;
    print(asJson ? { token: cfg.token, masked, path: configPath() } : `${masked}\n(${configPath()})`, asJson);
    return;
  }

  if (sub === "login") {
    const email = flags.email || (await promptLine("Email: "));
    const password = flags.password || (await promptLine("Password: ", { secret: true }));
    const data = await authPost("cli_login", { email, password }, { auth: false });
    saveConfig({
      token: data.token,
      user_id: data.user.id,
      username: data.user.username,
    });
    print(asJson ? { user: data.user } : `Logged in as @${data.user.username}`, asJson);
    return;
  }

  if (sub === "register") {
    const interactive = input.isTTY && !(flags.email && flags.username && flags.password);
    if (interactive) {
      const data = await runInteractiveRegister(
        (q, opts) => promptLine(q, opts),
        { email: flags.email, username: flags.username || flags.user, password: flags.password }
      );
      return print(asJson ? data : undefined, asJson);
    }
    const email = flags.email || (await promptLine("Email: "));
    const username = flags.username || flags.user || (await promptLine("Username: "));
    const password = flags.password || (await promptLine("Password: ", { secret: true }));
    const data = await registerWithChecks({ email, username, password });
    print(
      asJson ? data : `${data.message}\nThen run: 1024 auth verify --email ${email} --code 六位注册码`,
      asJson
    );
    return;
  }

  if (sub === "verify") {
    const email = flags.email || (await promptLine("Email: "));
    if (input.isTTY && !flags.code) {
      const data = await promptRegistrationCode((q) => promptLine(q), email);
      if (data.token) {
        saveConfig({ token: data.token, user_id: data.user.id, username: data.user.username });
      }
      print(
        asJson ? data : `注册成功！当前账户 @${data.user.username}\n使用 1024 auth whoami 查看登录状态`,
        asJson
      );
      return;
    }
    let code = flags.code || (await promptLine("6-digit code: "));
    code = String(code).replace(/\s/g, "");
    const data = await authPost("verify_code", { email, code }, { auth: false });
    if (data.token) {
      saveConfig({ token: data.token, user_id: data.user.id, username: data.user.username });
    }
    print(
      asJson
        ? data
        : `注册成功！@${data.user.username}\n使用 1024 auth whoami 查看登录状态`,
      asJson
    );
    return;
  }

  if (sub === "passwd" || sub === "password") {
    if (input.isTTY && !flags.password) {
      const data = await runInteractivePasswd((q, opts) => promptLine(q, opts));
      return print(asJson ? data : undefined, asJson);
    }
    const cfg = loadConfig();
    if (!cfg.token) throw new Error("请先登录：1024 auth login");
    const current = flags.current || (await promptLine("Current password: ", { secret: true }));
    const password = flags.password || (await promptLine("New password: ", { secret: true }));
    const password2 = flags.password2 || flags["password-confirm"] || (await promptLine("Confirm new password: ", { secret: true }));
    const data = await authPost("cli_change_password", { current_password: current, password, password2 }, { auth: true });
    print(asJson ? data : data.message || "Password updated.", asJson);
    return;
  }

  throw new Error("Usage: 1024 auth register|verify|login|passwd|logout|whoami|token");
}

async function cmdGeo(asJson) {
  const data = await portalGet("geo", {}, { auth: false });
  if (asJson) return print(data, true);
  const proxy = data.proxy ? " · proxy/VPN" : "";
  console.log(`${data.label || "—"}${proxy}`);
  console.log(data.ip || "");
  console.log(`Network: ${data.networkType || "—"} · Purity ${data.purity ?? "—"}%`);
}

async function cmdQuota(flags, asJson) {
  const [lyrics, pdf] = await Promise.all([
    portalGet("lyrics_quota", {}, { auth: true }),
    portalGet("pdf_quota", {}, { auth: true }),
  ]);
  if (asJson) {
    print({ lyrics, pdf }, true);
    return;
  }
  printQuota("lyrics", lyrics, false);
  printQuota("pdf", pdf, false);
}

async function cmdFx(sub, flags, asJson) {
  if (sub !== "rates") throw new Error("Usage: 1024 fx rates [--base USD]");
  const data = await portalGet("rates", { base: flags.base || "USD" }, { auth: false });
  if (asJson) return print(data, true);
  console.log(`${data.base} · ${data.date}`);
  for (const [code, rate] of Object.entries(data.rates || {})) {
    console.log(`  ${code}: ${rate}`);
  }
}

async function cmdMusic(sub, asJson) {
  if (sub !== "chart") throw new Error("Usage: 1024 music chart [--json]");
  const data = await portalGet("tracks", {}, { auth: false });
  if (asJson) return print(data, true);
  for (const t of data.tracks || []) {
    console.log(`${t.id}\t${t.artist} — ${t.title}`);
  }
}

async function cmdLyrics(sub, flags, rest, asJson) {
  if (sub === "quota") {
    const data = await portalGet("lyrics_quota", {}, { auth: true });
    return printQuota("lyrics", data, asJson);
  }
  if (sub === "search") {
    const title = rest[0] || flags.title;
    const artist = flags.artist || "";
    if (!title && !artist) throw new Error('Usage: 1024 lyrics search "title" [--artist "name"]');
    const data = await portalGet("lyrics_search", { title, artist }, { auth: true });
    if (asJson) return print(data, true);
    for (const row of data.results || []) {
      console.log(`${row.id}\t${row.artist} — ${row.title}`);
    }
    if (data.remaining !== undefined) {
      console.log(`\nQuota: ${data.remaining}/${data.allowed} left today`);
    }
    return;
  }
  if (sub === "get") {
    const id = rest[0] || flags.id;
    if (!id) throw new Error("Usage: 1024 lyrics get <id>");
    const data = await portalGet("lyrics_get", { id }, { auth: false });
    if (asJson) return print(data, true);
    console.log(`${data.artist || ""} — ${data.title || ""}\n`);
    console.log(data.plainLyrics || data.syncedLyrics || data.lyrics || "");
    return;
  }
  throw new Error("Usage: 1024 lyrics search|get|quota");
}

async function cmdPdf(sub, flags, rest, asJson) {
  if (sub === "quota") {
    const data = await portalGet("pdf_quota", {}, { auth: true });
    return printQuota("pdf", data, asJson);
  }
  if (sub === "convert") {
    const file = rest[0] || flags.file;
    if (!file) throw new Error("Usage: 1024 pdf convert <file> [--out out.pdf]");
    throw new Error(
      "PDF convert runs in the browser (Word / Markdown / TXT → PDF). CLI upload is not available yet. Use https://1024201.com/tools/pdf/ or 1024 pdf quota."
    );
  }
  throw new Error("Usage: 1024 pdf quota|convert");
}

async function cmdSyncnote(sub, flags, rest, asJson) {
  const slot = flags.slot !== undefined ? Number(flags.slot) : 0;
  if (!Number.isFinite(slot) || slot < 0 || slot > 2) {
    throw new Error("--slot must be 0, 1, or 2");
  }

  if (sub === "get") {
    const data = await portalGet("syncnote_get", {}, { auth: true });
    if (asJson) return print(data, true);
    const row = (data.slots || []).find((s) => s.slot === slot);
    console.log(row?.content ?? "");
    return;
  }

  if (sub === "set") {
    const text = rest.join(" ") || flags.text || "";
    const data = await portalPost("syncnote_save", { slot, content: text }, {}, { auth: true });
    print(asJson ? data : `Slot ${slot} saved.`, asJson);
    return;
  }

  if (sub === "clear") {
    const data = await portalPost("syncnote_clear", { slot }, {}, { auth: true });
    print(asJson ? data : `Slot ${slot} cleared.`, asJson);
    return;
  }

  throw new Error("Usage: 1024 syncnote get|set|clear [--slot N]");
}

function help() {
  console.log(`1024 v${VERSION} — 1024201 portal CLI

Usage:
  1024 auth register|verify|login|passwd|logout|whoami|token
  1024 geo
  1024 quota [--json]
  1024 fx rates [--base USD]
  1024 music chart [--json]
  1024 lyrics search "title" [--artist "name"]
  1024 lyrics get <id>
  1024 lyrics quota
  1024 pdf quota
  1024 pdf convert <file> [--out out.pdf]   (browser-only for now)
  1024 syncnote get|set|clear [--slot 0-2]

Docs: https://1024201.com/tools/cli/
`);
}

export async function run(argv) {
  const { flags, positionals } = parseArgs(argv);
  const asJson = !!flags.json;

  if (flags.version) {
    console.log(VERSION);
    return;
  }

  if (flags.help || !positionals.length) {
    help();
    return;
  }

  const [group, sub, ...rest] = positionals;

  try {
    switch (group) {
      case "auth":
        return cmdAuth(sub, flags, asJson);
      case "geo":
        return cmdGeo(asJson);
      case "quota":
        return cmdQuota(flags, asJson);
      case "fx":
        return cmdFx(sub, flags, asJson);
      case "music":
        return cmdMusic(sub, asJson);
      case "lyrics":
        return cmdLyrics(sub, flags, rest, asJson);
      case "pdf":
        return cmdPdf(sub, flags, rest, asJson);
      case "syncnote":
        return cmdSyncnote(sub, flags, rest, asJson);
      default:
        if (group === "help") {
          help();
          return;
        }
        throw new Error(`Unknown command: ${group}. Run 1024 help`);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.body?.needLogin) {
        throw new Error(`${err.message}. Run: 1024 auth login`);
      }
      if (err.body?.error === "daily_limit") {
        throw new Error(`Daily quota exceeded (${err.body.remaining ?? 0} left).`);
      }
    }
    throw err;
  }
}
