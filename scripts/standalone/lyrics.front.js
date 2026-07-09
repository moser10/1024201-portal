import { getPortalLang, mountLangTabs } from "./js/langTabs.js";
import { estimateEtaMs, mountProgress } from "./loading.js";
import { apiErrorText, formatQuotaLine } from "./js/toolI18n.js";
import { guessQuota, readQuotaCache, writeQuotaCache } from "./js/quotaUi.js";

const UI = {
  en: {
    title: "Find Lyrics",
    sub: "LRCLIB + Deezer · search by song or artist",
    lblTitle: "Song title",
    lblArtist: "Artist",
    hint: "32 free searches. Star the repo on GitHub for unlimited use.",
    search: "Search",
    searching: "Searching…",
    quota: (r, a) => `Uses left: ${r}/${a}`,
    quotaUnlimited: (who) => (who ? `Unlimited · ${who}` : "Unlimited · starred"),
    starTitle: "Unlock unlimited searches",
    starDesc: "Star this project on GitHub, then sign in with GitHub.",
    starBtn: "Star & sign in with GitHub",
    thTitle: "Title",
    thArtist: "Artist",
    thAlbum: "Album",
    thYear: "Year",
    single: "Single",
    empty: "No results",
    err: "Search failed",
    needQuery: "Enter a song title or artist",
  },
  zh: {
    title: "找歌词",
    sub: "LRCLIB + Deezer · 按歌名或歌手搜索",
    lblTitle: "歌曲名称",
    lblArtist: "歌手",
    hint: "免费 32 次搜索。在 GitHub Star 本仓库可无限使用。",
    search: "搜索",
    searching: "正在搜索…",
    quota: (r, a) => `剩余次数：${r}/${a}`,
    quotaUnlimited: (who) => (who ? `无限次 · ${who}` : "无限次 · 已 Star"),
    starTitle: "解锁无限次搜索",
    starDesc: "在 GitHub 上 Star 本仓库，并用 GitHub 登录验证。",
    starBtn: "Star 并用 GitHub 登录",
    thTitle: "歌名",
    thArtist: "歌手",
    thAlbum: "专辑",
    thYear: "年代",
    single: "单曲",
    empty: "无结果",
    err: "搜索失败",
    needQuery: "请填写歌曲名称或歌手",
  },
  ja: {
    title: "歌詞検索",
    sub: "LRCLIB + Deezer · 曲名またはアーティスト",
    lblTitle: "曲名",
    lblArtist: "アーティスト",
    hint: "無料32回。GitHubでStarすると無制限。",
    search: "検索",
    searching: "検索中…",
    quota: (r, a) => `残り：${r}/${a}`,
    quotaUnlimited: (who) => (who ? `無制限 · ${who}` : "無制限 · Star済"),
    starTitle: "無制限を解除",
    starDesc: "GitHubでStarし、GitHubログインで認証。",
    starBtn: "StarしてGitHubログイン",
    thTitle: "曲名",
    thArtist: "アーティスト",
    thAlbum: "アルバム",
    thYear: "年代",
    single: "シングル",
    empty: "結果なし",
    err: "検索に失敗しました",
    needQuery: "曲名またはアーティストを入力してください",
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;
let quota = null;

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("lblTitle").textContent = t.lblTitle;
  document.getElementById("lblArtist").textContent = t.lblArtist;
  document.getElementById("searchHint").textContent = t.hint;
  const btn = document.getElementById("searchBtn");
  if (!btn.disabled) btn.textContent = t.search;
  document.getElementById("thTitle").textContent = t.thTitle;
  document.getElementById("thArtist").textContent = t.thArtist;
  document.getElementById("thAlbum").textContent = t.thAlbum;
  document.getElementById("thYear").textContent = t.thYear;
  document.getElementById("starTitle").textContent = t.starTitle;
  document.getElementById("starDesc").textContent = t.starDesc;
  document.getElementById("starBtn").textContent = t.starBtn;
  updateQuotaUI();
  const errBox = document.getElementById("errBox");
  if (errBox && !errBox.hidden && errBox.dataset.errCode) {
    errBox.textContent = apiErrorText({ error: errBox.dataset.errCode }, lang) || t.err;
  }
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

const params = new URLSearchParams(location.search);
if (params.get("star") === "ok") loadQuota();
if (params.get("star") === "need") {
  document.getElementById("starPanel").hidden = false;
}

function albumLabel(row) {
  const a = (row.album || "").trim();
  return a || t.single;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

document.getElementById("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("errBox");
  const wrap = document.getElementById("resultsWrap");
  const body = document.getElementById("resultsBody");
  const searchBtn = document.getElementById("searchBtn");
  const loadingHost = document.getElementById("searchLoading");
  errBox.hidden = true;
  errBox.dataset.errCode = "";
  wrap.hidden = true;

  const title = document.getElementById("qTitle").value.trim();
  const artist = document.getElementById("qArtist").value.trim();
  if (!title && !artist) {
    errBox.textContent = t.needQuery;
    errBox.hidden = false;
    return;
  }

  const q = new URLSearchParams({ action: "lyrics_search" });
  if (title) q.set("title", title);
  if (artist) q.set("artist", artist);

  searchBtn.disabled = true;
  searchBtn.textContent = t.searching;
  const progress = mountProgress(loadingHost, { label: t.searching, etaMs: estimateEtaMs(6) });

  try {
    const res = await fetch(`/api?${q}`);
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(apiErrorText(data, lang) || t.err);
      err.data = data;
      throw err;
    }
    const rows = data.results || [];
    const cache = {};
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4">${t.empty}</td></tr>`;
    } else {
      body.innerHTML = rows
        .map((r) => {
          cache[r.id] = r;
          return `<tr data-id="${esc(r.id)}">
          <td>${esc(r.title)}</td><td>${esc(r.artist)}</td>
          <td>${esc(albumLabel(r))}</td><td>${esc(r.year || "—")}</td></tr>`;
        })
        .join("");
      try {
        sessionStorage.setItem("lyrics_result_cache", JSON.stringify(cache));
      } catch {
        /* ignore */
      }
    }
    progress.done();
    quota = data;
    updateQuotaUI();
    wrap.hidden = false;
  } catch (err) {
    progress.fail();
    if (err.data) {
      quota = err.data;
      updateQuotaUI();
      errBox.dataset.errCode = err.data.error || "";
    }
    errBox.textContent = err.message || t.err;
    errBox.hidden = false;
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = t.search;
  }
});

document.getElementById("resultsBody").addEventListener("click", (e) => {
  const row = e.target.closest("tr[data-id]");
  if (!row?.dataset.id) return;
  window.location.href = `view.html?id=${encodeURIComponent(row.dataset.id)}`;
});
