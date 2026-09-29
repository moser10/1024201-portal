import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";
import { currentUserId, loginHref } from "../js/quotaClient.js";
import { paintToolUser } from "../js/toolPageBoot.js";
import {
  uploadFile,
  deleteFile,
  downloadFileEntry,
  shareFileEntries,
  fetchFileBlob,
  isMobileIos,
  SYNCNOTE_MAX_ATTACH,
} from "../js/attachGrid.js";
import { fetchFileStorage, formatStorageMb, storageLeftLabel } from "../js/storageQuota.js";
import { showSheet } from "/game/js/toast.js";
import { mountProgress } from "../lyrics/loading.js";
import {
  readLocalCache,
  writeLocalCache,
  patchLocalCache,
  getThumbBlob,
  putThumbBlob,
  deleteThumbBlob,
  blobToThumbBlob,
  fileToThumbBlob,
} from "../js/syncnoteCache.js";

const MAX_LINES = 3;
const FLASH_MS = 2200;
const ATTACH_SLOT = 2;
const MAX_FILE_MB = 5;

const UI = {
  en: {
    title: "Text Relay",
    back: "Back to lobby",
    loginDesc: "Sign in to use Text Relay.",
    loginBtn: "Sign in / Register",
    slot: (n) => `Relay ${n}`,
    slotAttach: "Attachments",
    copy: "Copy",
    addFile: "Upload",
    download: "Download",
    del: "Delete",
    emptyFiles: "No files yet",
    pickFirst: "Select a file first",
    downloadAll: "Download",
    downloadOk: "OK",
    downloadEmpty: "No files to download",
    downloading: "Downloading…",
    downloadingN: (n, total) => `Downloading ${n}/${total}…`,
    uploading: "Uploading…",
    uploadingN: (n, total) => `Uploading ${n}/${total}…`,
    savedImage: "Image saved",
    saveHint: "Select files, then download or delete. Tap an image name to preview.",
    previewLoading: "Loading image…",
    downloadDone: (n) =>
      `${n} file(s) saved to your default Downloads folder.\n\niPhone/iPad: Files → Downloads\nMac: Downloads folder\nAndroid: Download`,
    downloadShareDone: (n) =>
      `${n} file(s) opened in the share sheet. Choose Save to Photos or Save to Files.`,
    downloadIosDone: (n) =>
      `${n} file(s) processed. If any are missing, download them one by one.`,
    maxImages: "Up to 3 files",
    clear: "Delete all",
    saved: "Saved",
    saving: "Saving…",
    loaded: "Loaded",
    cleared: "Cleared",
    synced: "Synced",
    copied: "Copied to clipboard",
    storageLeft: (mb) => `${mb} left`,
    errLoad: "Failed to load",
    errSave: "Failed to save",
    errUpload: "Upload failed",
    errUploadImage: "Upload failed",
    errClip: "Clipboard unavailable",
  },
  zh: {
    title: "文本中转站",
    back: "返回大厅",
    loginDesc: "请登录后使用文本中转站。",
    loginBtn: "登录 / 注册",
    slot: (n) => `中转 ${n}`,
    slotAttach: "附件",
    copy: "复制",
    addFile: "上传",
    download: "下载",
    del: "删除",
    emptyFiles: "还没有文件",
    pickFirst: "先选择文件",
    downloadAll: "下载",
    downloadOk: "知道了",
    downloadEmpty: "没有可下载的文件",
    downloading: "下载中…",
    downloadingN: (n, total) => `下载中 ${n}/${total}…`,
    uploading: "上传中…",
    uploadingN: (n, total) => `上传中 ${n}/${total}…`,
    savedImage: "图片已保存",
    saveHint: "勾选文件后下载或删除。点图片名可预览。",
    previewLoading: "加载大图…",
    downloadDone: (n) =>
      `已下载 ${n} 个文件到系统默认「下载」文件夹。\n\niPhone/iPad：文件 App → 下载\nMac：下载文件夹\nAndroid：Download 目录`,
    downloadShareDone: (n) =>
      `已通过分享面板发送 ${n} 个文件，可选择「存储到照片」或「存储到文件」。`,
    downloadIosDone: (n) =>
      `已处理 ${n} 个文件。如有遗漏，请逐个下载。`,
    maxImages: "最多 3 个文件",
    clear: "全部删除",
    saved: "已保存",
    saving: "保存中…",
    loaded: "已加载",
    cleared: "已清空",
    synced: "已同步",
    copied: "已复制到剪贴板",
    storageLeft: (mb) => `剩余 ${mb}`,
    errLoad: "加载失败",
    errSave: "保存失败",
    errUpload: "上传失败",
    errUploadImage: "上传失败",
    errClip: "无法访问剪贴板",
  },
  ja: {
    title: "テキスト中継",
    back: "ロビーへ",
    loginDesc: "テキスト中継を使うにはログインしてください。",
    loginBtn: "ログイン / 登録",
    slot: (n) => `中継 ${n}`,
    slotAttach: "添付",
    copy: "コピー",
    addFile: "アップロード",
    download: "ダウンロード",
    del: "削除",
    emptyFiles: "ファイルなし",
    pickFirst: "先にファイルを選んでください",
    downloadAll: "ダウンロード",
    downloadOk: "OK",
    downloadEmpty: "ダウンロードするファイルがありません",
    downloading: "ダウンロード中…",
    downloadingN: (n, total) => `ダウンロード中 ${n}/${total}…`,
    uploading: "アップロード中…",
    uploadingN: (n, total) => `アップロード中 ${n}/${total}…`,
    savedImage: "画像を保存しました",
    saveHint: "ファイルを選んでダウンロードまたは削除。画像名をタップするとプレビューします。",
    previewLoading: "画像を読み込み中…",
    downloadDone: (n) =>
      `${n} 件を既定のダウンロードフォルダに保存しました。\n\niPhone/iPad：ファイル → ダウンロード\nMac：ダウンロード\nAndroid：Download`,
    downloadShareDone: (n) =>
      `${n} 件を共有シートで開きました。「写真に保存」または「ファイルに保存」を選べます。`,
    downloadIosDone: (n) =>
      `${n} 件を処理しました。不足がある場合は個別にダウンロードしてください。`,
    maxImages: "最大 3 件",
    clear: "すべて削除",
    saved: "保存済み",
    saving: "保存中…",
    loaded: "読み込み済み",
    cleared: "削除しました",
    synced: "同期済み",
    copied: "クリップボードにコピー",
    storageLeft: (mb) => `残り ${mb}`,
    errLoad: "読み込みに失敗",
    errSave: "保存に失敗",
    errUpload: "アップロード失敗",
    errUploadImage: "アップロード失敗",
    errClip: "クリップボードを使用できません",
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;
const saveTimers = new Map();
const dirtySlots = new Set();
const baselineStatus = new Map();
const flashTimers = new Map();
const flashing = new Set();
const slotEpoch = new Map(); // bumps on clear — kills in-flight stale saves
let attachFiles = [];
let pollTimer = 0;
let pollInflight = false;
const POLL_MS = 2000;

const errBox = document.getElementById("errBox");
const loginPanel = document.getElementById("loginPanel");
const syncWorkspace = document.getElementById("syncWorkspace");
const slotEls = [...document.querySelectorAll(".sync-slot")];
const attachList = document.getElementById("attachList");
const attachEmpty = document.getElementById("attachEmpty");
const attachInput = document.getElementById("attachInput");
const attachSpace = document.getElementById("attachSpace");
const attachProgress = document.getElementById("attachProgress");
const attachSaveHint = document.getElementById("attachSaveHint");
const attachPreview = document.getElementById("attachPreview");
const previewImg = document.getElementById("previewImg");
const previewProgress = document.getElementById("previewProgress");
const previewClose = document.getElementById("previewClose");
const attachSlotEl = slotEls.find((s) => parseInt(s.dataset.slot, 10) === ATTACH_SLOT);
let attachBusy = false;
const thumbObjectUrls = new Map();
const slotUpdatedAt = new Map();
let previewObjectUrl = null;

function slotNum(el) {
  return parseInt(el.dataset.slot, 10);
}

function isAttachSlot(el) {
  return el?.dataset?.type === "attach";
}

function slotInput(el) {
  return el.querySelector(".sync-input");
}

function slotStatusEl(el) {
  if (isAttachSlot(el)) return null;
  return el.querySelector(".sync-status");
}

function lineMetrics(ta) {
  const style = getComputedStyle(ta);
  const lh = parseFloat(style.lineHeight) || 21;
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return { lh, padY };
}

function fitInput(ta, { tail = false } = {}) {
  const { lh, padY } = lineMetrics(ta);
  ta.style.height = "0";
  const contentLines = Math.max(1, Math.ceil((ta.scrollHeight - padY) / lh));
  const visibleLines = Math.min(MAX_LINES, contentLines);
  ta.style.height = `${visibleLines * lh + padY}px`;
  if (tail || (contentLines > MAX_LINES && document.activeElement !== ta)) {
    ta.scrollTop = ta.scrollHeight;
  }
}

function fitAllInputs(opts) {
  slotEls.forEach((el) => {
    if (isAttachSlot(el)) return;
    fitInput(slotInput(el), opts);
  });
}

function paintAttachHint() {
  if (!attachSaveHint) return;
  const show = attachFiles.length > 0 && currentUserId();
  attachSaveHint.textContent = show ? t.saveHint : "";
  attachSaveHint.hidden = !show;
}

function setAttachBusy(on) {
  attachBusy = on;
  const addBtn = attachSlotEl?.querySelector(".sync-add-file");
  const dlBtn = attachSlotEl?.querySelector(".sync-download-sel");
  const delBtn = attachSlotEl?.querySelector(".sync-delete-sel");
  const guest = !currentUserId();
  if (addBtn) addBtn.disabled = on || guest || attachFiles.length >= SYNCNOTE_MAX_ATTACH;
  if (dlBtn) dlBtn.disabled = on || guest || !attachFiles.length;
  if (delBtn) delBtn.disabled = on || guest || !attachFiles.length;
  attachList?.querySelectorAll("button, input").forEach((el) => {
    el.disabled = on || guest;
  });
}

function updateProgressLabel(host, text) {
  const label = host?.querySelector(".loading-label");
  if (label) label.textContent = text;
}

const cacheWriteTimer = { id: 0 };

function scheduleCacheWrite() {
  clearTimeout(cacheWriteTimer.id);
  cacheWriteTimer.id = setTimeout(() => persistCache(), 400);
}

function revokeThumbUrls() {
  for (const url of thumbObjectUrls.values()) URL.revokeObjectURL(url);
  thumbObjectUrls.clear();
}

function closePreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  if (previewImg) {
    previewImg.removeAttribute("src");
    previewImg.hidden = true;
  }
  if (previewProgress) {
    previewProgress.hidden = true;
    previewProgress.innerHTML = "";
  }
  if (attachPreview) attachPreview.hidden = true;
}

function cachePayloadFromState(remaining = null) {
  const uid = currentUserId();
  if (!uid) return null;
  const slots = {};
  slotEls.forEach((el) => {
    if (isAttachSlot(el)) return;
    const slot = slotNum(el);
    slots[slot] = {
      content: slotInput(el).value,
      updatedAt: slotUpdatedAt.get(slot) ?? null,
    };
  });
  const prev = readLocalCache(uid);
  return {
    slots,
    files: attachFiles.map(({ id, name, mime, size, url, purpose, slot, createdAt }) => ({
      id,
      name,
      mime,
      size,
      url,
      purpose,
      slot,
      createdAt,
    })),
    remaining: remaining ?? prev?.remaining ?? null,
  };
}

function persistCache(remaining = null) {
  const uid = currentUserId();
  if (!uid) return;
  writeLocalCache(uid, cachePayloadFromState(remaining));
}

function applySlotsToDom(slots = {}, { respectLocalEdits = false } = {}) {
  slotEls.forEach((el) => {
    const slot = slotNum(el);
    if (isAttachSlot(el)) return;
    const row = slots[slot] || slots[String(slot)] || { content: "", updatedAt: null };
    const ta = slotInput(el);
    if (respectLocalEdits) {
      if (dirtySlots.has(slot)) return;
      if (document.activeElement === ta) return;
      const localAt = slotUpdatedAt.get(slot) ?? "";
      const remoteAt = row.updatedAt ?? "";
      const localVal = ta.value || "";
      const remoteVal = row.content || "";
      if (localVal === remoteVal && localAt === remoteAt) return;
    }
    if (row.updatedAt != null) slotUpdatedAt.set(slot, row.updatedAt);
    else if (!(row.content || "")) slotUpdatedAt.set(slot, null);
    ta.value = row.content || "";
    dirtySlots.delete(slot);
    setBaseline(el, loadedLabel(row.updatedAt));
    fitInput(ta, { tail: true });
  });
}

function paintFromCache() {
  const uid = currentUserId();
  if (!uid) return false;
  const cached = readLocalCache(uid);
  if (!cached) return false;

  applySlotsToDom(cached.slots || {});
  attachFiles = (cached.files || []).slice(0, SYNCNOTE_MAX_ATTACH);
  paintAttachGrid();
  if (attachSpace && cached.remaining != null) {
    attachSpace.textContent = storageLeftLabel(t, cached.remaining);
  }
  hydrateCachedThumbs();
  return true;
}

async function hydrateCachedThumbs() {
  /* thumbs stay in IDB for image preview; the list no longer paints cells */
}

function scheduleThumbPrefetch() {
  const uid = currentUserId();
  if (!uid || !attachFiles.length) return;
  const run = () => prefetchMissingThumbs(uid);
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 200);
  }
}

