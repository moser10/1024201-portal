import test from "node:test";
import assert from "node:assert/strict";
import { LEVEL_BLUEPRINTS, levelSignature, mazeEntryPath, mazeRingPlan } from "./levels.js";

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

test("level one entrances form a short diagonal instead of a disconnected jump", () => {
  const path = mazeEntryPath(0);
  const route = [...path.ringCenters, ...path.deflectorCenters].map((value) => value * path.direction);
  for (let i = 1; i < route.length; i++) {
    assert.ok(route[i] > route[i - 1], "entry route should keep moving in one direction");
    assert.ok(route[i] - route[i - 1] <= 52.01, "adjacent entrances should remain reachable");
  }
});

test("all levels keep ring and lower-wall entrances on one readable diagonal", () => {
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const path = mazeEntryPath(index);
    const route = [...path.ringCenters, ...path.deflectorCenters].map((value) => value * path.direction);
    for (let i = 1; i < route.length; i++) {
      assert.ok(route[i] > route[i - 1], `level ${index + 1} route should be monotonic`);
      assert.ok(route[i] - route[i - 1] <= 52.01, `level ${index + 1} opening gap is too large`);
    }
  }
});

test("every ring has a matching bottom entrance on the diagonal", () => {
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const { ringCount } = mazeRingPlan(index);
    const path = mazeEntryPath(index);
    assert.equal(path.ringCenters.length, ringCount, `level ${index + 1} missing ring gates`);
  }
});
