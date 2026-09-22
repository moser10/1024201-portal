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

const GRID_ROWS = 26;
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
  const doorChoices = [2, 5, C - 7, C - 4];
  const side = clampLaneCol(doorChoices[index % 4], C);
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

function paintLadder(steel, mask, r0, c0, h, w) {
  const r1 = r0 + h - 1;
  const c1 = c0 + w - 1;
  const mid = c0 + Math.floor(w / 2);
  for (let r = r0; r <= r1; r++) {
    setSteel(steel, mask, r, c0);
    setSteel(steel, mask, r, c1);
  }
  for (let r = r0 + 2; r < r1; r += 2) {
    for (let c = c0 + 1; c < c1; c++) {
      if (c === mid || c === mid - 1) {
        if (steel[r]) steel[r][c] = 0;
        setAir(mask, r, c);
      } else {
        setSteel(steel, mask, r, c);
      }
    }
  }
  for (let r = r0; r <= r1; r++) {
    for (let c = c0 + 1; c < c1; c++) {
      if (steel[r]?.[c]) continue;
      setAir(mask, r, c);
    }
  }
}

function paintChamber(steel, mask, r0, c0, h, w) {
  paintLadder(steel, mask, r0, c0, h, w);
}

function nonSteelComponents(steel, mask) {
  const R = steel.length;
  const C = steel[0].length;
  const seen = Array.from({ length: R }, () => Array(C).fill(0));
  const regions = [];
  const pass = (r, c) => r >= 0 && r < R && c >= 0 && c < C && !steel[r][c];
  let id = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (!pass(r, c) || seen[r][c]) continue;
      id += 1;
      const cells = [];
      let bricks = 0;
      let touchBottom = false;
      const stack = [[r, c]];
      seen[r][c] = id;
      while (stack.length) {
        const [y, x] = stack.pop();
        cells.push([y, x]);
        if (mask[y][x]) bricks += 1;
        if (y === R - 1) touchBottom = true;
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const yy = y + dy;
          const xx = x + dx;
          if (!pass(yy, xx) || seen[yy][xx]) continue;
          seen[yy][xx] = id;
          stack.push([yy, xx]);
        }
      }
      regions.push({ cells, bricks, air: cells.length - bricks, touchBottom });
    }
  }
  return regions;
}

function isFrameCell(r, c, rows, cols) {
  return r <= 0 || c <= 0 || r >= rows - 1 || c >= cols - 1;
}

function punchTunnel(steel, mask, fromCells, toCells) {
  const R = steel.length;
  const C = steel[0].length;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const fromAdj = [];
  const toAdj = new Set();
  for (const [r, c] of fromCells) {
    for (const [dr, dc] of dirs) {
      const rr = r + dr;
      const cc = c + dc;
      if (steel[rr]?.[cc] && !isFrameCell(rr, cc, R, C)) fromAdj.push(`${rr},${cc}`);
    }
  }
  for (const [r, c] of toCells) {
    for (const [dr, dc] of dirs) {
      const rr = r + dr;
      const cc = c + dc;
      if (steel[rr]?.[cc] && !isFrameCell(rr, cc, R, C)) toAdj.add(`${rr},${cc}`);
    }
  }
  const seen = new Map();
  const q = [];
  for (const key of fromAdj) {
    if (seen.has(key)) continue;
    seen.set(key, null);
    q.push(key);
  }
  let end = null;
  for (let i = 0; i < q.length; i++) {
    const key = q[i];
    if (toAdj.has(key)) {
      end = key;
      break;
    }
    const [r, c] = key.split(",").map(Number);
    for (const [dr, dc] of dirs) {
      const rr = r + dr;
      const cc = c + dc;
      const next = `${rr},${cc}`;
      if (!steel[rr]?.[cc] || isFrameCell(rr, cc, R, C) || seen.has(next)) continue;
      seen.set(next, key);
      q.push(next);
    }
  }
  const open = (r, c) => {
    if (!steel[r] || steel[r][c] === undefined || isFrameCell(r, c, R, C)) return;
    steel[r][c] = 0;
    mask[r][c] = 0;
  };
  if (!end) {
    for (const [r, c] of fromCells) {
      for (const [dr, dc] of dirs) {
        const rr = r + dr;
        const cc = c + dc;
        if (steel[rr]?.[cc] && !isFrameCell(rr, cc, R, C)) {
          open(rr, cc);
          open(rr + dr, cc + dc);
          return true;
        }
      }
    }
    return false;
  }
  for (let key = end; key; key = seen.get(key)) {
    const [r, c] = key.split(",").map(Number);
    open(r, c);
    for (const [dr, dc] of dirs) {
      if (steel[r + dr]?.[c + dc] && !isFrameCell(r + dr, c + dc, R, C)) {
        open(r + dr, c + dc);
        break;
      }
    }
  }
  return true;
}

