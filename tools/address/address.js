import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { deferWork } from "../js/toolPageBoot.js";

const CACHE_KEY = "addr_countries_v2";

const UI = {
  en: {
    title: "Address Lookup",
    sub: "Rental & sale addresses · postal codes · local phone prefixes",
    back: "Toolbox",
    lblCountry: "Country / region",
    lblCity: "City",
    lblKind: "Listing type",
    lblQuery: "Keyword",
    kindAll: "All",
    kindRent: "Rent",
    kindSale: "Sale",
    kindRentShort: "R",
    kindSaleShort: "S",
    kindNewShort: "N",
    search: "Search",
    hint: "13 countries · major cities · refreshed daily at 22:00 Beijing time. Curated seed data; optional Google Geocoding when API key is set.",
    meta: (n, at) => (at ? `${n} listings · last refresh ${at}` : `${n} listings`),
    count: (n) => `${n} result(s)`,
    thKind: "Type",
    thTitle: "Title",
    thAddress: "Full address",
    thPostal: "Postal",
    thPhone: "Phone sample",
    empty: "No listings match your filters",
    err: "Search failed",
    phoneMeta: (cc, area, prefixes) => {
      const p = (prefixes || []).slice(0, 3).join(", ");
      return `CC ${cc}${area ? ` · area ${area}` : ""}${p ? ` · mobile ${p}…` : ""}`;
    },
  },
  zh: {
    title: "地址查找",
    sub: "多国租售房源 · 详细地址 · 邮编 · 当地电话区号",
    back: "返回工具箱",
    lblCountry: "国家 / 地区",
    lblCity: "城市",
    lblKind: "租售类型",
    lblQuery: "关键词",
    kindAll: "全部",
    kindRent: "租",
    kindSale: "售",
    kindRentShort: "租",
    kindSaleShort: "售",
    kindNewShort: "新",
    search: "搜索",
    hint: "覆盖 13 国主要城市；每日北京时间 22:00 自动更新。当前为合规种子库，可扩展对接 Google 等授权 API。",
    meta: (n, at) => (at ? `共 ${n} 条 · 上次刷新 ${at}` : `共 ${n} 条`),
    count: (n) => `找到 ${n} 条`,
    thKind: "类型",
    thTitle: "标题",
    thAddress: "详细地址",
    thPostal: "邮编",
    thPhone: "电话示例",
    empty: "没有匹配的房源",
    err: "搜索失败",
    phoneMeta: (cc, area, prefixes) => {
      const p = (prefixes || []).slice(0, 3).join("、");
      return `区号 ${cc}${area ? ` · 本市 ${area}` : ""}${p ? ` · 手机常用 ${p}…` : ""}`;
    },
  },
  ja: {
    title: "住所検索",
    sub: "賃貸・売買 · 住所 · 郵便番号 · 電話番号",
    back: "ツールボックス",
    lblCountry: "国・地域",
    lblCity: "都市",
    lblKind: "種別",
    lblQuery: "キーワード",
    kindAll: "すべて",
    kindRent: "賃",
    kindSale: "売",
    kindRentShort: "賃",
    kindSaleShort: "売",
    kindNewShort: "新",
    search: "検索",
    hint: "13か国の主要都市。毎日 22:00（北京）更新。シードデータ＋任意で Google Geocoding。",
    meta: (n, at) => (at ? `${n} 件 · 最終更新 ${at}` : `${n} 件`),
    count: (n) => `${n} 件`,
    thKind: "種別",
    thTitle: "タイトル",
    thAddress: "住所",
    thPostal: "郵便",
    thPhone: "電話例",
    empty: "該当なし",
    err: "検索に失敗",
    phoneMeta: (cc, area, prefixes) => {
      const p = (prefixes || []).slice(0, 3).join(", ");
      return `国番号 ${cc}${area ? ` · 市内 ${area}` : ""}${p ? ` · 携帯 ${p}…` : ""}`;
    },
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;

const countrySel = document.getElementById("countrySel");
const citySel = document.getElementById("citySel");
const kindSel = document.getElementById("kindSel");
const queryIn = document.getElementById("queryIn");
const errBox = document.getElementById("errBox");
const resultsWrap = document.getElementById("resultsWrap");
const resultsBody = document.getElementById("resultsBody");
const emptyLine = document.getElementById("emptyLine");
const countLine = document.getElementById("countLine");
const metaLine = document.getElementById("metaLine");

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("backLink").textContent = t.back;
  document.getElementById("lblCountry").textContent = t.lblCountry;
  document.getElementById("lblCity").textContent = t.lblCity;
  document.getElementById("lblKind").textContent = t.lblKind;
  document.getElementById("lblQuery").textContent = t.lblQuery;
  document.getElementById("searchBtn").textContent = t.search;
  document.getElementById("searchHint").textContent = t.hint;
  document.getElementById("thKind").textContent = t.thKind;
  document.getElementById("thTitle").textContent = t.thTitle;
  document.getElementById("thAddress").textContent = t.thAddress;
  document.getElementById("thPostal").textContent = t.thPostal;
  document.getElementById("thPhone").textContent = t.thPhone;
  kindSel.options[0].textContent = t.kindAll;
  kindSel.options[1].textContent = t.kindRent;
  kindSel.options[2].textContent = t.kindSale;
}

function showError(msg) {
  errBox.textContent = msg;
  errBox.hidden = !msg;
}

function countryLabel(c) {
  if (lang === "zh") return `${c.name_zh} (${c.code})`;
  return `${c.name_en} (${c.code})`;
}

function formatRefreshTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (lang === "zh") {
    return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  }
  if (lang === "ja") {
    return d.toLocaleString("ja-JP", { timeZone: "Asia/Shanghai", hour12: false });
  }
  return d.toLocaleString("en-GB", { timeZone: "Asia/Shanghai", hour12: false });
}

