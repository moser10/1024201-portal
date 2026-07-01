import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { deferWork } from "/tools/js/toolPageBoot.js";

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
    back: "Portal",
    err: "Failed to load rates",
    updated: "Updated",
  },
  zh: {
    title: "实时汇率",
    sub: "欧洲央行参考汇率 · 每 6 小时更新",
    base: "基准货币",
    back: "返回门户",
    err: "汇率加载失败",
    updated: "更新于",
  },
  ja: {
    title: "為替レート",
    sub: "ECB参考 · 6時間ごとに更新",
    base: "基準通貨",
    back: "ポータル",
    err: "読み込みに失敗しました",
    updated: "更新",
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;

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
  document.getElementById("backLink").textContent = t.back;
  if (!baseSelect.dataset.touched) {
    baseSelect.value = "USD";
  }
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

async function loadRates() {
  const errBox = document.getElementById("errBox");
  const list = document.getElementById("rateList");
  errBox.hidden = true;
  list.innerHTML = `<li class="rate-row"><span class="rate-name">…</span></li>`;
  try {
    const base = baseSelect.value;
    const res = await fetch(`/api/portal?action=rates&base=${encodeURIComponent(base)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.err);
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
deferWork(loadRates);
