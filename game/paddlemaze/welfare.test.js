import test from "node:test";
import assert from "node:assert/strict";
import {
  WELFARE_PHASES,
  createWelfareState,
  noteWelfareBrickHit,
  pickWelfarePower,
  tickWelfare,
  welfareInterval,
} from "./welfare.js";

function drainPhase(state, interval, firstKind, secondKind) {
  assert.equal(welfareInterval(state), interval);
  assert.equal(tickWelfare(state, interval - 0.01), null);
  assert.equal(tickWelfare(state, 0.02).kind, firstKind);
  assert.equal(tickWelfare(state, interval).kind, secondKind);
}

test("phase A is 120s random buff then 120s ball buff", () => {
  const state = createWelfareState();
  drainPhase(state, 120, "any", "balls");
  assert.equal(welfareInterval(state), 90);
});

test("phases shorten 90, 60, 30, 15, 10, then stay at 5s", () => {
  const state = createWelfareState();
  drainPhase(state, 120, "any", "balls");
  drainPhase(state, 90, "any", "balls");
  drainPhase(state, 60, "any", "balls");
  drainPhase(state, 30, "any", "balls");
  drainPhase(state, 15, "any", "balls");
  drainPhase(state, 10, "any", "balls");
  drainPhase(state, 5, "any", "balls");
  drainPhase(state, 5, "any", "balls");
  assert.deepEqual(WELFARE_PHASES, [120, 90, 60, 30, 15, 10, 5]);
});

test("hitting a brick from any phase returns to A", () => {
  const state = createWelfareState();
  drainPhase(state, 120, "any", "balls");
  drainPhase(state, 90, "any", "balls");
  tickWelfare(state, 20);
  noteWelfareBrickHit(state);
  assert.equal(state.phaseIndex, 0);
  assert.equal(state.stepInPhase, 0);
  assert.equal(state.elapsed, 0);
  assert.equal(welfareInterval(state), 120);
  assert.equal(tickWelfare(state, 120).kind, "any");
});

test("welfare picker only returns increase resources", () => {
  for (const roll of [0, 0.2, 0.5, 0.8, 0.999]) {
    const any = pickWelfarePower("any", () => roll);
    assert.equal(any.buff, true);
    const balls = pickWelfarePower("balls", () => roll);
    assert.equal(balls.kind, "balls");
    assert.equal(balls.buff, true);
  }
});
