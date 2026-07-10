import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";
import { currentUserId, loginHref } from "../js/quotaClient.js";
import { paintToolUser, deferWork } from "../js/toolPageBoot.js";
import { uploadFile } from "../js/attachGrid.js";
import { watermarkImage, fetchStampLine } from "../js/watermark.js";

const UI = {
  en: {
    title: "Portfolio",
    sub: "Show design or photo work with watermark — harder to steal, still easy to share.",
    back: "Toolbox",
    loginDesc: "Sign in to upload portfolio works.",
    loginBtn: "Sign in / Register",
    lblTitle: "Title",
    lblFile: "Image (max 5MB)",
    lblWatermark: "Watermark text",
    stampLbl: "Add upload-time stamp",
    stampHint:
      "Uses timezone inferred from your upload IP location. If you use a proxy or VPN, the time may not match where you actually are.",
    submit: "Upload & publish",
    mineTitle: "My works",
    uploading: "Processing…",
    done: "Published! Share link:",
    err: "Upload failed",
    views: (n) => `${n} views`,
  },
  zh: {
    title: "作品展示",
    sub: "设计/摄影用户上传带水印作品，方便展示、降低被白嫖风险。",
    back: "返回工具箱",
    loginDesc: "请登录后上传作品。",
    loginBtn: "登录 / 注册",
    lblTitle: "作品标题",
    lblFile: "图片（最大 5MB）",
    lblWatermark: "水印文字",
    stampLbl: "添加时间戳",
    stampHint:
      "时间按上传 IP 所在地时区生成。若使用代理或 VPN，显示时间可能与真实所在地不一致。",
    submit: "上传并发布",
    mineTitle: "我的作品",
    uploading: "处理中…",
    done: "已发布，分享链接：",
    err: "上传失败",
    views: (n) => `${n} 次浏览`,
  },
  ja: {
    title: "作品展示",
    sub: "デザイン・写真を透かし付きで公開。",
    back: "ツールボックス",
    loginDesc: "ログインして作品をアップロード。",
    loginBtn: "ログイン / 登録",
    lblTitle: "タイトル",
    lblFile: "画像（最大5MB）",
    lblWatermark: "透かし文字",
    stampLbl: "タイムスタンプを追加",
    stampHint: "アップロードIPのタイムゾーンを使用。VPN利用時は実際の場所と異なる場合があります。",
    submit: "アップロードして公開",
    mineTitle: "自分の作品",
    uploading: "処理中…",
    done: "公開しました：",
    err: "アップロード失敗",
    views: (n) => `${n} 回表示`,
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;

const form = document.getElementById("uploadForm");
const errBox = document.getElementById("errBox");
const resultBox = document.getElementById("resultBox");
const loginPanel = document.getElementById("loginPanel");
const workspace = document.getElementById("scWorkspace");
const mineWrap = document.getElementById("mineWrap");
const mineList = document.getElementById("mineList");

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("backLink").textContent = t.back;
  document.getElementById("loginDesc").textContent = t.loginDesc;
  document.getElementById("loginBtn").textContent = t.loginBtn;
  document.getElementById("loginBtn").href = loginHref("/tools/showcase/");
  document.getElementById("lblTitle").textContent = t.lblTitle;
  document.getElementById("lblFile").textContent = t.lblFile;
  document.getElementById("lblWatermark").textContent = t.lblWatermark;
  document.getElementById("stampLbl").textContent = t.stampLbl;
  document.getElementById("stampHint").textContent = t.stampHint;
  document.getElementById("submitBtn").textContent = t.submit;
  document.getElementById("mineTitle").textContent = t.mineTitle;
}

function setGuest(on) {
  workspace.classList.toggle("sc-guest", on);
  loginPanel.hidden = !on;
  mineWrap.hidden = on;
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
    <li><a href="${w.viewUrl}">
      <img src="${w.thumbUrl}" alt="" loading="lazy" />
      <span>${esc(w.title || w.id)} · ${t.views(w.views)}</span>
    </a></li>`
    )
    .join("");
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.hidden = true;
  resultBox.hidden = true;
  const uid = currentUserId();
  if (!uid) return;

  const file = document.getElementById("fileIn").files?.[0];
  if (!file) return;

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = t.uploading;

  try {
    const watermark = document.getElementById("wmIn").value.trim();
    const stampEnabled = document.getElementById("stampChk").checked;
    const stampLine = stampEnabled ? await fetchStampLine() : "";
    const processed = await watermarkImage(file, { text: watermark, stampLine });

    const uploaded = await uploadFile({
      file: processed,
      purpose: "showcase",
      userId: uid,
      meta: { watermark, stampLine },
    });

    const res = await fetch("/api/portal?action=showcase_publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: uid,
        file_id: uploaded.id,
        title: document.getElementById("titleIn").value.trim(),
        watermark,
        stamp_enabled: stampEnabled,
        stamp_label: stampLine,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.err);

    const link = new URL(data.viewUrl, location.origin).href;
    resultBox.innerHTML = `${t.done} <a href="${link}">${link}</a>`;
    resultBox.hidden = false;
    form.reset();
    await loadMine();
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
  },
});

function boot() {
  applyI18n();
  paintToolUser();
  const user = getUser();
  if (!user?.id) {
    setGuest(true);
    return;
  }
  setGuest(false);
  deferWork(loadMine);
}

boot();
