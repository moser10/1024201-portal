export const RESOURCE_COLORS = Object.freeze({
  paddleUp: "#0a84ff",
  paddleDown: "#30d158",
  ballsUp: "#ff453a",
  ballsDown: "#bf5af2",
  reset: "#ffd60a",
});

export const POWER_TYPES = Object.freeze([
  { kind: "paddle", operation: "multiply", value: 2, label: "托盘 ×2", color: RESOURCE_COLORS.paddleUp, weight: 5 },
  { kind: "paddle", operation: "multiply", value: 4, label: "托盘 ×4", color: RESOURCE_COLORS.paddleUp, weight: 3 },
  { kind: "paddle", operation: "divide", value: 2, label: "托盘 ÷2", color: RESOURCE_COLORS.paddleDown, weight: 4 },
  { kind: "paddle", operation: "divide", value: 4, label: "托盘 ÷4", color: RESOURCE_COLORS.paddleDown, weight: 2 },
  { kind: "balls", operation: "add", value: 2, label: "球 +2", color: RESOURCE_COLORS.ballsUp, weight: 2 },
  { kind: "balls", operation: "add", value: 5, label: "球 +5", color: RESOURCE_COLORS.ballsUp, weight: 1 },
  ...[2, 3, 5, 10, 20].map((value) => ({
    kind: "balls",
    operation: "multiply",
    value,
    label: `球 ×${value}`,
    color: RESOURCE_COLORS.ballsUp,
    weight: value === 2 ? 12 : value === 3 ? 10 : value === 5 ? 8 : value === 10 ? 6 : 5,
  })),
  ...[2, 3, 5, 10, 20].map((value) => ({
    kind: "balls",
    operation: "divide",
    value,
    label: `球 ÷${value}`,
    color: RESOURCE_COLORS.ballsDown,
    weight: value >= 10 ? 3 : 4,
  })),
  { kind: "reset", operation: "reset", value: 1, label: "复位", color: RESOURCE_COLORS.reset, textColor: "#211b00", weight: 0.6 },
]);

export function pickPower(random = Math.random, { forceBallMultiplier = false } = {}) {
  const candidates = forceBallMultiplier
    ? POWER_TYPES.filter((power) => power.kind === "balls" && power.operation === "multiply")
    : POWER_TYPES;
  const total = candidates.reduce((sum, power) => sum + power.weight, 0);
  let roll = random() * total;
  for (const power of candidates) {
    roll -= power.weight;
    if (roll < 0) return power;
  }
  return candidates[candidates.length - 1];
}

export function targetBallCount(current, power, maxBalls) {
  const count = Math.max(1, Math.floor(Number(current) || 1));
  const cap = Math.max(1, Math.floor(Number(maxBalls) || 1));
  if (power.kind === "reset") return 1;
  if (power.kind !== "balls") return Math.min(count, cap);
  const value = Math.max(1, Number(power.value) || 1);
  if (power.operation === "add") return Math.min(cap, count + Math.floor(value));
  if (power.operation === "multiply") return Math.min(cap, Math.max(count + 1, Math.round(count * value)));
  if (power.operation === "divide") return Math.max(1, Math.min(cap, Math.ceil(count / value)));
  return Math.min(count, cap);
}

export function targetPaddleWidth(current, power, initialWidth, minWidth, maxWidth) {
  if (power.kind === "reset") return initialWidth;
  if (power.kind !== "paddle") return current;
  const next = power.operation === "divide" ? current / power.value : current * power.value;
  return Math.max(minWidth, Math.min(maxWidth, next));
}
