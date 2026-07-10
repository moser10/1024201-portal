/**
 * Pre-deploy checks — run before wrangler deploy.
 */
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { buildAddressSeedStatements } from "./address-seed-sql.mjs";
import { cleanLyricsText } from "../functions/api/lyricsClean.js";

const root = process.cwd();
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const errors = [];

function fail(msg) {
  errors.push(msg);
}

function readAssetsIgnore() {
  try {
    return readFileSync(join(root, ".assetsignore"), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function ignored(rel, patterns) {
  return patterns.some((p) => {
    if (p.endsWith("/**")) {
      const prefix = p.slice(0, -3);
      return rel === prefix || rel.startsWith(`${prefix}/`);
    }
    if (p.endsWith("**")) return rel.startsWith(p.slice(0, -2));
    return rel === p;
  });
}

function walkAssets(dir, patterns, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith(".")) continue;
    const abs = join(dir, name.name);
    const rel = relative(root, abs).replace(/\\/g, "/");
    if (ignored(rel, patterns)) continue;
    if (name.isDirectory()) walkAssets(abs, patterns, acc);
    else acc.push(abs);
  }
  return acc;
}

function checkAssetsIgnore() {
  const patterns = readAssetsIgnore();
  if (!patterns.some((p) => p.startsWith("node_modules"))) {
    fail(".assetsignore must exclude node_modules/** (Cloudflare 25 MiB per-file limit)");
  }
}

function checkAssetSizes() {
  const patterns = readAssetsIgnore();
  const files = walkAssets(root, patterns);
  for (const file of files) {
    const size = statSync(file).size;
    if (size > MAX_ASSET_BYTES) {
      fail(`Asset too large: ${relative(root, file)} (${(size / 1024 / 1024).toFixed(1)} MiB > 25 MiB)`);
    }
  }
}

function checkAddressSeedSql() {
  const lines = buildAddressSeedStatements("2026-01-01T00:00:00.000Z");
  if (lines.length < 300) {
    fail(`address seed too few statements (${lines.length}); expected ~320`);
  }
  const joined = lines.join("\n");
  if (joined.includes("undefined") || joined.includes("NaN")) {
    fail("address seed SQL contains undefined/NaN");
  }
  if (!joined.includes("INSERT INTO address_listings")) {
    fail("address seed SQL missing listings");
  }
}

function checkWranglerToml() {
  const toml = readFileSync(join(root, "wrangler.toml"), "utf8");
  if (!toml.includes('name = "1024201-portal"')) {
    fail('wrangler.toml name must be "1024201-portal"');
  }
  if (!toml.includes("database_id")) {
    fail("wrangler.toml missing D1 database_id");
  }
}

function checkLyricsClean() {
  const raw = "[00:12.00]海鸥飞过\n吉他：张三\n未经著作权人许可不得翻唱\n天空很蓝";
  const out = cleanLyricsText(raw);
  if (!out.includes("海鸥飞过") || !out.includes("天空很蓝")) {
    fail("cleanLyricsText removed lyric body");
  }
  if (out.includes("吉他") || out.includes("未经著作权")) {
    fail("cleanLyricsText should strip credits and legal boilerplate");
  }
}

function main() {
  console.log("predeploy-check …");
  checkAssetsIgnore();
  checkAssetSizes();
  checkWranglerToml();
  checkAddressSeedSql();
  checkLyricsClean();

  if (errors.length) {
    console.error("predeploy-check FAILED:");
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log("predeploy-check OK");
}

main();
