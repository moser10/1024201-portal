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
  if (action === "pdf_use" && request.method === "POST") return pdfUse(context);
  return json({ error: "unknown_action" }, 404);
}

async function quota(context) {
  const { request, env } = context;
  return json(await getQuotaPayload(request, env));
}

async function pdfUse(context) {
  const { request, env } = context;
  const gate = await gateUse(request, env, { increment: true });
  if (!gate.ok) return json(gate.body, gate.status);
  return json({ ok: true, ...gate.payload });
}
