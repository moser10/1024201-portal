import test from "node:test";
import assert from "node:assert/strict";
import {
  PINGPONG_LIMIT,
  bounceCircleRect,
  bounceWorldEdge,
  clampSpeed,
  reflectAndEscape,
  resetTrap,
} from "./bounce.js";

test("grazing a wall leaves with a real normal speed instead of sliding", () => {
  const incoming = Math.hypot(2, 400);
  const v = reflectAndEscape(2, 400, 1, 0, 0);
  assert.ok(v.vx > 80);
  assert.ok(Math.abs(v.vy) > 200);
  assert.ok(Math.hypot(v.vx, v.vy) <= incoming + 1e-6);
});

test("bounces never add energy", () => {
  const incoming = Math.hypot(180, 12);
  let vx = 180;
  let vy = 12;
  for (let i = 0; i < 30; i++) {
    const v = reflectAndEscape(vx, vy, i % 2 ? 1 : -1, 0, i + 1);
    vx = v.vx;
    vy = v.vy;
  }
  assert.ok(Math.hypot(vx, vy) <= incoming + 1e-6);
  const capped = clampSpeed(900, 200, 320);
  assert.ok(Math.hypot(capped.vx, capped.vy) <= 320 + 1e-6);
});

test("three left-right bounces force a new heading", () => {
  const first = reflectAndEscape(220, 8, 1, 0, PINGPONG_LIMIT);
  assert.ok(Math.abs(first.vy) > 80, "must pick up the open axis");
  assert.ok(Math.hypot(first.vx, first.vy) > 200);
});

test("a ball in a one-cell gap cannot stay in a horizontal loop", () => {
  const left = { x: 0, y: 0, w: 30, h: 100 };
  const right = { x: 48, y: 0, w: 30, h: 100 };
  const ball = { x: 39, y: 50, r: 7, vx: 220, vy: 3, trapAxis: "", trapHits: 0 };
  let flippedY = false;
  for (let i = 0; i < 40; i++) {
    ball.x += ball.vx * 0.016;
    ball.y += ball.vy * 0.016;
    bounceCircleRect(ball, left, 220);
    bounceCircleRect(ball, right, 220);
    if (Math.abs(ball.vy) > 40) flippedY = true;
  }
  assert.equal(flippedY, true);
  assert.ok(Math.hypot(ball.vx, ball.vy) <= 220 + 1e-6);
});

test("world-edge ping-pong also breaks after a few hits", () => {
  const ball = { x: 7, y: 80, r: 7, vx: -180, vy: 6, trapAxis: "", trapHits: 0 };
  resetTrap(ball);
  let escaped = false;
  for (let i = 0; i < 6; i++) {
    if (ball.vx < 0) {
      ball.x = 6;
      bounceWorldEdge(ball, 900, 1100);
    } else {
      ball.x = 894;
      bounceWorldEdge(ball, 900, 1100);
    }
    if (Math.abs(ball.vy) > 50) escaped = true;
  }
  assert.equal(escaped, true);
});
