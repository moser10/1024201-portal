import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { safeAuthDest } from "./authNav.js";

test("post-login dest stays on-site and never loops back to register", () => {
  assert.equal(safeAuthDest("/"), "/");
  assert.equal(safeAuthDest(""), "/");
  assert.equal(safeAuthDest("/game/"), "/game/");
  assert.equal(safeAuthDest("game/"), "/game/");
  assert.equal(safeAuthDest("onesentence/"), "/game/onesentence/");
  assert.equal(safeAuthDest("/game/register/?return=/"), "/");
  assert.equal(safeAuthDest("https://evil.example/"), "/");
  assert.equal(safeAuthDest("//evil.example"), "/");
  assert.equal(safeAuthDest("/foo/../admin"), "/");
});

test("auth page navigates once after login and does not paint a 继续 interstitial", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const js = readFileSync(join(dir, "../game/register/auth.js"), "utf8");
  const html = readFileSync(join(dir, "../game/register/index.html"), "utf8");
  assert.match(js, /leaveAuthTo/);
  assert.equal(js.includes("登录成功"), false);
  assert.equal(js.includes("location.replace"), false);
  assert.match(html, /location\.assign/);
  assert.equal(html.includes("location.replace"), false);
});
