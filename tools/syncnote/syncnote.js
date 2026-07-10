import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";
import { currentUserId, loginHref } from "../js/quotaClient.js";
import { paintToolUser, deferWork } from "../js/toolPageBoot.js";
import { renderAttachGrid, uploadFile, deleteFile, downloadFileEntry, SYNCNOTE_MAX_ATTACH } from "../js/attachGrid.js";
import { fetchFileStorage, paintStorageMeta } from "../js/storageQuota.js";
import { showToast, showSheet } from "/game/js/toast.js";

const MAX_LINES = 3;
const FLASH_MS = 2200;
const ATTACH_SLOT = 2;
const MAX_FILE_MB = 5;

const UI = {
  en: {
    title: "Text Relay",
    sub: "Two text fields + one attachment box (5MB each, D1), synced across devices.",
    back: "Toolbox",
    loginDesc: "Sign in to use Text Relay.",
    loginBtn: "Sign in / Register",
    slot: (n) => `Relay ${n}`,
    slotAttach: "Attachments",
    copy: "Copy",
    addFile: "Add image",
    downloadAll: "Download all",
    downloadOk: "OK",
    downloadEmpty: "No images to download",
    downloadDone: (n) =>
      `${n} image(s) saved to your device’s default Downloads folder.\n\niPhone/iPad: Files app → Downloads\nMac: ~/Downloads\nAndroid: Downloads`,
    maxImages: `Up to ${SYNCNOTE_MAX_ATTACH} images`,
    clear: "Delete all",
    saved: "Saved",
    saving: "Saving…",
    uploading: "Uploading…",
    loaded: "Loaded",
    cleared: "Cleared",
    copied: "Copied to clipboard",
    storageDesc: `Up to ${SYNCNOTE_MAX_ATTACH} images · max ${MAX_FILE_MB}MB each`,
    storageLeft: (mb) => `${mb} left`,
    errLoad: "Failed to load",
    errSave: "Failed to save",
    errUpload: "Upload failed",
    errUploadImage: "Images only",
    errClip: "Clipboard unavailable",
  },
  zh: {
    title: "文本中转站",
    sub: "两个文本框 + 一个附件框（单文件最大 5MB，D1 免费存储），跨设备同步。",
    back: "返回工具箱",
    loginDesc: "请登录后使用文本中转站。",
    loginBtn: "登录 / 注册",
    slot: (n) => `中转 ${n}`,
    slotAttach: "附件",
    copy: "复制",
    addFile: "添加图片",
    downloadAll: "全部下载",
    downloadOk: "知道了",
    downloadEmpty: "没有可下载的图片",
    downloadDone: (n) =>
      `已下载 ${n} 张图片到系统默认「下载」文件夹。\n\niPhone/iPad：文件 App → 下载\nMac：下载文件夹\nAndroid：Download 目录`,
    maxImages: `最多 ${SYNCNOTE_MAX_ATTACH} 张图片`,
    clear: "全部删除",
    saved: "已保存",
    saving: "保存中…",
    uploading: "上传中…",
    loaded: "已加载",
    cleared: "已清空",
    copied: "已复制到剪贴板",
    storageDesc: `最多 ${SYNCNOTE_MAX_ATTACH} 张图片 · 单文件最大 ${MAX_FILE_MB}MB`,
    storageLeft: (mb) => `剩余 ${mb}`,
    errLoad: "加载失败",
    errSave: "保存失败",
    errUpload: "上传失败",
    errUploadImage: "仅支持图片",
    errClip: "无法访问剪贴板",
  },
  ja: {
    title: "テキスト中継",
    sub: "テキスト2枠 + 添付1枠（各5MB・D1）、端末間同期。",
    back: "ツールボックス",
    loginDesc: "テキスト中継を使うにはログインしてください。",
    loginBtn: "ログイン / 登録",
    slot: (n) => `中継 ${n}`,
    slotAttach: "添付",
    copy: "コピー",
    addFile: "画像を追加",
    downloadAll: "すべてダウンロード",
    downloadOk: "OK",
    downloadEmpty: "ダウンロードする画像がありません",
    downloadDone: (n) =>
      `${n} 枚を端末の既定のダウンロードフォルダに保存しました。\n\niPhone/iPad：ファイル → ダウンロード\nMac：ダウンロード\nAndroid：Download`,
    maxImages: `最大 ${SYNCNOTE_MAX_ATTACH} 枚`,
    clear: "すべて削除",
    saved: "保存済み",
    saving: "保存中…",
    uploading: "アップロード中…",
    loaded: "読み込み済み",
    cleared: "削除しました",
    copied: "クリップボードにコピー",
    storageDesc: `最大 ${SYNCNOTE_MAX_ATTACH} 枚 · 各 ${MAX_FILE_MB}MB まで`,
    storageLeft: (mb) => `残り ${mb}`,
    errLoad: "読み込みに失敗",
    errSave: "保存に失敗",
    errUpload: "アップロード失敗",
    errUploadImage: "画像のみ対応",
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
let attachFiles = [];

const errBox = document.getElementById("errBox");
const loginPanel = document.getElementById("loginPanel");
const syncWorkspace = document.getElementById("syncWorkspace");
const slotEls = [...document.querySelectorAll(".sync-slot")];
const attachGrid = document.getElementById("attachGrid");
const attachInput = document.getElementById("attachInput");
const attachDesc = document.getElementById("attachDesc");
const attachSpace = document.getElementById("attachSpace");
const attachSlotEl = slotEls.find((s) => parseInt(s.dataset.slot, 10) === ATTACH_SLOT);

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

function paintAttachGrid() {
  const uid = currentUserId();
  renderAttachGrid(attachGrid, attachFiles, {
    readOnly: !uid,
    userId: uid,
    onDelete: uid ? (id) => removeAttach(id) : undefined,
  });
  const addBtn = attachSlotEl?.querySelector(".sync-add-file");
  if (addBtn) addBtn.disabled = !uid || attachFiles.length >= SYNCNOTE_MAX_ATTACH;
}

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("backLink").textContent = t.back;
  document.getElementById("loginDesc").textContent = t.loginDesc;
  document.getElementById("loginBtn").textContent = t.loginBtn;
  document.getElementById("loginBtn").href = loginHref("/tools/syncnote/");
  if (attachDesc) attachDesc.textContent = t.storageDesc;
  slotEls.forEach((el) => {
    const n = slotNum(el);
    if (isAttachSlot(el)) {
      el.querySelector("[data-slot-label]").textContent = t.slotAttach;
      el.querySelector(".sync-add-file").textContent = t.addFile;
      el.querySelector(".sync-download-all").textContent = t.downloadAll;
      return;
    }
    el.querySelector("[data-slot-label]").textContent = t.slot(n + 1);
    el.querySelector(".sync-copy").textContent = t.copy;
    el.querySelector(".sync-clear").textContent = t.clear;
  });
}

function renderBaseline(slot) {
  if (flashing.has(slot)) return;
  const el = slotEls.find((s) => slotNum(s) === slot);
  if (!el) return;
  slotStatusEl(el).textContent = baselineStatus.get(slot) || "";
}

function setBaseline(el, msg) {
  const slot = slotNum(el);
  baselineStatus.set(slot, msg);
  renderBaseline(slot);
}

function flashStatus(el, msg) {
  const slot = slotNum(el);
  clearTimeout(flashTimers.get(slot));
  flashing.add(slot);
  slotStatusEl(el).textContent = msg;
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

async function refreshAttachStorage() {
  const uid = currentUserId();
  if (!uid) {
    if (attachSpace) attachSpace.textContent = "";
    return;
  }
  try {
    const data = await fetchFileStorage(uid, "syncnote");
    paintStorageMeta({ descEl: attachDesc, spaceEl: attachSpace, t, data });
  } catch {
    if (attachSpace) attachSpace.textContent = "";
  }
}

async function loadNotes() {
  const uid = currentUserId();
  if (!uid) return;
  showError("");
  try {
    const res = await fetch(`/api/portal?action=syncnote_get&user_id=${encodeURIComponent(uid)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.errLoad);
    const bySlot = new Map((data.slots || []).map((s) => [s.slot, s]));
    slotEls.forEach((el) => {
      const slot = slotNum(el);
      const row = bySlot.get(slot) || { content: "", updatedAt: null };
      if (isAttachSlot(el)) {
        attachFiles = (row.files || []).slice(0, SYNCNOTE_MAX_ATTACH).map((f) => ({
          ...f,
          url: f.url,
        }));
        paintAttachGrid();
        await refreshAttachStorage();
        return;
      }
      const ta = slotInput(el);
      ta.value = row.content || "";
      dirtySlots.delete(slot);
      setBaseline(el, loadedLabel(row.updatedAt));
      fitInput(ta, { tail: true });
    });
    const userLine = document.getElementById("userLine");
    userLine.hidden = false;
    userLine.textContent = `@${data.username || getUser()?.username || ""}`;
    paintToolUser();
  } catch (e) {
    showError(e.message || t.errLoad);
  }
}

async function saveSlot(el, { quiet = false } = {}) {
  const uid = currentUserId();
  if (!uid || isAttachSlot(el)) return;
  const slot = slotNum(el);
  if (!quiet && !flashing.has(slot)) setBaseline(el, t.saving);
  try {
    const res = await fetch("/api/portal?action=syncnote_save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: apiBody({ slot, content: slotInput(el).value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.errSave);
    dirtySlots.delete(slot);
    if (!flashing.has(slot)) setBaseline(el, savedLabel(data.updatedAt));
  } catch (e) {
    showError(e.message || t.errSave);
    if (!flashing.has(slot)) renderBaseline(slot);
  }
}

function scheduleSave(el) {
  const slot = slotNum(el);
  dirtySlots.add(slot);
  clearTimeout(saveTimers.get(slot));
  saveTimers.set(slot, setTimeout(() => saveSlot(el, { quiet: flashing.has(slot) }), 600));
}

async function clearSlot(el) {
  const uid = currentUserId();
  if (!uid) return;
  const slot = slotNum(el);
  showError("");
  try {
    const res = await fetch("/api/portal?action=syncnote_clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: apiBody({ slot }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.errSave);
    if (isAttachSlot(el)) {
      attachFiles = [];
      paintAttachGrid();
      await refreshAttachStorage();
      showToast(t.cleared);
    } else {
      const ta = slotInput(el);
      ta.value = "";
      fitInput(ta);
      flashStatus(el, t.cleared);
      setBaseline(el, "");
    }
    dirtySlots.delete(slot);
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
    paintAttachGrid();
    await refreshAttachStorage();
    showToast(t.cleared);
  } catch (e) {
    showError(e.message || t.errUpload);
  }
}

async function downloadAllAttach() {
  const uid = currentUserId();
  if (!uid) return;
  const images = attachFiles.filter((f) => String(f.mime || "").startsWith("image/"));
  if (!images.length) {
    await showSheet(t.downloadEmpty, [{ label: t.downloadOk, value: true }]);
    return;
  }
  showError("");
  try {
    for (const f of images) {
      await downloadFileEntry(f, uid);
      await new Promise((r) => setTimeout(r, 280));
    }
    await showSheet(t.downloadDone(images.length), [{ label: t.downloadOk, value: true }]);
  } catch (e) {
    showError(e.message || t.errUpload);
  }
}

async function handleAttachPick(fileList) {
  const uid = currentUserId();
  if (!uid || !fileList?.length) return;
  const room = SYNCNOTE_MAX_ATTACH - attachFiles.length;
  if (room <= 0) {
    showError(t.maxImages);
    attachInput.value = "";
    return;
  }
  showError("");
  try {
    const picks = [...fileList].slice(0, room);
    for (const file of picks) {
      if (!file.type?.startsWith("image/")) {
        throw new Error(t.errUploadImage);
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`${file.name}: max ${MAX_FILE_MB}MB`);
      }
      const uploaded = await uploadFile({ file, purpose: "syncnote", slot: ATTACH_SLOT, userId: uid });
      attachFiles.push(uploaded);
    }
    attachFiles = attachFiles.slice(0, SYNCNOTE_MAX_ATTACH);
    paintAttachGrid();
    await refreshAttachStorage();
    showToast(t.saved);
  } catch (e) {
    showError(e.message || t.errUpload);
  } finally {
    attachInput.value = "";
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
  syncWorkspace.classList.toggle("sync-guest", on);
  loginPanel.hidden = !on;
  slotEls.forEach((el) => {
    if (isAttachSlot(el)) {
      el.querySelector(".sync-add-file").disabled = on;
      el.querySelector(".sync-download-all").disabled = on;
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
  paintAttachGrid();
  fitAllInputs();
  const user = getUser();
  if (!user?.id) {
    setGuestMode(true);
    return;
  }
  setGuestMode(false);
  deferWork(async () => {
    await loadNotes();
    await refreshAttachStorage();
  });
}

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    refreshAttachStorage();
    baselineStatus.forEach((msg, slot) => {
      if (!flashing.has(slot)) {
        const el = slotEls.find((s) => slotNum(s) === slot);
        if (el) slotStatusEl(el).textContent = msg;
      }
    });
  },
});

slotEls.forEach((el) => {
  if (isAttachSlot(el)) {
    el.querySelector(".sync-add-file").addEventListener("click", () => attachInput.click());
    attachInput.addEventListener("change", () => handleAttachPick([...attachInput.files]));
    el.querySelector(".sync-download-all").addEventListener("click", (e) => {
      e.preventDefault();
      downloadAllAttach();
    });
    return;
  }
  const ta = slotInput(el);
  ta.addEventListener("input", () => {
    fitInput(ta);
    scheduleSave(el);
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
    navigator.sendBeacon(
      "/api/portal?action=syncnote_save",
      new Blob([apiBody({ slot, content: slotInput(el).value })], { type: "application/json" })
    );
  });
});

boot();
