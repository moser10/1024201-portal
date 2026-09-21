import { buildLevelSpec } from "./levels.js";

export const DEFAULT_FIELD = Object.freeze({ x: 142, y: 190, w: 616, h: 430 });
export const DEFAULT_BOARD = Object.freeze({ w: 900, h: 1100, paddleY: 1042 });

const MIN_GATE = 78;

function add(out, x, y, w, h) {
  if (w >= 3 && h >= 3) out.push({ x, y, w, h });
}

function hbar(out, x0, x1, y, t, gaps = []) {
  let cursor = x0;
  const sorted = [...gaps].sort((a, b) => a.x - b.x);
  for (const gap of sorted) {
    const left = Math.max(cursor, gap.x);
    const right = Math.min(x1, gap.x + gap.w);
    if (left > cursor) add(out, cursor, y, left - cursor, t);
    cursor = Math.max(cursor, right);
  }
  if (cursor < x1) add(out, cursor, y, x1 - cursor, t);
}

function vbar(out, y0, y1, x, t, gaps = []) {
  let cursor = y0;
  const sorted = [...gaps].sort((a, b) => a.y - b.y);
  for (const gap of sorted) {
    const top = Math.max(cursor, gap.y);
    const bottom = Math.min(y1, gap.y + gap.h);
    if (top > cursor) add(out, x, cursor, t, top - cursor);
    cursor = Math.max(cursor, bottom);
  }
  if (cursor < y1) add(out, x, cursor, t, y1 - cursor);
}

function merlons(out, x0, x1, y, t, count, toothH, skipCenter = false) {
  const span = x1 - x0;
  const tooth = span / (count * 2);
  for (let i = 0; i < count; i++) {
    if (skipCenter && i === Math.floor(count / 2)) continue;
    const x = x0 + i * 2 * tooth + tooth * 0.25;
    add(out, x, y - toothH, tooth * 1.1, toothH + t);
  }
}

function gateAt(field, t, frac, width = MIN_GATE) {
  const x = field.x + field.w * frac - width / 2;
  return { x: Math.max(field.x - 40, Math.min(field.x + field.w + 40 - width, x)), w: width };
}

/**
 * Hybrid ptmp-style steel: unique outer frame + motif-rhyming interior,
 * never a stack of identical concentric rectangles. Bottom gate always open.
 */
