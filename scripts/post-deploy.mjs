import { execSync } from "node:child_process";
import { wranglerExec } from "./_wrangler.mjs";
import { warmAddressRemote } from "./address-warm.mjs";

const SITE = "https://1024201.com";
const root = process.cwd();
let failed = false;

function warn(step, e) {
  console.warn(`${step}:`, e.message || e);
  failed = true;
}

try {
  wranglerExec(
    'd1 execute one-sentence-novel --remote -y --command "DELETE FROM tool_usage_quota; DELETE FROM tool_pdf_quota;"',
    { cwd: root, inherit: true }
  );
} catch (e) {
  warn("D1 quota cleanup", e);
}

try {
  const out = execSync(`curl -s -X POST "${SITE}/api/portal?action=quota_reset"`, { encoding: "utf8" });
  console.log("quota_reset:", out.trim());
} catch (e) {
  warn("quota_reset", e);
}

try {
  warmAddressRemote();
} catch (e) {
  warn("address-warm", e);
}

if (failed) {
  console.error("\npost-deploy had errors — fix and run: node scripts/post-deploy.mjs");
  process.exit(1);
}

console.log("post-deploy OK");
