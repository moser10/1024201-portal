/**
 * 24 original brick layouts. Old procedural shape/cut maps are unused.
 * Prime stages 2,3,5,7,11,13,17,19,23 spell PRIMENUMB in uppercase bricks.
 */

export const PRIME_LETTER_STAGES = Object.freeze({
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

const LETTER_ART = Object.freeze({
  P: [
    "###########....",
    "##.......##....",
    "##.......##....",
    "###########....",
    "##.............",
    "##.............",
    "##.............",
    "##.............",
    "##.............",
  ],
  R: [
    "###########....",
    "##.......##....",
    "##.......##....",
    "###########....",
    "##..##.........",
    "##...##........",
    "##....##.......",
    "##.....##......",
    "##......##.....",
  ],
  I: [
    "...#########...",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    ".....#####.....",
    "...#########...",
  ],
  M: [
    "##.........##..",
    "###.......###..",
    "##.##...##.##..",
    "##..##.##..##..",
    "##...###...##..",
    "##....#....##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
  ],
  E: [
    "##############.",
    "##.............",
    "##.............",
    "###########....",
    "##.............",
    "##.............",
    "##.............",
    "##.............",
    "##############.",
  ],
  N: [
    "##.........##..",
    "###........##..",
    "##.##......##..",
    "##..##.....##..",
    "##...##....##..",
    "##....##...##..",
    "##.....##..##..",
    "##......##.##..",
    "##.......####..",
  ],
  U: [
    "##.........##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
    "##.........##..",
    ".##.......##...",
    "..#########....",
  ],
  B: [
    "############...",
    "##........##...",
    "##........##...",
    "############...",
    "##........##...",
    "##........##...",
    "##........##...",
    "##........##...",
    "############...",
  ],
});

/** Second M (stage 19): same letter, extra stem row so the mask is unique. */
const LETTER_ART_M2 = [
  ".##.........##.",
  ".###.......###.",
  ".##.##...##.##.",
  ".##..##.##..##.",
  ".##...###...##.",
  ".##....#....##.",
  ".##.........##.",
  ".##.........##.",
  ".##.........##.",
  ".##.........##.",
];

const GRID_ROWS = 22;
const GRID_COLS = 32;

function zeros(rows = GRID_ROWS, cols = GRID_COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function ones(rows = GRID_ROWS, cols = GRID_COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(1));
}

function scaleArt(lines, sx, sy) {
  const out = [];
  for (const line of lines) {
    const wide = [...line].map((ch) => ch.repeat(sx)).join("");
    for (let i = 0; i < sy; i++) out.push(wide);
  }
  return out;
}

function stampSteel(steel, mask, art, r0, c0) {
  for (let r = 0; r < art.length; r++) {
    for (let c = 0; c < art[r].length; c++) {
      if (art[r][c] !== "#") continue;
      const rr = r0 + r;
      const cc = c0 + c;
      if (steel[rr]?.[cc] === undefined) continue;
      steel[rr][cc] = 1;
      mask[rr][cc] = 0;
    }
  }
}

function setSteel(steel, mask, r, c) {
  if (steel[r]?.[c] === undefined) return;
  steel[r][c] = 1;
  mask[r][c] = 0;
}

function setAir(mask, r, c) {
  if (mask[r]?.[c] === undefined) return;
  mask[r][c] = 0;
}

function paintSolidFrame(steel, mask) {
  const R = steel.length;
  const C = steel[0].length;
  for (let r = 0; r < R; r++) {
    setSteel(steel, mask, r, 0);
    setSteel(steel, mask, r, C - 1);
  }
  for (let c = 0; c < C; c++) {
    setSteel(steel, mask, 0, c);
    setSteel(steel, mask, R - 1, c);
  }
}

function vLane(steel, mask, r0, r1, c, lane = 2) {
  const lo = Math.min(r0, r1);
  const hi = Math.max(r0, r1);
  for (let r = lo; r <= hi; r++) {
    for (let k = 0; k < lane; k++) setAir(mask, r, c + k);
    setSteel(steel, mask, r, c - 1);
    setSteel(steel, mask, r, c + lane);
  }
}

function hLane(steel, mask, c0, c1, r, lane = 2) {
  const lo = Math.min(c0, c1);
  const hi = Math.max(c0, c1);
  for (let c = lo; c <= hi; c++) {
    for (let k = 0; k < lane; k++) setAir(mask, r + k, c);
    setSteel(steel, mask, r - 1, c);
    setSteel(steel, mask, r + lane, c);
  }
}

function dLane(steel, mask, r0, c0, steps, dr, dc, lane = 2) {
  let r = r0;
  let c = c0;
  for (let i = 0; i < steps; i++) {
    for (let k = 0; k < lane; k++) setAir(mask, r, c + k);
    setSteel(steel, mask, r, c - 1);
    setSteel(steel, mask, r, c + lane);
    r += dr;
    c += dc;
  }
}

/** Brick-filled notch in the bottom steel. Not an air cave on the outer edge. */
function pinchGate(steel, mask, c, lane = 2) {
  const R = steel.length;
  for (let k = 0; k < lane; k++) {
    if (steel[R - 1]?.[c + k] !== undefined) {
      steel[R - 1][c + k] = 0;
      mask[R - 1][c + k] = 1;
    }
    if (steel[R - 2]?.[c + k] !== undefined) {
      steel[R - 2][c + k] = 0;
      mask[R - 2][c + k] = 1;
    }
  }
  setSteel(steel, mask, R - 2, c - 1);
  setSteel(steel, mask, R - 2, c + lane);
}

/** Interior corner door into a short vestibule that turns; no straight shaft. */
function innerPocket(steel, mask, doorR, mouthC, index) {
  const C = mask[0].length;
  const fromLeft = index % 2 === 0;
  const side = fromLeft ? 2 : C - 4;
  for (let col = 1; col < C - 1; col++) {
    setSteel(steel, mask, doorR, col);
    setSteel(steel, mask, doorR - 2, col);
  }
  const lo = Math.min(side, mouthC);
  const hi = Math.max(side + 1, mouthC + 1);
  for (let c = lo; c <= hi; c++) setAir(mask, doorR - 1, c);
  setSteel(steel, mask, doorR - 1, lo - 1);
  setSteel(steel, mask, doorR - 1, hi + 1);
  for (let k = 0; k < 2; k++) {
    if (steel[doorR]?.[side + k] === undefined) continue;
    steel[doorR][side + k] = 0;
    setAir(mask, doorR, side + k);
    if (steel[doorR - 2]?.[mouthC + k] === undefined) continue;
    steel[doorR - 2][mouthC + k] = 0;
    setAir(mask, doorR - 2, mouthC + k);
  }
}

function paintLetter(steel, mask, letter, variant = 1) {
  const art = letter === "M" && variant === 2 ? LETTER_ART_M2 : LETTER_ART[letter];
  const scaled = scaleArt(art, 1, 1);
  const r0 = 4;
  const c0 = Math.max(6, Math.floor((steel[0].length - scaled[0].length) / 2));
  stampSteel(steel, mask, scaled, r0, c0);
}

function paintChamber(steel, mask, r0, c0, h, w) {
  for (let r = r0; r < r0 + h; r++) {
    setSteel(steel, mask, r, c0);
    setSteel(steel, mask, r, c0 + w - 1);
  }
  for (let c = c0; c < c0 + w; c++) {
    setSteel(steel, mask, r0, c);
    setSteel(steel, mask, r0 + h - 1, c);
  }
}

function clampLaneCol(c, cols, lane = 2) {
  return Math.max(2, Math.min(cols - lane - 2, c));
}

function recessedMouth(steel, mask, index) {
  const R = steel.length;
  const C = steel[0].length;
  const slot = clampLaneCol(2 + ((index * 5 + 3) % 24), C);
  const mouthC = clampLaneCol(2 + ((index * 7 + 11) % 24), C);
  const doorR = R - 5;
  const mouthR = doorR - 2;
  pinchGate(steel, mask, slot, 2);
  return { R, C, slot, mouthC, mouthR, doorR };
}

function paintRectLoop(steel, mask, r0, c0, r1, c1, lane = 2) {
  hLane(steel, mask, c0, c1, r1, lane);
  vLane(steel, mask, r1, r0, c0, lane);
  hLane(steel, mask, c0, c1, r0, lane);
  vLane(steel, mask, r0, r1, c1, lane);
}

function feedTo(steel, mask, mouthC, mouthR, targetC, targetR) {
  hLane(steel, mask, mouthC, targetC, mouthR, 2);
  vLane(steel, mask, mouthR, targetR, targetC, 2);
}

function paintApproach(steel, mask, kind, index) {
  const { C, mouthC, mouthR, doorR } = recessedMouth(steel, mask, index);
  const boxC = 7 + (index % 5);
  const boxR = 3 + (index % 2);
  const boxW = 14;
  const boxH = 10;
  const c1 = Math.min(C - 4, boxC + boxW);
  const r1 = boxR + boxH;

  switch (kind) {
    case "doubleloop":
      paintRectLoop(steel, mask, 3, 6, 14, 24);
      paintRectLoop(steel, mask, 6, 9, 11, 21);
      dLane(steel, mask, 11, 12, 5, -1, 1, 2);
      feedTo(steel, mask, mouthC, mouthR, 14, 14);
      break;
    case "boxslash":
      paintChamber(steel, mask, boxR, boxC + 2, 8, 12);
      feedTo(steel, mask, mouthC, mouthR, clampLaneCol(boxC + 2, C), r1 - 1);
      dLane(steel, mask, r1 - 1, clampLaneCol(boxC + 2, C), 8, -1, 1, 2);
      break;
    case "coil":
      paintRectLoop(steel, mask, boxR, boxC, r1, c1);
      vLane(steel, mask, r1, boxR + 3, boxC + 4, 2);
      hLane(steel, mask, boxC + 4, c1 - 3, boxR + 3, 2);
      vLane(steel, mask, boxR + 3, r1 - 3, c1 - 3, 2);
      feedTo(steel, mask, mouthC, mouthR, clampLaneCol(boxC, C), r1);
      break;
    case "switchback":
      hLane(steel, mask, boxC, c1, mouthR, 2);
      vLane(steel, mask, mouthR, mouthR - 3, boxC, 2);
      hLane(steel, mask, boxC, c1, mouthR - 3, 2);
      vLane(steel, mask, mouthR - 3, mouthR - 6, c1, 2);
      hLane(steel, mask, c1, boxC, mouthR - 6, 2);
      vLane(steel, mask, mouthR - 6, boxR, boxC, 2);
      hLane(steel, mask, boxC, boxC + 8, boxR, 2);
      break;
    case "shaft":
      paintChamber(steel, mask, boxR, boxC + 4, 7, 9);
      feedTo(steel, mask, mouthC, mouthR, clampLaneCol(boxC + 6, C), r1);
      vLane(steel, mask, r1, boxR + 1, clampLaneCol(boxC + 6, C), 2);
      hLane(steel, mask, clampLaneCol(boxC + 6, C), boxC + 1, boxR + 1, 2);
      break;
    case "dogleg":
      feedTo(steel, mask, mouthC, mouthR, c1, r1);
      hLane(steel, mask, c1, boxC, r1, 2);
      vLane(steel, mask, r1, boxR, boxC, 2);
      hLane(steel, mask, boxC, boxC + 8, boxR, 2);
      vLane(steel, mask, boxR, boxR + 5, boxC + 8, 2);
      break;
    case "loop":
      paintRectLoop(steel, mask, boxR, boxC, r1, c1);
      dLane(steel, mask, r1, boxC, 6, -1, 1, 2);
      feedTo(steel, mask, mouthC, mouthR, clampLaneCol(boxC, C), r1);
      break;
    case "stem":
      paintChamber(steel, mask, boxR, boxC + 1, 6, 11);
      hLane(steel, mask, boxC, c1, mouthR, 2);
      vLane(steel, mask, mouthR, boxR + 6, boxC, 2);
      vLane(steel, mask, mouthR, boxR + 6, c1, 2);
      hLane(steel, mask, boxC, c1, boxR + 6, 2);
      vLane(steel, mask, boxR + 6, boxR + 1, clampLaneCol(boxC + 5, C), 2);
      break;
    case "twin":
      vLane(steel, mask, mouthR, boxR, boxC, 2);
      vLane(steel, mask, mouthR, boxR, c1, 2);
      hLane(steel, mask, boxC, c1, boxR, 2);
      hLane(steel, mask, mouthC, boxC, mouthR, 2);
      break;
    case "spiral":
      paintRectLoop(steel, mask, boxR, boxC, r1, c1);
      paintRectLoop(steel, mask, boxR + 3, boxC + 3, r1 - 3, c1 - 3);
      feedTo(steel, mask, mouthC, mouthR, clampLaneCol(boxC, C), r1);
      break;
    case "hook":
      feedTo(steel, mask, mouthC, mouthR, boxC, r1);
      vLane(steel, mask, r1, boxR, boxC, 2);
      hLane(steel, mask, boxC, c1, boxR, 2);
      vLane(steel, mask, boxR, boxR + 6, c1, 2);
      hLane(steel, mask, c1, boxC + 4, boxR + 6, 2);
      break;
    case "slashrun":
      paintChamber(steel, mask, boxR, boxC + 4, 8, 10);
      hLane(steel, mask, mouthC, boxC, mouthR, 2);
      dLane(steel, mask, mouthR, boxC, 10, -1, 1, 2);
      break;
    case "ring":
      paintRectLoop(steel, mask, boxR, boxC, r1, c1);
      paintChamber(steel, mask, boxR + 3, boxC + 3, 6, 8);
      dLane(steel, mask, r1, boxC, 5, -1, 1, 2);
      feedTo(steel, mask, mouthC, mouthR, clampLaneCol(c1, C), r1);
      break;
    default:
      feedTo(steel, mask, mouthC, mouthR, c1, boxR + 2);
      hLane(steel, mask, c1, boxC, boxR + 2, 2);
  }
  innerPocket(steel, mask, doorR, mouthC, index);
}

const APPROACH = Object.freeze([
  "boxslash", "doubleloop", "hook", "stem", "coil", "slashrun", "twin", "switchback",
  "spiral", "stem", "dogleg", "ring", "slashrun", "twin", "hook", "coil",
  "loop", "stem", "dogleg", "boxslash", "hook", "slashrun", "loop", "switchback",
]);

export const LEVEL_BLUEPRINTS = [
  { motif: "shaft" },
  { letter: "P" },
  { letter: "R" },
  { motif: "stem" },
  { letter: "I" },
  { motif: "slashrun" },
  { letter: "M", letterVariant: 1 },
  { motif: "twin" },
  { motif: "spiral" },
  { motif: "stem" },
  { letter: "E" },
  { motif: "shaft" },
  { letter: "N" },
  { motif: "twin" },
  { motif: "hook" },
  { motif: "spiral" },
  { letter: "U" },
  { motif: "stem" },
  { letter: "M", letterVariant: 2 },
  { motif: "shaft" },
  { motif: "hook" },
  { motif: "slashrun" },
  { letter: "B" },
  { motif: "loop" },
];

export function buildSteelGrid(index) {
  const bp = LEVEL_BLUEPRINTS[index];
  if (!bp) throw new RangeError(`Unknown level ${index + 1}`);
  const steel = zeros();
  const mask = ones();
  paintSolidFrame(steel, mask);
  paintApproach(steel, mask, APPROACH[index], index);
  if (bp.letter) paintLetter(steel, mask, bp.letter, bp.letterVariant || 1);
  return { steel, mask };
}

export function buildLevelSpec(index) {
  const bp = LEVEL_BLUEPRINTS[index];
  if (!bp) throw new RangeError(`Unknown level ${index + 1}`);
  const number = index + 1;
  const expectedLetter = PRIME_LETTER_STAGES[number] || null;
  if (expectedLetter && bp.letter !== expectedLetter) {
    throw new Error(`Level ${number} must be letter ${expectedLetter}`);
  }
  if (!expectedLetter && bp.letter) {
    throw new Error(`Level ${number} should not be a letter stage`);
  }
  const { steel, mask } = buildSteelGrid(index);
  return {
    rows: GRID_ROWS,
    cols: GRID_COLS,
    letter: bp.letter || null,
    motif: bp.motif || null,
    number,
    speed: Math.min(430, 300 + index * 5),
    seed: 1042 + number * 201,
    mask,
    steel,
  };
}

export function levelSignature(index) {
  const s = buildLevelSpec(index);
  return JSON.stringify({ rows: s.rows, cols: s.cols, mask: s.mask, steel: s.steel });
}