export function buildWallRects(index, field = DEFAULT_FIELD, board = DEFAULT_BOARD) {
  const spec = buildLevelSpec(index);
  const out = [];
  const t = 16;
  const pad = 26 + (index % 5) * 3;
  const left = field.x - pad;
  const right = field.x + field.w + pad;
  const top = field.y - pad;
  const bottom = field.y + field.h + pad;
  const key = spec.letter ? `letter-${spec.letter}-${spec.number}` : spec.motif;
  const builders = {
    fortress: wallsFortress,
    diamond: wallsDiamond,
    pyramid: wallsPyramid,
    nested: wallsNested,
    wave: wallsWave,
    plus: wallsPlus,
    honeycomb: wallsHoneycomb,
    stairs: wallsStairs,
    hourglass: wallsHourglass,
    tiles: wallsTiles,
    pillars: wallsPillars,
    arch: wallsArch,
    meander: wallsMeander,
    bowtie: wallsBowtie,
    islands: wallsIslands,
    "letter-P-2": wallsLetterP,
    "letter-R-3": wallsLetterR,
    "letter-I-5": wallsLetterI,
    "letter-M-7": wallsLetterM,
    "letter-E-11": wallsLetterE,
    "letter-N-13": wallsLetterN,
    "letter-U-17": wallsLetterU,
    "letter-M-19": wallsLetterMWide,
    "letter-B-23": wallsLetterB,
  };
  const ctx = { field, board, spec, t, pad, left, right, top, bottom };
  const build = builders[key];
  if (!build) throw new Error(`Missing wall recipe for ${key}`);
  build(out, ctx);
  ensureBottomApron(out, ctx, spec.number);
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

function ensureBottomApron(out, ctx, number) {
  const { field, board, t, bottom } = ctx;
  const frameY = bottom - t / 2;
  if (longestOpenRun(out, frameY, board.w) >= MIN_GATE && longestOpenRun(out, frameY, board.w) < board.w - 80) {
    return;
  }
  const y = field.y + field.h + 36;
  if (longestOpenRun(out, y, board.w) >= MIN_GATE && longestOpenRun(out, y, board.w) < board.w - 80) {
    return;
  }
  const frac = 0.28 + (number % 7) * 0.06;
  const g = gateAt(field, t, frac, MIN_GATE + 12);
  hbar(out, 40, board.w - 40, y, t, [g]);
}

function wallsFortress(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  merlons(out, left, right, top, t, 7, 18, true);
  hbar(out, left, right, top, t);
  vbar(out, top, bottom, left, t);
  vbar(out, top, bottom, right - t, t);
  const g = gateAt(field, t, 0.5, 86);
  hbar(out, left, right, bottom - t, t, [g]);
  add(out, left, top, 52, 52);
  add(out, right - 52, top, 52, 52);
  add(out, left, bottom - 52, 52, 36);
  add(out, right - 52, bottom - 52, 52, 36);
  hbar(out, 48, ctx.board.w - 48, bottom + 48, t, [{ x: g.x - 20, w: g.w + 40 }]);
}

function wallsDiamond(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left + 36, right - 36, top, t);
  vbar(out, top + 24, bottom - 24, left, t);
  vbar(out, top + 24, bottom - 24, right - t, t);
  add(out, left + 8, top + 8, 70, 18);
  add(out, left + 8, top + 8, 18, 70);
  add(out, right - 78, top + 8, 70, 18);
  add(out, right - 26, top + 8, 18, 70);
  add(out, left + 8, bottom - 26, 70, 18);
  add(out, left + 8, bottom - 78, 18, 70);
  add(out, right - 78, bottom - 26, 70, 18);
  add(out, right - 26, bottom - 78, 18, 70);
  const g = gateAt(field, t, 0.42, 80);
  hbar(out, left, right, bottom - t, t, [g]);
}

function wallsPyramid(out, ctx) {
  const { field, t, top, bottom, left, right } = ctx;
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const inset = 18 + i * 22;
    add(out, left + inset, top + i * 28, t, 36);
    add(out, right - inset - t, top + i * 28, t, 36);
  }
  hbar(out, left + 40, right - 40, top, t);
  const g = gateAt(field, t, 0.5, 90);
  hbar(out, left, right, bottom - t, t, [g]);
  add(out, field.x + 40, bottom + 8, field.w - 80, t);
  hbar(out, 40, ctx.board.w - 40, bottom + 56, t, [{ x: g.x, w: g.w }]);
}

function wallsNested(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left, right, top, t, [{ x: field.x + field.w * 0.62, w: 64 }]);
  vbar(out, top, bottom, left, t);
  vbar(out, top, bottom, right - t, t);
  const innerL = left + 34;
  const innerR = right - 34;
  const innerT = top + 34;
  const innerB = bottom - 34;
  hbar(out, innerL, innerR, innerT, t);
  vbar(out, innerT, innerB, innerL, t);
  vbar(out, innerT, innerB, innerR - t, t, [{ y: innerT + 80, h: 70 }]);
  const g = gateAt(field, t, 0.38, 82);
  hbar(out, innerL, innerR, innerB - t, t, [g]);
  hbar(out, left, right, bottom - t, t, [{ x: g.x - 12, w: g.w + 24 }]);
}

