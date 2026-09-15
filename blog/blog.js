import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";
import { formatBlogDate } from "./md.js";

const UI = {
  en: {
    title: "Blog",
    sub: "Image & text posts. Drafts stay private until you publish.",
    back: "Portal",
    loginDesc: "Sign in to write and manage your blog.",
    loginBtn: "Sign in / Register",
    newPost: "New post",
    empty: "No posts yet. Create your first one.",
    public: "Public",
    private: "Private",
    draft: "Draft",
    updated: "Updated",
    err: "Failed to load",
  },
  zh: {
    title: "博客",
    sub: "图文博客。草稿默认不公开，发布后按展现状态决定是否可访问。",
    back: "门户",
    loginDesc: "登录后可写博客、管理已发布内容。",
    loginBtn: "登录 / 注册",
    newPost: "新建博客",
    empty: "还没有博客，写一篇吧。",
    public: "展现",
    private: "自己看",
    draft: "草稿",
    updated: "更新",
    err: "加载失败",
  },
  ja: {
    title: "ブログ",
    sub: "画像とテキストのブログ。下書きは非公開、公開後は表示設定に従います。",
    back: "ポータル",
    loginDesc: "ログインしてブログを作成・管理。",
    loginBtn: "ログイン / 登録",
    newPost: "新規作成",
    empty: "まだ投稿がありません。",
    public: "公開",
    private: "非公開",
    draft: "下書き",
    updated: "更新",
    err: "読み込みに失敗しました",
  },
};

function t() {
  return UI[getPortalLang()] || UI.en;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showErr(msg) {
  const el = document.getElementById("errBox");
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = msg;
}

async function api(action, opts = {}) {
  const user = getUser();
  const qs = new URLSearchParams({ action });
  if (user?.id) qs.set("user_id", String(user.id));
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
  }
  const res = await fetch(`/api/blog?${qs}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || t().err);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function paintList(blogs) {
  const list = document.getElementById("blogList");
  const empty = document.getElementById("emptyBox");
  const ui = t();
  const lang = getPortalLang();

  if (!blogs.length) {
    list.innerHTML = "";
    empty.hidden = false;
    empty.textContent = ui.empty;
    return;
  }
  empty.hidden = true;
  list.innerHTML = blogs
    .map((b) => {
      const vis =
        b.status === "draft"
          ? `<span class="blog-pill draft">${esc(ui.draft)}</span>`
          : b.visibility === "public"
            ? `<span class="blog-pill public">${esc(ui.public)}</span>`
            : `<span class="blog-pill private">${esc(ui.private)}</span>`;
      // Title row: creation date only (updated date lives in the article body)
      const created = esc(formatBlogDate(b.created_at, lang));
      return `<li>
        <a class="blog-item" href="/blog/edit.html?id=${encodeURIComponent(b.id)}">
          <div class="blog-item-title">${esc(b.title || "(untitled)")}</div>
          <div class="blog-item-meta"><span>${created}</span>${vis}</div>
        </a>
      </li>`;
    })
    .join("");
}

function applyI18n() {
  const ui = t();
  document.getElementById("pageTitle").textContent = ui.title;
  document.getElementById("pageSub").textContent = ui.sub;
  document.getElementById("backLink").textContent = ui.back;
  document.getElementById("loginDesc").textContent = ui.loginDesc;
  document.getElementById("loginBtn").textContent = ui.loginBtn;
  document.getElementById("newBtn").textContent = ui.newPost;
  document.title = `${ui.title} | 1024201`;
}

async function boot() {
  mountLangTabs(document.getElementById("langSlot"), {
    onChange: () => {
      applyI18n();
      bootContent();
    },
  });
  applyI18n();
  await bootContent();
}

const LIST_CACHE_KEY = "blog_mine_cache";

function readListCache() {
  try {
    const raw = sessionStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data?.blogs) ? data.blogs : null;
  } catch {
    return null;
  }
}

function writeListCache(blogs) {
  try {
    sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ blogs, t: Date.now() }));
  } catch {
    /* ignore */
  }
}

async function bootContent() {
  const user = getUser();
  const loginPanel = document.getElementById("loginPanel");
  const listWrap = document.getElementById("listWrap");
  const toolbar = document.getElementById("toolbar");
  const userLine = document.getElementById("userLine");
  showErr("");

  if (!user?.id) {
    loginPanel.hidden = false;
    listWrap.hidden = true;
    toolbar.hidden = true;
    userLine.hidden = true;
    document.getElementById("loginBtn").href = `/game/register/?return=${encodeURIComponent("/blog/")}`;
    return;
  }

  loginPanel.hidden = true;
  listWrap.hidden = false;
  toolbar.hidden = false;
  userLine.hidden = false;
  userLine.textContent = `@${user.username || user.email || user.id}`;

  document.getElementById("newBtn").onclick = () => {
    location.assign("/blog/edit.html");
  };

  // Paint cached list instantly, then refresh — publish → list feels instant
  const cached = readListCache();
  if (cached) paintList(cached);

  try {
    const data = await api("mine");
    const blogs = data.blogs || [];
    writeListCache(blogs);
    paintList(blogs);
    try {
      sessionStorage.removeItem("blog_list_dirty");
    } catch {
      /* ignore */
    }
  } catch (e) {
    if (e.data?.needLogin) {
      loginPanel.hidden = false;
      listWrap.hidden = true;
      toolbar.hidden = true;
      return;
    }
    if (!cached) showErr(e.message || t().err);
  }
}

boot();
