import { corsHeaders, json, requireDb, ensureSchema } from "./_shared.js";
import { gateUse, getQuotaPayload } from "./quota.js";
import { githubRoutes } from "./github.js";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/github")) return githubRoutes(context);
  if (url.pathname !== "/api") return json({ error: "not_found" }, 404);
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const action = url.searchParams.get("action");
  if (action === "quota") return quota(context);
  if (action === "lyrics_search" && request.method === "GET") return lyricsSearch(context);
  if (action === "lyrics_get" && request.method === "GET") return lyricsGet(context);
  if (action === "translate" && request.method === "POST") return translate(context);
  return json({ error: "unknown_action" }, 404);
}

async function quota(context) {
  const { request, env } = context;
  return json(await getQuotaPayload(request, env));
}

async function lyricsSearch(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const title = url.searchParams.get("title")?.trim() || "";
  const artist = url.searchParams.get("artist")?.trim() || "";
  if (!title && !artist) return json({ error: "need_query" }, 400);

  const gate = await gateUse(request, env, { increment: true });
  if (!gate.ok) return json(gate.body, gate.status);

  const rows = await searchLyricsMulti(title, artist);
  return json({ results: rows, ...gate.payload });
}

async function lyricsGet(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  if (id?.startsWith("dz-")) {
    const row = await getDeezerLyricsRow(id.slice(3));
    if (!row) return json({ error: "not_found" }, 404);
    return json(row);
  }
  if (id) {
    const res = await fetch(`https://lrclib.net/api/get/${id}`);
    if (!res.ok) return json({ error: "not_found" }, 404);
    return json(formatLyricsRow(await res.json()));
  }
  const title = url.searchParams.get("title")?.trim() || "";
  const artist = url.searchParams.get("artist")?.trim() || "";
  if (!title && !artist) return json({ error: "bad_request" }, 400);
  const rows = await searchLyricsMulti(title, artist);
  if (!rows[0]) return json({ error: "not_found" }, 404);
  return json(rows[0]);
}

async function translate(context) {
  const { text, target } = await context.request.json();
  if (!text?.trim() || !target) return json({ error: "bad_request" }, 400);
  try {
    return json({ text: await translateText(text, target) });
  } catch {
    return json({ error: "translate_unavailable" }, 503);
  }
}

const ARTIST_ALIASES = {
  枪花: ["Guns N' Roses", "Guns N Roses", "GNR"],
  枪花乐队: ["Guns N' Roses", "GNR"],
  gns: ["GNS", "Guns N' Roses"],
  gnr: ["Guns N' Roses"],
  面孔: ["面孔乐队", "The Face"],
  面孔乐队: ["The Face"],
};

function expandArtistTerms(artist) {
  if (!artist?.trim()) return [];
  const terms = new Set([artist.trim()]);
  const lower = artist.trim().toLowerCase();
  for (const [key, alts] of Object.entries(ARTIST_ALIASES)) {
    const kl = key.toLowerCase();
    if (lower === kl || lower.includes(kl) || kl.includes(lower)) {
      alts.forEach((a) => terms.add(a));
    }
  }
  if (/^gns$/i.test(artist.trim())) terms.add("GNS");
  return [...terms];
}

