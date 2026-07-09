import { execSync } from "node:child_process";

const SITE = "https://1024201.com";
const root = process.cwd();

try {
  execSync(
    'npx wrangler d1 execute one-sentence-novel --remote --command "DELETE FROM tool_usage_quota; DELETE FROM tool_pdf_quota;"',
    { stdio: "inherit", cwd: root }
  );
} catch (e) {
  console.warn("D1 quota cleanup:", e.message);
}

try {
  const out = execSync(`curl -s -X POST "${SITE}/api/portal?action=quota_reset"`, { encoding: "utf8" });
  console.log("quota_reset:", out.trim());
} catch (e) {
  console.warn("quota_reset failed:", e.message);
}

try {
  execSync("node scripts/address-warm.mjs", { stdio: "inherit", cwd: root });
} catch (e) {
  console.warn("address-warm failed:", e.message);
}
