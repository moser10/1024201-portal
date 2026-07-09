import { getPortalLang, mountLangTabs } from "./js/langTabs.js";
import { apiErrorText, formatQuotaLine } from "./js/toolI18n.js";
import { guessQuota, readQuotaCache, writeQuotaCache } from "./js/quotaUi.js";

const UI = {
  en: {
    title: "PDF Convert",
    sub: "Word / TXT / MD → PDF (client-side)",
    pick: "Choose file",
    hint: ".docx .txt .md",
    convert: "Generate PDF",
    quota: (r, a) => `Uses left: ${r}/${a}`,
    quotaUnlimited: (who) => (who ? `Unlimited · ${who}` : "Unlimited · starred"),
    starTitle: "Unlock unlimited conversions",
    starDesc: "Star this repo on GitHub, then sign in with GitHub.",
    starBtn: "Star & sign in with GitHub",
    noFile: "Select a file first",
    converting: "Converting…",
    errQuota: "Free limit reached",
    rulesTitle: "Usage",
    rules: [
      "32 free conversions per visitor. Star on GitHub for unlimited.",
      "Conversion runs entirely in your browser.",
      "Forks can disable limits via QUOTA_DISABLED in wrangler.toml.",
    ],
    errConvert: "Conversion failed",
    errType: "Unsupported file type",
  },
  zh: {
    title: "PDF 转换",
    sub: "Word / TXT / MD → PDF（本地转换）",
    pick: "选择文件",
    hint: ".docx .txt .md",
    convert: "生成 PDF",
    quota: (r, a) => `剩余次数：${r}/${a}`,
    quotaUnlimited: (who) => (who ? `无限次 · ${who}` : "无限次 · 已 Star"),
    starTitle: "解锁无限次转换",
    starDesc: "在 GitHub Star 本仓库，并用 GitHub 登录验证。",
    starBtn: "Star 并用 GitHub 登录",
    noFile: "请先选择文件",
    converting: "转换中…",
    errQuota: "免费次数已用完",
    rulesTitle: "说明",
    rules: ["每位访客 32 次免费转换。GitHub Star 后无限次。", "文件仅在浏览器本地转换。", "Fork 可在 wrangler.toml 关闭限次。"],
    errConvert: "转换失败",
    errType: "不支持的文件格式",
  },
  ja: {
    title: "PDF変換",
    sub: "Word / TXT / MD → PDF（ローカル）",
    pick: "ファイルを選択",
    hint: ".docx .txt .md",
    convert: "PDFを生成",
    quota: (r, a) => `残り：${r}/${a}`,
    quotaUnlimited: (who) => (who ? `無制限 · ${who}` : "無制限 · Star済"),
    starTitle: "無制限を解除",
    starDesc: "GitHubでStarし、ログインで認証。",
    starBtn: "StarしてGitHubログイン",
    noFile: "ファイルを選んでください",
    converting: "変換中…",
    errQuota: "無料回数を使い切りました",
    rulesTitle: "利用",
    rules: ["32回まで無料。Starで無制限。", "ブラウザ内で変換。", "ForkはQUOTA_DISABLEDで解除可。"],
    errConvert: "変換に失敗しました",
    errType: "未対応の形式です",
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;
let quota = null;
let selectedFile = null;

const convertBtn = document.getElementById("convertBtn");
const errBox = document.getElementById("errBox");
const starPanel = document.getElementById("starPanel");
const quotaBox = document.getElementById("quotaBox");

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("pickLabel").textContent = t.pick;
  document.getElementById("pickHint").textContent = t.hint;
  convertBtn.textContent = t.convert;
  document.getElementById("rulesTitle").textContent = t.rulesTitle;
  document.getElementById("rulesList").innerHTML = t.rules.map((r) => `<li>${r}</li>`).join("");
  document.getElementById("starTitle").textContent = t.starTitle;
  document.getElementById("starDesc").textContent = t.starDesc;
  document.getElementById("starBtn").textContent = t.starBtn;
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
quota = readQuotaCache() || guessQuota();
updateQuotaUI();
loadQuota();

async function loadQuota() {
  quotaBox.classList.add("is-fetching");
  try {
    const res = await fetch("/api?action=quota");
    quota = await res.json();
    writeQuotaCache(quota);
    updateQuotaUI();
  } catch {
    quotaBox.classList.remove("is-fetching");
  }
}

function updateQuotaUI() {
  if (!quota) return;
  quotaBox.classList.remove("is-fetching");
  quotaBox.textContent = formatQuotaLine(t, quota);
  starPanel.hidden = !quota.needStar;
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
    const useRes = await fetch("/api?action=pdf_use", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const useData = await useRes.json();
    if (!useRes.ok) {
      quota = useData;
      updateQuotaUI();
      errBox.dataset.errCode = useData.error || "star_required";
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