async function prefetchMissingThumbs(uid) {
  for (const f of attachFiles) {
    if (!String(f.mime || "").startsWith("image/")) continue;
    if (await getThumbBlob(f.id)) continue;
    try {
      const full = await fetchFileBlob(f, uid);
      const thumb = await blobToThumbBlob(full);
      if (!thumb) continue;
      await putThumbBlob(f.id, thumb);
      if (thumbObjectUrls.has(f.id)) continue;
      const url = URL.createObjectURL(thumb);
      thumbObjectUrls.set(f.id, url);
    } catch {
      /* background */
    }
  }
}

async function storeThumbFromFile(fileId, source) {
  const thumb = await fileToThumbBlob(source);
  if (!thumb) return;
  await putThumbBlob(fileId, thumb);
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function selectedAttachIds() {
  return [...(attachList?.querySelectorAll(".sync-ft-check:checked") || [])]
    .map((el) => el.closest(".sync-ft-row")?.dataset.id)
    .filter(Boolean);
}

function selectedAttachFiles() {
  const ids = new Set(selectedAttachIds());
  return attachFiles.filter((f) => ids.has(f.id));
}

function paintAttachGrid() {
  const uid = currentUserId();
  if (!attachList || !attachEmpty) return;
  const kept = new Set(selectedAttachIds());
  attachEmpty.hidden = attachFiles.length > 0;
  attachEmpty.textContent = t.emptyFiles;
  attachList.innerHTML = attachFiles
    .map((f) => {
      const checked = kept.has(f.id) ? " checked" : "";
      return `<li class="sync-ft-row" data-id="${escHtml(f.id)}">
        <label class="sync-ft-pick"><input type="checkbox" class="sync-ft-check"${checked} /></label>
        <button type="button" class="sync-ft-name">${escHtml(f.name || "file")}<span class="sync-ft-meta">${escHtml(formatStorageMb(f.size))}</span></button>
        <button type="button" class="btn-primary sync-ft-get">${escHtml(t.download)}</button>
        <button type="button" class="btn-danger sync-ft-del">${escHtml(t.del)}</button>
      </li>`;
    })
    .join("");
  attachList.querySelectorAll(".sync-ft-get").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const row = attachFiles.find((f) => f.id === btn.closest(".sync-ft-row")?.dataset.id);
      if (row) downloadAttachFiles([row]);
    };
  });
  attachList.querySelectorAll(".sync-ft-del").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.closest(".sync-ft-row")?.dataset.id;
      if (id) removeAttach(id);
    };
  });
  attachList.querySelectorAll(".sync-ft-name").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const row = attachFiles.find((f) => f.id === btn.closest(".sync-ft-row")?.dataset.id);
      if (!row) return;
      if (String(row.mime || "").startsWith("image/")) previewAttach(row);
      else downloadAttachFiles([row]);
    };
  });
  setAttachBusy(attachBusy);
  paintAttachHint();
}

