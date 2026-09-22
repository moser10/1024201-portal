import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(dir, "game.css"), "utf8");
const js = readFileSync(join(dir, "game.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");

test("game page CSS blocks system select and callout without disabling buttons", () => {
  assert.match(css, /user-select:\s*none/);
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /\.canvas-wrap[\s\S]*touch-action:\s*none/);
  assert.match(css, /\.control-zone[\s\S]*touch-action:\s*none/);
  assert.match(css, /a,\s*button[\s\S]*touch-action:\s*manipulation/);
});

test("game page JS cancels select/callout/zoom but keeps pointer paddle drag", () => {
  for (const type of ["contextmenu", "selectstart", "dragstart", "dblclick", "gesturestart"]) {
    assert.match(js, new RegExp(type));
  }
  assert.match(js, /selectionchange/);
  assert.match(js, /removeAllRanges/);
  assert.match(js, /suppressCallout/);
  assert.match(js, /beginPaddleDrag/);
  assert.match(js, /startBtn\.addEventListener\("click"/);
  assert.match(js, /pauseBtn\.addEventListener\("click"/);
});

test("game page viewport disables pinch zoom and cache-busts lock assets", () => {
  assert.match(html, /user-scalable=no/);
  assert.match(html, /game\.css\?v=\d+/);
  assert.match(html, /game\.js\?v=\d+/);
});
