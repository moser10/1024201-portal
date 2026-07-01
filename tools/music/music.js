import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { paintToolUser, deferWork } from "../js/toolPageBoot.js";

const UI = {
  en: {
    title: "Music",
    sub: "Deezer chart · 30s preview clips (full tracks via Deezer link)",
    back: "Toolbox",
    lyrics: "Lyrics",
    play: "Play",
    pause: "Pause",
    prev: "Prev",
    next: "Next",
    detail: "Info",
    noPreview: "No preview",
    lyricsLoading: "Loading lyrics…",
    lyricsEmpty: "No lyrics found",
    err: "Failed to load tracks",
    album: "Album",
    listen: "Listen full track on Deezer",
    close: "Close",
  },
  zh: {
    title: "音乐",
    sub: "Deezer 榜单 · 30 秒试听（完整版请跳转 Deezer）",
    back: "返回工具箱",
    lyrics: "歌词",
    play: "播放",
    pause: "暂停",
    prev: "上一曲",
    next: "下一曲",
    detail: "详情",
    noPreview: "无试听",
    lyricsLoading: "加载歌词…",
    lyricsEmpty: "暂无歌词",
    err: "音乐列表加载失败",
    album: "专辑",
    listen: "在 Deezer 收听完整版",
    close: "关闭",
  },
  ja: {
    title: "音楽",
    sub: "Deezerチャート · 30秒プレビュー（フルはDeezerへ）",
    back: "ツールボックス",
    lyrics: "歌詞",
    play: "再生",
    pause: "一時停止",
    prev: "前へ",
    next: "次へ",
    detail: "詳細",
    noPreview: "プレビューなし",
    lyricsLoading: "歌詞を読み込み中…",
    lyricsEmpty: "歌詞がありません",
    err: "読み込みに失敗しました",
    album: "アルバム",
    listen: "Deezerでフル再生",
    close: "閉じる",
  },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;

const musicCard = document.getElementById("musicCard");
const audio = document.getElementById("audio");
const trackList = document.getElementById("trackList");
const lyricsPanel = document.getElementById("lyricsPanel");
const lyricsBody = document.getElementById("lyricsBody");
const nowPlaying = document.getElementById("nowPlaying");
const progressBar = document.getElementById("progressBar");
const curTime = document.getElementById("curTime");
const durTime = document.getElementById("durTime");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let tracks = [];
let currentIndex = -1;
let isSeeking = false;
let lyricsOpen = false;
let lyricsIndex = -1;

function applyI18n() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en";
  document.getElementById("pageTitle").textContent = t.title;
  document.getElementById("pageSub").textContent = t.sub;
  document.getElementById("backLink").textContent = t.back;
  document.getElementById("lyricsTitle").textContent = t.lyrics;
  document.getElementById("modalClose").textContent = t.close;
  prevBtn.textContent = t.prev;
  nextBtn.textContent = t.next;
  updatePlayButtons();
  paintToolUser();
}

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
    renderTrackList();
  },
});

applyI18n();
paintToolUser();
deferWork(loadTracks);

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trackRowHtml(tr, i, { focus = false } = {}) {
  return `<li class="track-row${focus ? " is-focus" : ""}" data-index="${i}">
    <img class="track-cover" src="${tr.cover || ""}" alt="" loading="lazy">
    <div class="track-meta">
      <div class="track-title">${esc(tr.title)}</div>
      <div class="track-artist">${esc(tr.artist)}</div>
    </div>
    <div class="track-actions">
      <button type="button" class="btn-lyrics" data-index="${i}">${t.lyrics}</button>
      <button type="button" class="btn-detail" data-index="${i}">${t.detail}</button>
      <button type="button" class="btn-play" data-index="${i}" ${tr.preview ? "" : "disabled"}>${t.play}</button>
    </div>
  </li>`;
}

function renderTrackList() {
  if (!tracks.length) return;
  if (lyricsOpen && lyricsIndex >= 0) {
    const tr = tracks[lyricsIndex];
    trackList.innerHTML = tr ? trackRowHtml(tr, lyricsIndex, { focus: true }) : "";
    return;
  }
  trackList.innerHTML = tracks.map((tr, i) => trackRowHtml(tr, i)).join("");
  updatePlayButtons();
}

function closeLyrics() {
  if (!lyricsOpen) return;
  lyricsOpen = false;
  lyricsIndex = -1;
  musicCard.classList.remove("lyrics-open");
  lyricsBody.textContent = "";
  renderTrackList();
}

function updatePlayButtons() {
  trackList.querySelectorAll(".btn-play").forEach((btn) => {
    const idx = Number(btn.dataset.index);
    const playing = idx === currentIndex && !audio.paused;
    btn.classList.toggle("is-playing", playing);
    btn.disabled = playing;
    btn.textContent = playing ? t.pause : t.play;
  });
  playPauseBtn.textContent = audio.paused || currentIndex < 0 ? t.play : t.pause;
}

