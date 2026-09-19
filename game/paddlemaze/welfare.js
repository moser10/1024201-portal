import { POWER_TYPES } from "./resources.js";

/** Seconds without a brick hit before the next consolation drop. */
export const WELFARE_INTERVALS = Object.freeze([120, 90, 60]);

export function createWelfareState() {
  return {
    elapsed: 0,
    consecutiveDrops: 0,
    intervalIndex: 0,
  };
}

export function welfareInterval(state) {
  return WELFARE_INTERVALS[Math.min(state.intervalIndex, WELFARE_INTERVALS.length - 1)];
}

export function noteWelfareBrickHit(state) {
  state.elapsed = 0;
  state.consecutiveDrops = 0;
  state.intervalIndex = 0;
}

export function pickWelfarePower(kind, random = Math.random) {
  const candidates = POWER_TYPES.filter((power) =>
    power.kind === kind && (power.operation === "multiply" || power.operation === "add")
  );
  const total = candidates.reduce((sum, power) => sum + power.weight, 0);
  let roll = random() * total;
  for (const power of candidates) {
    roll -= power.weight;
    if (roll < 0) return power;
  }
  return candidates[candidates.length - 1];
}

/**
 * Advance the drought clock. Returns a drop kind when a consolation item should fall.
 * First drop in a drought may be a paddle buff; every later drop in that streak is a ball buff.
 * After two unanswered drops the wait becomes 90s; after the next unanswered drop it becomes 60s.
 */
export function tickWelfare(state, dt) {
  state.elapsed += dt;
  if (state.elapsed < welfareInterval(state)) return null;
  const kind = state.consecutiveDrops === 0 ? "paddle" : "balls";
  state.elapsed = 0;
  state.consecutiveDrops += 1;
  state.intervalIndex = Math.min(WELFARE_INTERVALS.length - 1, Math.max(0, state.consecutiveDrops - 1));
  return { kind, consecutiveDrops: state.consecutiveDrops, nextInterval: welfareInterval(state) };
}
