import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { currentUserId, loginHref, quotaQuery, quotaBody, isLoginRequired } from "../js/quotaClient.js";
import { apiErrorText, formatQuotaLine } from "../js/toolI18n.js";
import { guessQuota, readQuotaCache, writeQuotaCache } from "../js/quotaUi.js";

const UI = {
  en: {
    title: "PDF Convert",
    sub: "Word / TXT / MD → PDF (client-side)",
    back: "Toolbox",
    pick: "Choose file",
    hint: ".docx .txt .md",
    convert: "Generate PDF",
    quota: (r, a, logged, name) =>
      logged ? `Today: ${r}/${a} · ${name || "signed in"}` : `Today: ${r}/${a} (guest)`,
    noFile: "Select a file first",
    converting: "Converting…",
    errQuota: "Daily limit reached",
    loginTitle: "Sign in for more",
    loginDesc: "Guests: 1/day. Registered users: 5/day per tool.",
    loginBtn: "Sign in / Register",
    unlockTitle: "Need more conversions?",
    unlockDesc: (n) => `Watch ${n} simulated ad(s) for +1 use, or pay via Wise (soon).`,
    adBtn: (n) => `Watch ad (${n} needed)`,
    adProgress: (p, n) => `Ad progress: ${p}/${n}`,
    wise: "Pay via Wise (coming soon)",
    rulesTitle: "Usage rules",
    rules: [
      "Guests: 1 use/day per tool. Registered: 5/day (all toolbox tools).",
      "Over limit: simulated ads (+1 each round, doubling) or future Wise payment.",
      "No commercial ad API yet — needs your AdSense/partner account.",
      "Conversion runs locally in your browser.",
    ],
    errConvert: "Conversion failed",
    errType: "Unsupported file type",
    adNote: "Commercial ads require a publisher account; not auto-available.",
  },
  zh: {
    title: "PDF 转换",
    sub: "Word / TXT / MD → PDF（本地转换）",
    back: "返回工具箱",
    pick: "选择文件",
    hint: ".docx .txt .md",
    convert: "生成 PDF",
    quota: (r, a, logged, name) =>
      logged ? `今日剩余 ${r}/${a} · ${name || "已登录"}` : `今日剩余 ${r}/${a}（游客）`,
    noFile: "请先选择文件",
    converting: "转换中…",
    errQuota: "今日次数已用完",
    loginTitle: "登录后继续使用",
    loginDesc: "游客每天 1 次；注册用户每天 5 次（工具箱通用）。",
    loginBtn: "登录 / 注册",
    unlockTitle: "需要更多次数？",
    unlockDesc: (n) => `观看 ${n} 次模拟广告 +1 次，或使用 Wise 付费（即将上线）。`,
    adBtn: (n) => `观看广告（还需 ${n} 次）`,
    adProgress: (p, n) => `广告进度：${p}/${n}`,
    wise: "Wise 扫码支付（即将上线）",
    rulesTitle: "使用说明",
    rules: [
      "游客每工具每天 1 次；注册用户每工具每天 5 次（工具箱统一规则）。",
      "超出后：模拟广告解锁或未来 Wise 付费。",
      "商用广告 API 未接入，需您提供广告平台账号。",
      "文件仅在浏览器本地转换。",
    ],
    errConvert: "转换失败",
    errType: "不支持的文件格式",
    adNote: "商用广告需自行申请发布商账号，无法自动开通。",
  },
  ja: {
    title: "PDF変換",
    sub: "Word / TXT / MD → PDF（ローカル）",
    back: "ツールボックス",
    pick: "ファイルを選択",
    hint: ".docx .txt .md",
    convert: "PDFを生成",
    quota: (r, a, logged, name) =>
      logged ? `本日残り ${r}/${a} · ${name || "ログイン済"}` : `本日残り ${r}/${a}（ゲスト）`,
    noFile: "ファイルを選んでください",
    converting: "変換中…",
    errQuota: "本日の回数を使い切りました",
    loginTitle: "ログインして続行",
    loginDesc: "ゲスト1日1回。登録ユーザーは1日5回。",
    loginBtn: "ログイン / 登録",
    unlockTitle: "回数を追加",
    unlockDesc: (n) => `模擬広告 ${n} 回で +1。Wise決済は準備中。`,
    adBtn: (n) => `広告（あと ${n} 回）`,
    adProgress: (p, n) => `進捗：${p}/${n}`,
    wise: "Wise決済（準備中）",
    rulesTitle: "利用ルール",
    rules: [
      "ゲスト1日1回。登録ユーザー1日5回（ツール共通）。",
      "超過後は模擬広告またはWise。",
      "商用広告APIは未連携。",
      "ローカル変換のみ。",
    ],
    errConvert: "変換に失敗しました",
    errType: "未対応の形式です",
    adNote: "商用広告は自動取得できません。",
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;
let quota = null;
let selectedFile = null;

const convertBtn = document.getElementById("convertBtn");
const errBox = document.getElementById("errBox");
const unlockPanel = document.getElementById("unlockPanel");
const loginPanel = document.getElementById("loginPanel");
const quotaBox = document.getElementById("quotaBox");

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("backLink").textContent = t.back;
  document.getElementById("pickLabel").textContent = t.pick;
  document.getElementById("pickHint").textContent = t.hint;
  convertBtn.textContent = t.convert;
  document.getElementById("rulesTitle").textContent = t.rulesTitle;
  document.getElementById("rulesList").innerHTML = t.rules.map((r) => `<li>${r}</li>`).join("");
  document.getElementById("unlockTitle").textContent = t.unlockTitle;
  document.getElementById("wiseBtn").textContent = t.wise;
  document.getElementById("loginTitle").textContent = t.loginTitle;
  document.getElementById("loginDesc").textContent = t.loginDesc;
  document.getElementById("loginBtn").textContent = t.loginBtn;
  document.getElementById("adNote").textContent = t.adNote;
  document.getElementById("loginBtn").href = loginHref("/tools/pdf/");
  updateQuotaUI();
  if (!errBox.hidden && errBox.dataset.errCode) {
    errBox.textContent = apiErrorText({ error: errBox.dataset.errCode }, lang) || t.errQuota;
  }
}

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    loadQuota();
  },
});