function paintCountries(countries) {
  const prev = countrySel.value;
  countrySel.innerHTML = `<option value="">—</option>`;
  for (const c of countries || []) {
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = countryLabel(c);
    opt.dataset.phoneCc = c.phone_cc;
    countrySel.appendChild(opt);
  }
  if (prev) countrySel.value = prev;
}

function readCountryCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.countries?.length) return null;
    return data.countries;
  } catch {
    return null;
  }
}

function writeCountryCache(countries) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ countries, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

async function loadMeta() {
  try {
    const res = await fetch("/api/portal?action=address_meta");
    const data = await res.json();
    if (!res.ok) return;
    const n = data.listing_count || "0";
    metaLine.textContent = t.meta(n, formatRefreshTime(data.last_refresh));
  } catch {
    /* ignore */
  }
}

async function loadCountries() {
  const cached = readCountryCache();
  if (cached) paintCountries(cached);

  const res = await fetch("/api/portal?action=address_countries");
  const data = await res.json();
  if (!res.ok) throw new Error(t.err);
  paintCountries(data.countries);
  writeCountryCache(data.countries);
}

async function loadCities(country) {
  citySel.innerHTML = `<option value="">—</option>`;
  if (!country) return;
  const res = await fetch(`/api/portal?action=address_cities&country=${encodeURIComponent(country)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(t.err);
  for (const c of data.cities || []) {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = lang === "zh" && c.name_local ? `${c.name_en} · ${c.name_local}` : c.name_en;
    citySel.appendChild(opt);
  }
}

function kindIcons(r) {
  const rent = r.kind === "rent";
  const sale = r.kind === "sale";
  const parts = [
    `<span class="addr-tag ${rent ? "rent on" : "rent off"}" title="${t.kindRent}">${t.kindRentShort}</span>`,
    `<span class="addr-tag ${sale ? "sale on" : "sale off"}" title="${t.kindSale}">${t.kindSaleShort}</span>`,
  ];
  if (r.is_new) {
    parts.push(`<span class="addr-tag new on" title="${t.kindNewShort}">${t.kindNewShort}</span>`);
  }
  return `<span class="addr-tags">${parts.join("")}</span>`;
}

function renderResults(data) {
  const rows = data.results || [];
  resultsBody.innerHTML = "";
  if (!rows.length) {
    resultsWrap.hidden = true;
    emptyLine.hidden = false;
    emptyLine.textContent = t.empty;
    countLine.hidden = true;
    return;
  }
  emptyLine.hidden = true;
  resultsWrap.hidden = false;
  countLine.hidden = false;
  countLine.textContent = t.count(data.total ?? rows.length);

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${kindIcons(r)}</td>
      <td>${escapeHtml(r.title)}<span class="addr-line-sub">${escapeHtml(r.city_name || "")}${r.district ? ` · ${escapeHtml(r.district)}` : ""}</span></td>
      <td>${escapeHtml(r.full_address)}</td>
      <td>${escapeHtml(r.postal_code)}<span class="addr-line-sub">${escapeHtml(r.postal_hint || "")}</span></td>
      <td>${escapeHtml(r.phone_sample || "—")}<span class="addr-phone-meta">${escapeHtml(t.phoneMeta(r.phone_cc, r.phone_area, r.phone_mobile_prefixes))}</span></td>`;
    resultsBody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function runSearch(e) {
  e?.preventDefault();
  showError("");
  const params = new URLSearchParams();
  if (countrySel.value) params.set("country", countrySel.value);
  if (citySel.value) params.set("city_id", citySel.value);
  if (kindSel.value) params.set("kind", kindSel.value);
  if (queryIn.value.trim()) params.set("q", queryIn.value.trim());
  try {
    const res = await fetch(`/api/portal?action=address_search&${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.err);
    renderResults(data);
  } catch (err) {
    showError(err.message || t.err);
  }
}

countrySel.addEventListener("change", () => {
  loadCities(countrySel.value).catch(() => {});
});

document.getElementById("searchForm").addEventListener("submit", runSearch);

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    loadCountries().catch(() => {});
  },
});

function boot() {
  applyI18n();
  const cached = readCountryCache();
  if (cached) paintCountries(cached);

  deferWork(async () => {
    await Promise.all([loadMeta(), loadCountries()]);
  });
}

boot();
