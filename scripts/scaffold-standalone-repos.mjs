#!/usr/bin/env node
/**
 * Scaffolds findLytics, 2PDF, latestRates as sibling directories.
 * Run: node scripts/scaffold-standalone-repos.mjs
 */
import { cpSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "..");

const SHARED_BACKEND = `import { corsHeaders, json, requireDb, ensureSchema } from "./_shared.js";
import { gateUse, getQuotaPayload, FREE_LIMIT } from "./quota.js";
import { githubRoutes } from "./github.js";

export async function onRequest(context) {
  const { request, env, ctx } = context;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/github")) {
    return githubRoutes(context);
  }
  if (url.pathname !== "/api") {
    return json({ error: "not_found" }, 404);
  }
  const action = url.searchParams.get("action");
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return handleApi(context, action);
}

async function handleApi(context, action) {
  const handler = API[action];
  if (!handler) return json({ error: "unknown_action" }, 404);
  return handler(context);
}
`;

function writeSharedFiles(dir, toolName) {
  const fn = join(dir, "functions/api");
  mkdirSync(fn, { recursive: true });

  writeFileSync(
    join(fn, "_shared.js"),
    `export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function requireDb(env) {
  if (!env?.DB?.prepare) {
    throw new Error("D1 not bound. Run: wrangler d1 create ${toolName}-db and set database_id in wrangler.toml");
  }
  return env.DB;
}

export async function ensureSchema(db) {
  await db
    .prepare(
      \`CREATE TABLE IF NOT EXISTS usage_quota (
        quota_key TEXT PRIMARY KEY,
        uses INTEGER NOT NULL DEFAULT 0
      )\`
    )
    .run();
  await db
    .prepare(
      \`CREATE TABLE IF NOT EXISTS github_sessions (
        session_id TEXT PRIMARY KEY,
        github_id INTEGER NOT NULL,
        github_login TEXT NOT NULL,
        access_token TEXT NOT NULL,
        starred INTEGER NOT NULL DEFAULT 0,
        checked_at TEXT NOT NULL
      )\`
    )
    .run();
}
`
  );

  writeFileSync(
    join(fn, "quota.js"),
    readFileSync(join(ROOT, "scripts/standalone/quota.js"), "utf8")
  );
  writeFileSync(
    join(fn, "github.js"),
    readFileSync(join(ROOT, "scripts/standalone/github.js"), "utf8")
  );
}

function workerJs() {
  return `const API = await import("./functions/api/index.js");

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          hasDb: !!env?.DB,
          quotaDisabled: env?.QUOTA_DISABLED === "true",
          starRepo: env?.GITHUB_STAR_REPO || null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/api" || url.pathname.startsWith("/api/github")) {
      return API.onRequest({ request, env, ctx });
    }

    return serveStatic(request, env);
  },
};

async function serveStatic(request, env) {
  const url = new URL(request.url);
  let { pathname } = url;
  if (!pathname.endsWith("/") && !pathname.includes(".")) {
    const u = new URL(request.url);
    u.pathname = pathname + "/";
    return Response.redirect(u.toString(), 301);
  }
  let res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;
  if (pathname.endsWith("/")) {
    const u = new URL(request.url);
    u.pathname = pathname + "index.html";
    res = await env.ASSETS.fetch(new Request(u, request));
  }
  return res;
}
`;
}

function wranglerToml(name, dbName) {
  return `# ${name} — Cloudflare Worker + static assets
name = "${name}"
main = "worker.js"
compatibility_date = "2024-09-23"
workers_dev = true

[assets]
directory = "."
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = "${dbName}"
database_id = "REPLACE_WITH_YOUR_D1_ID"

[vars]
QUOTA_DISABLED = "false"
GITHUB_STAR_REPO = "YOUR_GITHUB_USER/${name}"
# Secrets (wrangler secret put): GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET
`;
}

function packageJson(name, desc) {
  return JSON.stringify(
    {
      name: name.toLowerCase(),
      private: false,
      description: desc,
      type: "module",
      scripts: {
        dev: "wrangler dev",
        deploy: "wrangler deploy",
        "db:create": `wrangler d1 create ${name}-db`,
      },
      license: "MIT",
    },
    null,
    2
  );
}

function gitignore() {
  return `.wrangler/
node_modules/
.dev.vars
.DS_Store
`;
}

function copyAsset(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

// --- create standalone shared frontend modules ---
function writeFrontendShared(repoDir) {
  const js = join(repoDir, "js");
  mkdirSync(js, { recursive: true });
  copyAsset(join(ROOT, "js/langTabs.js"), join(js, "langTabs.js"));
  copyAsset(join(ROOT, "js/langTabs.css"), join(js, "langTabs.css"));
  copyAsset(join(ROOT, "js/featurePage.css"), join(js, "featurePage.css"));
  writeFileSync(
    join(js, "quotaUi.js"),
    readFileSync(join(ROOT, "scripts/standalone/quotaUi.js"), "utf8")
  );
  writeFileSync(
    join(js, "toolI18n.js"),
    readFileSync(join(ROOT, "scripts/standalone/toolI18n.js"), "utf8")
  );
}

console.log("Scaffold modules must exist in scripts/standalone/ — run after creating those files.");