async function refreshAttachStorage() {
  const uid = currentUserId();
  if (!attachSpace) return;
  if (!uid) {
    attachSpace.textContent = "";
    return;
  }
  try {
    const data = await fetchFileStorage(uid, "syncnote");
    attachSpace.textContent = storageLeftLabel(t, data.remaining ?? 0);
    patchLocalCache(uid, { remaining: data.remaining ?? 0 });
  } catch {
    /* keep cached value */
  }
}

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  const subEl = document.getElementById("pageSub");
  if (subEl) subEl.hidden = true;
  const back = document.getElementById("backLink");
  back.textContent = t.back;
  back.href = "/";
  document.getElementById("loginDesc").textContent = t.loginDesc;
  document.getElementById("loginBtn").textContent = t.loginBtn;
  document.getElementById("loginBtn").href = loginHref("/tools/syncnote/");
  if (attachSaveHint && !attachSaveHint.hidden) attachSaveHint.textContent = t.saveHint;
  slotEls.forEach((el) => {
    const n = slotNum(el);
    if (isAttachSlot(el)) {
      const label = el.querySelector("[data-slot-label]");
      const addBtn = el.querySelector(".sync-add-file");
      const dlBtn = el.querySelector(".sync-download-sel");
      const delBtn = el.querySelector(".sync-delete-sel");
      if (label) label.textContent = t.slotAttach;
      if (addBtn) addBtn.textContent = t.addFile;
      if (dlBtn) dlBtn.textContent = t.download;
      if (delBtn) delBtn.textContent = t.del;
      return;
    }
    const label = el.querySelector("[data-slot-label]");
    const copyBtn = el.querySelector(".sync-copy");
    const clearBtn = el.querySelector(".sync-clear");
    if (label) label.textContent = t.slot(n + 1);
    if (copyBtn) copyBtn.textContent = t.copy;
    if (clearBtn) clearBtn.textContent = t.clear;
  });
}

