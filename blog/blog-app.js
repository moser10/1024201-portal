import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";

const MAX_IMAGES = 12;
const MAX_MB = 5;
const LIST_KEY = "blog_mine_v2";
const DOC_PREFIX = "blog_doc_v2:";

const UI = {
  en: {
    title: "Blog",
    sub: "Write and manage your posts.",
    back: "Back to lobby",
    loginDesc: "Sign in to write and manage your blog.",
    loginBtn: "Sign in / Register",
    newPost: "New post",
    empty: "No posts yet. Create your first one.",
    public: "Public",
    private: "Hidden",
    draft: "Draft",
    err: "Failed to load",
    loading: "Loading…",
    titleNew: "New post",
    titleEdit: "Edit post",
    editBack: "Back",
    editSub: "A quiet place for your words and images.",
    lblTitle: "Title",
    lblVis: "Visibility",
    visPrivate: "Hidden",
    visPrivateDesc: "Only you can see it",
    visPublic: "Public",
    visPublicDesc: "Anyone with the link",
    lblBody: "Content",
    bodyPh: "Start writing…",
    lblImages: "Images",
    addImg: "Add image",
    imgHint: `JPEG/PNG/WebP/GIF · max ${MAX_MB}MB · up to ${MAX_IMAGES}`,
    save: "Save",
    publish: "Publish",
    cancel: "Back",
    delete: "Delete",
    deleteConfirm: "Delete this post permanently?",
    saved: "Saved",
    titleRequired: "Please add a title",
    bodyRequired: "Please add some content",
    tooMany: "Too many images",
    tooLarge: "Image too large",
  },
  zh: {
    title: "博客",
    sub: "记录图文，按需隐藏或展现。",
    back: "返回大厅",
    loginDesc: "登录后可写博客、管理内容。",
    loginBtn: "登录 / 注册",
    newPost: "新建博客",
    empty: "还没有博客，写一篇吧。",
    public: "展现",
    private: "隐藏",
    draft: "草稿",
    err: "加载失败",
    loading: "加载中…",
    titleNew: "新建博客",
    titleEdit: "编辑博客",
    editBack: "返回",
    editSub: "写下此刻想留下的文字与图片。",
    lblTitle: "标题",
    lblVis: "可见范围",
    visPrivate: "隐藏",
    visPrivateDesc: "仅自己可见",
    visPublic: "展现",
    visPublicDesc: "可通过链接访问",
    lblBody: "正文",
    bodyPh: "在这里写下正文…",
    lblImages: "图片",
    addImg: "添加图片",
    imgHint: `JPEG/PNG/WebP/GIF · 单张 ≤ ${MAX_MB}MB · 最多 ${MAX_IMAGES} 张`,
    save: "保存",
    publish: "发布",
    cancel: "返回",
    delete: "删除",
    deleteConfirm: "确定永久删除这篇博客？",
    saved: "已保存",
    titleRequired: "请填写标题",
    bodyRequired: "请填写正文",
    tooMany: "图片数量过多",
    tooLarge: "图片太大",
  },
  ja: {
    title: "ブログ",
    sub: "画像とテキストを記録。非公開／公開を選べます。",
    back: "ロビーへ",
    loginDesc: "ログインしてブログを作成・管理。",
    loginBtn: "ログイン / 登録",
    newPost: "新規作成",
    empty: "まだ投稿がありません。",
    public: "公開",
    private: "非公開",
    draft: "下書き",
    err: "読み込みに失敗しました",
    loading: "読み込み中…",
    titleNew: "新規ブログ",
    titleEdit: "ブログ編集",
    editBack: "戻る",
    editSub: "いま残したい言葉と画像を。",
    lblTitle: "タイトル",
    lblVis: "公開範囲",
    visPrivate: "非公開",
    visPrivateDesc: "自分だけ",
    visPublic: "公開",
    visPublicDesc: "リンクで閲覧可",
    lblBody: "本文",
    bodyPh: "本文を入力…",
    lblImages: "画像",
    addImg: "画像を追加",
    imgHint: `JPEG/PNG/WebP/GIF · 各 ${MAX_MB}MB まで · 最大 ${MAX_IMAGES}`,
    save: "保存",
    publish: "公開",
    cancel: "戻る",
    delete: "削除",
    deleteConfirm: "このブログを完全に削除しますか？",
    saved: "保存しました",
    titleRequired: "タイトルを入力してください",
    bodyRequired: "本文を入力してください",
    tooMany: "画像が多すぎます",
    tooLarge: "画像が大きすぎます",
  },
};