/** Closed steel shapes become through-channels; sealed brick pockets get a door. */
function openSealedShapes(steel, mask) {
  for (let n = 0; n < 48; n++) {
    const regions = nonSteelComponents(steel, mask);
    const main = regions.find((region) => region.touchBottom) || regions[0];
    if (!main) return;
    const sealed = regions
      .filter((region) => region !== main)
      .sort((a, b) => a.cells.length - b.cells.length || a.cells[0][0] - b.cells[0][0] || a.cells[0][1] - b.cells[0][1]);
    if (!sealed.length) return;
    const pocket = sealed[0];
    if (pocket.cells.length <= 80) {
      for (const [r, c] of pocket.cells) {
        steel[r][c] = 0;
        mask[r][c] = 0;
      }
    }
    punchTunnel(steel, mask, pocket.cells, main.cells);
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

function paintPoly(steel, mask, pts, lane = 2) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, c0] = pts[i];
    const [r1, c1] = pts[i + 1];
    if (r0 === r1) hLane(steel, mask, c0, c1, r0, lane);
    else if (c0 === c1) vLane(steel, mask, r0, r1, c0, lane);
    else {
      const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
      dLane(steel, mask, r0, c0, steps + 1, Math.sign(r1 - r0) || 0, Math.sign(c1 - c0) || 0, lane);
    }
  }
}

