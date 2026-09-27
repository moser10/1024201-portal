import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wranglerExec } from "./_wrangler.mjs";
import { DEFAULT_REPO } from "../functions/api/deployMap.js";

const root = process.cwd();

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: root, encoding: "utf8" }).trim();
}

function repoSlug() {
  try {
    const url = git("remote get-url origin");
    const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/i);
    if (m) return `${m[1]}/${m[2]}`;
  } catch {
    /* default */
  }
  return DEFAULT_REPO;
}

function ghJson(path) {
  return JSON.parse(execSync(`gh api ${JSON.stringify(path)}`, { cwd: root, encoding: "utf8" }));
}

function snapshotBranches(currentBranch) {
  const repo = repoSlug();
  const branches = ghJson(`repos/${repo}/branches?per_page=100`);
  const rows = [];
  for (const b of branches) {
    const name = b.name;
    let updatedAt = "";
    let compareStatus = "unknown";
    let sha = String(b.commit?.sha || "").slice(0, 7);
    try {
      const detail = ghJson(`repos/${repo}/branches/${encodeURIComponent(name)}`);
      updatedAt = detail?.commit?.commit?.committer?.date || detail?.commit?.commit?.author?.date || "";
      sha = String(detail?.commit?.sha || b.commit?.sha || "").slice(0, 7);
      if (name === currentBranch) compareStatus = "identical";
      else {
        const cmp = ghJson(`repos/${repo}/compare/${encodeURIComponent(currentBranch)}...${encodeURIComponent(name)}`);
        compareStatus = cmp?.status || "diverged";
      }
    } catch {
      compareStatus = "unknown";
    }
    rows.push({ name, sha, updatedAt, compareStatus });
  }
  return { currentBranch, source: "snapshot", at: new Date().toISOString(), branches: rows };
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

let snapshot = { currentBranch: record.branch, source: "fallback", at: record.at, branches: [] };
try {
  snapshot = snapshotBranches(record.branch);
  console.log("record-deploy: snapshot", snapshot.branches.length, "branches");
} catch (e) {
  console.warn("record-deploy: GitHub snapshot failed", e.message);
}

const sql = [
  `INSERT INTO portal_stats (key, value, updated_at) VALUES ('deploy_record', '${JSON.stringify(record).replace(/'/g, "''")}', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
  `INSERT INTO portal_stats (key, value, updated_at) VALUES ('deploy_branch_snapshot', '${JSON.stringify(snapshot).replace(/'/g, "''")}', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
  `DELETE FROM portal_stats WHERE key = 'deploy_map_cache';`,
].join("\n");
const sqlFile = join(tmpdir(), "record-deploy.sql");
writeFileSync(sqlFile, sql);
try {
  wranglerExec(`d1 execute one-sentence-novel --remote -y --file ${JSON.stringify(sqlFile)}`, { cwd: root, inherit: true });
  console.log("record-deploy:", record.branch, record.versionId);
} catch (e) {
  console.warn("record-deploy: D1 write failed", e.message);
}
