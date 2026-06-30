import { corsHeaders, json, requireDb, ensureAppSchema } from "./_shared.js";

const DC_KW = /hosting|cloud|data\s*center|server|colo|vps|amazon|google|microsoft|digitalocean|linode|ovh|hetzner|alibaba|tencent|huawei/i;
const LIMIT_ANON = 1;
const LIMIT_USER = 5;

export async function onRequest(context) {
  const { request, env, ctx } = context;
  const waitUntil = (promise) => ctx?.waitUntil?.(promise);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (request.method === "GET" && action === "geo") {
    return json(await buildIpIntel(request));
  }

  if (request.method === "GET" && action === "rates") {
    const base = url.searchParams.get("base")?.toUpperCase() || "USD";
    return getCachedRates(base, waitUntil);
  }

  if (request.method === "GET" && action === "tracks") {
    const res = await fetch("https://api.deezer.com/chart/0/tracks?limit=24");
    if (!res.ok) return json({ error: "音乐列表暂不可用" }, 502);
    const data = await res.json();
    const tracks = (data.data || []).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist?.name || "",
      artistId: t.artist?.id || null,
      album: t.album?.title || "",
      cover: t.album?.cover_small || "",
      preview: t.preview || "",
      link: t.link || "",
    }));
    return json({ tracks });
  }

  if (request.method === "GET" && action === "lyrics") {
    const title = url.searchParams.get("title")?.trim();
    const artist = url.searchParams.get("artist")?.trim();
    if (!title || !artist) return json({ lyrics: "" });
    const hit = await fetchLyricsHit(title, artist);
    return json({ lyrics: hit?.plainLyrics || hit?.syncedLyrics || "" });
  }

  if (request.method === "GET" && action === "lyrics_search") {
    const title = url.searchParams.get("title")?.trim() || "";
    const artist = url.searchParams.get("artist")?.trim() || "";
    if (!title && !artist) return json({ error: "请填写歌曲名称或歌手" }, 400);
    const userId = parseUserId(url);
    const db = requireDb(env);
    await ensureAppSchema(db);
    const gate = await gateToolUse(db, request, "lyrics", userId);
    if (!gate.ok) return json(gate.body, gate.status);
    const rows = await searchLyricsMulti(title, artist);
    gate.q.uses += 1;
    await saveToolQuota(db, gate.key, "lyrics", gate.q);
    return json({ results: rows, ...toolQuotaPayload(gate.q, userId) });
  }

  if (request.method === "GET" && action === "lyrics_quota") {
    const db = requireDb(env);
    await ensureAppSchema(db);
    const userId = parseUserId(url);
    const key = quotaKey(request, userId);
    const q = await getToolQuota(db, key, "lyrics");
    return json(toolQuotaPayload(q, userId));
  }

  if (request.method === "GET" && action === "lyrics_get") {
    const id = url.searchParams.get("id");
    if (id?.startsWith("dz-")) {
      const row = await getDeezerLyricsRow(id.slice(3));
      if (!row) return json({ error: "歌曲不存在" }, 404);
      return json(row);
    }
    if (id) {
      const res = await fetch(`https://lrclib.net/api/get/${id}`);
      if (!res.ok) return json({ error: "歌词不存在" }, 404);
      const row = await res.json();
      return json(formatLyricsRow(row));
    }
    const title = url.searchParams.get("title")?.trim() || "";
    const artist = url.searchParams.get("artist")?.trim() || "";
    if (!title && !artist) return json({ error: "参数不足" }, 400);
    const hit = await fetchLyricsHit(title, artist);
    if (!hit) return json({ error: "歌词不存在" }, 404);
    return json(formatLyricsRow(hit));
  }

  if (request.method === "POST" && action === "translate") {
    const { text, target } = await request.json();
    if (!text?.trim() || !target) return json({ error: "缺少参数" }, 400);
    try {
      const translated = await translateText(text, target);
      return json({ text: translated });
    } catch {
      return json({ error: "翻译服务暂不可用" }, 503);
    }
  }

  if (request.method === "GET" && action === "pdf_quota") {
    const db = requireDb(env);
    await ensureAppSchema(db);
    const userId = parseUserId(url);
    const key = quotaKey(request, userId);
    const q = await getToolQuota(db, key, "pdf");
    return json(toolQuotaPayload(q, userId));
  }

  if (request.method === "POST" && action === "pdf_use") {
    const db = requireDb(env);
    await ensureAppSchema(db);
    const body = await request.json().catch(() => ({}));
    const userId = parseUserId(url, body);
    const gate = await gateToolUse(db, request, "pdf", userId);
    if (!gate.ok) return json(gate.body, gate.status);
    gate.q.uses += 1;
    await saveToolQuota(db, gate.key, "pdf", gate.q);
    return json({ ok: true, ...toolQuotaPayload(gate.q, userId) });
  }

  if (request.method === "POST" && action === "tool_ad") {
    const db = requireDb(env);
    await ensureAppSchema(db);
    const body = await request.json().catch(() => ({}));
    const userId = parseUserId(url, body);
    const tool = url.searchParams.get("tool") || body?.tool || "pdf";
    if (!userId) return json({ error: "login_required", needLogin: true }, 403);
    const key = quotaKey(request, userId);
    const q = await getToolQuota(db, key, tool);
    const need = 2 ** q.ad_tier;
    q.ad_progress += 1;
    if (q.ad_progress >= need) {
      q.bonus += 1;
      q.ad_tier += 1;
      q.ad_progress = 0;
    }
    await saveToolQuota(db, key, tool, q);
    return json({ ok: true, simulated: true, tool, ...toolQuotaPayload(q, userId) });
  }

  if (request.method === "POST" && action === "quota_reset") {
    const db = requireDb(env);
    await ensureAppSchema(db);
    const ip = clientIp(request);
    await db.prepare("DELETE FROM tool_usage_quota WHERE quota_key = ?").bind(`ip:${ip}`).run();
    await db.prepare("DELETE FROM tool_pdf_quota WHERE ip = ?").bind(ip).run();
    return json({ ok: true, ip });
  }

  if (request.method === "GET" && action === "syncnote_get") {
    return syncNoteGet(env, url);
  }

  if (request.method === "POST" && action === "syncnote_save") {
    return syncNoteSave(env, request, url);
  }

  if (request.method === "POST" && action === "syncnote_clear") {
    return syncNoteClear(env, request, url);
  }

  return json({ error: "未知操作" }, 404);
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function buildIpIntel(request) {
  const cf = request.cf || {};
  const ip = clientIp(request);
  const city = cf.city || "";
  const region = cf.region || cf.regionCode || "";
  const country = cf.country || "";
  const asn = cf.asn || null;
  const org = cf.asOrganization || "";

  let hosting = false;
  let proxy = false;
  let mobile = false;
  let isp = org || "";

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,isp,org,as,mobile,proxy,hosting`,
      { cf: { cacheTtl: 300 } }
    );
    if (res.ok) {
      const ext = await res.json();
      if (ext.status === "success") {
        hosting = !!ext.hosting;
        proxy = !!ext.proxy;
        mobile = !!ext.mobile;
        isp = ext.isp || ext.org || isp;
      }
    }
  } catch {
    /* use cf heuristics only */
  }

  if (!hosting && (DC_KW.test(org) || DC_KW.test(isp))) hosting = true;

  const networkType = hosting ? "datacenter" : mobile ? "mobile" : "residential";
  let purity = 92;
  if (hosting) purity -= 38;
  if (proxy) purity -= 32;
  if (mobile) purity -= 6;
  purity = Math.max(5, Math.min(99, purity));

  const parts = [city, region, country].filter(Boolean);
  return {
    ip,
    city,
    region,
    country,
    label: parts.length ? parts.join(", ") : country || ip,
    asn,
    org,
    isp,
    hosting,
    proxy,
    mobile,
    networkType,
    purity,
    purityLevel: purity >= 75 ? "high" : purity >= 45 ? "mid" : "low",
  };
}

async function searchLyrics(title, artist) {
  const rows = await searchLyricsMulti(title || "", artist || "");
  return rows.map((r) => ({
    id: r.id,
    trackName: r.title,
    artistName: r.artist,
    albumName: r.album,
    releaseDate: r.year,
    plainLyrics: r.lyrics,
    duration: r.duration,
  }));
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

function parseUserId(url, body) {
  const raw = url.searchParams.get("user_id") ?? body?.user_id;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function quotaKey(request, userId) {
  if (userId) return `u:${userId}`;
  return `ip:${clientIp(request)}`;
}

function dailyLimit(userId) {
  return userId ? LIMIT_USER : LIMIT_ANON;
}

async function getToolQuota(db, key, tool) {
  const day = todayUtc();
  const row = await db
    .prepare("SELECT uses, ad_tier, ad_progress, bonus FROM tool_usage_quota WHERE quota_key = ? AND tool = ? AND day = ?")
    .bind(key, tool, day)
    .first();
  return row || { uses: 0, ad_tier: 0, ad_progress: 0, bonus: 0 };
}

async function saveToolQuota(db, key, tool, q) {
  const day = todayUtc();
  await db
    .prepare(
      `INSERT INTO tool_usage_quota (quota_key, tool, day, uses, ad_tier, ad_progress, bonus)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(quota_key, tool, day) DO UPDATE SET
         uses = excluded.uses,
         ad_tier = excluded.ad_tier,
         ad_progress = excluded.ad_progress,
         bonus = excluded.bonus`
    )
    .bind(key, tool, day, q.uses, q.ad_tier, q.ad_progress, q.bonus)
    .run();
}

function toolQuotaPayload(q, userId) {
  const base = dailyLimit(userId);
  const allowed = userId ? base + q.bonus : base;
  const remaining = Math.max(0, allowed - q.uses);
  const needAds = 2 ** q.ad_tier;
  return {
    uses: q.uses,
    allowed,
    remaining,
    dailyFree: base,
    bonus: q.bonus,
    loggedIn: !!userId,
    needLogin: !userId && q.uses >= LIMIT_ANON,
    needUnlock: !!userId && q.uses >= allowed,
    adTier: q.ad_tier,
    adProgress: q.ad_progress,
    adsNeeded: needAds,
    adsRemaining: Math.max(0, needAds - q.ad_progress),
  };
}

async function gateToolUse(db, request, tool, userId) {
  const key = quotaKey(request, userId);
  const q = await getToolQuota(db, key, tool);
  const allowed = userId ? LIMIT_USER + q.bonus : LIMIT_ANON;
  if (q.uses >= allowed) {
    const payload = toolQuotaPayload(q, userId);
    if (!userId) {
      return {
        ok: false,
        status: 403,
        body: {
          error: "login_required",
          needLogin: true,
          ...payload,
        },
      };
    }
    return {
      ok: false,
      status: 403,
      body: { error: "daily_limit", needLogin: false, ...payload },
    };
  }
  return { ok: true, key, q };
}

const RATES_TTL_SEC = 6 * 60 * 60;
const RATE_SYMBOLS = "USD,CNY,GBP,EUR,JPY,THB,SEK,INR,HKD,AUD,MXN,BRL";

async function getCachedRates(base, waitUntil) {
  const cache = caches.default;
  const cacheKey = new Request(`https://rates.1024201.internal/?base=${encodeURIComponent(base)}`);
  const hit = await cache.match(cacheKey);
  if (hit) {
    const data = await hit.json();
    return json(data);
  }

  const symbols = RATE_SYMBOLS.split(",").filter((s) => s !== base).join(",");
  const apiUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${symbols}`;
  const res = await fetch(apiUrl);
  if (!res.ok) return json({ error: "汇率服务暂不可用" }, 502);
  const data = await res.json();
  const payload = {
    base: data.base,
    date: data.date,
    rates: data.rates,
    cachedAt: new Date().toISOString(),
    refreshHours: 6,
  };
  const toCache = new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${RATES_TTL_SEC}`,
    },
  });
  waitUntil?.(cache.put(cacheKey, toCache.clone()));
  return json(payload);
}

