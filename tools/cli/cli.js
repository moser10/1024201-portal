import { getPortalLang, mountLangTabs } from "/js/langTabs.js";

const COPY = {
  zh: {
    pageTitle: "命令行",
    pageSub: "在终端调用 1024201 工具 · 与网页共用接口与配额",
    backLink: "返回工具箱",
    statusBadge: "命令行 v1.2 已上线",
    introTitle: "概述",
    intro:
      "命令行是网页工具的终端前端。注册分步校验邮箱与昵称、两次确认密码，邮件 6 位注册码验证后自动登录。快捷入口：cli.1024201.com",
    installTitle: "安装",
    installNote: "v1.2 支持分步注册与修改密码。完整测试见仓库 cli/TESTS.md。",
    sections: {
      auth: {
        title: "鉴权",
        lead: "注册按步骤进行：① 邮箱是否可用 ② 昵称是否可用（占用则提示推荐）③ 设置密码并再次确认（不一致可重试 5 次）④ 输入邮件 6 位注册码。成功后可用 whoami 查看状态。",
        cmds: [
          { cmd: "1024 auth register", desc: "交互式注册（推荐）：逐步提示，含邮箱/昵称校验与两次密码确认" },
          {
            cmd: '1024 auth register <span class="flag">--email</span> <span class="arg">邮箱</span> <span class="flag">--username</span> <span class="arg">昵称</span> <span class="flag">--password</span> <span class="arg">密码</span>',
            desc: "非交互注册（仍须 verify）",
          },
          { cmd: '1024 auth verify <span class="flag">--email</span> <span class="arg">邮箱</span> <span class="flag">--code</span> <span class="arg">123456</span>', desc: "单独提交注册码（中断后可续）" },
          { cmd: "1024 auth login", desc: "已有账号登录" },
          { cmd: "1024 auth passwd", desc: "修改密码：验证当前密码 → 新密码两次确认（须已登录）" },
          { cmd: "1024 auth whoami", desc: "查看当前 @用户名 与 id" },
          { cmd: "1024 auth logout", desc: "退出并清除本地令牌" },
          { cmd: "1024 auth token", desc: "查看令牌（脱敏）" },
        ],
        plan: false,
      },
      global: {
        title: "通用",
        lead: "不属于某一个具体工具，而是跨功能公用：例如查 IP、汇总各工具当日配额。",
        cmds: [
          { cmd: "1024 geo", desc: "查询当前 IP 位置与网络类型" },
          { cmd: "1024 quota", desc: "查看各工具今日剩余配额" },
          { cmd: '1024 quota <span class="flag">--json</span>', desc: "以 JSON 格式输出配额" },
        ],
      },
      fx: {
        title: "汇率",
        cmds: [
          { cmd: "1024 fx rates", desc: "实时汇率，默认基准货币美元" },
          { cmd: '1024 fx rates <span class="flag">--base</span> CNY', desc: "指定基准货币查询" },
        ],
      },
      music: {
        title: "音乐",
        cmds: [
          { cmd: "1024 music chart", desc: "Deezer 热门榜单与 30 秒试听链接" },
          { cmd: '1024 music chart <span class="flag">--json</span>', desc: "以 JSON 格式输出" },
        ],
      },
      lyrics: {
        title: "歌词",
        cmds: [
          {
            cmd: '1024 lyrics search <span class="arg">"歌名"</span> <span class="flag">--artist</span> <span class="arg">"歌手"</span>',
            desc: "按歌名或歌手搜索（搜索计次）",
          },
          { cmd: '1024 lyrics get <span class="arg">&lt;编号&gt;</span>', desc: "按编号获取歌词全文" },
          { cmd: "1024 lyrics quota", desc: "查看歌词搜索今日配额" },
        ],
      },
      pdf: {
        title: "PDF 转换",
        lead: "将 Word、Markdown、TXT 转为 PDF。",
        cmds: [
          { cmd: "1024 pdf quota", desc: "查看 PDF 转换今日配额" },
          {
            cmd: '1024 pdf convert <span class="arg">文件.docx</span> <span class="flag">--out</span> 输出.pdf',
            desc: "上传并转换（规划中；网页端为浏览器本地转换）",
          },
        ],
      },
      syncnote: {
        title: "文本中转站",
        cmds: [
          { cmd: '1024 syncnote get <span class="flag">--slot</span> 0', desc: "读取指定槽位内容（须登录）" },
          {
            cmd: '1024 syncnote set <span class="arg">"文本"</span> <span class="flag">--slot</span> 1',
            desc: "写入指定槽位（须登录）",
          },
          { cmd: '1024 syncnote clear <span class="flag">--slot</span> 2', desc: "清空指定槽位（须登录）" },
        ],
      },
    },
    installCmds: [
      { cmd: "curl -fsSL https://1024201.com/cli/install.sh | sh", desc: "一键安装（需 git、npm）" },
      { cmd: "npm link ./cli", desc: "在仓库根目录本地链接" },
      { cmd: "1024 --version", desc: "验证安装" },
    ],
    quotaTitle: "配额表",
    quotaNote: "按世界协调时（UTC）每日零点重置。未登录按 IP 计数，登录后按用户编号计数。",
    thTool: "工具 / 命令",
    thGuest: "游客 / 日",
    thUser: "注册用户 / 日",
    thLogin: "须登录",
    thApi: "对应接口",
    thNote: "说明",
    errorsTitle: "常见错误",
    configTitle: "本地配置",
    live: "已上线",
    plan: "规划中",
    yes: "是",
    no: "否",
    open: "开放",
    unlimited: "不限次",
    errors: [
      ["401 / 403 须登录", "执行 1024 auth login"],
      ["403 当日配额已满", "今日次数已用完"],
      ["429（规划）", "每分钟请求过快"],
    ],
    configPaths: ["~/.config/1024/config.json", "~/.1024/credentials"],
    configDesc: "存放接口地址、令牌与用户信息的本地文件路径。",
    quotaRows: [
      { tool: "IP 查询 / 汇率 / 音乐榜单", guest: "开放", user: "开放", login: "否", api: "geo, rates, tracks", note: "不限次" },
      { tool: "歌词搜索", guest: "1", user: "5", login: "否", api: "lyrics_search", note: "仅搜索计次 · 网页可看广告 +1（命令行暂不支持）" },
      { tool: "歌词详情 / 翻译", guest: "开放", user: "开放", login: "否", api: "lyrics_get, translate", note: "不限次" },
      { tool: "PDF 转换", guest: "1", user: "5", login: "否", api: "pdf_use", note: "Word / Markdown / TXT → PDF；网页本地转换" },
      { tool: "文本中转站", guest: "—", user: "不限次", login: "是", api: "syncnote_*", note: "须登录，不限次" },
      { tool: "鉴权 / 注册 / 改密", guest: "—", user: "—", login: "—", api: "check / register / verify_code / cli_change_password", note: "注册分步校验；改密须已登录" },
      { tool: "全局限流", guest: "60 次/分", user: "120 次/分", login: "否", api: "所有 /api/*", note: "规划中" },
    ],
  },
  en: {
    pageTitle: "CLI",
    pageSub: "Run 1024201 tools from the terminal · same API & quotas as the web",
    backLink: "Toolbox",
    statusBadge: "CLI v1.2 is live",
    introTitle: "Overview",
    intro:
      "Terminal front-end for the same APIs as the website. Register in the CLI (6-digit code by email), then use tools with a saved token. Shortcut: cli.1024201.com",
    installTitle: "Install",
    installNote: "v1.2 adds step-by-step register and passwd. See cli/TESTS.md in the repo.",
    sections: {
      auth: {
        title: "Auth",
        lead: "Step-by-step register: email check → username check → password ×2 (5 retries) → 6-digit mail code. passwd changes password when logged in.",
        cmds: [
          { cmd: "1024 auth register", desc: "Interactive register (recommended)" },
          { cmd: '1024 auth verify <span class="flag">--email</span> <span class="arg">addr</span> <span class="flag">--code</span> <span class="arg">123456</span>', desc: "Submit code only (resume)" },
          { cmd: "1024 auth login", desc: "Sign in" },
          { cmd: "1024 auth passwd", desc: "Change password (login required)" },
          { cmd: "1024 auth whoami", desc: "Show @username" },
          { cmd: "1024 auth logout", desc: "Sign out" },
          { cmd: "1024 auth token", desc: "Masked token" },
        ],
        plan: false,
      },
      global: {
        title: "Global",
        lead: "Cross-tool utilities not tied to one feature — e.g. IP lookup and quota summary.",
        cmds: [
          { cmd: "1024 geo", desc: "IP location and network type" },
          { cmd: "1024 quota", desc: "Today's remaining quotas for all tools" },
          { cmd: '1024 quota <span class="flag">--json</span>', desc: "Machine-readable JSON output" },
        ],
      },
      fx: {
        title: "FX",
        cmds: [
          { cmd: "1024 fx rates", desc: "Live rates, USD base by default" },
          { cmd: '1024 fx rates <span class="flag">--base</span> CNY', desc: "Rates with a custom base currency" },
        ],
      },
      music: {
        title: "Music",
        cmds: [
          { cmd: "1024 music chart", desc: "Deezer chart with 30s preview URLs" },
          { cmd: '1024 music chart <span class="flag">--json</span>', desc: "JSON output" },
        ],
      },
      lyrics: {
        title: "Lyrics",
        cmds: [
          {
            cmd: '1024 lyrics search <span class="arg">"title"</span> <span class="flag">--artist</span> <span class="arg">"artist"</span>',
            desc: "Search by title or artist (counts toward quota)",
          },
          { cmd: '1024 lyrics get <span class="arg">&lt;id&gt;</span>', desc: "Fetch full lyrics by ID" },
          { cmd: "1024 lyrics quota", desc: "Show lyrics search quota for today" },
        ],
      },
      pdf: {
        title: "PDF Convert",
        lead: "Convert Word, Markdown, and TXT to PDF.",
        cmds: [
          { cmd: "1024 pdf quota", desc: "Show PDF convert quota for today" },
          {
            cmd: '1024 pdf convert <span class="arg">file.docx</span> <span class="flag">--out</span> out.pdf',
            desc: "Upload and convert (planned; web uses client-side conversion)",
          },
        ],
      },
      syncnote: {
        title: "Text Relay",
        cmds: [
          { cmd: '1024 syncnote get <span class="flag">--slot</span> 0', desc: "Read slot content (login required)" },
          {
            cmd: '1024 syncnote set <span class="arg">"text"</span> <span class="flag">--slot</span> 1',
            desc: "Write slot content (login required)",
          },
          { cmd: '1024 syncnote clear <span class="flag">--slot</span> 2', desc: "Clear slot (login required)" },
        ],
      },
    },
    installCmds: [
      { cmd: "curl -fsSL https://1024201.com/cli/install.sh | sh", desc: "One-line install (needs git, npm)" },
      { cmd: "npm link ./cli", desc: "Link from repo root" },
      { cmd: "1024 --version", desc: "Verify install" },
    ],
    quotaTitle: "Quota table",
    quotaNote: "Resets at UTC midnight. Key: IP when logged out, user_id when logged in.",
    thTool: "Tool / command",
    thGuest: "Guest / day",
    thUser: "Registered / day",
    thLogin: "Login",
    thApi: "API",
    thNote: "Notes",
    errorsTitle: "Common errors",
    configTitle: "Local config",
    live: "Live",
    plan: "Planned",
    yes: "Yes",
    no: "No",
    open: "Open",
    unlimited: "Unlimited",
    errors: [
      ["401 / 403 login_required", "Run 1024 auth login"],
      ["403 daily_limit", "Today's quota used up"],
      ["429 (planned)", "Per-minute rate limit"],
    ],
    configPaths: ["~/.config/1024/config.json", "~/.1024/credentials"],
    configDesc: "Local paths for API base URL, token, and user info.",
    quotaRows: [
      { tool: "geo / FX / music chart", guest: "Open", user: "Open", login: "No", api: "geo, rates, tracks", note: "Unlimited" },
      { tool: "lyrics search", guest: "1", user: "5", login: "No", api: "lyrics_search", note: "Search counts · web ad +1 (not in CLI yet)" },
      { tool: "lyrics get / translate", guest: "Open", user: "Open", login: "No", api: "lyrics_get, translate", note: "Unlimited" },
      { tool: "PDF convert", guest: "1", user: "5", login: "No", api: "pdf_use", note: "Word / Markdown / TXT → PDF; web is client-side" },
      { tool: "Text Relay", guest: "—", user: "Unlimited", login: "Yes", api: "syncnote_*", note: "Login required" },
      { tool: "auth / register / passwd", guest: "—", user: "—", login: "—", api: "check / register / verify_code / cli_change_password", note: "Step register; passwd needs login" },
      { tool: "global rate limit", guest: "60/min", user: "120/min", login: "No", api: "all /api/*", note: "Planned" },
    ],
  },
  ja: {
    pageTitle: "CLI",
    pageSub: "ターミナルから 1024201 ツール · Web と同じ API・割当",
    backLink: "ツールボックス",
    statusBadge: "CLI v1.2 稼働中",
    introTitle: "概要",
    intro:
      "Web と同じ API のターミナル版。登録はメール・ニックネーム確認、パスワード二回入力、6 桁コードで完了。ショートカット：cli.1024201.com",
    installTitle: "インストール",
    installNote: "v1.2 で段階的登録と passwd 対応。テストは cli/TESTS.md。",
    sections: {
      auth: {
        title: "認証",
        lead: "登録手順：① メール確認 ② ニックネーム確認 ③ パスワード二回（不一致は最大 5 回）④ メール 6 桁コード。passwd はログイン後にパスワード変更。",
        cmds: [
          { cmd: "1024 auth register", desc: "対話式登録（推奨）" },
          { cmd: '1024 auth verify <span class="flag">--email</span> <span class="arg">addr</span> <span class="flag">--code</span> <span class="arg">123456</span>', desc: "コードのみ送信（中断後再開）" },
          { cmd: "1024 auth login", desc: "ログイン" },
          { cmd: "1024 auth passwd", desc: "パスワード変更（要ログイン）" },
          { cmd: "1024 auth whoami", desc: "@ユーザー名を表示" },
          { cmd: "1024 auth logout", desc: "ログアウト" },
          { cmd: "1024 auth token", desc: "トークン（マスク）" },
        ],
        plan: false,
      },
      global: {
        title: "グローバル",
        lead: "特定ツールに属さない共通コマンド（IP 確認・全ツールの割当一覧など）。",
        cmds: [
          { cmd: "1024 geo", desc: "IP 位置とネットワーク種別" },
          { cmd: "1024 quota", desc: "本日の残り割当を一覧" },
          { cmd: '1024 quota <span class="flag">--json</span>', desc: "JSON 形式で出力" },
        ],
      },
      fx: {
        title: "為替",
        cmds: [
          { cmd: "1024 fx rates", desc: "為替レート（基準 USD）" },
          { cmd: '1024 fx rates <span class="flag">--base</span> CNY', desc: "基準通貨を指定" },
        ],
      },
      music: {
        title: "音楽",
        cmds: [
          { cmd: "1024 music chart", desc: "Deezer チャートと 30 秒プレビュー" },
          { cmd: '1024 music chart <span class="flag">--json</span>', desc: "JSON 出力" },
        ],
      },
      lyrics: {
        title: "歌詞",
        cmds: [
          {
            cmd: '1024 lyrics search <span class="arg">"曲名"</span> <span class="flag">--artist</span> <span class="arg">"アーティスト"</span>',
            desc: "曲名・アーティストで検索（検索がカウント）",
          },
          { cmd: '1024 lyrics get <span class="arg">&lt;id&gt;</span>', desc: "ID で歌詞全文を取得" },
          { cmd: "1024 lyrics quota", desc: "歌詞検索の本日割当" },
        ],
      },
      pdf: {
        title: "PDF 変換",
        lead: "Word・Markdown・TXT を PDF に変換。",
        cmds: [
          { cmd: "1024 pdf quota", desc: "PDF 変換の本日割当" },
          {
            cmd: '1024 pdf convert <span class="arg">file.docx</span> <span class="flag">--out</span> out.pdf',
            desc: "アップロード変換（予定 · Web はブラウザ側）",
          },
        ],
      },
      syncnote: {
        title: "テキスト中継",
        cmds: [
          { cmd: '1024 syncnote get <span class="flag">--slot</span> 0', desc: "スロットを読み取り（要ログイン）" },
          {
            cmd: '1024 syncnote set <span class="arg">"テキスト"</span> <span class="flag">--slot</span> 1',
            desc: "スロットに書き込み（要ログイン）",
          },
          { cmd: '1024 syncnote clear <span class="flag">--slot</span> 2', desc: "スロットをクリア（要ログイン）" },
        ],
      },
    },
    installCmds: [
      { cmd: "curl -fsSL https://1024201.com/cli/install.sh | sh", desc: "ワンライン（git・npm 要）" },
      { cmd: "npm link ./cli", desc: "リポジトリルートからリンク" },
      { cmd: "1024 --version", desc: "インストール確認" },
    ],
    quotaTitle: "割当表",
    quotaNote: "UTC 日付でリセット。未ログインは IP、ログイン後は user_id。",
    thTool: "ツール / コマンド",
    thGuest: "ゲスト / 日",
    thUser: "登録 / 日",
    thLogin: "要ログイン",
    thApi: "API",
    thNote: "備考",
    errorsTitle: "よくあるエラー",
    configTitle: "ローカル設定",
    live: "稼働中",
    plan: "予定",
    yes: "はい",
    no: "いいえ",
    open: "制限なし",
    unlimited: "無制限",
    errors: [
      ["401 / 403 login_required", "1024 auth login を実行"],
      ["403 daily_limit", "本日の割当を使い切り"],
      ["429（予定）", "短時間にリクエスト過多"],
    ],
    configPaths: ["~/.config/1024/config.json", "~/.1024/credentials"],
    configDesc: "API ベース URL・トークン・ユーザー情報の保存先。",
    quotaRows: [
      { tool: "IP / 為替 / 音楽チャート", guest: "制限なし", user: "制限なし", login: "いいえ", api: "geo, rates, tracks", note: "無制限" },
      { tool: "歌詞検索", guest: "1", user: "5", login: "いいえ", api: "lyrics_search", note: "検索のみカウント · Web 広告 +1（CLI 未対応）" },
      { tool: "歌詞取得 / 翻訳", guest: "制限なし", user: "制限なし", login: "いいえ", api: "lyrics_get, translate", note: "無制限" },
      { tool: "PDF 変換", guest: "1", user: "5", login: "いいえ", api: "pdf_use", note: "Word / Markdown / TXT → PDF · Web はローカル" },
      { tool: "テキスト中継", guest: "—", user: "無制限", login: "はい", api: "syncnote_*", note: "要ログイン" },
      { tool: "認証 / 登録 / passwd", guest: "—", user: "—", login: "—", api: "check / register / verify_code / cli_change_password", note: "段階登録・passwd は要ログイン" },
      { tool: "全体レート制限", guest: "60/分", user: "120/分", login: "いいえ", api: "すべての /api/*", note: "予定" },
    ],
  },
};

