import test from "node:test";
import assert from "node:assert/strict";
import {
  POWER_TYPES,
  RESOURCE_COLORS,
  RESOURCE_LABEL_COLOR,
  ballResourceScope,
  formatPaddleUnits,
  isBuffOperation,
  materializePower,
  multiplyCloneAngles,
  pickDivideKeep,
  pickPower,
  pickSubtractNear,
  resourceColor,
  resourceLabel,
  targetBallCount,
  targetPaddleWidth,
} from "./resources.js";
import { playField, paddleUnitPx } from "./walls.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

test("green and red increase, blue and purple decrease", () => {
  assert.equal(RESOURCE_COLORS.paddleUp, "#30d158");
  assert.equal(RESOURCE_COLORS.paddleDown, "#0a84ff");
  assert.equal(RESOURCE_COLORS.ballsUp, "#ff453a");
  assert.equal(RESOURCE_COLORS.ballsDown, "#bf5af2");
  const paddleUp = materializePower({ kind: "paddle", operation: "multiply", value: 2 });
  const paddleDown = materializePower({ kind: "paddle", operation: "divide", value: 2 });
  assert.equal(paddleUp.color, "#30d158");
  assert.equal(paddleDown.color, "#0a84ff");
  assert.ok(targetPaddleWidth(240, paddleUp, 120, 120, 900) > 240);
  assert.ok(targetPaddleWidth(240, paddleDown, 120, 120, 900) < 240);
});

test("labels stay numeric and the chip text color is the UI white", () => {
  assert.equal(resourceLabel("add", 2), "+2");
  assert.equal(resourceLabel("subtract", 3), "-3");
  assert.equal(resourceLabel("multiply", 5), "×5");
  assert.equal(resourceLabel("divide", 6), "÷6");
  assert.equal(resourceLabel("reset", 1), "♻️");
  assert.equal(RESOURCE_LABEL_COLOR, "#f5f5f7");
});

test("a reused pool item that still says +2 becomes a blue decrease with ÷ not +", () => {
  const pool = {
    active: false,
    kind: "balls",
    operation: "add",
    value: 2,
    label: "+2",
    color: "#ff453a",
    buff: true,
  };
  const spec = materializePower({ kind: "paddle", operation: "divide", value: 2 });
  Object.assign(pool, spec, { label: resourceLabel(spec.operation, spec.value) });
  assert.equal(pool.color, RESOURCE_COLORS.paddleDown);
  assert.equal(pool.label, "÷2");
  assert.equal(pool.label.startsWith("+"), false);
  assert.equal(resourceLabel(pool.operation, pool.value), "÷2");
});

test("no decrease resource is allowed to keep a plus sign", () => {
  for (const power of POWER_TYPES) {
    if (power.kind === "reset" || power.buff) continue;
    assert.equal(power.label.startsWith("+"), false, power.label);
    assert.match(power.label, /^[-÷]\d+$/u);
  }
  assert.equal(resourceLabel("subtract", 2), "-2");
  assert.equal(resourceLabel("divide", 2), "÷2");
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

test("red ball buffs never shrink the count even if few bricks remain", () => {
  const add = materializePower({ kind: "balls", operation: "add", value: 5 });
  const mul = materializePower({ kind: "balls", operation: "multiply", value: 2 });
  assert.equal(add.buff, true);
  assert.equal(add.color, RESOURCE_COLORS.ballsUp);
  assert.ok(targetBallCount(40, add, 128) > 40);
  assert.ok(targetBallCount(40, mul, 128) > 40);
  const js = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "game.js"), "utf8");
  assert.match(js, /spec\.buff/);
  assert.equal(js.includes("bricks.length"), true);
  assert.match(js, /applyBallResource/);
  assert.match(js, /cloneBallFrom/);
  assert.match(js, /pickSubtractNear/);
});

test("plus and minus stay at the paddle, times and divide hit every ball", () => {
  assert.equal(ballResourceScope("add"), "paddle");
  assert.equal(ballResourceScope("subtract"), "paddle");
  assert.equal(ballResourceScope("multiply"), "all");
  assert.equal(ballResourceScope("divide"), "all");
  const paddle = { x: 400, y: 1000, w: 120, h: 12 };
  const near = { x: 460, y: 990, held: false };
  const far = { x: 200, y: 80, held: false };
  const extra = { x: 430, y: 980, held: false };
  const balls = [far, near, extra];
  const cut = pickSubtractNear(balls, paddle, 5);
  assert.equal(cut.includes(far), false);
  assert.equal(cut.includes(near), true);
  assert.equal(cut.length, 2);
  const keep = pickDivideKeep(balls, 2);
  assert.equal(keep.length, 2);
  assert.equal(multiplyCloneAngles(1).length, 1);
  assert.equal(multiplyCloneAngles(3).length, 3);
});

test("HUD paddle units are brick widths, so the default tray is not 1", () => {
  const spec = { rows: 26, cols: 32, seed: 1042 };
  const field = playField({ w: 900, h: 1100, paddleY: 1042 }, spec);
  const unit = paddleUnitPx(field, spec);
  const start = formatPaddleUnits(120, unit);
  assert.ok(unit < 40, `1 unit should be one brick (${unit})`);
  assert.ok(start >= 3.5, `default paddle should be several bricks, got ${start}`);
  assert.notEqual(start, 1);
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
