import { corsHeaders, json, requireDb, ensureSchema } from "./_shared.js";
import { gateUse, getQuotaPayload } from "./quota.js";
import { githubRoutes } from "./github.js";

const RATES_TTL_SEC = 30 * 60;
const RATE_SYMBOLS = "USD,CNY,GBP,EUR,JPY,THB,SEK,INR,HKD,AUD,MXN,BRL";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/github")) return githubRoutes(context);
  if (url.pathname !== "/api") return json({ error: "not_found" }, 404);
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const action = url.searchParams.get("action");
  if (action === "quota") return quota(context);
  if (action === "rates" && request.method === "GET") return rates(context);
  return json({ error: "unknown_action" }, 404);
}

async function quota(context) {
  const { request, env } = context;
  return json(await getQuotaPayload(request, env));
}

async function rates(context) {
  const { request, env, ctx } = context;
  const url = new URL(request.url);
  const base = url.searchParams.get("base")?.toUpperCase() || "USD";

  const gate = await gateUse(request, env, { increment: true });
  if (!gate.ok) return json(gate.body, gate.status);

  const waitUntil = (p) => ctx?.waitUntil?.(p);
  const cache = caches.default;
  const cacheKey = new Request(`https://rates.internal/?base=${encodeURIComponent(base)}`);
  const hit = await cache.match(cacheKey);
  let payload;
  if (hit) {
    payload = await hit.json();
  } else {
    const symbols = RATE_SYMBOLS.split(",").filter((s) => s !== base).join(",");
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${symbols}`);
    if (!res.ok) return json({ error: "rates_unavailable" }, 502);
    const data = await res.json();
    payload = {
      base: data.base,
      date: data.date,
      rates: data.rates,
      cachedAt: new Date().toISOString(),
      refreshMinutes: 30,
    };
    const toCache = new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${RATES_TTL_SEC}`,
      },
    });
    waitUntil?.(cache.put(cacheKey, toCache.clone()));
  }
  return json({ ...payload, ...gate.payload });
}
