import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("home-screen navigations paint from cache first", () => {
  const sw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "sw.js"), "utf8");
  assert.match(sw, /cache-first so iOS icons paint immediately/);
  assert.match(sw, /if \(cached\) \{\s*networkPromise\.catch/);
  assert.equal(sw.includes("status: 504"), false);
});
