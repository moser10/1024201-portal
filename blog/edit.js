import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";

const MAX_IMAGES = 12;
const MAX_MB = 5;

const UI = {
  en: {
    titleNew: "New post",
    titleEdit: "Edit post",
    sub: "Save draft anytime. Publish formats content as clean Markdown.",
    back: "Blog",
    loginDesc: "Sign in to edit blogs.",
    loginBtn: "Sign in / Register",
    lblTitle: "Title",
    lblVis: "Visibility",
    visPrivate: "Private (only you)",
    visPublic: "Public (URL share + likes)",
    visHint: "Visibility can only be set while creating or editing.",
    lblBody: "Content",
    bodyPh: "Write freely. On publish it becomes clean Markdown layout.",
    lblImages: "Images",
    addImg: "Add image",
    imgHint: `JPEG/PNG/WebP/GIF · max ${MAX_MB}MB each · up to ${MAX_IMAGES}`,
    draft: "Save draft",
    publish: "Publish",
    delete: "Delete",
    deleteConfirm: "Delete this post permanently?",
    saved: "Draft saved",
    published: "Published",
    err: "Save failed",
    titleRequired: "Title is required to publish",
    bodyRequired: "Content is required to publish",
    tooMany: "Too many images",
    tooLarge: "Image too large",
  },
  zh: {
    titleNew: "新建博客",
    titleEdit: "编辑博客",
    sub: "可随时存草稿；发布时会自动整理成干净的 Markdown 排版。",
    back: "博客列表",
    loginDesc: "登录后编辑博客。",
    loginBtn: "登录 / 注册",
    lblTitle: "标题",
    lblVis: "展现状态",
    visPrivate: "自己看（外网搜不到）",
    visPublic: "展现（URL 可访问并点赞）",
    visHint: "展现状态仅在新建或编辑时可选择。",
    lblBody: "正文",
    bodyPh: "随意写。发布后会自动变成扁平、整齐的 Markdown 页面。",
    lblImages: "图片",
    addImg: "添加图片",
    imgHint: `JPEG/PNG/WebP/GIF · 单张 ≤ ${MAX_MB}MB · 最多 ${MAX_IMAGES} 张`,
    draft: "存草稿",
    publish: "发布",
    delete: "删除",
    deleteConfirm: "确定永久删除这篇博客？",
    saved: "草稿已保存",
    published: "已发布",
    err: "保存失败",
    titleRequired: "发布需要标题",
    bodyRequired: "发布需要正文",
    tooMany: "图片数量过多",
    tooLarge: "图片太大",
  },
  ja: {
    titleNew: "新規ブログ",
    titleEdit: "ブログ編集",
    sub: "下書き保存可。公開時に Markdown へ整えます。",
    back: "一覧",
    loginDesc: "ログインして編集。",
    loginBtn: "ログイン / 登録",
    lblTitle: "タイトル",
    lblVis: "表示状態",
    visPrivate: "非公開（自分だけ）",
    visPublic: "公開（URL共有・いいね）",
    visHint: "表示状態は作成・編集時のみ選べます。",
    lblBody: "本文",
    bodyPh: "自由に書いてください。公開時に整った Markdown になります。",
    lblImages: "画像",
    addImg: "画像を追加",
    imgHint: `JPEG/PNG/WebP/GIF · 各 ${MAX_MB}MB まで · 最大 ${MAX_IMAGES}`,
    draft: "下書き保存",
    publish: "公開",
    delete: "削除",
    deleteConfirm: "このブログを完全に削除しますか？",
    saved: "下書きを保存しました",
    published: "公開しました",
    err: "保存に失敗しました",
    titleRequired: "公開にはタイトルが必要です",
    bodyRequired: "公開には本文が必要です",
    tooMany: "画像が多すぎます",
    tooLarge: "画像が大きすぎます",
  },
};

let blogId = "";
let imageIds = [];