function renderBaseline(slot) {
  if (flashing.has(slot) || slot === ATTACH_SLOT) return;
  const el = slotEls.find((s) => slotNum(s) === slot);
  const status = slotStatusEl(el);
  if (!status) return;
  status.textContent = baselineStatus.get(slot) || "";
}

function setBaseline(el, msg) {
  const slot = slotNum(el);
  if (isAttachSlot(el)) return;
  baselineStatus.set(slot, msg);
  renderBaseline(slot);
}

function flashStatus(el, msg) {
  const slot = slotNum(el);
  const status = slotStatusEl(el);
  if (!status) return;
  clearTimeout(flashTimers.get(slot));
  flashing.add(slot);
  status.textContent = msg;
  flashTimers.set(
    slot,
    setTimeout(() => {
      flashing.delete(slot);
      renderBaseline(slot);
    }, FLASH_MS)
  );
}

function showError(msg) {
  errBox.textContent = msg;
  errBox.hidden = !msg;
}

function apiBody(extra = {}) {
  return JSON.stringify({ user_id: currentUserId(), ...extra });
}

function loadedLabel(updatedAt) {
  return updatedAt ? `${t.loaded} · ${updatedAt}` : t.loaded;
}

function savedLabel(updatedAt) {
  return updatedAt ? `${t.saved} · ${updatedAt}` : t.saved;
}

