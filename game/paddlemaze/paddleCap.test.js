import test from "node:test";
import assert from "node:assert/strict";
import {
  PADDLE_MAX_HOLD_SECONDS,
  createPaddleCapState,
  isPaddleAtMax,
  paddleCapClock,
  syncPaddleCap,
  tickPaddleCap,
} from "./paddleCap.js";

test("only a maxed paddle starts a 30s hold", () => {
  assert.equal(isPaddleAtMax(240, 900), false);
  assert.equal(isPaddleAtMax(900, 900), true);
  const state = createPaddleCapState();
  syncPaddleCap(state, 240, 900);
  assert.equal(state.remaining, 0);
  syncPaddleCap(state, 900, 900);
  assert.equal(state.remaining, PADDLE_MAX_HOLD_SECONDS);
});

test("another max pickup refreshes the 30s clock", () => {
  const state = createPaddleCapState();
  syncPaddleCap(state, 900, 900);
  tickPaddleCap(state, 12);
  assert.equal(state.remaining, 18);
  syncPaddleCap(state, 900, 900);
  assert.equal(state.remaining, 30);
});

test("leaving max or yellow reset cancels the clock", () => {
  const state = createPaddleCapState();
  syncPaddleCap(state, 900, 900);
  syncPaddleCap(state, 120, 900);
  assert.equal(state.remaining, 0);
  assert.equal(paddleCapClock(state), "");
});

test("expiry after 30s of unpaused time", () => {
  const state = createPaddleCapState();
  syncPaddleCap(state, 900, 900);
  assert.equal(tickPaddleCap(state, 29.5), false);
  assert.equal(paddleCapClock(state), "0:01");
  assert.equal(tickPaddleCap(state, 0.6), true);
  assert.equal(state.remaining, 0);
});
