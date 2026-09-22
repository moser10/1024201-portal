import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { heldBallPose, launchVelocity } from "./serve.js";

const dir = dirname(fileURLToPath(import.meta.url));
const js = readFileSync(join(dir, "game.js"), "utf8");

test("held ball sits on the paddle center", () => {
  const pose = heldBallPose({ x: 100, w: 120, y: 1042 }, 7);
  assert.equal(pose.x, 160);
  assert.equal(pose.y, 1042 - 8);
});

test("launch from paddle center goes straight up", () => {
  const v = launchVelocity({ x: 100, w: 120 }, 160, 300);
  assert.ok(Math.abs(v.vx) < 1e-6);
  assert.equal(v.vy, -300);
});

test("launch from the paddle edge aims outward and up", () => {
  const left = launchVelocity({ x: 100, w: 120 }, 100, 300);
  const right = launchVelocity({ x: 100, w: 120 }, 220, 300);
  assert.ok(left.vx < 0);
  assert.ok(right.vx > 0);
  assert.ok(left.vy < 0);
  assert.ok(right.vy < 0);
});

test("level start seats a held ball and pointer-up launches it", () => {
  assert.match(js, /activateBall\(cfg\.speed, null, true, true\)/);
  assert.match(js, /ball\.held/);
  assert.match(js, /launchHeldBalls/);
  assert.match(js, /endPaddleDrag[\s\S]*launchHeldBalls/);
});
