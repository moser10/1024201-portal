import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_BLUEPRINTS,
  PRIME_LETTER_STAGES,
  buildLevelSpec,
  levelSignature,
} from "./levels.js";
import { bottomGateWidth, wallSignature, playField, DEFAULT_BOARD, cellMetrics, edgeGutters } from "./walls.js";

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

test("every stage hides a long interior run behind a tight recessed mouth", () => {
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const spec = buildLevelSpec(index);
    const last = spec.steel[spec.rows - 1];
    const mouth = last.filter((cell) => cell === 0).length;
    assert.ok(mouth <= 4, `level ${index + 1} outer mouth is ${mouth} cells`);
    const plugRow = spec.rows - 2;
    for (let c = 0; c < spec.cols; c++) {
      if (last[c] !== 0) continue;
      assert.equal(spec.mask[spec.rows - 1][c], 1, `level ${index + 1} outer notch should be bricks`);
      assert.equal(spec.mask[plugRow][c], 1, `level ${index + 1} apron should stay bricked`);
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
    assert.ok(airDeep >= 8, `level ${index + 1} has no upper-field channel (${airDeep})`);
    assert.ok(airInterior >= 50, `level ${index + 1} interior run is too short (${airInterior} air cells)`);
  }
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

test("each stage rolls independent 1-4 cell gutters on top/left/right and keeps a taller bottom apron", () => {
  const gutters = [];
  const flies = [];
  for (let index = 0; index < LEVEL_BLUEPRINTS.length; index++) {
    const spec = buildLevelSpec(index);
    assert.equal(spec.rows, 26);
    assert.equal(spec.cols, 32);
    const g = edgeGutters(spec);
    assert.ok(g.left >= 1 && g.left <= 4, `level ${index + 1} left ${g.left}`);
    assert.ok(g.right >= 1 && g.right <= 4, `level ${index + 1} right ${g.right}`);
    assert.ok(g.top >= 1 && g.top <= 4, `level ${index + 1} top ${g.top}`);
    assert.equal(g.bottomRows, 4);
    gutters.push(`${g.left}:${g.right}:${g.top}`);
    const field = playField(DEFAULT_BOARD, spec);
    const { brickW, brickH } = cellMetrics(field, spec);
    const unit = field.w / spec.cols;
    assert.ok(Math.abs(field.x - g.left * unit) < unit * 0.4, `left px ${field.x}`);
    const right = DEFAULT_BOARD.w - field.x - field.w;
    assert.ok(Math.abs(right - g.right * unit) < unit * 0.4, `right px ${right}`);
    assert.ok(Math.abs(field.y - g.top * unit) < unit * 0.4, `top px ${field.y}`);
    const fly = DEFAULT_BOARD.paddleY - (field.y + field.h);
    flies.push(fly);
    assert.ok(fly >= 128 + 3 * brickH, `bottom apron too tight (${fly}px)`);
  }
  assert.ok(new Set(gutters).size >= 12, "outer gutters should vary across stages");
  assert.ok(Math.max(...flies) - Math.min(...flies) < 80, "bottom apron should stay fixed-ish");
});
