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