function wallsWave(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  const span = right - left;
  for (let i = 0; i < 8; i++) {
    const x = left + (span / 8) * i;
    const rise = 10 + Math.round((Math.sin(i * 0.95) + 1) * 12);
    add(out, x, top - rise, span / 8 - 3, rise + t);
  }
  vbar(out, top, bottom, left, t);
  vbar(out, top, bottom, right - t, t);
  const g = gateAt(field, t, 0.58, 84);
  hbar(out, left, right, bottom - t, t, [g]);
  add(out, left + 80, bottom + 36, 120, t);
  add(out, right - 200, bottom + 36, 120, t);
}

function wallsPlus(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left, right, top, t);
  vbar(out, top, bottom, left, t);
  vbar(out, top, bottom, right - t, t);
  const midY = (top + bottom) / 2;
  add(out, left - 28, midY - 18, 70, 36);
  add(out, right - 42, midY - 18, 70, 36);
  add(out, (left + right) / 2 - 18, top - 22, 36, 60);
  const g = gateAt(field, t, 0.5, 88);
  hbar(out, left, right, bottom - t, t, [g]);
  add(out, g.x - 26, bottom - 8, 16, 54);
  add(out, g.x + g.w + 10, bottom - 8, 16, 54);
}

function wallsHoneycomb(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left, right, top, t);
  const g = gateAt(field, t, 0.33, 80);
  hbar(out, left, right, bottom - t, t, [g]);
  for (let i = 0; i < 4; i++) {
    const y = top + 40 + i * 70;
    add(out, left, y, t, 40);
    add(out, right - t, y + 28, t, 40);
  }
  for (let i = 0; i < 3; i++) {
    add(out, field.x - 20, field.y + 40 + i * 110, 18, 48);
    add(out, field.x + field.w + 2, field.y + 80 + i * 110, 18, 48);
  }
}

function wallsStairs(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  for (let i = 0; i < 6; i++) {
    add(out, left + i * 28, top + i * 36, 90 - i * 8, t);
    add(out, right - 90 + i * 8 - i * 28, top + i * 36, 90 - i * 8, t);
  }
  vbar(out, top + 40, bottom, left, t);
  vbar(out, top + 40, bottom, right - t, t);
  const g = gateAt(field, t, 0.6, 82);
  hbar(out, left, right, bottom - t, t, [g]);
}

function wallsHourglass(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left, right, top, t);
  hbar(out, left, right, bottom - t, t, [gateAt(field, t, 0.5, 92)]);
  const mid = (top + bottom) / 2;
  add(out, left + 8, top + 12, t, 90);
  add(out, right - t - 8, top + 12, t, 90);
  add(out, left + 48, mid - 50, t, 100);
  add(out, right - t - 48, mid - 50, t, 100);
  add(out, left + 8, bottom - 102, t, 90);
  add(out, right - t - 8, bottom - 102, t, 90);
}

function wallsTiles(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left, right, top, t);
  vbar(out, top, bottom, left, t);
  vbar(out, top, bottom, right - t, t);
  const g = gateAt(field, t, 0.27, 80);
  hbar(out, left, right, bottom - t, t, [g]);
  for (const [x, y] of [
    [left + 22, top + 22],
    [right - 58, top + 22],
    [left + 22, bottom - 58],
    [right - 58, bottom - 58],
    [left + 22, (top + bottom) / 2],
    [right - 58, (top + bottom) / 2],
  ]) {
    add(out, x, y, 36, 36);
  }
}

function wallsPillars(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left, right, top, t);
  const g = gateAt(field, t, 0.48, 86);
  hbar(out, left, right, bottom - t, t, [g]);
  for (let i = 0; i < 5; i++) {
    add(out, left + i * 18, top + 20, 10, bottom - top - 40);
    add(out, right - 10 - i * 18, top + 20, 10, bottom - top - 40);
  }
}

function wallsArch(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  const mid = (left + right) / 2;
  for (let i = 0; i < 6; i++) {
    const drop = i * i * 3;
    add(out, mid - 40 - i * 42, top + drop, 36, t);
    add(out, mid + 4 + i * 42, top + drop, 36, t);
  }
  vbar(out, top + 40, bottom, left, t);
  vbar(out, top + 40, bottom, right - t, t);
  const g = gateAt(field, t, 0.5, 88);
  hbar(out, left, right, bottom - t, t, [g]);
}