function t() {
  return UI[getPortalLang()] || UI.en;
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

function fileUrl(id) {
  return `/api/portal?action=file_get&id=${encodeURIComponent(id)}`;
}

async function api(action, opts = {}) {
  const user = getUser();
  const qs = new URLSearchParams({ action });
  if (user?.id) qs.set("user_id", String(user.id));
  const res = await fetch(`/api/blog?${qs}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
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

function applyI18n() {
  const ui = t();
  const isEdit = !!blogId;
  document.getElementById("pageTitle").textContent = isEdit ? ui.titleEdit : ui.titleNew;
  document.getElementById("pageSub").textContent = ui.sub;
  document.getElementById("backLink").textContent = ui.back;
  document.getElementById("loginDesc").textContent = ui.loginDesc;
  document.getElementById("loginBtn").textContent = ui.loginBtn;
  document.getElementById("lblTitle").textContent = ui.lblTitle;
  document.getElementById("lblVis").textContent = ui.lblVis;
  document.getElementById("visPrivate").textContent = ui.visPrivate;
  document.getElementById("visPublic").textContent = ui.visPublic;
  document.getElementById("visHint").textContent = ui.visHint;
  document.getElementById("lblBody").textContent = ui.lblBody;
  document.getElementById("bodyIn").placeholder = ui.bodyPh;
  document.getElementById("lblImages").textContent = ui.lblImages;
  document.getElementById("addImgBtn").textContent = ui.addImg;
  document.getElementById("imgHint").textContent = ui.imgHint;
  document.getElementById("draftBtn").textContent = ui.draft;
  document.getElementById("publishBtn").textContent = ui.publish;
  document.getElementById("deleteBtn").textContent = ui.delete;
  document.title = `${isEdit ? ui.titleEdit : ui.titleNew} | 1024201`;
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
      showErr(ui.tooMany);
      break;
    }
    if (!String(file.type || "").startsWith("image/")) continue;
    if (file.size > MAX_MB * 1024 * 1024) {
      showErr(ui.tooLarge);
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
  const visibility = document.querySelector('input[name="vis"]:checked')?.value === "public" ? "public" : "private";

  if (mode === "publish") {
    if (!title) {
      showErr(ui.titleRequired);
      return;
    }
    if (!body_md.trim()) {
      showErr(ui.bodyRequired);
      return;
    }
  }

  showErr("");
  const draftBtn = document.getElementById("draftBtn");
  const publishBtn = document.getElementById("publishBtn");
  draftBtn.disabled = true;
  publishBtn.disabled = true;
  try {
    const data = await api("save", {
      method: "POST",
      body: { id: blogId || undefined, title, body_md, visibility, mode, images: imageIds },
    });
    blogId = data.blog?.id || blogId;
    history.replaceState(null, "", `/blog/edit.html?id=${encodeURIComponent(blogId)}`);
    document.getElementById("deleteBtn").hidden = false;
    applyI18n();
    if (mode === "publish" && data.blog?.visibility === "public") {
      location.href = `/blog/view.html?id=${encodeURIComponent(blogId)}`;
      return;
    }
    showErr("");
    const note = document.createElement("p");
    note.className = "blog-hint";
    note.textContent = mode === "publish" ? ui.published : ui.saved;
    note.style.color = "#1b7a3d";
    const err = document.getElementById("errBox");
    err.hidden = false;
    err.className = "blog-hint";
    err.style.color = "#1b7a3d";
    err.textContent = mode === "publish" ? ui.published : ui.saved;
  } catch (e) {
    document.getElementById("errBox").className = "err";
    document.getElementById("errBox").style.color = "";
    showErr(e.message || ui.err);
  } finally {
    draftBtn.disabled = false;
    publishBtn.disabled = false;
  }
}

async function loadBlog() {
  if (!blogId) return;
  const user = getUser();
  const qs = new URLSearchParams({ action: "get", id: blogId, user_id: String(user.id) });
  const res = await fetch(`/api/blog?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || t().err);
  if (!data.is_owner) throw new Error(t().err);

  document.getElementById("titleIn").value = data.title || "";
  document.getElementById("bodyIn").value = data.body_md || "";
  const vis = data.visibility === "public" ? "public" : "private";
  document.querySelector(`input[name="vis"][value="${vis}"]`).checked = true;
  imageIds = Array.isArray(data.images) ? data.images.slice() : [];
  paintThumbs();
  document.getElementById("deleteBtn").hidden = false;
}

async function boot() {
  const params = new URLSearchParams(location.search);
  blogId = (params.get("id") || "").trim();

  mountLangTabs(document.getElementById("langSlot"), { onChange: applyI18n });
  applyI18n();

  const user = getUser();
  const form = document.getElementById("editForm");
  const loginPanel = document.getElementById("loginPanel");

  if (!user?.id) {
    form.hidden = true;
    loginPanel.hidden = false;
    document.getElementById("loginBtn").href = `/game/register/?return=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }

  form.hidden = false;
  loginPanel.hidden = true;

  document.getElementById("addImgBtn").onclick = () => document.getElementById("imgInput").click();
  document.getElementById("imgInput").onchange = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    try {
      showErr("");
      await uploadImages(files);
    } catch (err) {
      showErr(err.message || t().err);
    }
  };
  document.getElementById("draftBtn").onclick = () => save("draft");
  document.getElementById("publishBtn").onclick = () => save("publish");
  document.getElementById("deleteBtn").onclick = async () => {
    if (!blogId) return;
    if (!confirm(t().deleteConfirm)) return;
    try {
      await api("delete", { method: "POST", body: { id: blogId } });
      location.href = "/blog/";
    } catch (e) {
      showErr(e.message || t().err);
    }
  };

  if (blogId) {
    try {
      await loadBlog();
      applyI18n();
    } catch (e) {
      showErr(e.message || t().err);
    }
  }
}

boot();