async function requireRegisteredUser(db, userId) {
  if (!userId) return { ok: false, status: 403, body: { error: "login_required", needLogin: true } };
  const row = await db.prepare("SELECT id, username FROM users WHERE id = ?").bind(userId).first();
  if (!row) return { ok: false, status: 403, body: { error: "login_required", needLogin: true } };
  return { ok: true, user: row };
}

async function syncNoteGet(env, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  const userId = parseUserId(url);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);
  const { results } = await db
    .prepare("SELECT slot, content, updated_at FROM user_sync_notes WHERE user_id = ? ORDER BY slot")
    .bind(userId)
    .all();
  const bySlot = new Map(results.map((r) => [r.slot, r]));
  const slots = [0, 1, 2].map((slot) => {
    const row = bySlot.get(slot);
    return { slot, content: row?.content ?? "", updatedAt: row?.updated_at ?? null };
  });
  return json({ slots, username: auth.user.username });
}

function parseSlot(body, url) {
  const raw = body?.slot ?? url.searchParams.get("slot");
  const slot = parseInt(raw, 10);
  if (!Number.isFinite(slot) || slot < 0 || slot > 2) return null;
  return slot;
}

async function syncNoteSave(env, request, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  const body = await request.json().catch(() => ({}));
  const userId = parseUserId(url, body);
  const slot = parseSlot(body, url);
  if (slot === null) return json({ error: "invalid_slot" }, 400);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);
  const content = String(body?.content ?? "");
  if (content.length > 65536) return json({ error: "content_too_large" }, 413);
  await db
    .prepare(
      `INSERT INTO user_sync_notes (user_id, slot, content, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, slot) DO UPDATE SET
         content = excluded.content,
         updated_at = excluded.updated_at`
    )
    .bind(userId, slot, content)
    .run();
  const row = await db
    .prepare("SELECT updated_at FROM user_sync_notes WHERE user_id = ? AND slot = ?")
    .bind(userId, slot)
    .first();
  return json({ ok: true, slot, updatedAt: row?.updated_at ?? null });
}

async function syncNoteClear(env, request, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  const body = await request.json().catch(() => ({}));
  const userId = parseUserId(url, body);
  const slot = parseSlot(body, url);
  if (slot === null) return json({ error: "invalid_slot" }, 400);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);
  await db.prepare("DELETE FROM user_sync_notes WHERE user_id = ? AND slot = ?").bind(userId, slot).run();
  return json({ ok: true, slot });
}
