/** Keep breakout balls from 1D ping-pong and from sliding along steel. */

export const PINGPONG_LIMIT = 3;
export const MIN_LEAVE = 0.36;

export function resetTrap(ball) {
  ball.trapAxis = "";
  ball.trapHits = 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function circleRectNormal(cx, cy, r, rect) {
  const inside =
    cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  let dx = cx - closestX;
  let dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (!inside && distSq > r * r) return null;
  if (inside) {
    const left = cx - rect.x;
    const right = rect.x + rect.w - cx;
    const top = cy - rect.y;
    const bottom = rect.y + rect.h - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { nx: -1, ny: 0, depth: r + left };
    if (m === right) return { nx: 1, ny: 0, depth: r + right };
    if (m === top) return { nx: 0, ny: -1, depth: r + top };
    return { nx: 0, ny: 1, depth: r + bottom };
  }
  const dist = Math.sqrt(distSq) || 1e-6;
  return { nx: dx / dist, ny: dy / dist, depth: r - dist };
}

/** Keep heading; never add energy above cruise speed. */
export function clampSpeed(vx, vy, speed) {
  const cap = Math.max(1, Number(speed) || 1);
  const current = Math.hypot(vx, vy);
  if (current < 1e-9) return { vx: 0, vy: -cap };
  if (current <= cap + 1e-6) return { vx, vy };
  return { vx: (vx / current) * cap, vy: (vy / current) * cap };
}

export function reflectAndEscape(vx, vy, nx, ny, trapHits = 0) {
  const speed = Math.hypot(vx, vy) || 1;
  let dot = vx * nx + vy * ny;
  if (dot < 0) {
    vx -= 2 * dot * nx;
    vy -= 2 * dot * ny;
  }
  if (trapHits >= PINGPONG_LIMIT) {
    const px = -ny;
    const py = nx;
    const along = vx * px + vy * py;
    const side = along >= 0 ? 1 : -1;
    const mix = 0.7;
    vx = vx * (1 - mix) + side * px * speed * mix;
    vy = vy * (1 - mix) + side * py * speed * mix;
  }
  const scaled = Math.hypot(vx, vy) || 1;
  vx = (vx / scaled) * speed;
  vy = (vy / scaled) * speed;
  dot = vx * nx + vy * ny;
  const minLeave = speed * MIN_LEAVE;
  if (dot < minLeave) {
    vx += nx * (minLeave - dot);
    vy += ny * (minLeave - dot);
  }
  return clampSpeed(vx, vy, speed);
}

export function noteTrapAxis(ball, nx, ny) {
  const axis = Math.abs(nx) >= Math.abs(ny) ? "x" : "y";
  if (ball.trapAxis === axis) ball.trapHits += 1;
  else {
    ball.trapAxis = axis;
    ball.trapHits = 1;
  }
  return axis;
}

function applyBounceVel(ball, nx, ny, cruise) {
  const escaped = reflectAndEscape(ball.vx, ball.vy, nx, ny, ball.trapHits);
  const cap = cruise || Math.hypot(ball.vx, ball.vy) || 1;
  const pinned = clampSpeed(escaped.vx, escaped.vy, cap);
  ball.vx = pinned.vx;
  ball.vy = pinned.vy;
  if (ball.trapHits >= PINGPONG_LIMIT) ball.trapHits = 0;
}

export function bounceCircleRect(ball, rect, cruise) {
  const hit = circleRectNormal(ball.x, ball.y, ball.r, rect);
  if (!hit) return false;
  noteTrapAxis(ball, hit.nx, hit.ny);
  applyBounceVel(ball, hit.nx, hit.ny, cruise);
  const push = Math.max(0.12, hit.depth + 0.12);
  ball.x += hit.nx * push;
  ball.y += hit.ny * push;
  return true;
}

export function bounceWorldEdge(ball, width, height, cruise) {
  let hit = false;
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    noteTrapAxis(ball, 1, 0);
    applyBounceVel(ball, 1, 0, cruise);
    hit = true;
  } else if (ball.x + ball.r > width) {
    ball.x = width - ball.r;
    noteTrapAxis(ball, -1, 0);
    applyBounceVel(ball, -1, 0, cruise);
    hit = true;
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    noteTrapAxis(ball, 0, 1);
    applyBounceVel(ball, 0, 1, cruise);
    hit = true;
  }
  return hit;
}
