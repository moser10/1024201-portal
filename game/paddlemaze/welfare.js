import { POWER_TYPES, materializePower } from "./resources.js";

/** A=120, B=90, C=60, D=30, E=15, F=10, G=5. Each phase drops twice, then the next letter. */
export const WELFARE_PHASES = Object.freeze([120, 90, 60, 30, 15, 10, 5]);
export const WELFARE_INTERVALS = WELFARE_PHASES;

export function createWelfareState() {
  return {
    elapsed: 0,
    phaseIndex: 0,
    stepInPhase: 0,
  };
}

export function welfareInterval(state) {
  return WELFARE_PHASES[Math.min(state.phaseIndex, WELFARE_PHASES.length - 1)];
}

export function welfareRemaining(state) {
  return Math.max(0, welfareInterval(state) - state.elapsed);
}

export function welfareNextKind(state) {
  return state.stepInPhase === 0 ? "any" : "balls";
}

export function noteWelfareBrickHit(state) {
  state.elapsed = 0;
  state.phaseIndex = 0;
  state.stepInPhase = 0;
}

export function pickWelfarePower(kind, random = Math.random) {
  const candidates = POWER_TYPES.filter((power) => {
    if (!power.buff) return false;
    if (kind === "any") return true;
    return power.kind === kind;
  });
  const total = candidates.reduce((sum, power) => sum + power.weight, 0);
  let roll = random() * total;
  for (const power of candidates) {
    roll -= power.weight;
    if (roll < 0) return materializePower(power);
  }
  return materializePower(candidates[candidates.length - 1]);
}

/**
 * Two unanswered drops complete a phase, then the wait shortens.
 * Step 0 is any increase; step 1 must be a ball increase.
 */
export function tickWelfare(state, dt) {
  state.elapsed += dt;
  if (state.elapsed < welfareInterval(state)) return null;
  const kind = state.stepInPhase === 0 ? "any" : "balls";
  state.elapsed = 0;
  state.stepInPhase += 1;
  if (state.stepInPhase >= 2) {
    state.stepInPhase = 0;
    state.phaseIndex = Math.min(WELFARE_PHASES.length - 1, state.phaseIndex + 1);
  }
  return { kind, nextInterval: welfareInterval(state), phaseIndex: state.phaseIndex };
}