async function fetchLrclibSearch(params) {
  const u = new URL("https://lrclib.net/api/search");
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
  }
  try {
    const res = await fetch(u.toString(), { cf: { cacheTtl: 3600 } });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function searchLrclibVariants(title, artist) {
  const tasks = [];
  const artists = artist ? expandArtistTerms(artist) : [];

  if (title && artist) {
    for (const a of artists) {
      tasks.push(fetchLrclibSearch({ track_name: title, artist_name: a }));
    }
    tasks.push(fetchLrclibSearch({ q: `${title} ${artist}` }));
  } else if (artist) {
    for (const a of artists) {
      tasks.push(fetchLrclibSearch({ artist_name: a }));
      tasks.push(fetchLrclibSearch({ q: a }));
    }
  } else if (title) {
    tasks.push(fetchLrclibSearch({ q: title }));
    tasks.push(fetchLrclibSearch({ track_name: title }));
  }

  const batches = await Promise.all(tasks);
  return batches.flat();
}

async function fetchDeezer(url) {
  try {
    const res = await fetch(url, { cf: { cacheTtl: 1800 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function deezerTrackRow(t, artistOverride) {
  return {
    id: `dz-${t.id}`,
    source: "deezer",
    trackName: t.title,
    artistName: artistOverride || t.artist?.name || "",
    albumName: t.album?.title || "",
    releaseDate: t.album?.release_date || "",
    plainLyrics: "",
    syncedLyrics: "",
    duration: t.duration,
  };
}

async function searchDeezer(title, artist) {
  const out = [];
  const seen = new Set();
  const push = (row) => {
    const key = `${row.trackName}|${row.artistName}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  const q = [title, artist].filter(Boolean).join(" ").trim();
  if (q) {
    const data = await fetchDeezer(`https://api.deezer.com/search/track?q=${encodeURIComponent(q)}&limit=30`);
    for (const t of data?.data || []) push(deezerTrackRow(t));
  }

  if (artist) {
    const terms = expandArtistTerms(artist);
    for (const a of terms.slice(0, 5)) {
      const ad = await fetchDeezer(`https://api.deezer.com/search/artist?q=${encodeURIComponent(a)}&limit=4`);
      for (const ar of ad?.data || []) {
        const td = await fetchDeezer(`https://api.deezer.com/artist/${ar.id}/top?limit=25`);
        for (const t of td?.data || []) push(deezerTrackRow(t, ar.name));
        const al = await fetchDeezer(`https://api.deezer.com/artist/${ar.id}/albums?limit=8`);
        for (const album of al?.data || []) {
          const tr = await fetchDeezer(`https://api.deezer.com/album/${album.id}/tracks?limit=30`);
          for (const t of tr?.data || []) push(deezerTrackRow(t, ar.name));
        }
      }
    }
  }

  return out;
}

function mapResultRow(r) {
  const id = r.id ?? r.trackName;
  return {
    id: String(id),
    title: r.trackName || r.name || "",
    artist: r.artistName || r.artist || "",
    album: r.albumName || r.album || "",
    year: (r.releaseDate || "").slice(0, 4),
    duration: r.duration || null,
    lyrics: r.plainLyrics || stripSynced(r.syncedLyrics) || "",
    source: String(id).startsWith("dz-") ? "deezer" : "lrclib",
  };
}

function scoreResult(row, titleQ, artistQ, expandedArtists) {
  let score = 0;
  const t = row.title.toLowerCase();
  const a = row.artist.toLowerCase();
  const tq = (titleQ || "").toLowerCase().trim();
  const aq = (artistQ || "").toLowerCase().trim();

  if (aq && a === aq) score += 220;
  if (tq && t === tq) score += 220;
  for (const ea of expandedArtists) {
    const e = ea.toLowerCase();
    if (a === e) score += 180;
    else if (a.includes(e) || e.includes(a)) score += 50;
  }
  if (aq && a.includes(aq)) score += 70;
  if (tq && t.includes(tq)) score += 60;
  if (row.lyrics?.length > 0) score += 30;
  if (row.source === "lrclib") score += 15;
  return score;
}

async function searchLyricsMulti(title, artist) {
  const expanded = artist ? expandArtistTerms(artist) : [];
  const [lrclib, deezer] = await Promise.all([
    searchLrclibVariants(title, artist),
    searchDeezer(title, artist),
  ]);

  const map = new Map();
  for (const raw of [...lrclib, ...deezer]) {
    const row = mapResultRow(raw);
    const key = `${row.title.toLowerCase()}|${row.artist.toLowerCase()}`;
    const score = scoreResult(row, title, artist, expanded);
    const prev = map.get(key);
    if (!prev || score > prev._score || (row.lyrics && !prev.lyrics)) {
      map.set(key, { ...row, _score: score });
    }
  }

  return [...map.values()]
    .sort((a, b) => b._score - a._score)
    .slice(0, 50)
    .map(({ _score, ...row }) => row);
}

async function getDeezerLyricsRow(dzId) {
  const track = await fetchDeezer(`https://api.deezer.com/track/${dzId}`);
  if (!track?.title) return null;

  const artist = track.artist?.name || "";
  const lrRows = await searchLrclibVariants(track.title, artist);
  const hit = lrRows.find((r) => r.plainLyrics || r.syncedLyrics) || lrRows[0];

  if (hit) {
    const row = formatLyricsRow(hit);
    row.id = `dz-${dzId}`;
    return row;
  }

  return {
    id: `dz-${dzId}`,
    title: track.title,
    artist,
    album: track.album?.title || "",
    year: track.album?.release_date?.slice(0, 4) || "",
    lyrics: "",
  };
}

async function fetchLyricsHit(title, artist) {
  const rows = await searchLyricsMulti(title || "", artist || "");
  return rows[0] ? {
    id: rows[0].id,
    trackName: rows[0].title,
    artistName: rows[0].artist,
    albumName: rows[0].album,
    releaseDate: rows[0].year,
    plainLyrics: rows[0].lyrics,
  } : null;
}

function formatLyricsRow(row) {
  return {
    id: row.id,
    title: row.trackName || row.name || "",
    artist: row.artistName || row.artist || "",
    album: row.albumName || row.album || "",
    year: row.releaseDate?.slice(0, 4) || "",
    lyrics: row.plainLyrics || stripSynced(row.syncedLyrics) || "",
  };
}

function stripSynced(synced) {
  if (!synced) return "";
  return synced.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim();
}

async function translateText(text, target) {
  const langMap = { en: "en", zh: "zh", ja: "ja" };
  const tgt = langMap[target] || target;
  const chunks = chunkText(text, 450);
  const out = [];
  for (const chunk of chunks) {
    const res = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: chunk, source: "auto", target: tgt, format: "text" }),
    });
    if (!res.ok) throw new Error("translate unavailable");
    const data = await res.json();
    const piece = data.translatedText || "";
    if (!piece || isBadTranslation(piece)) throw new Error("translate unavailable");
    out.push(piece);
  }
  return out.join("\n");
}

function isBadTranslation(text) {
  return /MYMEMORY\s+WARNING|USAGE\s*LIMIT|TRANSLAT(?:E|ION)\s+UNAVAILABLE|NEXT\s+AVAILABLE\s+IN/i.test(text);
}

function chunkText(text, size) {
  const lines = text.split("\n");
  const chunks = [];
  let buf = "";
  for (const line of lines) {
    if ((buf + line).length > size && buf) {
      chunks.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text.slice(0, size)];
}

