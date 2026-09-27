/** Silent stall relief. No HUD. Unpaused level time only. */

export const STALL_WINDOW_SEC = 240;
export const STALL_CHANGE = 0.2;
export const STALL_REMAINING = 0.5;
export const STALL_FIRST_INTERIOR_CUT = 6;
export const STALL_REPEAT_INTERIOR_CUT = 3;

export function createStallReliefState() {
  return {
    startBricks: 0,
    markBricks: 0,
    windowsFired: 0,
  };
}

export function resetStallRelief(state, brickCount) {
  state.startBricks = brickCount;
  state.markBricks = brickCount;
  state.windowsFired = 0;
  return state;
}

export function brickChangeRatio(before, after) {
  if (before <= 0) return 1;
  return (before - after) / before;
}

function inwardTouchesBrick(wall, bricks) {
  const pad = Math.max(wall.w, wall.h) + 4;
  let x = wall.x;
  let y = wall.y;
  let w = wall.w;
  let h = wall.h;
  if (wall.role === "frame-top") {
    y = wall.y + wall.h;
    h = pad;
  } else if (wall.role === "frame-left") {
    x = wall.x + wall.w;
    w = pad;
  } else if (wall.role === "frame-right") {
    x = wall.x - pad;
    w = pad;
  } else {
    return false;
  }
  return bricks.some((b) => b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y);
}

export function pickFrameHole(walls, sides, rng = Math.random, bricks = []) {
  const pool = walls.filter((wall) => sides.includes(wall.role));
  if (!pool.length) return -1;
  const preferred = pool.filter((wall) => inwardTouchesBrick(wall, bricks));
  const use = preferred.length ? preferred : pool;
  return walls.indexOf(use[Math.floor(rng() * use.length)]);
}

export function pickInteriorCuts(walls, count, rng = Math.random) {
  const idxs = [];
  for (let i = 0; i < walls.length; i++) {
    if (walls[i].role === "interior") idxs.push(i);
  }
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = idxs[i];
    idxs[i] = idxs[j];
    idxs[j] = swap;
  }
  return idxs.slice(0, Math.min(count, idxs.length));
}

export function applyStallActions(walls, actions) {
  const drop = new Set();
  for (const action of actions) {
    if (action.type === "hole" && action.index >= 0) drop.add(action.index);
    if (action.type === "interior") {
      for (const index of action.indices) drop.add(index);
    }
  }
  if (!drop.size) return walls;
  return walls.filter((_, index) => !drop.has(index));
}

/**
 * Fire one silent checkpoint per completed 4-minute window.
 * Window 1: from the serve, 4 minutes with <20% brick loss opens the top frame.
 * Window 2+: another 4 minutes from the last mark, T/L/R (never the paddle side).
 * At 8 minutes and every later window: if remaining >50% of start, cut interior steel.
 */
export function tickStallRelief(state, { elapsed, brickCount, walls, bricks = [], rng = Math.random }) {
  const actions = [];
  if (state.startBricks <= 0) return actions;
  const due = Math.floor(elapsed / STALL_WINDOW_SEC);
  while (state.windowsFired < due) {
    state.windowsFired += 1;
    const windowIndex = state.windowsFired;
    const stalled = brickChangeRatio(state.markBricks, brickCount) < STALL_CHANGE;
    if (stalled) {
      const sides = windowIndex === 1
        ? ["frame-top"]
        : ["frame-top", "frame-left", "frame-right"];
      const index = pickFrameHole(walls, sides, rng, bricks);
      if (index >= 0) actions.push({ type: "hole", index, windowIndex });
    }
    if (windowIndex >= 2 && brickCount / state.startBricks > STALL_REMAINING) {
      const count = windowIndex === 2 ? STALL_FIRST_INTERIOR_CUT : STALL_REPEAT_INTERIOR_CUT;
      const indices = pickInteriorCuts(walls, count, rng);
      if (indices.length) actions.push({ type: "interior", indices, windowIndex });
    }
    state.markBricks = brickCount;
  }
  return actions;
}
