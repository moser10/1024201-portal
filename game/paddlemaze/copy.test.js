import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PADDLE_COPY, paddleCopy } from "./copy.js";

const dir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(dir, "game.css"), "utf8");
const js = readFileSync(join(dir, "game.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");

test("start overlay explains the serve in zh, en, and ja", () => {
  assert.match(PADDLE_COPY.zh.serveTitle, /松手发送弹珠/);
  assert.match(PADDLE_COPY.en.serveTitle, /Release to send the marble/);
  assert.match(PADDLE_COPY.ja.serveTitle, /ビー玉/);
  assert.equal(PADDLE_COPY.zh.serveTitle.includes("打砖块"), false);
  assert.equal(paddleCopy("en").serveTitle.includes("Paddle"), false);
  assert.match(html, /松手发送弹珠/);
  assert.match(js, /serveTitle/);
});

test("HUD unit tray uses the in-game paddle color, not resource green or blue", () => {
  assert.match(js, /fillStyle = "#ff6b64"/);
  assert.match(css, /\.hud-paddle[\s\S]*background:\s*#ff6b64/);
  assert.equal(/\.hud-paddle[\s\S]*background:\s*#30d158/.test(css), false);
  assert.equal(/\.hud-paddle[\s\S]*background:\s*#0a84ff/.test(css), false);
});

test("pause keeps the board visible instead of covering it", () => {
  assert.match(js, /pauseBanner/);
  assert.equal(/showOverlay\([\s\S]*已暂停/.test(js), false);
  assert.match(css, /\.pause-banner/);
});