const CONFIG_JSON = `{
  "api_base": "https://1024201.com",
  "token": "…",
  "user_id": 42,
  "username": "you"
}`;

const SECTION_ORDER = ["auth", "global", "fx", "music", "lyrics", "pdf", "syncnote"];

function renderCmdList(cmds) {
  return `<div class="cli-cmd-list">${cmds
    .map(
      (c) => `<div class="cli-cmd-item">
      <div class="cli-cmd-text">${c.cmd}</div>
      <p class="cli-desc">${c.desc}</p>
    </div>`
    )
    .join("")}</div>`;
}

function section(title, bodyHtml, tag) {
  const tagHtml = tag ? `<span class="cli-tag ${tag.cls}">${tag.text}</span>` : "";
  return `<section class="cli-section"><h2>${title}${tagHtml}</h2>${bodyHtml}</section>`;
}

function renderSection(sec, L) {
  const lead = sec.lead ? `<p class="cli-section-lead">${sec.lead}</p>` : "";
  const tag = sec.plan ? { cls: "plan", text: L.plan } : { cls: "live", text: L.live };
  return section(sec.title, `${lead}${renderCmdList(sec.cmds)}`, tag);
}

function renderDoc(lang) {
  const t = COPY[lang] || COPY.en;

  document.getElementById("pageTitle").textContent = t.pageTitle;
  document.getElementById("pageSub").textContent = t.pageSub;
  document.getElementById("statusBadge").textContent = t.statusBadge;
  document.getElementById("backLink").textContent = t.backLink;

  const quotaHtml = `
    <p>${t.quotaNote}</p>
    <div class="cli-table-wrap">
      <table class="cli-table">
        <thead><tr>
          <th>${t.thTool}</th><th>${t.thGuest}</th><th>${t.thUser}</th>
          <th>${t.thLogin}</th><th>${t.thApi}</th><th>${t.thNote}</th>
        </tr></thead>
        <tbody>
          ${t.quotaRows
            .map(
              (r) => `<tr>
              <td>${r.tool}</td><td>${r.guest}</td><td>${r.user}</td>
              <td>${r.login}</td><td><code>${r.api}</code></td><td>${r.note}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;

  const errorsHtml = `<ul>${t.errors.map(([code, hint]) => `<li><code>${code}</code> — ${hint}</li>`).join("")}</ul>`;

  const root = document.getElementById("docRoot");
  root.innerHTML = [
    section(t.introTitle, `<p>${t.intro}</p>`),
    section(
      t.installTitle,
      `<p>${t.installNote}</p>${renderCmdList(t.installCmds)}`,
      { cls: "live", text: t.live }
    ),
    ...SECTION_ORDER.map((key) => renderSection(t.sections[key], t)),
    section(t.quotaTitle, quotaHtml),
    section(t.errorsTitle, errorsHtml),
    section(
      t.configTitle,
      `<p>${t.configDesc}</p><p>${t.configPaths.join(" · ")}</p><pre class="cli-pre">${CONFIG_JSON}</pre>`
    ),
  ].join("");
}

let lang = getPortalLang();
if (!COPY[lang]) lang = "en";
renderDoc(lang);

mountLangTabs(document.getElementById("langSlot"), {
  onChange: (next) => {
    lang = COPY[next] ? next : "en";
    renderDoc(lang);
  },
});
