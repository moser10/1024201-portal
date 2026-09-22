/** Analog-stick math for Dua. Keep travel finite so the knob never gets NaN. */
export const STICK_TRAVEL = 52;
export const STICK_DEADZONE = 8;
export const AIM_REACH = 420;
export const KNOB_SNAP = 18;

export function clampStick(dx, dy, travel = STICK_TRAVEL, dead = STICK_DEADZONE) {
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || !Number.isFinite(travel) || travel <= 0) {
    return { nx: 0, ny: 0, cap: 0, aiming: false, dist: 0 };
  }
  if (dist < dead) {
    return { nx: 0, ny: 0, cap: 0, aiming: false, dist };
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const cap = Math.min(dist, travel);
  return { nx, ny, cap, aiming: true, dist };
}

export function aimFromDir(px, py, nx, ny, reach = AIM_REACH) {
  return { x: px + nx * reach, y: py + ny * reach };
}

export function lerpToward(cur, tgt, dt, snap = KNOB_SNAP) {
  const k = 1 - Math.exp(-snap * Math.max(0, dt));
  return cur + (tgt - cur) * k;
}

export function haptic(kind, vibe) {
  const fn = vibe || globalThis.navigator?.vibrate;
  if (typeof fn !== "function") return false;
  try {
    if (kind === "fire") return Boolean(fn.call(globalThis.navigator || {}, 18));
    if (kind === "hit") return Boolean(fn.call(globalThis.navigator || {}, [14, 32, 36]));
  } catch {
    return false;
  }
  return false;
}