function wallsMeander(out, ctx) {
  const { left, right, top, bottom, t, field, board } = ctx;
  hbar(out, left, right, top, t);
  vbar(out, top, bottom, left, t);
  vbar(out, top, bottom, right - t, t);
  const g = gateAt(field, t, 0.22, 80);
  hbar(out, left, right, bottom - t, t, [g]);
  add(out, 50, bottom + 28, g.x - 20, t);
  add(out, g.x + 30, bottom + 28, 180, t);
  add(out, g.x + 190, bottom + 28, t, 70);
  add(out, g.x + 190, bottom + 82, board.w - 80 - (g.x + 190), t);
  add(out, board.w - 96, bottom + 82, t, 70);
  hbar(out, 50, board.w - 50, bottom + 152, t, [{ x: board.w / 2 - 40, w: 90 }]);
}

function wallsBowtie(out, ctx) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left, right, top, t);
  hbar(out, left, right, bottom - t, t, [gateAt(field, t, 0.5, 84)]);
  for (let i = 0; i < 5; i++) {
    const inset = 8 + i * 16;
    const y = top + 24 + i * 48;
    add(out, left + inset, y, t, 40);
    add(out, right - t - inset, y, t, 40);
  }
}

function wallsIslands(out, ctx) {
  const { field, t, board } = ctx;
  add(out, 36, 36, 90, 90);
  add(out, board.w - 126, 36, 90, 90);
  add(out, 36, field.y + field.h + 40, 70, 70);
  add(out, board.w - 106, field.y + field.h + 40, 70, 70);
  add(out, field.x - 36, field.y + 30, 22, 120);
  add(out, field.x + field.w + 14, field.y + 180, 22, 120);
  const g = gateAt(field, t, 0.55, 96);
  hbar(out, 80, board.w - 80, field.y + field.h + 28, t, [g]);
}

function letterFrame(out, ctx, opts) {
  const { left, right, top, bottom, t, field } = ctx;
  hbar(out, left, right, top, t, opts.topGap ? [opts.topGap] : []);
  vbar(out, top, bottom, left, t, opts.leftGap ? [opts.leftGap] : []);
  vbar(out, top, bottom, right - t, t, opts.rightGap ? [opts.rightGap] : []);
  hbar(out, left, right, bottom - t, t, [opts.bottom]);
}

function wallsLetterP(out, ctx) {
  const { field, t, left, bottom } = ctx;
  letterFrame(out, ctx, { bottom: gateAt(field, t, 0.32, 82) });
  add(out, left - 18, ctx.top + 20, 22, 210);
  add(out, left - 18, ctx.top + 20, 120, 22);
  add(out, left + 80, ctx.top + 20, 22, 110);
  add(out, left - 18, ctx.top + 208, 120, 22);
  hbar(out, 44, ctx.board.w - 44, bottom + 44, t, [{ x: field.x + 40, w: 100 }]);
}

function wallsLetterR(out, ctx) {
  const { field, t, left, right, bottom } = ctx;
  letterFrame(out, ctx, { bottom: gateAt(field, t, 0.3, 80) });
  add(out, left - 18, ctx.top + 16, 22, 230);
  add(out, left - 18, ctx.top + 16, 130, 22);
  add(out, left + 90, ctx.top + 16, 22, 120);
  add(out, left - 18, ctx.top + 214, 130, 22);
  add(out, right - 90, bottom - 8, 18, 70);
  add(out, right - 160, bottom + 46, 90, 18);
}

function wallsLetterI(out, ctx) {
  const { field, t, left, right, top, bottom } = ctx;
  letterFrame(out, ctx, { bottom: gateAt(field, t, 0.5, 100) });
  add(out, left + 28, top + 30, 28, bottom - top - 60);
  add(out, right - 56, top + 30, 28, bottom - top - 60);
  add(out, left + 8, top + 24, 90, 20);
  add(out, right - 98, top + 24, 90, 20);
}

