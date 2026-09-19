import test from "node:test";
import assert from "node:assert/strict";
import { LEVEL_BLUEPRINTS, levelSignature, mazeRingPlan } from "./levels.js";

test("all 24 maze blueprints remain unique", () => {
  const signatures = new Set(LEVEL_BLUEPRINTS.map((_, index) => levelSignature(index)));
  assert.equal(signatures.size, 24);
});

test("opening count decreases as ring count increases", () => {
  const plans = LEVEL_BLUEPRINTS.map((_, index) => mazeRingPlan(index));
  const openings = new Map(plans.map((plan) => [plan.ringCount, plan.openingsPerRing]));
  assert.equal(openings.get(2), 2);
  assert.equal(openings.get(3), 1);
  assert.equal(openings.get(4), 1);
  assert.ok(openings.get(2) > openings.get(3));
  assert.ok(openings.get(3) >= openings.get(4));
});

test("pacing includes relief after hard four-ring stages", () => {
  const ringCounts = LEVEL_BLUEPRINTS.map((_, index) => mazeRingPlan(index).ringCount);
  assert.ok(ringCounts.includes(2) && ringCounts.includes(3) && ringCounts.includes(4));
  assert.ok(ringCounts.some((rings, index) => rings === 4 && ringCounts[index + 1] === 2));
});
