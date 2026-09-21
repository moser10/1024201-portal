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

function scaleArt(lines, sx, sy) {
  const out = [];
  for (const line of lines) {
    const wide = [...line].map((ch) => ch.repeat(sx)).join("");
    for (let i = 0; i < sy; i++) out.push(wide);
  }
  return out;
}

function stamp(steel, art, r0, c0) {
  for (let r = 0; r < art.length; r++) {
    for (let c = 0; c < art[r].length; c++) {
      if (art[r][c] !== "#") continue;
      const rr = r0 + r;
      const cc = c0 + c;
      if (steel[rr]?.[cc] !== undefined) steel[rr][cc] = 1;
    }
  }
}

function paintRect(steel, r0, c0, h, w) {
  for (let r = r0; r < r0 + h; r++) {
    for (let c = c0; c < c0 + w; c++) {
      if (steel[r]?.[c] !== undefined) steel[r][c] = 1;
    }
  }
}

function paintFrame(steel, gapCols) {
  const R = steel.length;
  const C = steel[0].length;
  for (let r = 0; r < R; r++) {
    steel[r][0] = 1;
    steel[r][C - 1] = 1;
  }
  for (let c = 0; c < C; c++) {
    steel[0][c] = 1;
    steel[R - 1][c] = 1;
  }
  const g0 = Math.floor((C - gapCols) / 2);
  for (let c = g0; c < g0 + gapCols; c++) steel[R - 1][c] = 0;
}

function paintLetter(steel, letter, variant = 1) {
  const art = letter === "M" && variant === 2 ? LETTER_ART_M2 : LETTER_ART[letter];
  const scaled = scaleArt(art, 1, 1);
  const r0 = Math.max(1, Math.floor((steel.length - scaled.length) / 2));
  const c0 = Math.max(1, Math.floor((steel[0].length - scaled[0].length) / 2));
  stamp(steel, scaled, r0, c0);
}

function paintMotif(steel, motif, index) {
  const R = steel.length;
  const C = steel[0].length;
  const midC = Math.floor(C / 2);
  const midR = Math.floor(R / 2);
  switch (motif) {
    case "chute":
      paintRect(steel, 2, midC - 3, R - 5, 2);
      paintRect(steel, 2, midC + 1, R - 5, 2);
      paintRect(steel, 2, midC - 3, 2, 6);
      break;
    case "hcross":
      paintRect(steel, midR - 1, 6, 2, C - 12);
      paintRect(steel, 4, midC - 1, R - 7, 2);
      paintRect(steel, midR - 4, 8, 2, 6);
      paintRect(steel, midR - 4, C - 14, 2, 6);
      break;
    case "arrow":
      paintRect(steel, 5, midC - 1, R - 8, 2);
      paintRect(steel, 4, midC - 6, 2, 12);
      paintRect(steel, 3, midC - 4, 2, 8);
      break;
    case "towers":
      paintRect(steel, 3, midC - 7, R - 6, 3);
      paintRect(steel, 3, midC + 4, R - 6, 3);
      paintRect(steel, 3, midC - 7, 2, 5);
      paintRect(steel, 3, midC + 2, 2, 5);
      break;
    case "nested":
      paintRect(steel, 2, 2, 1, C - 4);
      paintRect(steel, 2, 2, R - 4, 1);
      paintRect(steel, 2, C - 3, R - 4, 1);
      paintRect(steel, R - 3, 2, 1, 10);
      paintRect(steel, R - 3, C - 12, 1, 10);
      break;
    case "plus":
      paintRect(steel, midR - 1, 5, 2, C - 10);
      paintRect(steel, 5, midC - 1, R - 8, 2);
      break;
    case "split":
      paintRect(steel, 1, midC - 1, R - 2, 2);
      break;
    case "twincol":
      paintRect(steel, 1, Math.floor(C / 3), R - 2, 2);
      paintRect(steel, 1, Math.floor((2 * C) / 3), R - 2, 2);
      break;
    case "funnel":
      for (let i = 0; i < 7; i++) {
        paintRect(steel, 3 + i, 4 + i, 1, C - 8 - i * 2);
      }
      paintRect(steel, 10, midC - 1, R - 12, 2);
      break;
    case "doubleframe":
      paintRect(steel, 2, 2, 1, C - 4);
      paintRect(steel, R - 3, 2, 1, C - 4);
      paintRect(steel, 2, 2, R - 4, 1);
      paintRect(steel, 2, C - 3, R - 4, 1);
      steel[R - 3][midC] = 0;
      steel[R - 3][midC - 1] = 0;
      steel[R - 3][midC + 1] = 0;
      break;
    case "slats":
      for (let i = 0; i < 4; i++) paintRect(steel, 3, 4 + i * 7, R - 6, 2);
      break;
    case "archchute":
      paintRect(steel, 4, 6, 2, C - 12);
      paintRect(steel, 4, midC - 1, R - 7, 2);
      break;
    case "tjunc":
      paintRect(steel, 2, midC - 1, R - 4, 2);
      paintRect(steel, midR, 4, 2, midC - 4);
      break;
    case "slash":
      for (let i = 0; i < 14; i++) paintRect(steel, 3 + i, 4 + i, 2, 3);
      for (let i = 0; i < 12; i++) paintRect(steel, 4 + i, 8 + i, 2, 3);
      break;
    case "halves":
      paintRect(steel, 1, midC - 1, R - 2, 2);
      paintRect(steel, 1, 1, 1, C - 2);
      break;
    default:
      paintRect(steel, 4, 4, 2, C - 8);
  }
}

/**
 * Dense brick seas with interior steel cutouts (ptmp language, remixed).
 */
export const LEVEL_BLUEPRINTS = [
  { motif: "chute" },
  { letter: "P" },
  { letter: "R" },
  { motif: "hcross" },
  { letter: "I" },
  { motif: "arrow" },
  { letter: "M", letterVariant: 1 },
  { motif: "towers" },
  { motif: "nested" },
  { motif: "plus" },
  { letter: "E" },
  { motif: "split" },
  { letter: "N" },
  { motif: "twincol" },
  { motif: "funnel" },
  { motif: "doubleframe" },
  { letter: "U" },
  { motif: "slats" },
  { letter: "M", letterVariant: 2 },
  { motif: "archchute" },
  { motif: "tjunc" },
  { motif: "slash" },
  { letter: "B" },
  { motif: "halves" },
];

export function buildSteelGrid(index) {
  const bp = LEVEL_BLUEPRINTS[index];
  if (!bp) throw new RangeError(`Unknown level ${index + 1}`);
  const steel = zeros();
  const gap = 6 + (index % 4);
  paintFrame(steel, gap);
  if (bp.letter) paintLetter(steel, bp.letter, bp.letterVariant || 1);
  else paintMotif(steel, bp.motif, index);
  return steel;
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
  const steel = buildSteelGrid(index);
  const mask = steel.map((row) => row.map((cell) => (cell ? 0 : 1)));
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
