import test from "node:test";
import assert from "node:assert/strict";
import {
  POWER_TYPES,
  RESOURCE_COLORS,
  pickPower,
  targetBallCount,
  targetPaddleWidth,
} from "./resources.js";

test("each resource family uses its specified color", () => {
  for (const power of POWER_TYPES) {
    const expected =
      power.kind === "reset"
        ? RESOURCE_COLORS.reset
        : power.kind === "paddle"
          ? power.operation === "multiply" ? RESOURCE_COLORS.paddleUp : RESOURCE_COLORS.paddleDown
          : power.operation === "divide" ? RESOURCE_COLORS.ballsDown : RESOURCE_COLORS.ballsUp;
    assert.equal(power.color, expected, power.label);
  }
});

test("ball additions and requested multipliers are available", () => {
  const labels = new Set(POWER_TYPES.map(({ label }) => label));
  for (const label of ["球 +2", "球 +5", "球 ×2", "球 ×3", "球 ×5", "球 ×10", "球 ×20"]) {
    assert.ok(labels.has(label), `${label} should exist`);
  }
});

test("ball increases, proportional reductions, reset and cap are calculated correctly", () => {
  assert.equal(targetBallCount(3, { kind: "balls", operation: "add", value: 5 }, 128), 8);
  assert.equal(targetBallCount(3, { kind: "balls", operation: "multiply", value: 20 }, 128), 60);
  assert.equal(targetBallCount(17, { kind: "balls", operation: "divide", value: 5 }, 128), 4);
  assert.equal(targetBallCount(1, { kind: "balls", operation: "divide", value: 20 }, 128), 1);
  assert.equal(targetBallCount(100, { kind: "balls", operation: "multiply", value: 20 }, 128), 128);
  assert.equal(targetBallCount(42, { kind: "reset" }, 128), 1);
});

test("paddle changes persist and reductions use the current width", () => {
  const divideByTwo = { kind: "paddle", operation: "divide", value: 2 };
  const multiplyByFour = { kind: "paddle", operation: "multiply", value: 4 };
  assert.equal(targetPaddleWidth(480, divideByTwo, 120, 30, 900), 240);
  assert.equal(targetPaddleWidth(60, divideByTwo, 120, 30, 900), 30);
  assert.equal(targetPaddleWidth(300, multiplyByFour, 120, 30, 900), 900);
  assert.equal(targetPaddleWidth(600, { kind: "reset" }, 120, 30, 900), 120);
});

test("weighted picker can select the rare reset resource", () => {
  assert.equal(pickPower(() => 0).label, "托盘 ×2");
  assert.equal(pickPower(() => 0.999999).kind, "reset");
  const reset = POWER_TYPES.find(({ kind }) => kind === "reset");
  const total = POWER_TYPES.reduce((sum, power) => sum + power.weight, 0);
  assert.ok(reset.weight / total < 0.01, "reset probability should remain below one percent");
});
