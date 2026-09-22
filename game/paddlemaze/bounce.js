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
  return { vx, vy };
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

export function bounceCircleRect(ball, rect) {
  const hit = circleRectNormal(ball.x, ball.y, ball.r, rect);
  if (!hit) return false;
  noteTrapAxis(ball, hit.nx, hit.ny);
  const escaped = reflectAndEscape(ball.vx, ball.vy, hit.nx, hit.ny, ball.trapHits);
  ball.vx = escaped.vx;
  ball.vy = escaped.vy;
  const push = Math.max(0.12, hit.depth + 0.12);
  ball.x += hit.nx * push;
  ball.y += hit.ny * push;
  if (ball.trapHits >= PINGPONG_LIMIT) ball.trapHits = 0;
  return true;
}

export function bounceWorldEdge(ball, width, height) {
  let hit = false;
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    noteTrapAxis(ball, 1, 0);
    const v = reflectAndEscape(ball.vx, ball.vy, 1, 0, ball.trapHits);
    ball.vx = v.vx;
    ball.vy = v.vy;
    if (ball.trapHits >= PINGPONG_LIMIT) ball.trapHits = 0;
    hit = true;
  } else if (ball.x + ball.r > width) {
    ball.x = width - ball.r;
    noteTrapAxis(ball, -1, 0);
    const v = reflectAndEscape(ball.vx, ball.vy, -1, 0, ball.trapHits);
    ball.vx = v.vx;
    ball.vy = v.vy;
    if (ball.trapHits >= PINGPONG_LIMIT) ball.trapHits = 0;
    hit = true;
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    noteTrapAxis(ball, 0, 1);
    const v = reflectAndEscape(ball.vx, ball.vy, 0, 1, ball.trapHits);
    ball.vx = v.vx;
    ball.vy = v.vy;
    if (ball.trapHits >= PINGPONG_LIMIT) ball.trapHits = 0;
    hit = true;
  }
  return hit;
}
