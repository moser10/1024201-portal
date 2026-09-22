import { buildLevelSpec } from "./levels.js";

export const DEFAULT_BOARD = Object.freeze({ w: 900, h: 1100, paddleY: 1042 });

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Top/left/right: independent 1–4 cells. Bottom: fixed 4-row reaction apron. */
export function edgeGutters(spec = { seed: 1042 }) {
  const rng = mulberry32(Number(spec.seed) || 1042);
  const roll = () => 1 + Math.floor(rng() * 4);
  return Object.freeze({ left: roll(), right: roll(), top: roll(), bottomRows: 4 });
}

export function playField(board = DEFAULT_BOARD, spec = { rows: 26, cols: 32, seed: 1042 }) {
  const g = edgeGutters(spec);
  const cols = spec.cols || 32;
  const cellW = board.w / (cols + g.left + g.right);
  const x = Math.round(g.left * cellW);
  const w = Math.round(cols * cellW);
  const y = Math.round(g.top * cellW);
  const bottom = Math.round(128 + g.bottomRows * cellW);
  const h = board.paddleY - bottom - y;
  return { x, y, w, h, gutters: g };
}

export const DEFAULT_FIELD = Object.freeze(playField());

function add(out, x, y, w, h, extra = {}) {
  if (w >= 2 && h >= 2) out.push({ x, y, w, h, ...extra });
}

export function wallRole(r, c, rows, cols) {
  if (r === 0) return "frame-top";
  if (r === rows - 1) return "frame-bottom";
  if (c === 0) return "frame-left";
  if (c === cols - 1) return "frame-right";
  return "interior";
}

export function cellMetrics(field, spec) {
  const gap = 2;
  const brickW = (field.w - gap * (spec.cols - 1)) / spec.cols;
  const brickH = (field.h - gap * (spec.rows - 1)) / spec.rows;
  return { gap, brickW, brickH };
}

/**
 * Steel cells sit in the same grid as bricks (ptmp: gray cutouts in a dense fill).
 */
export function buildWallRects(index, field, board = DEFAULT_BOARD) {
  const spec = buildLevelSpec(index);
  const used = field || playField(board, spec);
  const { gap, brickW, brickH } = cellMetrics(used, spec);
  const out = [];
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      if (!spec.steel[r][c]) continue;
      add(
        out,
        used.x + c * (brickW + gap),
        used.y + r * (brickH + gap),
        brickW,
        brickH,
        { r, c, role: wallRole(r, c, spec.rows, spec.cols) },
      );
    }
  }
  return out;
}

function longestOpenRun(walls, y, x0, x1) {
  let best = 0;
  let run = 0;
  for (let x = x0; x < x1; x += 2) {
    const hit = walls.some((w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
    if (!hit) {
      run += 2;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

export function wallSignature(index, board = DEFAULT_BOARD) {
  const spec = buildLevelSpec(index);
  const field = playField(board, spec);
  return JSON.stringify(buildWallRects(index, field, board).map((r) => [
    Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h),
  ]));
}

export function bottomGateWidth(index, field, board = DEFAULT_BOARD) {
  const spec = buildLevelSpec(index);
  const used = field || playField(board, spec);
  const walls = buildWallRects(index, used, board);
  const { gap, brickH } = cellMetrics(used, spec);
  const y = used.y + spec.rows * (brickH + gap) - brickH / 2;
  return longestOpenRun(walls, y, used.x, used.x + used.w);
}
