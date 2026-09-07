import { corsHeaders, json, requireDb, ensureSchema } from "./_shared.js";
import { gateUse, getQuotaPayload } from "./quota.js";
import { githubRoutes } from "./github.js";

const RATES_TTL_SEC = 30 * 60;
const RATE_SYMBOLS = "USD,CNY,GBP,EUR,JPY,THB,SEK,INR,HKD,AUD,MXN,BRL";
const FRANKFURTER_LATEST = "https://api.frankfurter.dev/v1/latest";

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

function ratesPayloadValid(data) {
  return !!(data?.base && data?.rates && typeof data.rates === "object" && Object.keys(data.rates).length > 0);
}

async function ensureRatesSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS fx_rates_last (
        base TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
}

async function readLastRates(db, base) {
  try {
    await ensureRatesSchema(db);
    const row = await db.prepare("SELECT payload FROM fx_rates_last WHERE base = ?").bind(base).first();
    if (!row?.payload) return null;
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

async function writeLastRates(db, base, payload) {
  try {
    await ensureRatesSchema(db);
    await db
      .prepare(
        `INSERT INTO fx_rates_last (base, payload, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(base) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`
      )
      .bind(base, JSON.stringify(payload))
      .run();
  } catch {
    /* ignore */
  }
}

async function rates(context) {
  const { request, env, ctx } = context;
  const url = new URL(request.url);
  const base = url.searchParams.get("base")?.toUpperCase() || "USD";

  const gate = await gateUse(request, env, { increment: true });
  if (!gate.ok) return json(gate.body, gate.status);

  const waitUntil = (p) => ctx?.waitUntil?.(p);
  const cache = caches.default;
  const cacheKey = new Request(`https://rates.internal/v2/?base=${encodeURIComponent(base)}`);
  const hit = await cache.match(cacheKey);
  if (hit) {
    try {
      const cached = await hit.json();
      if (ratesPayloadValid(cached)) return json({ ...cached, ...gate.payload });
    } catch {
      /* fall through */
    }
  }

  let db = null;
  try {
    db = requireDb(env);
    await ensureSchema(db);
  } catch {
    db = null;
  }

  try {
    const symbols = RATE_SYMBOLS.split(",").filter((s) => s !== base).join(",");
    const res = await fetch(`${FRANKFURTER_LATEST}?from=${encodeURIComponent(base)}&to=${symbols}`, {
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`frankfurter_${res.status}`);
    const data = await res.json();
    if (!ratesPayloadValid(data)) throw new Error("frankfurter_empty");
    const payload = {
      base: data.base,
      date: data.date,
      rates: data.rates,
      cachedAt: new Date().toISOString(),
      refreshMinutes: 30,
      stale: false,
    };
    const toCache = new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${RATES_TTL_SEC}`,
      },
    });
    waitUntil?.(cache.put(cacheKey, toCache.clone()));
    if (db) waitUntil?.(writeLastRates(db, base, payload));
    return json({ ...payload, ...gate.payload });
  } catch {
    const last = db ? await readLastRates(db, base) : null;
    if (last && ratesPayloadValid(last)) {
      return json({ ...last, stale: true, refreshMinutes: 30, ...gate.payload });
    }
    return json({ error: "rates_unavailable", ...gate.payload }, 502);
  }
}
