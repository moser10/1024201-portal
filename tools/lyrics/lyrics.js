import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { loginHref, quotaQuery, currentUserId, quotaBody } from "../js/quotaClient.js";
import { apiErrorText, formatQuotaLine } from "../js/toolI18n.js";
import { guessQuota, readQuotaCache, writeQuotaCache } from "../js/quotaUi.js";
import { paintToolUser, deferWork } from "../js/toolPageBoot.js";

const UI = {
  en: {
    title: "Find Lyrics",
    sub: "LRCLIB + Deezer · search by song or artist",
    back: "Toolbox",
    lblTitle: "Song title",
    lblArtist: "Artist",
    hint: "Enter a song title, an artist, or both. Guests: 1/day; registered: 5/day.",
    search: "Search",
    searching: "Searching…",
    quota: (r, a, logged) =>
      logged ? `Searches: ${r}/${a}` : `Searches: ${r}/${a} (guest)`,
    loginTitle: "Sign in for more",
    loginDesc: "Guest limit reached. Sign in for 5 searches per day.",
    loginBtn: "Sign in / Register",
    unlockTitle: "Need more searches?",
    unlockDesc: (n) => `Watch ${n} simulated ad(s) for +1, or pay via Wise (soon).`,
    adBtn: (n) => `Watch ad (${n} needed)`,
    adProgress: (p, n) => `Ad progress: ${p}/${n}`,
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
    back: "返回工具箱",
    lblTitle: "歌曲名称",
    lblArtist: "歌手",
    hint: "可只填歌名、只填歌手，或两者都填。游客每天 1 次；注册用户每天 5 次。",
    search: "搜索",
    searching: "正在搜索…",
    quota: (r, a, logged) =>
      logged ? `今日搜索剩余 ${r}/${a}` : `今日搜索剩余 ${r}/${a}（游客）`,
    loginTitle: "登录后继续使用",
    loginDesc: "游客今日次数已用完。登录后每天可搜索 5 次。",
    loginBtn: "登录 / 注册",
    unlockTitle: "需要更多次数？",
    unlockDesc: (n) => `观看 ${n} 次模拟广告 +1 次，或 Wise 付费（即将上线）。`,
    adBtn: (n) => `观看广告（还需 ${n} 次）`,
    adProgress: (p, n) => `广告进度：${p}/${n}`,
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
    back: "ツールボックス",
    lblTitle: "曲名",
    lblArtist: "アーティスト",
    hint: "曲名のみ、アーティストのみ、または両方。ゲスト1日1回、登録5回。",
    search: "検索",
    searching: "検索中…",
    quota: (r, a, logged) =>
      logged ? `本日残り ${r}/${a}` : `本日残り ${r}/${a}（ゲスト）`,
    loginTitle: "ログインして続行",
    loginDesc: "ゲスト上限です。ログインで1日5回。",
    loginBtn: "ログイン / 登録",
    unlockTitle: "回数を追加",
    unlockDesc: (n) => `模擬広告 ${n} 回で +1。`,
    adBtn: (n) => `広告（あと ${n} 回）`,
    adProgress: (p, n) => `進捗：${p}/${n}`,
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

function applyI18n() {
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("backLink").textContent = t.back;
  document.getElementById("lblTitle").textContent = t.lblTitle;
  document.getElementById("lblArtist").textContent = t.lblArtist;
  document.getElementById("searchHint").textContent = t.hint;
  const btn = document.getElementById("searchBtn");
  if (!btn.disabled) btn.textContent = t.search;
  document.getElementById("thTitle").textContent = t.thTitle;
  document.getElementById("thArtist").textContent = t.thArtist;
  document.getElementById("thAlbum").textContent = t.thAlbum;
  document.getElementById("thYear").textContent = t.thYear;
  document.getElementById("loginTitle").textContent = t.loginTitle;
  document.getElementById("loginDesc").textContent = t.loginDesc;
  document.getElementById("loginBtn").textContent = t.loginBtn;
  document.getElementById("loginBtn").href = loginHref("/tools/lyrics/");
  const unlock = document.getElementById("unlockPanel");
  if (unlock) {
    document.getElementById("unlockTitle").textContent = t.unlockTitle;
  }
  updateQuotaUI();
  paintToolUser();
  const errBox = document.getElementById("errBox");
  if (errBox && !errBox.hidden && errBox.dataset.errCode) {
    errBox.textContent = apiErrorText({ error: errBox.dataset.errCode }, lang) || t.err;
  }
}

let quota = null;

async function loadQuota() {
  const box = document.getElementById("quotaBox");
  if (box) box.classList.add("is-fetching");
  try {
    const res = await fetch(`/api/portal?action=lyrics_quota${quotaQuery()}`);
    quota = await res.json();
    writeQuotaCache("lyrics", quota);
    updateQuotaUI();
  } catch {
    if (box) box.classList.remove("is-fetching");
  }
}

function updateQuotaUI() {
  const box = document.getElementById("quotaBox");
  const panel = document.getElementById("loginPanel");
  const unlock = document.getElementById("unlockPanel");
  if (!quota || !box) return;
  box.classList.remove("is-fetching");
  box.textContent = formatQuotaLine(t, quota);
  if (panel) panel.hidden = !quota.needLogin;
  if (unlock) {
    unlock.hidden = !quota.needUnlock;
    if (quota.needUnlock) {
      document.getElementById("unlockDesc").textContent = t.unlockDesc(quota.adsNeeded);
      document.getElementById("adBtn").textContent = t.adBtn(quota.adsRemaining || quota.adsNeeded);
      document.getElementById("adProgress").textContent = t.adProgress(quota.adProgress, quota.adsNeeded);
    }
  }
}

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    deferWork(loadQuota);
  },
});

applyI18n();
paintToolUser();
quota = readQuotaCache("lyrics") || guessQuota();
updateQuotaUI();
deferWork(loadQuota);

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
  const uid = currentUserId();
  if (uid) q.set("user_id", uid);

  searchBtn.disabled = true;
  searchBtn.textContent = t.searching;
  const { estimateEtaMs, mountProgress } = await import("./loading.js");
  const progress = mountProgress(loadingHost, {
    label: t.searching,
    etaMs: estimateEtaMs(6),
  });

  try {
    const res = await fetch(`/api/portal?${q}`);
    const data = await res.json();
    if (!res.ok) {
      const e = new Error(apiErrorText(data, lang) || t.err);
      e.data = data;
      throw e;
    }
    const rows = data.results || [];
    const cache = {};
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4">${t.empty}</td></tr>`;
    } else {
      body.innerHTML = rows
        .map((r) => {
          cache[r.id] = r;
          return `
        <tr data-id="${esc(r.id)}" data-title="${esc(r.title)}" data-artist="${esc(r.artist)}">
          <td>${esc(r.title)}</td>
          <td>${esc(r.artist)}</td>
          <td>${esc(albumLabel(r))}</td>
          <td>${esc(r.year || "—")}</td>
        </tr>`;
        })
        .join("");
      try {
        sessionStorage.setItem("lyrics_result_cache", JSON.stringify(cache));
      } catch {
        /* quota */
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
  const params = new URLSearchParams({ id: row.dataset.id });
  window.location.href = `view.html?${params}`;
});

document.getElementById("adBtn")?.addEventListener("click", async () => {
  const res = await fetch("/api/portal?action=tool_ad&tool=lyrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...quotaBody(), tool: "lyrics" }),
  });
  quota = await res.json();
  updateQuotaUI();
});