applyI18n();

quota = readQuotaCache("pdf") || guessQuota();
updateQuotaUI();
loadQuota();

async function loadQuota() {
  quotaBox.classList.add("is-fetching");
  try {
    const res = await fetch(`/api/portal?action=pdf_quota${quotaQuery()}`);
    quota = await res.json();
    writeQuotaCache("pdf", quota);
    updateQuotaUI();
  } catch {
    quotaBox.classList.remove("is-fetching");
  }
}

function updateQuotaUI() {
  if (!quota) return;
  quotaBox.classList.remove("is-fetching");
  quotaBox.textContent = formatQuotaLine(t, quota);
  loginPanel.hidden = !quota.needLogin;
  unlockPanel.hidden = !quota.needUnlock;
  if (quota.needUnlock) {
    document.getElementById("unlockDesc").textContent = t.unlockDesc(quota.adsNeeded);
    document.getElementById("adBtn").textContent = t.adBtn(quota.adsRemaining || quota.adsNeeded);
    document.getElementById("adProgress").textContent = t.adProgress(quota.adProgress, quota.adsNeeded);
  }
}

function setFile(file) {
  selectedFile = file;
  const fileName = document.getElementById("fileName");
  if (!file) {
    fileName.hidden = true;
    convertBtn.disabled = true;
    return;
  }
  fileName.hidden = false;
  fileName.textContent = file.name;
  convertBtn.disabled = false;
  errBox.hidden = true;
}

document.getElementById("fileInput").addEventListener("change", (e) => setFile(e.target.files?.[0] || null));
const fileDrop = document.getElementById("fileDrop");
fileDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileDrop.classList.add("dragover");
});
fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("dragover"));
fileDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDrop.classList.remove("dragover");
  setFile(e.dataTransfer.files?.[0] || null);
});

async function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function extractBodyHtml(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt") {
    const text = await file.text();
    return `<pre style="white-space:pre-wrap;font-size:14px;line-height:1.55;margin:0">${escapeHtml(text)}</pre>`;
  }
  if (ext === "md") {
    const text = await file.text();
    const html = text
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    return `<div style="font-size:14px;line-height:1.55">${html}</div>`;
  }
  if (ext === "docx" || ext === "doc") {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js");
    const buf = await file.arrayBuffer();
    const result = await window.mammoth.convertToHtml({ arrayBuffer: buf });
    return `<div style="font-size:14px;line-height:1.55">${result.value}</div>`;
  }
  throw new Error(t.errType);
}

async function generatePdfOffscreen(bodyHtml, filename) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-12000px;top:0;width:794px;height:1120px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{margin:0;padding:28px 32px;color:#000;background:#fff;
    font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}
  </style></head><body>${bodyHtml}</body></html>`);
  doc.close();

  await new Promise((r) => {
    if (iframe.contentWindow?.document?.readyState === "complete") r();
    else iframe.onload = () => r();
  });
  await new Promise((r) => setTimeout(r, 300));

  try {
    await window.html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(doc.body)
      .save();
  } finally {
    iframe.remove();
  }
}

convertBtn.addEventListener("click", async () => {
  errBox.hidden = true;
  errBox.dataset.errCode = "";
  if (!selectedFile) {
    errBox.textContent = t.noFile;
    errBox.hidden = false;
    return;
  }
  convertBtn.disabled = true;
  convertBtn.textContent = t.converting;
  try {
    const useRes = await fetch("/api/portal?action=pdf_use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quotaBody()),
    });
    const useData = await useRes.json();
    if (!useRes.ok) {
      quota = useData;
      updateQuotaUI();
      const code = useData.error || (isLoginRequired(useData) ? "login_required" : "daily_limit");
      errBox.dataset.errCode = code;
      errBox.textContent = apiErrorText(useData, lang) || t.errQuota;
      errBox.hidden = false;
      return;
    }
    quota = useData;
    updateQuotaUI();
    const bodyHtml = await extractBodyHtml(selectedFile);
    const base = selectedFile.name.replace(/\.[^.]+$/, "") || "document";
    await generatePdfOffscreen(bodyHtml, `${base}.pdf`);
  } catch (e) {
    errBox.textContent = e.message || t.errConvert;
    errBox.hidden = false;
  } finally {
    convertBtn.textContent = t.convert;
    convertBtn.disabled = !selectedFile;
  }
});

document.getElementById("adBtn").addEventListener("click", async () => {
  const res = await fetch("/api/portal?action=tool_ad&tool=pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...quotaBody(), tool: "pdf" }),
  });
  quota = await res.json();
  updateQuotaUI();
});