let blogId = "";
let imageIds = [];
let listFingerprint = "";
let wired = false;
let editorLoadSeq = 0;
const prefetchInflight = new Map();

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

function showErr(msg, boxId = "errBox") {
  const el = document.getElementById(boxId);
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    el.className = boxId === "editErrBox" ? "err" : "err";
    el.style.color = "";
    return;
  }
  el.hidden = false;
  el.className = "err";
  el.style.color = "";
  el.textContent = msg;
}

function setLoading(on) {
  const el = document.getElementById("editLoading");
  if (!el) return;
  if (on) {
    el.hidden = false;
    el.textContent = t().loading;
  } else {
    el.hidden = true;
    el.textContent = "";
  }
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

function readDocCache(id) {
  try {
    const raw = sessionStorage.getItem(DOC_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hasFullDoc(doc) {
  return !!(doc && typeof doc.body_md === "string" && (doc.body_md.length > 0 || doc.title));
}

function fileUrl(id) {
  return `/api/portal?action=file_get&id=${encodeURIComponent(id)}`;
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
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify({ ...opts.body, user_id: user?.id }) : undefined,
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

function runViewSwap(fn) {
  if (document.startViewTransition) {
    document.startViewTransition(fn);
  } else {
    fn();
  }
}

function showList() {
  document.getElementById("listView").hidden = false;
  document.getElementById("editView").hidden = true;
  document.title = `${t().title} | 1024201`;
}

function showEditor() {
  document.getElementById("listView").hidden = true;
  document.getElementById("editView").hidden = false;
}

function getVisibility() {
  return document.getElementById("visValue")?.value === "public" ? "public" : "private";
}

function setVisibility(vis) {
  const next = vis === "public" ? "public" : "private";
  const input = document.getElementById("visValue");
  if (input) input.value = next;
  document.querySelectorAll(".blog-switch-opt").forEach((btn) => {
    const on = btn.dataset.vis === next;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  syncPrimaryBtn();
}

function syncPrimaryBtn() {
  const btn = document.getElementById("primaryBtn");
  if (!btn) return;
  const ui = t();
  const pub = getVisibility() === "public";
  btn.textContent = pub ? ui.publish : ui.save;
  btn.dataset.mode = pub ? "publish" : "draft";
}

function goList({ replace = false } = {}) {
  runViewSwap(() => {
    blogId = "";
    imageIds = [];
    setLoading(false);
    showList();
    if (replace) history.replaceState({ view: "list" }, "", "/blog/");
    else history.pushState({ view: "list" }, "", "/blog/");
  });
}

function goEdit(id, { replace = false } = {}) {
  const nextId = id || "";
  runViewSwap(() => {
    blogId = nextId;
    showEditor();
    applyEditI18n();
    const url = nextId ? `/blog/?id=${encodeURIComponent(nextId)}` : "/blog/?new=1";
    if (replace) history.replaceState({ view: "edit", id: nextId }, "", url);
    else history.pushState({ view: "edit", id: nextId }, "", url);
  });
  openEditor(nextId);
}

function bindListNav(userId) {
  const list = document.getElementById("blogList");
  list.querySelectorAll("a.blog-item").forEach((a) => {
    if (a.dataset.softBound === "1") return;
    a.dataset.softBound = "1";
    const warm = () => prefetchDoc(a.dataset.id, userId);
    a.addEventListener("pointerdown", warm, { passive: true });
    a.addEventListener("click", (e) => {
      e.preventDefault();
      warm();
      goEdit(a.dataset.id);
    });
  });
}

function listFp(blogs) {
  return JSON.stringify((blogs || []).map((b) => [b.id, b.title, b.status, b.visibility, b.created_at]));
}

function paintList(blogs, userId) {
  const fp = listFp(blogs);
  if (fp === listFingerprint) {
    bindListNav(userId);
    warmListDocs(blogs, userId);
    return;
  }
  listFingerprint = fp;

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

  bindListNav(userId);
  warmListDocs(blogs, userId);
}

function warmListDocs(blogs, userId) {
  if (!userId || !blogs?.length) return;
  // Prefetch full bodies so opening a post is instant
  blogs.slice(0, 12).forEach((b) => prefetchDoc(b.id, userId));
}

function prefetchDoc(id, userId) {
  if (!id || !userId) return;
  const cached = readDocCache(id);
  if (cached && typeof cached.body_md === "string") return;
  if (prefetchInflight.has(id)) return;
  const p = api("get", { query: { id } })
    .then((data) => {
      writeDocCache(data);
      return data;
    })
    .catch(() => null)
    .finally(() => prefetchInflight.delete(id));
  prefetchInflight.set(id, p);
}

function paintThumbs() {
  const grid = document.getElementById("thumbGrid");
  grid.innerHTML = imageIds
    .map(
      (id) => `<div class="blog-thumb" data-id="${id}">
        <img src="${fileUrl(id)}" alt="" />
        <button type="button" aria-label="Remove">×</button>
      </div>`
    )
    .join("");
  grid.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.closest(".blog-thumb")?.dataset.id;
      imageIds = imageIds.filter((x) => x !== id);
      paintThumbs();
    };
  });
}

function fillForm(data) {
  document.getElementById("titleIn").value = data?.title || "";
  document.getElementById("bodyIn").value = data?.body_md || "";
  setVisibility(data?.visibility === "public" ? "public" : "private");
  imageIds = Array.isArray(data?.images) ? data.images.slice() : [];
  document.getElementById("deleteBtn").hidden = !blogId;
  requestAnimationFrame(() => paintThumbs());
}

function resetForm() {
  fillForm({ title: "", body_md: "", visibility: "private", images: [] });
  document.getElementById("deleteBtn").hidden = true;
  showErr("", "editErrBox");
  setLoading(false);
}

function sameDoc(a, b) {
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.body_md === b.body_md &&
    a.visibility === b.visibility &&
    JSON.stringify(a.images || []) === JSON.stringify(b.images || [])
  );
}

async function openEditor(id) {
  const seq = ++editorLoadSeq;
  showErr("", "editErrBox");
  if (!id) {
    resetForm();
    applyEditI18n();
    return;
  }

  let cached = readDocCache(id);
  if (hasFullDoc(cached) || (cached && typeof cached.body_md === "string")) {
    fillForm(cached);
    setLoading(false);
  } else {
    const user = getUser();
    const stub = (readListCache(user?.id) || []).find((b) => b.id === id);
    if (stub) {
      fillForm({
        title: stub.title || "",
        body_md: document.getElementById("bodyIn").value || "",
        visibility: stub.visibility === "public" ? "public" : "private",
        images: [],
      });
    }
    setLoading(true);
  }

  try {
    let data = null;
    const pending = prefetchInflight.get(id);
    if (pending) data = await pending;
    if (!data) data = await api("get", { query: { id } });
    if (seq !== editorLoadSeq) return;
    if (data.is_owner === false) throw new Error(t().err);
    if (!sameDoc(cached, data)) fillForm(data);
    writeDocCache(data);
  } catch (e) {
    if (seq !== editorLoadSeq) return;
    const bodyEmpty = !document.getElementById("bodyIn").value.trim();
    if (bodyEmpty) showErr(e.message || t().err, "editErrBox");
  } finally {
    if (seq === editorLoadSeq) setLoading(false);
  }
  applyEditI18n();
}

function applyListI18n() {
  const ui = t();
  document.getElementById("pageTitle").textContent = ui.title;
  document.getElementById("pageSub").textContent = ui.sub;
  document.getElementById("backLink").textContent = ui.back;
  document.getElementById("backLink").href = "/";
  document.getElementById("loginDesc").textContent = ui.loginDesc;
  document.getElementById("loginBtn").textContent = ui.loginBtn;
  document.getElementById("newBtn").textContent = ui.newPost;
}

function applyEditI18n() {
  const ui = t();
  document.getElementById("editPageTitle").textContent = blogId ? ui.titleEdit : ui.titleNew;
  document.getElementById("editPageSub").textContent = ui.editSub;
  document.getElementById("editBackBtn").textContent = ui.editBack;
  document.getElementById("cancelBtn").textContent = ui.cancel;
  document.getElementById("lblTitle").textContent = ui.lblTitle;
  document.getElementById("lblVis").textContent = ui.lblVis;
  document.getElementById("visPrivate").textContent = ui.visPrivate;
  document.getElementById("visPrivateDesc").textContent = ui.visPrivateDesc;
  document.getElementById("visPublic").textContent = ui.visPublic;
  document.getElementById("visPublicDesc").textContent = ui.visPublicDesc;
  document.getElementById("lblBody").textContent = ui.lblBody;
  document.getElementById("bodyIn").placeholder = ui.bodyPh;
  document.getElementById("lblImages").textContent = ui.lblImages;
  document.getElementById("addImgBtn").textContent = ui.addImg;
  document.getElementById("imgHint").textContent = ui.imgHint;
  document.getElementById("deleteBtn").textContent = ui.delete;
  syncPrimaryBtn();
  document.title = `${blogId ? ui.titleEdit : ui.titleNew} | 1024201`;
}

function insertImageMarkdown(id) {
  const ta = document.getElementById("bodyIn");
  const snippet = `\n\n![](${fileUrl(id)})\n\n`;
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  ta.value = `${ta.value.slice(0, start)}${snippet}${ta.value.slice(end)}`;
  ta.focus();
}

async function uploadImages(files) {
  const user = getUser();
  const ui = t();
  for (const file of files) {
    if (imageIds.length >= MAX_IMAGES) {
      showErr(ui.tooMany, "editErrBox");
      break;
    }
    if (!String(file.type || "").startsWith("image/")) continue;
    if (file.size > MAX_MB * 1024 * 1024) {
      showErr(ui.tooLarge, "editErrBox");
      continue;
    }
    const qs = new URLSearchParams({
      action: "file_upload",
      purpose: "blog",
      user_id: String(user.id),
    });
    const fd = new FormData();
    fd.append("file", file, file.name || "image.jpg");
    const res = await fetch(`/api/portal?${qs}`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ui.err);
    const id = data.file?.id;
    if (id) {
      imageIds.push(id);
      insertImageMarkdown(id);
    }
  }
  paintThumbs();
}

async function save(mode) {
  const ui = t();
  const title = document.getElementById("titleIn").value.trim();
  const body_md = document.getElementById("bodyIn").value;
  const visibility = getVisibility();

  if (mode === "publish") {
    if (!title) {
      showErr(ui.titleRequired, "editErrBox");
      return;
    }
    if (!body_md.trim()) {
      showErr(ui.bodyRequired, "editErrBox");
      return;
    }
  }

  showErr("", "editErrBox");
  const primaryBtn = document.getElementById("primaryBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  primaryBtn.disabled = true;
  cancelBtn.disabled = true;
  try {
    const data = await api("save", {
      method: "POST",
      body: { id: blogId || undefined, title, body_md, visibility, mode, images: imageIds },
    });
    blogId = data.blog?.id || blogId;
    writeDocCache(data.blog);

    const user = getUser();
    let blogs = readListCache(user.id) || [];
    blogs = blogs.filter((b) => b.id !== data.blog.id);
    blogs.unshift({
      id: data.blog.id,
      title: data.blog.title,
      visibility: data.blog.visibility,
      status: data.blog.status,
      created_at: data.blog.created_at,
      updated_at: data.blog.updated_at,
      like_count: data.blog.like_count || 0,
    });
    writeListCache(user.id, blogs);
    listFingerprint = "";
    paintList(blogs, user.id);

    if (mode === "publish") {
      goList({ replace: true });
      return;
    }

    history.replaceState({ view: "edit", id: blogId }, "", `/blog/?id=${encodeURIComponent(blogId)}`);
    document.getElementById("deleteBtn").hidden = false;
    applyEditI18n();
    const err = document.getElementById("editErrBox");
    err.hidden = false;
    err.className = "blog-hint";
    err.style.color = "#1b7a3d";
    err.textContent = ui.saved;
  } catch (e) {
    showErr(e.message || ui.err, "editErrBox");
  } finally {
    primaryBtn.disabled = false;
    cancelBtn.disabled = false;
  }
}

function runPrimaryAction() {
  const vis = getVisibility();
  if (vis === "public") return save("publish");
  // Hidden: keep as private published when content is ready; otherwise draft
  const title = document.getElementById("titleIn").value.trim();
  const body = document.getElementById("bodyIn").value.trim();
  if (title && body) return save("publish");
  return save("draft");
}

async function bootList() {
  const user = getUser();
  const loginPanel = document.getElementById("loginPanel");
  const toolbar = document.getElementById("toolbar");
  const userLine = document.getElementById("userLine");
  showErr("");

  if (!user?.id) {
    loginPanel.hidden = false;
    toolbar.hidden = true;
    userLine.hidden = true;
    document.getElementById("blogList").innerHTML = "";
    document.getElementById("loginBtn").href = `/game/register/?return=${encodeURIComponent("/blog/")}`;
    return;
  }

  loginPanel.hidden = true;
  toolbar.hidden = false;
  userLine.hidden = false;
  userLine.textContent = `@${user.username || user.email || user.id}`;

  const cached = readListCache(user.id);
  if (cached) {
    if (document.querySelector("#blogList .blog-item")) {
      listFingerprint = listFp(cached);
      bindListNav(user.id);
      warmListDocs(cached, user.id);
    } else {
      paintList(cached, user.id);
    }
  }

  try {
    const data = await api("mine");
    const blogs = data.blogs || [];
    writeListCache(user.id, blogs);
    paintList(blogs, user.id);
  } catch (e) {
    if (e.data?.needLogin || e.status === 403) {
      loginPanel.hidden = false;
      toolbar.hidden = true;
      return;
    }
    if (!cached) showErr(e.message || t().err);
  }
}

function wireOnce() {
  if (wired) return;
  wired = true;

  document.getElementById("newBtn").onclick = () => {
    resetForm();
    goEdit("");
  };
  document.getElementById("editBackBtn").onclick = () => goList();
  document.getElementById("cancelBtn").onclick = () => goList();
  document.getElementById("addImgBtn").onclick = () => document.getElementById("imgInput").click();
  document.getElementById("imgInput").onchange = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    try {
      showErr("", "editErrBox");
      await uploadImages(files);
    } catch (err) {
      showErr(err.message || t().err, "editErrBox");
    }
  };
  document.getElementById("primaryBtn").onclick = () => runPrimaryAction();
  document.querySelectorAll(".blog-switch-opt").forEach((btn) => {
    btn.onclick = () => setVisibility(btn.dataset.vis);
  });
  document.getElementById("deleteBtn").onclick = async () => {
    if (!blogId) return;
    if (!confirm(t().deleteConfirm)) return;
    try {
      await api("delete", { method: "POST", body: { id: blogId } });
      const user = getUser();
      const blogs = (readListCache(user.id) || []).filter((b) => b.id !== blogId);
      writeListCache(user.id, blogs);
      listFingerprint = "";
      paintList(blogs, user.id);
      try {
        sessionStorage.removeItem(DOC_PREFIX + blogId);
      } catch {
        /* ignore */
      }
      goList({ replace: true });
    } catch (e) {
      showErr(e.message || t().err, "editErrBox");
    }
  };

  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(location.search);
    const id = (params.get("id") || "").trim();
    const isNew = params.get("new") === "1";
    if (id || isNew) {
      blogId = id;
      showEditor();
      openEditor(id);
    } else {
      blogId = "";
      showList();
    }
  });
}

function boot() {
  window.__blogSoftNav = true;
  mountLangTabs(document.getElementById("langSlot"), {
    onChange: () => {
      applyListI18n();
      applyEditI18n();
      bootList();
    },
  });
  const editSlot = document.getElementById("editLangSlot");
  if (editSlot && !editSlot.childElementCount) {
    mountLangTabs(editSlot, {
      onChange: () => {
        applyListI18n();
        applyEditI18n();
      },
    });
  }

  applyListI18n();
  applyEditI18n();
  wireOnce();

  const params = new URLSearchParams(location.search);
  const id = (params.get("id") || "").trim();
  const isNew = params.get("new") === "1";

  if (id || isNew) {
    blogId = id;
    showEditor();
    openEditor(id);
    history.replaceState({ view: "edit", id }, "", id ? `/blog/?id=${encodeURIComponent(id)}` : "/blog/?new=1");
  } else {
    showList();
    history.replaceState({ view: "list" }, "", "/blog/");
  }

  bootList();
  document.documentElement.classList.remove("blog-booting");
}

boot();
