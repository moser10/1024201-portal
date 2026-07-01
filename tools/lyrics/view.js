import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { estimateEtaMs, mountProgress } from "./loading.js";

const UI = {
  en: {
    back: "Search",
    err: "Failed to load lyrics",
    loading: "Loading lyrics…",
    translating: "Translating…",
    translateFail: "Translation unavailable — showing original lyrics",
    noLyrics: "No lyrics available",
  },
  zh: {
    back: "返回搜索",
    err: "歌词加载失败",
    loading: "正在加载歌词…",
    translating: "正在翻译…",
    translateFail: "翻译暂不可用，已显示原文歌词",
    noLyrics: "暂无歌词",
  },
  ja: {
    back: "検索",
    err: "歌詞の読み込みに失敗",
    loading: "歌詞を読み込み中…",
    translating: "翻訳中…",
    translateFail: "翻訳できません。原文を表示しています",
    noLyrics: "歌詞がありません",
  },
};

const CACHE_KEY = "lyrics_result_cache";

let lang = getPortalLang();
let t = UI[lang] || UI.en;
let originalLyrics = "";
let songTitle = "";
let userPickedTranslate = false;

const titleEl = document.getElementById("songTitle");
const bodyEl = document.getElementById("lyricsBody");
const errBox = document.getElementById("errBox");
const noteEl = document.getElementById("noteBox");
const loadingHost = document.getElementById("viewLoading");
const contentEl = document.getElementById("viewContent");

function applyI18n() {
  document.getElementById("backLink").textContent = t.back;
}

function readCache(id) {
  try {
    const store = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
    return store[id] || null;
  } catch {
    return null;
  }
}

function showOriginal() {
  bodyEl.textContent = originalLyrics || t.noLyrics;
}

function isBadTranslation(text) {
  return /MYMEMORY\s+WARNING|USAGE\s*LIMIT|NEXT\s+AVAILABLE\s+IN/i.test(text);
}

async function translateText(text, target) {
  const res = await fetch("/api/portal?action=translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "translate failed");
  if (isBadTranslation(data.text)) throw new Error("bad translation");
  return data.text || text;
}

function normalizeLyrics(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n+$/, "")
    .trim();
}

function applyLyricsData(data) {
  songTitle = data.title || "";
  originalLyrics = normalizeLyrics(data.lyrics);
  titleEl.textContent = songTitle;
  document.title = songTitle ? `${songTitle} | 1024201` : "Lyrics | 1024201";
  contentEl.hidden = false;
  showOriginal();
}

async function renderLyrics({ withProgress = false } = {}) {
  if (!originalLyrics) return;
  noteEl.hidden = true;

  if (!userPickedTranslate) {
    showOriginal();
    return;
  }

  let progress;
  if (withProgress) {
    bodyEl.textContent = "";
    progress = mountProgress(loadingHost, {
      label: t.translating,
      etaMs: estimateEtaMs(6),
    });
  } else {
    bodyEl.textContent = t.translating;
  }

  try {
    const translated = await translateText(originalLyrics, lang);
    bodyEl.textContent = translated;
  } catch {
    showOriginal();
    noteEl.textContent = t.translateFail;
    noteEl.hidden = false;
  } finally {
    progress?.done();
  }
}

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: async (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    userPickedTranslate = true;
    await renderLyrics({ withProgress: true });
  },
});

applyI18n();

async function fetchLyricsFromApi(id, title, artist) {
  const q = new URLSearchParams({ action: "lyrics_get" });
  if (id) q.set("id", id);
  else if (title) {
    q.set("title", title);
    if (artist) q.set("artist", artist);
  } else {
    throw new Error(t.err);
  }
  const res = await fetch(`/api/portal?${q}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || t.err);
  return data;
}

async function loadLyrics() {
  contentEl.hidden = true;
  titleEl.textContent = "";
  bodyEl.textContent = "";
  errBox.hidden = true;
  noteEl.hidden = true;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const title = params.get("title");
  const artist = params.get("artist");

  if (!id && !title) {
    errBox.textContent = t.err;
    errBox.hidden = false;
    return;
  }

  const cached = id ? readCache(id) : null;
  if (cached?.lyrics?.trim()) {
    applyLyricsData(cached);
    fetchLyricsFromApi(id, title, artist)
      .then((fresh) => {
        if (fresh.lyrics?.trim()) applyLyricsData(fresh);
      })
      .catch(() => {});
    return;
  }

  const progress = mountProgress(loadingHost, {
    label: t.loading,
    etaMs: estimateEtaMs(3),
  });

  try {
    const data = await fetchLyricsFromApi(id, title, artist);
    progress.done();
    applyLyricsData(data);
    if (id && data.lyrics?.trim()) {
      try {
        const store = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
        store[id] = { ...store[id], ...data };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(store));
      } catch {
        /* quota */
      }
    }
  } catch (e) {
    progress.fail();
    contentEl.hidden = false;
    errBox.textContent = e.message || t.err;
    errBox.hidden = false;
  }
}

document.getElementById("printBtn").addEventListener("click", () => window.print());

loadLyrics();
