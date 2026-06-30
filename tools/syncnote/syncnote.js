import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";
import { currentUserId, loginHref } from "../js/quotaClient.js";

const SLOT_COUNT = 3;

const UI = {
  en: {
    title: "syncNote",
    sub: "Three relay fields across devices. Saved until you delete each one.",
    back: "Toolbox",
    loginDesc: "Sign in to use syncNote.",
    loginBtn: "Sign in / Register",
    slot: (n) => `Relay ${n}`,
    copy: "Copy",
    paste: "Paste",
    clear: "Delete",
    saved: "Saved",
    saving: "Saving…",
    loaded: "Loaded",
    cleared: "Cleared",
    copied: "Copied to clipboard",
    pasted: "Pasted from clipboard",
    user: (n) => `@${n}`,
    errLoad: "Failed to load",
    errSave: "Failed to save",
    errClip: "Clipboard unavailable",
  },
  zh: {
    title: "syncNote",
    sub: "三个中转框，跨设备同步；不点删除则一直保留各框内容。",
    back: "返回工具箱",
    loginDesc: "请登录后使用 syncNote。",
    loginBtn: "登录 / 注册",
    slot: (n) => `中转 ${n}`,
    copy: "复制",
    paste: "粘贴",
    clear: "删除",
    saved: "已保存",
    saving: "保存中…",
    loaded: "已加载",
    cleared: "已清空",
    copied: "已复制到剪贴板",
    pasted: "已从剪贴板粘贴",
    user: (n) => `@${n}`,
    errLoad: "加载失败",
    errSave: "保存失败",
    errClip: "无法访问剪贴板",
  },
  ja: {
    title: "syncNote",
    sub: "3つの中継欄で端末間同期。削除するまで各欄を保持。",
    back: "ツールボックス",
    loginDesc: "syncNote を使うにはログインしてください。",
    loginBtn: "ログイン / 登録",
    slot: (n) => `中継 ${n}`,
    copy: "コピー",
    paste: "貼り付け",
    clear: "削除",
    saved: "保存済み",
    saving: "保存中…",
    loaded: "読み込み済み",
    cleared: "削除しました",
    copied: "クリップボードにコピー",
    pasted: "クリップボードから貼り付け",
    user: (n) => `@${n}`,
    errLoad: "読み込みに失敗",
    errSave: "保存に失敗",
    errClip: "クリップボードを使用できません",
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;
const saveTimers = new Map();
const dirtySlots = new Set();

const errBox = document.getElementById("errBox");
const loginPanel = document.getElementById("loginPanel");
const editorWrap = document.getElementById("editorWrap");
const slotEls = [...document.querySelectorAll(".sync-slot")];

function slotNum(el) {
  return parseInt(el.dataset.slot, 10);
}

function slotInput(el) {
  return el.querySelector(".sync-input");
}

function slotStatus(el) {
  return el.querySelector(".sync-status");
}

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("backLink").textContent = t.back;
  document.getElementById("loginDesc").textContent = t.loginDesc;
  document.getElementById("loginBtn").textContent = t.loginBtn;
  document.getElementById("loginBtn").href = loginHref("/tools/syncnote/");
  slotEls.forEach((el) => {
    const n = slotNum(el) + 1;
    el.querySelector("[data-slot-label]").textContent = t.slot(n);
    el.querySelector(".sync-copy").textContent = t.copy;
    el.querySelector(".sync-paste").textContent = t.paste;
    el.querySelector(".sync-clear").textContent = t.clear;
  });
}

function setSlotStatus(el, msg) {
  slotStatus(el).textContent = msg || "";
}

function showError(msg) {
  errBox.textContent = msg;
  errBox.hidden = !msg;
}

function apiBody(extra = {}) {
  return JSON.stringify({ user_id: currentUserId(), ...extra });
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
      slotInput(el).value = row.content || "";
      dirtySlots.delete(slot);
      setSlotStatus(el, row.updatedAt ? `${t.loaded} · ${row.updatedAt}` : t.loaded);
    });
    const userLine = document.getElementById("userLine");
    userLine.hidden = false;
    userLine.textContent = t.user(data.username || getUser()?.username || "");
  } catch (e) {
    showError(e.message || t.errLoad);
  }
}

async function saveSlot(el) {
  const uid = currentUserId();
  if (!uid) return;
  const slot = slotNum(el);
  setSlotStatus(el, t.saving);
  try {
    const res = await fetch("/api/portal?action=syncnote_save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: apiBody({ slot, content: slotInput(el).value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.errSave);
    dirtySlots.delete(slot);
    setSlotStatus(el, data.updatedAt ? `${t.saved} · ${data.updatedAt}` : t.saved);
  } catch (e) {
    showError(e.message || t.errSave);
    setSlotStatus(el, "");
  }
}

function scheduleSave(el) {
  const slot = slotNum(el);
  dirtySlots.add(slot);
  clearTimeout(saveTimers.get(slot));
  saveTimers.set(slot, setTimeout(() => saveSlot(el), 600));
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
    slotInput(el).value = "";
    dirtySlots.delete(slot);
    setSlotStatus(el, t.cleared);
  } catch (e) {
    showError(e.message || t.errSave);
  }
}

async function copySlot(el) {
  showError("");
  try {
    await navigator.clipboard.writeText(slotInput(el).value);
    setSlotStatus(el, t.copied);
  } catch {
    showError(t.errClip);
  }
}

async function pasteSlot(el) {
  showError("");
  try {
    const text = await navigator.clipboard.readText();
    slotInput(el).value = text;
    scheduleSave(el);
    setSlotStatus(el, t.pasted);
  } catch {
    showError(t.errClip);
  }
}

function boot() {
  applyI18n();
  const user = getUser();
  if (!user?.id) {
    loginPanel.hidden = false;
    editorWrap.hidden = true;
    return;
  }
  loginPanel.hidden = true;
  editorWrap.hidden = false;
  loadNotes();
}

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
  },
});

slotEls.forEach((el) => {
  slotInput(el).addEventListener("input", () => scheduleSave(el));
  el.querySelector(".sync-copy").addEventListener("click", () => copySlot(el));
  el.querySelector(".sync-paste").addEventListener("click", () => pasteSlot(el));
  el.querySelector(".sync-clear").addEventListener("click", () => clearSlot(el));
});

window.addEventListener("beforeunload", () => {
  if (!dirtySlots.size) return;
  const uid = currentUserId();
  if (!uid || !navigator.sendBeacon) return;
  dirtySlots.forEach((slot) => {
    const el = slotEls.find((s) => slotNum(s) === slot);
    if (!el) return;
    navigator.sendBeacon(
      "/api/portal?action=syncnote_save",
      new Blob([apiBody({ slot, content: slotInput(el).value })], { type: "application/json" })
    );
  });
});

boot();
