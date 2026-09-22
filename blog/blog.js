import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";

const UI = {
  en: {
    title: "Blog",
    sub: "Image & text posts. Drafts stay private until you publish.",
    back: "Back to lobby",
    loginDesc: "Sign in to write and manage your blog.",
    loginBtn: "Sign in / Register",
    newPost: "New post",
    empty: "No posts yet. Create your first one.",
    public: "Public",
    private: "Private",
    draft: "Draft",
    err: "Failed to load",
  },
  zh: {
    title: "博客",
    sub: "图文博客。草稿默认不公开，发布后按展现状态决定是否可访问。",
    back: "返回大厅",
    loginDesc: "登录后可写博客、管理已发布内容。",
    loginBtn: "登录 / 注册",
    newPost: "新建博客",
    empty: "还没有博客，写一篇吧。",
    public: "展现",
    private: "自己看",
    draft: "草稿",
    err: "加载失败",
  },
  ja: {
    title: "ブログ",
    sub: "画像とテキストのブログ。下書きは非公開、公開後は表示設定に従います。",
    back: "ロビーへ",
    loginDesc: "ログインしてブログを作成・管理。",
    loginBtn: "ログイン / 登録",
    newPost: "新規作成",
    empty: "まだ投稿がありません。",
    public: "公開",
    private: "非公開",
    draft: "下書き",
    err: "読み込みに失敗しました",
  },
};

const LIST_KEY = "blog_mine_v2";
const DOC_PREFIX = "blog_doc_v2:";

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

function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(String(raw).includes("T") ? raw : `${String(raw).replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  const lang = getPortalLang();
  const locale = lang === "ja" ? "ja-JP" : lang === "en" ? "en-US" : "zh-CN";
  return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
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

function listCacheKey(userId) {
  return `${LIST_KEY}:${userId}`;
}

function readListCache(userId) {
  try {
    const raw = localStorage.getItem(listCacheKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data?.blogs) ? data.blogs : null;
  } catch {
    return null;
  }
}

function writeListCache(userId, blogs) {
  try {
    localStorage.setItem(listCacheKey(userId), JSON.stringify({ blogs, t: Date.now() }));
  } catch {
    /* ignore */
  }
}

function writeDocCache(blog) {
  if (!blog?.id) return;
  try {
    sessionStorage.setItem(DOC_PREFIX + blog.id, JSON.stringify(blog));
  } catch {
    /* ignore */
  }
}

async function apiMine(userId) {
  const qs = new URLSearchParams({ action: "mine", user_id: String(userId) });
  const res = await fetch(`/api/blog?${qs}`, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || t().err);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function prefetchDoc(id, userId) {
  if (!id || !userId) return;
  const key = DOC_PREFIX + id;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch {
    /* ignore */
  }
  const qs = new URLSearchParams({ action: "get", id, user_id: String(userId) });
  fetch(`/api/blog?${qs}`, { headers: { Accept: "application/json" } })
    .then((r) => r.json())
    .then((data) => {
      if (data?.id || data?.body_md != null) writeDocCache({ ...data, id: data.id || id });
    })
    .catch(() => {});
}

function paintList(blogs, userId) {
  const list = document.getElementById("blogList");
  const empty = document.getElementById("emptyBox");
  const ui = t();

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
      return `<li>
        <a class="blog-item" href="/blog/?id=${encodeURIComponent(b.id)}" data-id="${esc(b.id)}">
          <div class="blog-item-title">${esc(b.title || "(untitled)")}</div>
          <div class="blog-item-meta"><span>${esc(formatDate(b.created_at))}</span>${vis}</div>
        </a>
      </li>`;
    })
    .join("");

  list.querySelectorAll("a.blog-item").forEach((a) => {
    const warm = () => prefetchDoc(a.dataset.id, userId);
    a.addEventListener("pointerdown", warm, { passive: true });
    a.addEventListener("mouseenter", warm, { passive: true });
  });
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
  document.getElementById("newBtn").onclick = () => location.assign("/blog/edit.html");

  const cached = readListCache(user.id);
  if (cached) paintList(cached, user.id);

  try {
    const data = await apiMine(user.id);
    const blogs = data.blogs || [];
    writeListCache(user.id, blogs);
    paintList(blogs, user.id);
  } catch (e) {
    if (e.data?.needLogin || e.status === 403) {
      loginPanel.hidden = false;
      listWrap.hidden = true;
      toolbar.hidden = true;
      return;
    }
    if (!cached) showErr(e.message || t().err);
  }
}

function boot() {
  mountLangTabs(document.getElementById("langSlot"), {
    onChange: () => {
      applyI18n();
      bootContent();
    },
  });
  applyI18n();
  bootContent();
}

boot();
