import { execSync } from "node:child_process";
import { wranglerExec } from "./_wrangler.mjs";

const root = process.cwd();

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: root, encoding: "utf8" }).trim();
}

let deployments = [];
try {
  const raw = wranglerExec("deployments list --json --name 1024201-portal", { cwd: root });
  deployments = JSON.parse(raw || "[]");
} catch (e) {
  console.warn("record-deploy: deployments list failed", e.message);
}

const rows = [...deployments].sort((a, b) => String(a.created_on).localeCompare(String(b.created_on)));
const ver = (row) => row?.versions?.[0]?.version_id || "";
const current = rows.at(-1);
const previous = rows.at(-2);
const record = {
  branch: git("rev-parse --abbrev-ref HEAD"),
  sha: git("rev-parse --short HEAD"),
  versionId: ver(current),
  previousVersionId: ver(previous),
  at: current?.created_on || new Date().toISOString(),
};
const payload = JSON.stringify(record).replace(/'/g, "''");
try {
  wranglerExec(
    `d1 execute one-sentence-novel --remote -y --command "INSERT INTO portal_stats (key, value, updated_at) VALUES ('deploy_record', '${payload}', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at; DELETE FROM portal_stats WHERE key = 'deploy_map_cache';"`,
    { cwd: root, inherit: true }
  );
  console.log("record-deploy:", record.branch, record.versionId);
} catch (e) {
  console.warn("record-deploy: D1 write failed", e.message);
}
