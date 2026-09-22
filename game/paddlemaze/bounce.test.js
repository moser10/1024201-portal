import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_LEAVE,
  PINGPONG_LIMIT,
  bounceCircleRect,
  bounceWorldEdge,
  reflectAndEscape,
  resetTrap,
} from "./bounce.js";

test("grazing a wall leaves with a real normal speed instead of sliding", () => {
  const incoming = Math.hypot(2, 400);
  const v = reflectAndEscape(2, 400, 1, 0, 0);
  assert.ok(v.vx >= incoming * MIN_LEAVE - 1e-6);
  assert.ok(Math.abs(v.vy) > 200);
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
    bounceCircleRect(ball, left);
    bounceCircleRect(ball, right);
    if (Math.abs(ball.vy) > 40) flippedY = true;
  }
  assert.equal(flippedY, true);
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