function paintApproach(steel, mask, kind, index) {
  const { C, mouthC, mouthR, doorR } = recessedMouth(steel, mask, index);
  const left = 3 + (index % 3);
  const right = C - 6 - (index % 3);
  const top = 2 + (index % 2);

  switch (kind) {
    case "doubleloop":
      paintRectLoop(steel, mask, 3, 6, 14, 24);
      paintRectLoop(steel, mask, 6, 9, 11, 21);
      dLane(steel, mask, 11, 12, 5, -1, 1, 2);
      paintPoly(steel, mask, [[mouthR, mouthC], [14, mouthC], [14, 14]]);
      break;
    case "spiral3":
      paintRectLoop(steel, mask, 4, 7, 12, 23);
      paintPoly(steel, mask, [[12, 10], [8, 10], [8, 20], [mouthR, mouthC], [12, 7]]);
      break;
    case "switch4":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [12, left], [12, right],
        [8, right], [8, left], [5, left], [5, right - 3],
      ]);
      break;
    case "boxslash":
      paintChamber(steel, mask, 3, 12, 8, 11);
      paintPoly(steel, mask, [
        [mouthR, mouthC], [14, 4], [14, 4], [4, 18],
        [4, 24], [12, 24], [12, 16],
      ]);
      break;
    case "hookJ":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [mouthR, right], [top, right], [top, left],
        [12, left], [12, 16], [5, 16], [5, 10],
      ]);
      break;
    case "coil":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, left], [13, right], [4, right], [4, left],
        [10, left], [10, right - 4], [7, right - 4], [7, left + 4],
      ]);
      break;
    case "twinwell":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [mouthR, left], [4, left], [4, right],
        [12, right], [8, right], [8, left + 4], [12, 16],
      ]);
      break;
    case "ustem":
      paintChamber(steel, mask, 3, 10, 7, 12);
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, left], [13, right], [6, right], [6, left],
        [6, 14], [3, 14], [10, 14],
      ]);
      break;
    case "dogleg3":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, 6], [13, 22], [8, 22], [8, 6],
        [4, 6], [4, 18], [11, 18], [11, 12],
      ]);
      break;
    case "ringcut":
      paintChamber(steel, mask, 4, 11, 7, 10);
      paintRectLoop(steel, mask, 3, 6, 13, 24);
      dLane(steel, mask, 13, 6, 7, -1, 1, 2);
      paintPoly(steel, mask, [[mouthR, mouthC], [13, mouthC], [13, 12]]);
      break;
    case "stairs":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, 4], [13, 9], [10, 9], [10, 14],
        [7, 14], [7, 19], [4, 19], [4, 24], [4, 8],
      ]);
      break;
    case "serpentine":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [12, left], [12, right], [8, right],
        [8, left], [4, left], [4, right - 2], [14, 16],
      ]);
      break;
    case "gallery":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [14, left], [14, right], [11, right],
        [11, left], [8, left], [8, right], [5, right], [5, left + 2],
      ]);
      break;
    case "racetrack":
      paintChamber(steel, mask, 5, 10, 6, 12);
      paintRectLoop(steel, mask, 3, 5, 14, 25);
      paintPoly(steel, mask, [[mouthR, mouthC], [14, 12], [8, 12], [8, 18]]);
      break;
    case "insetU":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, left], [4, left], [4, right], [13, right],
        [10, right], [10, left + 3], [7, left + 3], [7, right - 3],
      ]);
      break;
    case "ribbon":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, 3], [3, 20], [13, 26], [6, 8], [6, 22],
      ]);
      break;
    case "well":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [4, mouthC], [4, left], [13, left],
        [13, right], [4, right], [8, right], [8, 12], [12, 12],
      ]);
      break;
    case "labyrinth":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [14, 5], [5, 5], [5, 12], [12, 12],
        [12, 20], [5, 20], [5, 25], [14, 25], [9, 16],
      ]);
      break;
    case "snakenest":
      paintRectLoop(steel, mask, 5, 9, 12, 21);
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, 6], [4, 6], [4, 24], [10, 14],
      ]);
      break;
    case "cornerbox":
      paintChamber(steel, mask, 2, 2, 9, 12);
      paintPoly(steel, mask, [
        [mouthR, mouthC], [mouthR, right], [3, right], [3, 16],
        [10, 16], [10, 4], [6, 4], [6, 10],
      ]);
      break;
    case "foldback":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [14, left], [14, right], [12, right],
        [12, left + 2], [9, left + 2], [9, right - 2], [6, right - 2],
        [6, left + 5], [3, left + 5], [3, 20],
      ]);
      break;
    case "helix":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [12, 5], [12, 14], [8, 14], [8, 5],
        [5, 5], [5, 22], [12, 22], [3, 22], [3, 10],
      ]);
      break;
    case "canal":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, 4], [4, 4], [4, 14],
        [13, 14], [13, 24], [4, 24], [8, 24], [8, 8],
      ]);
      break;
    case "meander":
      paintPoly(steel, mask, [
        [mouthR, mouthC], [13, 8], [9, 8], [9, 18], [5, 18],
        [5, 6], [13, 6], [13, 24], [3, 24], [3, 12], [8, 12],
      ]);
      break;
    default:
      paintPoly(steel, mask, [
        [mouthR, mouthC], [12, right], [4, right], [4, left], [10, left], [10, 16],
      ]);
  }
  innerPocket(steel, mask, doorR, mouthC, index);
}

const APPROACH = Object.freeze([
  "boxslash", "doubleloop", "hookJ", "ustem", "coil", "ribbon",
  "twinwell", "switch4", "spiral3", "canal", "dogleg3", "ringcut",
  "stairs", "gallery", "helix", "snakenest", "insetU", "well",
  "labyrinth", "cornerbox", "foldback", "serpentine", "racetrack", "meander",
]);

export const LEVEL_BLUEPRINTS = [
  { motif: "boxslash" },
  { letter: "P" },
  { letter: "R" },
  { motif: "ustem" },
  { letter: "I" },
  { motif: "ribbon" },
  { letter: "M", letterVariant: 1 },
  { motif: "switch4" },
  { motif: "spiral3" },
  { motif: "canal" },
  { letter: "E" },
  { motif: "ringcut" },
  { letter: "N" },
  { motif: "gallery" },
  { motif: "helix" },
  { motif: "snakenest" },
  { letter: "U" },
  { motif: "well" },
  { letter: "M", letterVariant: 2 },
  { motif: "cornerbox" },
  { motif: "foldback" },
  { motif: "serpentine" },
  { letter: "B" },
  { motif: "meander" },
];

export function buildSteelGrid(index) {
  const bp = LEVEL_BLUEPRINTS[index];
  if (!bp) throw new RangeError(`Unknown level ${index + 1}`);
  const steel = zeros();
  const mask = ones();
  paintSolidFrame(steel, mask);
  paintApproach(steel, mask, APPROACH[index], index);
  if (bp.letter) paintLetter(steel, mask, bp.letter, bp.letterVariant || 1);
  openSealedShapes(steel, mask);
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