function wallsLetterM(out, ctx) {
  const { field, t, left, right, top, bottom } = ctx;
  letterFrame(out, ctx, { bottom: gateAt(field, t, 0.5, 88) });
  const ys = top + 18;
  const h = bottom - top - 50;
  add(out, left + 10, ys, 20, h);
  add(out, (left + right) / 2 - 10, ys, 20, h * 0.55);
  add(out, right - 30, ys, 20, h);
}

function wallsLetterE(out, ctx) {
  const { field, t, left, top, bottom } = ctx;
  letterFrame(out, ctx, { bottom: gateAt(field, t, 0.62, 82) });
  add(out, left - 20, top + 16, 24, bottom - top - 40);
  add(out, left - 20, top + 16, 110, 20);
  add(out, left - 20, (top + bottom) / 2 - 10, 90, 20);
  add(out, left - 20, bottom - 44, 110, 20);
}

function wallsLetterN(out, ctx) {
  const { field, t, left, right, top, bottom } = ctx;
  letterFrame(out, ctx, { bottom: gateAt(field, t, 0.45, 84) });
  add(out, left + 12, top + 20, 20, bottom - top - 50);
  add(out, right - 32, top + 20, 20, bottom - top - 50);
  add(out, left + 24, top + 40, 18, 36);
  add(out, left + 70, top + 110, 18, 36);
  add(out, left + 120, top + 180, 18, 36);
  add(out, left + 170, top + 250, 18, 36);
}

function wallsLetterU(out, ctx) {
  const { field, t, left, right, top, bottom } = ctx;
  vbar(out, top + 10, bottom, left, t);
  vbar(out, top + 10, bottom, right - t, t);
  hbar(out, left, right, bottom - t, t, [gateAt(field, t, 0.5, 90)]);
  add(out, left + 8, bottom - 8, 40, 48);
  add(out, right - 48, bottom - 8, 40, 48);
}

function wallsLetterMWide(out, ctx) {
  const { field, t, left, right, top, bottom } = ctx;
  letterFrame(out, ctx, { bottom: gateAt(field, t, 0.5, 92) });
  add(out, left + 4, top + 12, 26, bottom - top - 40);
  add(out, left + 70, top + 12, 22, (bottom - top) * 0.45);
  add(out, right - 96, top + 12, 22, (bottom - top) * 0.45);
  add(out, right - 30, top + 12, 26, bottom - top - 40);
  hbar(out, 40, ctx.board.w - 40, bottom + 40, t, [{ x: field.x + field.w / 2 - 50, w: 100 }]);
}

function wallsLetterB(out, ctx) {
  const { field, t, left, top, bottom } = ctx;
  letterFrame(out, ctx, { bottom: gateAt(field, t, 0.34, 80) });
  add(out, left - 18, top + 12, 22, bottom - top - 28);
  add(out, left - 18, top + 12, 100, 20);
  add(out, left + 60, top + 12, 20, 90);
  add(out, left - 18, top + 180, 100, 20);
  add(out, left + 60, top + 180, 20, 90);
  add(out, left - 18, bottom - 40, 100, 20);
}

export function wallSignature(index, field = DEFAULT_FIELD, board = DEFAULT_BOARD) {
  return JSON.stringify(buildWallRects(index, field, board).map((r) => [
    Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h),
  ]));
}

/** Longest open run along the first apron below the brick field. */
export function bottomGateWidth(index, field = DEFAULT_FIELD, board = DEFAULT_BOARD) {
  const walls = buildWallRects(index, field, board);
  let gate = Infinity;
  for (let y = field.y + field.h - 8; y <= field.y + field.h + 96; y += 4) {
    const open = longestOpenRun(walls, y, board.w);
    if (open >= MIN_GATE && open <= board.w - 80) gate = Math.min(gate, open);
  }
  return gate === Infinity ? 0 : gate;
}
