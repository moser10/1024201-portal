import test from "node:test";
import assert from "node:assert/strict";
import {
  POWER_TYPES,
  RESOURCE_COLORS,
  RESOURCE_LABEL_COLOR,
  isBuffOperation,
  materializePower,
  pickPower,
  resourceColor,
  resourceLabel,
  targetBallCount,
  targetPaddleWidth,
} from "./resources.js";

const CJK = /[\u4e00-\u9fff]/;

test("increase resources are green or red and decrease resources are blue or purple", () => {
  for (const power of POWER_TYPES) {
    if (power.kind === "reset") {
      assert.equal(power.color, RESOURCE_COLORS.reset);
      assert.equal(power.label, "♻️");
      continue;
    }
    if (power.buff) {
      assert.ok(
        power.color === RESOURCE_COLORS.paddleUp || power.color === RESOURCE_COLORS.ballsUp,
        `${power.label} buff should be green or red`,
      );
      assert.match(power.label, /^[+×]\d+$/u);
    } else {
      assert.ok(
        power.color === RESOURCE_COLORS.paddleDown || power.color === RESOURCE_COLORS.ballsDown,
        `${power.label} debuff should be blue or purple`,
      );
      assert.match(power.label, /^[-÷]\d+$/u);
    }
    assert.equal(power.color, resourceColor(power.kind, power.operation));
    assert.ok(!CJK.test(power.label), power.label);
  }
});

test("eating a color always matches the numeric effect", () => {
  for (const power of POWER_TYPES) {
    const balls = targetBallCount(10, power, 128);
    const paddle = targetPaddleWidth(240, power, 120, 120, 900);
    if (power.kind === "balls" && power.buff) assert.ok(balls > 10, power.label);
    if (power.kind === "balls" && !power.buff && power.kind !== "reset") assert.ok(balls < 10, power.label);
    if (power.kind === "paddle" && power.buff) assert.ok(paddle > 240, power.label);
    if (power.kind === "paddle" && !power.buff) assert.ok(paddle < 240, power.label);
    if (power.color === RESOURCE_COLORS.ballsUp) assert.ok(balls > 10, "red must add balls");
    if (power.color === RESOURCE_COLORS.ballsDown) assert.ok(balls < 10, "purple must remove balls");
    if (power.color === RESOURCE_COLORS.paddleUp) assert.ok(paddle > 240, "green must widen paddle");
    if (power.color === RESOURCE_COLORS.paddleDown) assert.ok(paddle < 240, "blue must shrink paddle");
  }
});

test("labels stay numeric and the chip text color is the UI white", () => {
  assert.equal(resourceLabel("add", 2), "+2");
  assert.equal(resourceLabel("subtract", 3), "-3");
  assert.equal(resourceLabel("multiply", 5), "×5");
  assert.equal(resourceLabel("divide", 6), "÷6");
  assert.equal(resourceLabel("reset", 1), "♻️");
  assert.equal(RESOURCE_LABEL_COLOR, "#f5f5f7");
});

test("materializePower drops leftover pool fields and rebuilds color/label together", () => {
  const dirty = materializePower({
    kind: "balls",
    operation: "divide",
    value: 2,
    label: "球 ×20",
    color: "#ff453a",
    textColor: "#211b00",
  });
  assert.equal(dirty.label, "÷2");
  assert.equal(dirty.color, RESOURCE_COLORS.ballsDown);
  assert.equal(dirty.buff, false);
  assert.equal("textColor" in dirty, false);
});

test("ball additions, subtractions, multipliers and caps are calculated correctly", () => {
  assert.equal(targetBallCount(3, { kind: "balls", operation: "add", value: 5 }, 128), 8);
  assert.equal(targetBallCount(8, { kind: "balls", operation: "subtract", value: 3 }, 128), 5);
  assert.equal(targetBallCount(3, { kind: "balls", operation: "multiply", value: 20 }, 128), 60);
  assert.equal(targetBallCount(17, { kind: "balls", operation: "divide", value: 5 }, 128), 4);
  assert.equal(targetBallCount(1, { kind: "balls", operation: "divide", value: 20 }, 128), 1);
  assert.equal(targetBallCount(2, { kind: "balls", operation: "subtract", value: 20 }, 128), 1);
  assert.equal(targetBallCount(100, { kind: "balls", operation: "multiply", value: 20 }, 128), 128);
  assert.equal(targetBallCount(100, { kind: "balls", operation: "multiply", value: 20 }, 12), 12);
  assert.equal(targetBallCount(42, { kind: "reset" }, 128), 1);
});

test("paddle changes persist and reductions use the current width", () => {
  const divideByTwo = { kind: "paddle", operation: "divide", value: 2 };
  const multiplyByFour = { kind: "paddle", operation: "multiply", value: 4 };
  assert.equal(targetPaddleWidth(480, divideByTwo, 120, 120, 900), 240);
  assert.equal(targetPaddleWidth(120, divideByTwo, 120, 120, 900), 120);
  assert.equal(targetPaddleWidth(300, multiplyByFour, 120, 120, 900), 900);
  assert.equal(targetPaddleWidth(600, { kind: "reset" }, 120, 120, 900), 120);
});

test("weighted picker can select the rare reset resource", () => {
  const first = pickPower(() => 0);
  assert.equal(first.label, "×2");
  assert.equal(first.kind, "paddle");
  assert.equal(first.color, RESOURCE_COLORS.paddleUp);
  assert.equal(pickPower(() => 0.999999).kind, "reset");
  const reset = POWER_TYPES.find(({ kind }) => kind === "reset");
  const total = POWER_TYPES.reduce((sum, power) => sum + power.weight, 0);
  assert.ok(reset.weight / total < 0.01, "reset probability should remain below one percent");
});

test("ball multipliers are common and drought protection forces one", () => {
  const multiplierWeight = POWER_TYPES
    .filter((power) => power.kind === "balls" && power.operation === "multiply")
    .reduce((sum, power) => sum + power.weight, 0);
  const total = POWER_TYPES.reduce((sum, power) => sum + power.weight, 0);
  assert.ok(multiplierWeight / total > 0.5, "ball multipliers should exceed half of weighted outcomes");
  for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
    const power = pickPower(() => roll, { forceBallMultiplier: true });
    assert.equal(power.kind, "balls");
    assert.equal(power.operation, "multiply");
    assert.equal(power.color, RESOURCE_COLORS.ballsUp);
    assert.equal(isBuffOperation(power.operation), true);
  }
});
