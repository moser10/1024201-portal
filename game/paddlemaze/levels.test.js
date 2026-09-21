import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_BLUEPRINTS,
  PRIME_LETTER_STAGES,
  buildLevelSpec,
  levelSignature,
} from "./levels.js";
import { bottomGateWidth, wallSignature } from "./walls.js";

test("all 24 maze blueprints remain unique", () => {
  const signatures = new Set(LEVEL_BLUEPRINTS.map((_, index) => levelSignature(index)));
  assert.equal(signatures.size, 24);
});

test("past procedural maps are gone: every stage has an explicit letter or motif", () => {
  for (const [index, bp] of LEVEL_BLUEPRINTS.entries()) {
    assert.equal("shape" in bp, false, `level ${index + 1} still has a procedural shape id`);
    assert.ok(bp.letter || bp.motif, `level ${index + 1} missing brick art`);
  }
});

test("prime stages spell PRIMENUMB with one uppercase letter each", () => {
  assert.deepEqual(PRIME_LETTER_STAGES, {
    2: "P",
    3: "R",
    5: "I",
    7: "M",
    11: "E",
    13: "N",
    17: "U",
    19: "M",
    23: "B",
  });
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const spec = buildLevelSpec(index);
    const expected = PRIME_LETTER_STAGES[index + 1] || null;
    assert.equal(spec.letter, expected);
    const bricks = spec.mask.flat().filter(Boolean).length;
    assert.ok(bricks >= 28, `level ${index + 1} is too empty`);
  }
});

test("letter masks keep a solid glyph rather than a filled rectangle", () => {
  for (const [stage, letter] of Object.entries(PRIME_LETTER_STAGES)) {
    const spec = buildLevelSpec(Number(stage) - 1);
    const total = spec.rows * spec.cols;
    const bricks = spec.mask.flat().filter(Boolean).length;
    assert.ok(bricks < total * 0.72, `letter ${letter} is too close to a solid block`);
    const mid = spec.mask[Math.floor(spec.rows / 2)];
    const gaps = mid.filter((cell) => cell === 0).length;
    if (letter !== "I") assert.ok(gaps >= 2, `letter ${letter} mid-row has no negative space`);
  }
});

test("every stage has a unique steel wall layout", () => {
  const signatures = new Set(LEVEL_BLUEPRINTS.map((_, index) => wallSignature(index)));
  assert.equal(signatures.size, 24);
});

test("every stage keeps a paddle-facing gate in the lower apron", () => {
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const gap = bottomGateWidth(index);
    assert.ok(gap >= 70, `level ${index + 1} bottom gate is ${gap}px`);
    assert.ok(gap < 500, `level ${index + 1} apron is too open to read as a map`);
  }
});
