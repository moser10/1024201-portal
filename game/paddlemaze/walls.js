import { buildLevelSpec } from "./levels.js";

export const DEFAULT_FIELD = Object.freeze({ x: 142, y: 190, w: 616, h: 430 });
export const DEFAULT_BOARD = Object.freeze({ w: 900, h: 1100, paddleY: 1042 });

function add(out, x, y, w, h) {
  if (w >= 2 && h >= 2) out.push({ x, y, w, h });
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
export function buildWallRects(index, field = DEFAULT_FIELD, board = DEFAULT_BOARD) {
  const spec = buildLevelSpec(index);
  const { gap, brickW, brickH } = cellMetrics(field, spec);
  const out = [];
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      if (!spec.steel[r][c]) continue;
      add(
        out,
        field.x + c * (brickW + gap),
        field.y + r * (brickH + gap),
        brickW,
        brickH,
      );
    }
  }
  return out;
}

function longestOpenRun(walls, y, boardW) {
  let best = 0;
  let run = 0;
  for (let x = 0; x < boardW; x += 2) {
    const hit = walls.some((w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
    if (!hit) {
      run += 2;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

export function wallSignature(index, field = DEFAULT_FIELD, board = DEFAULT_BOARD) {
  return JSON.stringify(buildWallRects(index, field, board).map((r) => [
    Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h),
  ]));
}

export function bottomGateWidth(index, field = DEFAULT_FIELD, board = DEFAULT_BOARD) {
  const spec = buildLevelSpec(index);
  const walls = buildWallRects(index, field, board);
  const { gap, brickH } = cellMetrics(field, spec);
  const y = field.y + spec.rows * (brickH + gap) - brickH / 2;
  return longestOpenRun(walls, y, board.w);
}
