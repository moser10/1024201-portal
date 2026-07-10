import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";
import { currentUserId, loginHref } from "../js/quotaClient.js";
import { paintToolUser, deferWork } from "../js/toolPageBoot.js";
import { uploadFile } from "../js/attachGrid.js";
import { watermarkImage, fetchStampTime } from "../js/watermark.js";
import { showSheet } from "/game/js/toast.js";
import { mountProgress } from "../lyrics/loading.js";
import { fetchFileStorage, paintStorageMeta } from "../js/storageQuota.js";

const UI = {
  en: {
    title: "Portfolio",
    sub: "Show design or photo work with watermark — harder to steal, still easy to share.",
    back: "Toolbox",
    loginDesc: "Sign in to upload portfolio works.",
    loginBtn: "Sign in / Register",
    lblTitle: "Title",
    pickFile: "Choose image",
    pickHint: "JPG · PNG · WebP · GIF · max 5MB",
    lblWatermark: "Watermark text",
    stampLbl: "Add upload-time stamp",
    stampHint:
      "Shows upload time only (timezone from your IP). With VPN/proxy the time may be inaccurate.",
    submit: "Upload & publish",
    mineTitle: "My works",
    uploading: "Processing…",
    deleting: "Deleting…",
    published: "Published",
    shareLbl: "Share link:",
    delete: "Delete work",
    deleteConfirm: "Delete this work and image? The share link will stop working.",
    cancel: "Cancel",
    confirm: "Delete",
    err: "Upload failed",
    views: (n) => `${n} views`,
    storageDesc: "Max 5MB per image",
    storageLeft: (mb) => `${mb} left`,
  },
  zh: {
    title: "作品展示",
    sub: "设计/摄影用户上传带水印作品，方便展示、降低被白嫖风险。",
    back: "返回工具箱",
    loginDesc: "请登录后上传作品。",
    loginBtn: "登录 / 注册",
    lblTitle: "作品标题",
    pickFile: "选择图片",
    pickHint: "JPG · PNG · WebP · GIF · 最大 5MB",
    lblWatermark: "水印文字",
    stampLbl: "添加时间戳",
    stampHint: "仅显示上传时间（按 IP 时区）。使用代理或 VPN 时，时间可能不准确。",
    submit: "上传并发布",
    mineTitle: "我的作品",
    uploading: "处理中…",
    deleting: "删除中…",
    published: "已发布",
    shareLbl: "分享链接：",
    delete: "删除作品",
    deleteConfirm: "确定删除此作品及图片？删除后分享链接将失效。",
    cancel: "取消",
    confirm: "删除",
    err: "上传失败",
    views: (n) => `${n} 次浏览`,
    storageDesc: "单张最大 5MB",
    storageLeft: (mb) => `剩余 ${mb}`,
  },
  ja: {
    title: "作品展示",
    sub: "デザイン・写真を透かし付きで公開。",
    back: "ツールボックス",
    loginDesc: "ログインして作品をアップロード。",
    loginBtn: "ログイン / 登録",
    lblTitle: "タイトル",
    pickFile: "画像を選択",
    pickHint: "JPG · PNG · WebP · GIF · 最大5MB",
    lblWatermark: "透かし文字",
    stampLbl: "タイムスタンプを追加",
    stampHint: "アップロード時刻のみ表示（IPのタイムゾーン）。VPN利用時は不正確な場合があります。",
    submit: "アップロードして公開",
    mineTitle: "自分の作品",
    uploading: "処理中…",
    deleting: "削除中…",
    published: "公開済み",
    shareLbl: "共有リンク：",
    delete: "作品を削除",
    deleteConfirm: "この作品と画像を削除しますか？共有リンクは無効になります。",
    cancel: "キャンセル",
    confirm: "削除",
    err: "アップロード失敗",
    views: (n) => `${n} 回表示`,
    storageDesc: "1枚最大 5MB",
    storageLeft: (mb) => `残り ${mb}`,
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;
let lastWorkId = null;

const form = document.getElementById("uploadForm");
const errBox = document.getElementById("errBox");
const resultBox = document.getElementById("resultBox");
const loginPanel = document.getElementById("loginPanel");
const workspace = document.getElementById("scWorkspace");
const mineWrap = document.getElementById("mineWrap");
const mineList = document.getElementById("mineList");
const progressBox = document.getElementById("progressBox");
const fileInput = document.getElementById("fileIn");
const fileName = document.getElementById("fileName");
const fileDrop = document.getElementById("fileDrop");
const titleIn = document.getElementById("titleIn");
const wmIn = document.getElementById("wmIn");
const stampChk = document.getElementById("stampChk");
const storageDesc = document.getElementById("storageDesc");
const storageSpace = document.getElementById("storageSpace");

const FORM_PREFS_KEY = "sc-showcase-form-prefs";

function readFormPrefs() {
  return {
    title: titleIn.value,
    watermark: wmIn.value,
    stampEnabled: stampChk.checked,
  };
}

function saveFormPrefs() {
  try {
    localStorage.setItem(FORM_PREFS_KEY, JSON.stringify(readFormPrefs()));
  } catch {
    /* ignore */
  }
}

function loadFormPrefs() {
  try {
    const raw = localStorage.getItem(FORM_PREFS_KEY);
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (typeof prefs.title === "string") titleIn.value = prefs.title;
    if (typeof prefs.watermark === "string") wmIn.value = prefs.watermark;
    if (typeof prefs.stampEnabled === "boolean") stampChk.checked = prefs.stampEnabled;
  } catch {
    /* ignore */
  }
}

function clearFileOnly() {
  setFile(null);
}

async function refreshShowcaseStorage() {
  const uid = currentUserId();
  if (!uid) {
    if (storageSpace) storageSpace.textContent = "";
    return;
  }
  try {
    const data = await fetchFileStorage(uid, "showcase");
    paintStorageMeta({ descEl: storageDesc, spaceEl: storageSpace, t, data });
  } catch {
    if (storageSpace) storageSpace.textContent = "";
  }
}

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("backLink").textContent = t.back;
  document.getElementById("loginDesc").textContent = t.loginDesc;
  document.getElementById("loginBtn").textContent = t.loginBtn;
  document.getElementById("loginBtn").href = loginHref("/tools/showcase/");
  document.getElementById("lblTitle").textContent = t.lblTitle;
  document.getElementById("pickLabel").textContent = t.pickFile;
  document.getElementById("pickHint").textContent = t.pickHint;
  document.getElementById("lblWatermark").textContent = t.lblWatermark;
  document.getElementById("stampLbl").textContent = t.stampLbl;
  document.getElementById("stampHint").textContent = t.stampHint;
  document.getElementById("submitBtn").textContent = t.submit;
  document.getElementById("mineTitle").textContent = t.mineTitle;
  if (storageDesc) storageDesc.textContent = t.storageDesc;
  if (!resultBox.hidden && lastWorkId) {
    renderPublished(resultBox.dataset.link || "", {
      title: resultBox.dataset.title || "",
      watermark: resultBox.dataset.watermark || "",
      stampEnabled: resultBox.dataset.stampEnabled === "1",
      stampLabel: resultBox.dataset.stampLabel || "",
    });
  }
}

function setGuest(on) {
  workspace.classList.toggle("sc-guest", on);
  loginPanel.hidden = !on;
  mineWrap.hidden = on;
}

function setFile(file) {
  if (!file) {
    fileName.hidden = true;
    fileName.textContent = "";
    fileInput.value = "";
    return;
  }
  fileName.hidden = false;
  fileName.textContent = file.name;
}

function renderPublished(link, meta = {}) {
  resultBox.dataset.link = link;
  resultBox.dataset.title = meta.title || "";
  resultBox.dataset.watermark = meta.watermark || "";
  resultBox.dataset.stampEnabled = meta.stampEnabled ? "1" : "0";
  resultBox.dataset.stampLabel = meta.stampLabel || "";
  resultBox.innerHTML = `
    <p class="sc-published-label">${esc(t.published)}</p>
    <p class="sc-share-lbl">${esc(t.shareLbl)}</p>
    <a class="sc-share-link" href="${esc(link)}">${esc(link)}</a>
  `;
}

async function confirmDelete() {
  return showSheet(t.deleteConfirm, [
    { label: t.cancel, value: false },
    { label: t.confirm, value: true, danger: true },
  ]);
}

async function deleteWork(workId) {
  if (!workId) return;
  const uid = currentUserId();
  if (!uid) return;
  const ok = await confirmDelete();
  if (!ok) return;

  const mineItem = mineList.querySelector(`.sc-mine-del[data-id="${CSS.escape(workId)}"]`)?.closest(".sc-mine-item");
  const hidePublished = workId === lastWorkId;
  const publishedSnapshot = hidePublished ? { link: resultBox.dataset.link || "", html: resultBox.innerHTML } : null;

  if (hidePublished) {
    lastWorkId = null;
    resultBox.hidden = true;
    resultBox.innerHTML = "";
  }
  if (mineItem) mineItem.hidden = true;

  let prog = null;
  const progTimer = setTimeout(() => {
    prog = mountProgress(progressBox, { label: t.deleting, estimatedMs: 5000 });
  }, 2000);

  try {
    const res = await fetch("/api/portal?action=showcase_delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, work_id: workId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.err);

    if (mineItem) mineItem.remove();
    errBox.hidden = true;

    const mineRes = await fetch(`/api/portal?action=showcase_mine&user_id=${encodeURIComponent(uid)}`);
    const mineData = await mineRes.json();
    const works = mineRes.ok ? mineData.works || [] : [];
    mineWrap.hidden = !works.length;
    if (!works.length) mineList.innerHTML = "";
    await refreshShowcaseStorage();
  } catch (err) {
    if (mineItem) mineItem.hidden = false;
    if (publishedSnapshot) {
      lastWorkId = workId;
      resultBox.innerHTML = publishedSnapshot.html;
      resultBox.dataset.link = publishedSnapshot.link;
      resultBox.hidden = false;
    }
    errBox.textContent = err.message || t.err;
    errBox.hidden = false;
    await loadMine();
  } finally {
    clearTimeout(progTimer);
    prog?.done();
  }
}

async function loadMine() {
  const uid = currentUserId();
  if (!uid) return;
  const res = await fetch(`/api/portal?action=showcase_mine&user_id=${encodeURIComponent(uid)}`);
  const data = await res.json();
  if (!res.ok) return;
  const works = data.works || [];
  if (!works.length) {
    mineWrap.hidden = true;
    return;
  }
  mineWrap.hidden = false;
  mineList.innerHTML = works
    .map(
      (w) => `
    <li class="sc-mine-item">
      <a class="sc-mine-link" href="${esc(w.viewUrl)}">
        <img src="${esc(w.thumbUrl)}" alt="" loading="lazy" />
        <span>${esc(w.title || w.id)} · ${t.views(w.views)}</span>
      </a>
      <button type="button" class="sc-mine-del" data-id="${esc(w.id)}" aria-label="${esc(t.delete)}">×</button>
    </li>`
    )
    .join("");

  mineList.querySelectorAll(".sc-mine-del").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      deleteWork(btn.dataset.id);
    });
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

titleIn.addEventListener("input", saveFormPrefs);
wmIn.addEventListener("input", saveFormPrefs);
stampChk.addEventListener("change", saveFormPrefs);

fileInput.addEventListener("change", (e) => setFile(e.target.files?.[0] || null));

fileDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileDrop.classList.add("dragover");
});
fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("dragover"));
fileDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDrop.classList.remove("dragover");
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  setFile(file);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.hidden = true;
  resultBox.hidden = true;
  const uid = currentUserId();
  if (!uid) return;

  const file = fileInput.files?.[0];
  if (!file) return;

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = t.uploading;

  try {
    const title = titleIn.value.trim();
    const watermark = wmIn.value.trim();
    const stampEnabled = stampChk.checked;
    const stampLine = stampEnabled ? await fetchStampTime() : "";
    const processed = await watermarkImage(file, { text: watermark, stampLine, titleLine: title });

    const uploaded = await uploadFile({
      file: processed,
      purpose: "showcase",
      userId: uid,
      meta: { watermark, stampLine, title, stampEnabled },
    });

    const res = await fetch("/api/portal?action=showcase_publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: uid,
        file_id: uploaded.id,
        title,
        watermark,
        stamp_enabled: stampEnabled,
        stamp_label: stampLine,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.err);

    const link = new URL(data.viewUrl, location.origin).href;
    lastWorkId = data.id;
    renderPublished(link, { title, watermark, stampEnabled, stampLabel: stampLine });
    resultBox.hidden = false;
    saveFormPrefs();
    clearFileOnly();
    await loadMine();
    await refreshShowcaseStorage();
  } catch (err) {
    errBox.textContent = err.message || t.err;
    errBox.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = t.submit;
  }
});

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    refreshShowcaseStorage();
  },
});

function boot() {
  loadFormPrefs();
  applyI18n();
  paintToolUser();
  const user = getUser();
  if (!user?.id) {
    setGuest(true);
    return;
  }
  setGuest(false);
  deferWork(async () => {
    await loadMine();
    await refreshShowcaseStorage();
  });
}

boot();
