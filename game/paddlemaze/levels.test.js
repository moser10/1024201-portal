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

test("maps are dense brick seas with steel cutouts", () => {
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const spec = buildLevelSpec(index);
    const total = spec.rows * spec.cols;
    const bricks = spec.mask.flat().filter(Boolean).length;
    const steel = spec.steel.flat().filter(Boolean).length;
    assert.ok(bricks / total >= 0.30, `level ${index + 1} is too sparse (${bricks}/${total})`);
    assert.ok(steel >= 40, `level ${index + 1} has too little steel`);
    for (let r = 0; r < spec.rows; r++) {
      for (let c = 0; c < spec.cols; c++) {
        assert.equal(spec.mask[r][c] + spec.steel[r][c] <= 1, true, "brick and steel overlap");
      }
    }
  }
});

test("prime stages spell PRIMENUMB with steel glyphs in the brick field", () => {
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
    assert.equal(spec.letter, PRIME_LETTER_STAGES[index + 1] || null);
  }
  for (const [stage, letter] of Object.entries(PRIME_LETTER_STAGES)) {
    const spec = buildLevelSpec(Number(stage) - 1);
    const steel = spec.steel.flat().filter(Boolean).length;
    assert.ok(steel >= 50, `letter ${letter} steel is too thin`);
  }
});

test("every stage has a unique steel wall layout", () => {
  const signatures = new Set(LEVEL_BLUEPRINTS.map((_, index) => wallSignature(index)));
  assert.equal(signatures.size, 24);
});

test("every stage keeps a paddle-facing gate in the lower apron", () => {
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const gap = bottomGateWidth(index);
    assert.ok(gap >= 32, `level ${index + 1} bottom gate is ${gap}px`);
    assert.ok(gap < 160, `level ${index + 1} mouth is too wide (${gap}px)`);
  }
});

test("level two hides a long interior run behind a tight mouth", () => {
  const spec = buildLevelSpec(1);
  const last = spec.steel[spec.rows - 1];
  const mouth = last.filter((cell) => cell === 0).length;
  assert.ok(mouth <= 4, `level 2 outer mouth is ${mouth} cells`);
  const plugRow = spec.rows - 2;
  for (let c = 0; c < spec.cols; c++) {
    if (last[c] !== 0) continue;
    assert.equal(spec.mask[spec.rows - 1][c], 1, "outer notch should be bricks, not an air cave");
    assert.equal(spec.mask[plugRow][c], 1, "outer slit should stay bricked on the next row");
    assert.equal(spec.steel[plugRow][c], 0, "outer slit must not open a steel cave on the edge");
  }
  let airDeep = 0;
  let airInterior = 0;
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      const air = !spec.mask[r][c] && !spec.steel[r][c];
      if (!air) continue;
      if (r < Math.floor(spec.rows / 2)) airDeep++;
      if (r < spec.rows - 2 && c > 0 && c < spec.cols - 1) airInterior++;
    }
  }
  assert.ok(airDeep >= 8, "level 2 should keep an air channel in the upper field");
  assert.ok(airInterior >= 40, `level 2 interior run is too short (${airInterior} air cells)`);
});

test("no stage exposes a two-row cave in the outer bottom edge", () => {
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const spec = buildLevelSpec(index);
    const last = spec.steel[spec.rows - 1];
    const slit = last.filter((cell) => cell === 0).length;
    assert.ok(slit <= 4, `level ${index + 1} outer slit is ${slit} cells`);
    for (let c = 0; c < spec.cols; c++) {
      if (last[c] !== 0) continue;
      assert.equal(
        spec.mask[spec.rows - 1][c],
        1,
        `level ${index + 1} still leaves an air cave in the outer frame`,
      );
      assert.equal(
        spec.mask[spec.rows - 2][c],
        1,
        `level ${index + 1} still opens the cave through the brick apron`,
      );
    }
  }
});