function setTrack(index, autoplay = true) {
  if (index < 0 || index >= tracks.length) return;
  closeLyrics();
  const tr = tracks[index];
  if (!tr.preview) {
    document.getElementById("errBox").hidden = false;
    document.getElementById("errBox").textContent = t.noPreview;
    return;
  }
  document.getElementById("errBox").hidden = true;
  currentIndex = index;
  audio.src = tr.preview;
  nowPlaying.textContent = `${tr.title} — ${tr.artist}`;
  prevBtn.disabled = index <= 0;
  nextBtn.disabled = index >= tracks.length - 1;
  updatePlayButtons();
  if (autoplay) audio.play().catch(() => {});
}

async function loadTracks() {
  const errBox = document.getElementById("errBox");
  closeLyrics();
  trackList.innerHTML = `<li class="track-row"><span class="track-artist">…</span></li>`;
  try {
    const res = await fetch("/api/portal?action=tracks");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.err);
    tracks = data.tracks || [];
    currentIndex = -1;
    nowPlaying.textContent = "—";
    renderTrackList();
  } catch (e) {
    trackList.innerHTML = "";
    errBox.hidden = false;
    errBox.textContent = e.message || t.err;
  }
}

async function showLyrics(index) {
  const tr = tracks[index];
  if (!tr) return;
  lyricsOpen = true;
  lyricsIndex = index;
  musicCard.classList.add("lyrics-open");
  renderTrackList();
  lyricsBody.classList.add("is-loading");
  lyricsBody.textContent = t.lyricsLoading;
  try {
    const q = new URLSearchParams({ title: tr.title, artist: tr.artist });
    const res = await fetch(`/api/portal?action=lyrics&${q}`);
    const data = await res.json();
    lyricsBody.classList.remove("is-loading");
    lyricsBody.textContent = data.lyrics?.trim() || t.lyricsEmpty;
  } catch {
    lyricsBody.classList.remove("is-loading");
    lyricsBody.textContent = t.lyricsEmpty;
  }
}

async function showDetail(index) {
  const tr = tracks[index];
  if (!tr) return;
  const modal = document.getElementById("detailModal");
  document.getElementById("modalTitle").textContent = tr.title;
  document.getElementById("modalArtist").textContent = tr.artist;
  document.getElementById("modalAlbum").textContent = `${t.album}: ${tr.album || "—"}`;
  const linkEl = document.getElementById("modalLink");
  linkEl.href = tr.link || "#";
  linkEl.textContent = t.listen;
  const bioEl = document.getElementById("modalBio");
  bioEl.textContent = "…";
  modal.hidden = false;
  if (tr.artistId) {
    try {
      const res = await fetch(`https://api.deezer.com/artist/${tr.artistId}`);
      const artist = await res.json();
      const bio = artist?.nb_fan
        ? `${artist.name}\n${(artist.nb_fan / 1e6).toFixed(1)}M fans`
        : artist?.name || tr.artist;
      bioEl.textContent = bio;
    } catch {
      bioEl.textContent = tr.artist;
    }
  } else {
    bioEl.textContent = tr.artist;
  }
}

trackList.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const index = Number(btn.dataset.index);
  if (btn.classList.contains("btn-play")) {
    if (index === currentIndex && !audio.paused) audio.pause();
    else setTrack(index);
  } else if (btn.classList.contains("btn-lyrics")) {
    showLyrics(index);
  } else if (btn.classList.contains("btn-detail")) {
    showDetail(index);
  }
});

document.getElementById("lyricsClose").onclick = closeLyrics;

document.getElementById("modalClose").onclick = () => {
  document.getElementById("detailModal").hidden = true;
};
document.getElementById("detailModal").addEventListener("click", (e) => {
  if (e.target.id === "detailModal") document.getElementById("detailModal").hidden = true;
});

playPauseBtn.onclick = () => {
  if (currentIndex < 0 && tracks.length) {
    setTrack(0);
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
};

prevBtn.onclick = () => {
  if (currentIndex > 0) setTrack(currentIndex - 1);
};
nextBtn.onclick = () => {
  if (currentIndex < tracks.length - 1) setTrack(currentIndex + 1);
};

audio.addEventListener("play", updatePlayButtons);
audio.addEventListener("pause", updatePlayButtons);
audio.addEventListener("ended", () => {
  if (currentIndex < tracks.length - 1) setTrack(currentIndex + 1);
  else updatePlayButtons();
});

audio.addEventListener("loadedmetadata", () => {
  durTime.textContent = fmt(audio.duration);
  progressBar.max = audio.duration || 30;
});

audio.addEventListener("timeupdate", () => {
  if (isSeeking) return;
  curTime.textContent = fmt(audio.currentTime);
  progressBar.value = audio.currentTime;
});

progressBar.addEventListener("input", () => {
  isSeeking = true;
  curTime.textContent = fmt(Number(progressBar.value));
});
progressBar.addEventListener("change", () => {
  audio.currentTime = Number(progressBar.value);
  isSeeking = false;
});