function bumpEpoch(slot) {
  const next = (slotEpoch.get(slot) || 0) + 1;
  slotEpoch.set(slot, next);
  return next;
}

function currentEpoch(slot) {
  return slotEpoch.get(slot) || 0;
}

async function fetchNotesPayload() {
  const uid = currentUserId();
  if (!uid) return null;
  const res = await fetch(`/api/portal?action=syncnote_get&user_id=${encodeURIComponent(uid)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || t.errLoad);
  return data;
}

function slotsFromPayload(data) {
  const bySlot = new Map((data.slots || []).map((s) => [s.slot, s]));
  const slots = {};
  let files = attachFiles;
  slotEls.forEach((el) => {
    const slot = slotNum(el);
    const row = bySlot.get(slot) || { content: "", updatedAt: null };
    if (isAttachSlot(el)) {
      files = (row.files || []).slice(0, SYNCNOTE_MAX_ATTACH);
      return;
    }
    slots[slot] = { content: row.content || "", updatedAt: row.updatedAt };
  });
  return { slots, files };
}

async function loadNotes({ quiet = false } = {}) {
  const uid = currentUserId();
  if (!uid) return;
  const hadCache = !!readLocalCache(uid);
  if (!quiet) refreshAttachStorage();
  try {
    const data = await fetchNotesPayload();
    const { slots, files } = slotsFromPayload(data);
    applySlotsToDom(slots, { respectLocalEdits: quiet });
    if (!attachBusy) {
      const prevIds = attachFiles.map((f) => f.id).join(",");
      const nextIds = files.map((f) => f.id).join(",");
      if (prevIds !== nextIds) {
        attachFiles = files;
        paintAttachGrid();
        scheduleThumbPrefetch();
      }
    }
    if (!quiet) paintToolUser();
    const prev = readLocalCache(uid);
    writeLocalCache(uid, {
      slots: cachePayloadFromState()?.slots || slots,
      files: attachFiles,
      remaining: prev?.remaining ?? null,
    });
    if (!quiet) scheduleThumbPrefetch();
    showError("");
  } catch (e) {
    if (!quiet && !hadCache) showError(e.message || t.errLoad);
  }
}

async function pollNotes() {
  if (pollInflight || document.hidden || !currentUserId()) return;
  pollInflight = true;
  try {
    await loadNotes({ quiet: true });
  } finally {
    pollInflight = false;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(pollNotes, POLL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = 0;
}

async function forceClearServer(slot) {
  const uid = currentUserId();
  if (!uid) return;
  try {
    await fetch("/api/portal?action=syncnote_clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: apiBody({ slot }),
    });
  } catch {
    /* best effort */
  }
}

async function saveSlot(el, { quiet = false } = {}) {
  const uid = currentUserId();
  if (!uid || isAttachSlot(el)) return;
  const slot = slotNum(el);
  const epoch = currentEpoch(slot);
  const content = slotInput(el).value;
  if (!quiet && !flashing.has(slot)) setBaseline(el, t.saving);
  try {
    if (currentEpoch(slot) !== epoch) return;
    const res = await fetch("/api/portal?action=syncnote_save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: apiBody({ slot, content }),
    });
    const data = await res.json().catch(() => ({}));
    // Cleared while save was in flight — re-assert empty on server (kills deadlock)
    if (currentEpoch(slot) !== epoch) {
      if (!slotInput(el).value) await forceClearServer(slot);
      return;
    }
    if (!res.ok) throw new Error(data.error || t.errSave);
    dirtySlots.delete(slot);
    if (data.updatedAt) slotUpdatedAt.set(slot, data.updatedAt);
    if (!flashing.has(slot)) setBaseline(el, savedLabel(data.updatedAt));
    persistCache();
  } catch (e) {
    if (currentEpoch(slot) !== epoch) return;
    showError(e.message || t.errSave);
    if (!flashing.has(slot)) renderBaseline(slot);
  }
}

function scheduleSave(el) {
  const slot = slotNum(el);
  dirtySlots.add(slot);
  clearTimeout(saveTimers.get(slot));
  saveTimers.set(slot, setTimeout(() => saveSlot(el, { quiet: flashing.has(slot) }), 400));
}

async function clearSlot(el) {
  const uid = currentUserId();
  if (!uid || isAttachSlot(el)) return;
  const slot = slotNum(el);
  showError("");
  clearTimeout(saveTimers.get(slot));
  saveTimers.delete(slot);
  bumpEpoch(slot);
  dirtySlots.delete(slot);

  const ta = slotInput(el);
  ta.value = "";
  fitInput(ta);
  slotUpdatedAt.set(slot, null);
  flashStatus(el, t.cleared);
  setBaseline(el, "");
  persistCache();

  try {
    const res = await fetch("/api/portal?action=syncnote_clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: apiBody({ slot }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t.errSave);
    persistCache();
  } catch (e) {
    showError(e.message || t.errSave);
  }
}

async function removeAttach(id) {
  const uid = currentUserId();
  if (!uid) return;
  showError("");
  try {
    await deleteFile({ id, userId: uid });
    attachFiles = attachFiles.filter((f) => f.id !== id);
    await deleteThumbBlob(id);
    paintAttachGrid();
    persistCache();
    refreshAttachStorage();
  } catch (e) {
    showError(e.message || t.errUpload);
  }
}

async function previewAttach(file) {
  const uid = currentUserId();
  if (!uid || attachBusy) return;
  showError("");
  closePreview();
  if (attachPreview) attachPreview.hidden = false;
  if (previewProgress) previewProgress.hidden = false;
  setAttachBusy(true);
  const estMs = Math.min(12000, Math.max(2500, (file.size || 500000) / 400));
  const prog = mountProgress(previewProgress, { label: t.previewLoading, estimatedMs: estMs });
  try {
    const blob = await fetchFileBlob(file, uid);
    prog.done();
    previewObjectUrl = URL.createObjectURL(blob);
    if (previewImg) {
      previewImg.src = previewObjectUrl;
      previewImg.alt = file.name || "";
      previewImg.hidden = false;
    }
    if (previewProgress) previewProgress.hidden = true;
  } catch (e) {
    prog.fail();
    closePreview();
    showError(e.message || t.errUpload);
  } finally {
    setAttachBusy(false);
  }
}

async function downloadAttachFiles(files) {
  const uid = currentUserId();
  const list = (files || []).filter(Boolean);
  if (!uid || attachBusy) return;
  if (!list.length) {
    await showSheet(t.downloadEmpty, [{ label: t.downloadOk, value: true }]);
    return;
  }
  showError("");
  setAttachBusy(true);
  const ios = isMobileIos();
  const estMs = list.length * (ios ? 4500 : 1800);
  const prog = mountProgress(attachProgress, { label: t.downloading, estimatedMs: estMs });
  try {
    if (ios) {
      const shared = await shareFileEntries(list, uid);
      if (shared) {
        prog.done();
        await showSheet(t.downloadShareDone(list.length), [{ label: t.downloadOk, value: true }]);
        return;
      }
    }
    for (let i = 0; i < list.length; i++) {
      updateProgressLabel(attachProgress, t.downloadingN(i + 1, list.length));
      await downloadFileEntry(list[i], uid);
      if (i < list.length - 1) {
        await new Promise((r) => setTimeout(r, ios ? 1500 : 350));
      }
    }
    prog.done();
    const msg = ios ? t.downloadIosDone(list.length) : t.downloadDone(list.length);
    await showSheet(msg, [{ label: t.downloadOk, value: true }]);
  } catch (e) {
    prog.fail();
    if (e?.name === "AbortError") return;
    showError(e.message || t.errUpload);
  } finally {
    setAttachBusy(false);
  }
}

function downloadSelectedAttach() {
  const picked = selectedAttachFiles();
  downloadAttachFiles(picked.length ? picked : attachFiles);
}

async function deleteSelectedAttach() {
  const picked = selectedAttachFiles();
  if (!picked.length) {
    showError(t.pickFirst);
    return;
  }
  for (const f of picked) {
    await removeAttach(f.id);
  }
}

async function handleAttachPick(fileList) {
  const uid = currentUserId();
  if (!uid || !fileList?.length || attachBusy) return;
  const room = SYNCNOTE_MAX_ATTACH - attachFiles.length;
  if (room <= 0) {
    showError(t.maxImages);
    attachInput.value = "";
    return;
  }
  showError("");
  setAttachBusy(true);
  const picks = [...fileList].slice(0, room);
  const prog = mountProgress(attachProgress, {
    label: t.uploading,
    estimatedMs: picks.length * 5000,
  });
  try {
    for (let i = 0; i < picks.length; i++) {
      const file = picks[i];
      updateProgressLabel(attachProgress, t.uploadingN(i + 1, picks.length));
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`${file.name}: max ${MAX_FILE_MB}MB`);
      }
      const uploaded = await uploadFile({ file, purpose: "syncnote", slot: ATTACH_SLOT, userId: uid });
      attachFiles.push(uploaded);
      if (file.type?.startsWith("image/")) await storeThumbFromFile(uploaded.id, file);
    }
    attachFiles = attachFiles.slice(0, SYNCNOTE_MAX_ATTACH);
    paintAttachGrid();
    persistCache();
    refreshAttachStorage();
    prog.done();
  } catch (e) {
    prog.fail();
    showError(e.message || t.errUpload);
  } finally {
    attachInput.value = "";
    setAttachBusy(false);
    paintAttachGrid();
  }
}

async function copySlot(el, e) {
  e.preventDefault();
  e.stopPropagation();
  showError("");
  try {
    await navigator.clipboard.writeText(slotInput(el).value);
    flashStatus(el, t.copied);
  } catch {
    showError(t.errClip);
  }
}

function setGuestMode(on) {
  syncWorkspace?.classList.toggle("sync-guest", on);
  loginPanel.hidden = !on;
  slotEls.forEach((el) => {
    if (isAttachSlot(el)) {
      setAttachBusy(attachBusy);
      return;
    }
    const ta = slotInput(el);
    ta.readOnly = on;
    ta.tabIndex = on ? -1 : 0;
  });
}

function boot() {
  applyI18n();
  paintToolUser();
  const user = getUser();
  if (!user?.id) {
    setGuestMode(true);
    paintAttachGrid();
    fitAllInputs();
    stopPolling();
    return;
  }
  setGuestMode(false);
  paintFromCache();
  fitAllInputs();
  setTimeout(() => loadNotes(), 0);
  startPolling();
}

previewClose?.addEventListener("click", closePreview);
attachPreview?.addEventListener("click", (e) => {
  if (e.target === attachPreview) closePreview();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (currentUserId()) pollNotes();
});

window.addEventListener("pageshow", () => {
  if (currentUserId()) {
    pollNotes();
    startPolling();
  }
});

window.addEventListener("pagehide", stopPolling);

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    paintAttachGrid();
    refreshAttachStorage();
    baselineStatus.forEach((msg, slot) => {
      if (!flashing.has(slot)) {
        const el = slotEls.find((s) => slotNum(s) === slot);
        const status = slotStatusEl(el);
        if (status) status.textContent = msg;
      }
    });
  },
});

slotEls.forEach((el) => {
  if (isAttachSlot(el)) {
    el.querySelector(".sync-add-file")?.addEventListener("click", () => attachInput.click());
    attachInput.addEventListener("change", () => handleAttachPick([...attachInput.files]));
    el.querySelector(".sync-download-sel")?.addEventListener("click", (e) => {
      e.preventDefault();
      downloadSelectedAttach();
    });
    el.querySelector(".sync-delete-sel")?.addEventListener("click", (e) => {
      e.preventDefault();
      deleteSelectedAttach();
    });
    return;
  }
  const ta = slotInput(el);
  ta.addEventListener("input", () => {
    fitInput(ta);
    scheduleSave(el);
    scheduleCacheWrite();
  });
  ta.addEventListener("focus", () => fitInput(ta));
  ta.addEventListener("blur", () => fitInput(ta, { tail: true }));
  el.querySelector(".sync-copy").addEventListener("click", (e) => copySlot(el, e));
  el.querySelector(".sync-clear").addEventListener("click", (e) => {
    e.preventDefault();
    clearSlot(el);
  });
});

window.addEventListener("beforeunload", () => {
  if (!dirtySlots.size) return;
  const uid = currentUserId();
  if (!uid || !navigator.sendBeacon) return;
  dirtySlots.forEach((slot) => {
    if (slot === ATTACH_SLOT) return;
    const el = slotEls.find((s) => slotNum(s) === slot);
    if (!el) return;
    // Don't beacon-restore content after a clear
    if (!slotInput(el).value && currentEpoch(slot) > 0) return;
    navigator.sendBeacon(
      "/api/portal?action=syncnote_save",
      new Blob([apiBody({ slot, content: slotInput(el).value })], { type: "application/json" })
    );
  });
});

boot();
