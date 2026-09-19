import test from "node:test";
import assert from "node:assert/strict";
import {
  WELFARE_INTERVALS,
  createWelfareState,
  noteWelfareBrickHit,
  pickWelfarePower,
  tickWelfare,
  welfareInterval,
} from "./welfare.js";

test("first unanswered wait is two minutes and may drop a paddle buff", () => {
  const state = createWelfareState();
  assert.equal(welfareInterval(state), 120);
  assert.equal(tickWelfare(state, 119.9), null);
  const drop = tickWelfare(state, 0.2);
  assert.equal(drop.kind, "paddle");
  assert.equal(drop.consecutiveDrops, 1);
  assert.equal(state.elapsed, 0);
  assert.equal(welfareInterval(state), 120);
});

test("second unanswered drop must be a ball buff and then wait becomes 90s", () => {
  const state = createWelfareState();
  assert.equal(tickWelfare(state, 120).kind, "paddle");
  const drop = tickWelfare(state, 120);
  assert.equal(drop.kind, "balls");
  assert.equal(drop.consecutiveDrops, 2);
  assert.equal(welfareInterval(state), 90);
  assert.deepEqual(WELFARE_INTERVALS, [120, 90, 60]);
});

test("a third unanswered cycle shortens to 60s", () => {
  const state = createWelfareState();
  tickWelfare(state, 120);
  tickWelfare(state, 120);
  const drop = tickWelfare(state, 90);
  assert.equal(drop.kind, "balls");
  assert.equal(welfareInterval(state), 60);
  assert.equal(tickWelfare(state, 59.9), null);
  assert.equal(tickWelfare(state, 0.2).kind, "balls");
  assert.equal(welfareInterval(state), 60);
});

test("hitting a brick after the first welfare resets the streak to two minutes", () => {
  const state = createWelfareState();
  tickWelfare(state, 120);
  tickWelfare(state, 40);
  noteWelfareBrickHit(state);
  assert.equal(state.consecutiveDrops, 0);
  assert.equal(state.elapsed, 0);
  assert.equal(welfareInterval(state), 120);
  assert.equal(tickWelfare(state, 119), null);
  assert.equal(tickWelfare(state, 2).kind, "paddle");
});

test("welfare picker only returns increase resources of the requested family", () => {
  for (const roll of [0, 0.2, 0.5, 0.8, 0.999]) {
    const paddle = pickWelfarePower("paddle", () => roll);
    assert.equal(paddle.kind, "paddle");
    assert.equal(paddle.operation, "multiply");
    const balls = pickWelfarePower("balls", () => roll);
    assert.equal(balls.kind, "balls");
    assert.ok(balls.operation === "multiply" || balls.operation === "add");
  }
});
