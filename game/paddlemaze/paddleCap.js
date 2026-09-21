export const PADDLE_MAX_HOLD_SECONDS = 30;

export function createPaddleCapState(hold = PADDLE_MAX_HOLD_SECONDS) {
  return { remaining: 0, hold };
}

export function isPaddleAtMax(width, maxWidth, epsilon = 0.51) {
  return Number(width) >= Number(maxWidth) - epsilon;
}

/** Call after width changes. At max, (re)start 30s; leaving max clears the clock. */
export function syncPaddleCap(state, width, maxWidth) {
  if (isPaddleAtMax(width, maxWidth)) {
    state.remaining = state.hold;
    return;
  }
  state.remaining = 0;
}

export function tickPaddleCap(state, dt) {
  if (state.remaining <= 0) return false;
  state.remaining -= dt;
  if (state.remaining > 0) return false;
  state.remaining = 0;
  return true;
}

export function paddleCapClock(state) {
  if (state.remaining <= 0) return "";
  const total = Math.max(1, Math.ceil(state.remaining - 1e-9));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
