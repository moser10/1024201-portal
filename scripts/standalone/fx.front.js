import { getPortalLang, mountLangTabs } from "./js/langTabs.js";
import { apiErrorText, formatQuotaLine } from "./js/toolI18n.js";
import { guessQuota, readQuotaCache, writeQuotaCache } from "./js/quotaUi.js";

const CURRENCIES = [
  { code: "USD", names: { en: "United States", zh: "美国", ja: "米国" } },
  { code: "CNY", names: { en: "China", zh: "中国", ja: "中国" } },
  { code: "GBP", names: { en: "United Kingdom", zh: "英国", ja: "英国" } },
  { code: "EUR", names: { en: "Eurozone", zh: "欧元区", ja: "ユーロ圏" } },
  { code: "JPY", names: { en: "Japan", zh: "日本", ja: "日本" } },
  { code: "THB", names: { en: "Thailand", zh: "泰国", ja: "タイ" } },
  { code: "SEK", names: { en: "Sweden", zh: "瑞典", ja: "スウェーデン" } },
  { code: "INR", names: { en: "India", zh: "印度", ja: "インド" } },
  { code: "HKD", names: { en: "Hong Kong", zh: "香港", ja: "香港" } },
  { code: "AUD", names: { en: "Australia", zh: "澳大利亚", ja: "オーストラリア" } },
  { code: "MXN", names: { en: "Mexico", zh: "墨西哥", ja: "メキシコ" } },
  { code: "BRL", names: { en: "Brazil", zh: "巴西", ja: "ブラジル" } },
];

const UI = {
  en: {
    title: "Exchange Rates",
    sub: "ECB reference · refreshes every 6 hours",
    base: "Base",
    err: "Failed to load rates",
    updated: "Updated",
    quota: (r, a) => `Refreshes left: ${r}/${a}`,
    quotaUnlimited: (who) => (who ? `Unlimited · ${who}` : "Unlimited · starred"),
    starTitle: "Unlock unlimited refreshes",
    starDesc: "Star this repo on GitHub, then sign in with GitHub.",
    starBtn: "Star & sign in with GitHub",
  },
  zh: {
    title: "实时汇率",
    sub: "欧洲央行参考汇率 · 每 6 小时更新",
    base: "基准货币",
    err: "汇率加载失败",
    updated: "更新于",
    quota: (r, a) => `剩余刷新：${r}/${a}`,
    quotaUnlimited: (who) => (who ? `无限次 · ${who}` : "无限次 · 已 Star"),
    starTitle: "解锁无限次刷新",
    starDesc: "在 GitHub Star 本仓库，并用 GitHub 登录验证。",
    starBtn: "Star 并用 GitHub 登录",
  },
  ja: {
    title: "為替レート",
    sub: "ECB参考 · 6時間ごとに更新",
    base: "基準通貨",
    err: "読み込みに失敗しました",
    updated: "更新",
    quota: (r, a) => `残り：${r}/${a}`,
    quotaUnlimited: (who) => (who ? `無制限 · ${who}` : "無制限 · Star済"),
    starTitle: "無制限を解除",
    starDesc: "GitHubでStarし、ログインで認証。",
    starBtn: "StarしてGitHubログイン",
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;
let quota = null;

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    loadRates();
  },
});

const baseSelect = document.getElementById("baseSelect");
for (const c of CURRENCIES) {
  const opt = document.createElement("option");
  opt.value = c.code;
  opt.textContent = c.code;
  baseSelect.appendChild(opt);
}

function applyI18n() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en";
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("baseLabel").textContent = t.base;
  document.getElementById("starTitle").textContent = t.starTitle;
  document.getElementById("starDesc").textContent = t.starDesc;
  document.getElementById("starBtn").textContent = t.starBtn;
  if (!baseSelect.dataset.touched) baseSelect.value = "USD";
  updateQuotaUI();
}

function nameFor(code) {
  const row = CURRENCIES.find((c) => c.code === code);
  return row?.names[lang] || row?.names.en || code;
}

function formatUpdated(data) {
  const locale = lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en-US";
  const when = data.cachedAt
    ? new Date(data.cachedAt).toLocaleString(locale, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })
    : data.date;
  return `${t.updated} ${when} · 1 ${data.base}`;
}

async function loadQuota() {
  const box = document.getElementById("quotaBox");
  if (box) box.classList.add("is-fetching");
  try {
    const res = await fetch("/api?action=quota");
    quota = await res.json();
    writeQuotaCache(quota);
    updateQuotaUI();
  } catch {
    if (box) box.classList.remove("is-fetching");
  }
}

function updateQuotaUI() {
  const box = document.getElementById("quotaBox");
  const panel = document.getElementById("starPanel");
  if (!quota || !box) return;
  box.classList.remove("is-fetching");
  box.textContent = formatQuotaLine(t, quota);
  if (panel) panel.hidden = !quota.needStar;
}

async function loadRates() {
  const errBox = document.getElementById("errBox");
  const list = document.getElementById("rateList");
  errBox.hidden = true;
  list.innerHTML = `<li class="rate-row"><span class="rate-name">…</span></li>`;
  try {
    const base = baseSelect.value;
    const res = await fetch(`/api?action=rates&base=${encodeURIComponent(base)}`);
    const data = await res.json();
    if (!res.ok) {
      quota = data;
      updateQuotaUI();
      throw new Error(apiErrorText(data, lang) || data.error || t.err);
    }
    if (data.remaining != null || data.unlimited != null) {
      quota = data;
      updateQuotaUI();
    }
    document.getElementById("updatedAt").textContent = formatUpdated(data);
    const rates = { [base]: 1, ...data.rates };
    const codes = CURRENCIES.map((c) => c.code).filter((c) => rates[c] != null);
    list.innerHTML = codes
      .map((code) => {
        const val = rates[code];
        const display = code === base ? "1.0000" : Number(val).toFixed(code === "JPY" ? 2 : 4);
        return `<li class="rate-row">
          <span class="rate-code">${code}</span>
          <span class="rate-name">${nameFor(code)}</span>
          <span class="rate-val">${display}</span>
        </li>`;
      })
      .join("");
  } catch (e) {
    list.innerHTML = "";
    errBox.hidden = false;
    errBox.textContent = e.message || t.err;
  }
}

baseSelect.onchange = () => {
  baseSelect.dataset.touched = "1";
  loadRates();
};

applyI18n();
quota = readQuotaCache() || guessQuota();
updateQuotaUI();
loadQuota();
loadRates();
