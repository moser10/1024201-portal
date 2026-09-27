import test from "node:test";
import assert from "node:assert/strict";
import { classifyBranch, fallbackBranchRows, githubHeaders, isHot, paintBranchItems, pickDeployPair } from "./deployMap.js";

test("live branch is green", () => {
  assert.equal(classifyBranch({ name: "cursor/ft", compareStatus: "ahead", currentBranch: "cursor/ft" }), "green");
});

test("merged leftover is red", () => {
  assert.equal(classifyBranch({ name: "old-fix", compareStatus: "behind", currentBranch: "cursor/ft" }), "red");
  assert.equal(classifyBranch({ name: "old-fix", compareStatus: "identical", currentBranch: "cursor/ft" }), "red");
});

test("main stays blue even if identical", () => {
  assert.equal(classifyBranch({ name: "main", compareStatus: "behind", currentBranch: "cursor/ft" }), "blue");
});

test("hot is last 24h", () => {
  assert.equal(isHot(new Date().toISOString()), true);
  assert.equal(isHot("2020-01-01T00:00:00Z", Date.parse("2020-01-03T00:00:00Z")), false);
});

test("pickDeployPair uses newest two", () => {
  const pair = pickDeployPair([
    { created_on: "2026-09-22T00:00:00Z", versions: [{ version_id: "old" }] },
    { created_on: "2026-09-27T16:00:00Z", versions: [{ version_id: "new" }] },
    { created_on: "2026-09-27T15:00:00Z", versions: [{ version_id: "mid" }] },
  ]);
  assert.equal(pair.current.versionId, "new");
  assert.equal(pair.previous.versionId, "mid");
});

test("github headers stay anonymous without a token", () => {
  assert.equal(githubHeaders("").Authorization, undefined);
  assert.equal(githubHeaders("ghp_x").Authorization, "Bearer ghp_x");
});

test("fallback keeps the live branch green even without GitHub", () => {
  const rows = fallbackBranchRows({ branch: "cursor/ft", sha: "abc1234", at: "2026-09-27T16:00:00Z" });
  const items = paintBranchItems(rows, "cursor/ft");
  assert.equal(items.find((b) => b.name === "cursor/ft").color, "green");
  assert.equal(items.find((b) => b.name === "main").color, "blue");
});
