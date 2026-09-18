export const RESOURCE_COLORS = Object.freeze({
  paddleUp: "#ff3b30",
  paddleDown: "#af52de",
  ballsUp: "#34c759",
  ballsDown: "#0a84ff",
  reset: "#ffd60a",
});

export const POWER_TYPES = Object.freeze([
  { kind: "paddle", operation: "multiply", value: 2, label: "托盘 ×2", color: RESOURCE_COLORS.paddleUp, weight: 7 },
  { kind: "paddle", operation: "multiply", value: 4, label: "托盘 ×4", color: RESOURCE_COLORS.paddleUp, weight: 3 },
  { kind: "paddle", operation: "divide", value: 2, label: "托盘 ÷2", color: RESOURCE_COLORS.paddleDown, weight: 6 },
  { kind: "paddle", operation: "divide", value: 4, label: "托盘 ÷4", color: RESOURCE_COLORS.paddleDown, weight: 3 },
  { kind: "balls", operation: "add", value: 2, label: "球 +2", color: RESOURCE_COLORS.ballsUp, weight: 8 },
  { kind: "balls", operation: "add", value: 5, label: "球 +5", color: RESOURCE_COLORS.ballsUp, weight: 5 },
  ...[2, 3, 5, 10, 20].map((value) => ({
    kind: "balls",
    operation: "multiply",
    value,
    label: `球 ×${value}`,
    color: RESOURCE_COLORS.ballsUp,
    weight: value >= 10 ? 2 : 5,
  })),
  ...[2, 3, 5, 10, 20].map((value) => ({
    kind: "balls",
    operation: "divide",
    value,
    label: `球 ÷${value}`,
    color: RESOURCE_COLORS.ballsDown,
    weight: value >= 10 ? 2 : 5,
  })),
  { kind: "reset", operation: "reset", value: 1, label: "复位", color: RESOURCE_COLORS.reset, textColor: "#211b00", weight: 0.6 },
]);

export function pickPower(random = Math.random) {
  const total = POWER_TYPES.reduce((sum, power) => sum + power.weight, 0);
  let roll = random() * total;
  for (const power of POWER_TYPES) {
    roll -= power.weight;
    if (roll < 0) return power;
  }
  return POWER_TYPES[POWER_TYPES.length - 1];
}

export function targetBallCount(current, power, maxBalls) {
  if (power.kind === "reset") return 1;
  if (power.kind !== "balls") return current;
  if (power.operation === "add") return Math.min(maxBalls, current + power.value);
  if (power.operation === "multiply") return Math.min(maxBalls, current * power.value);
  if (power.operation === "divide") return Math.max(1, Math.ceil(current / power.value));
  return current;
}

export function targetPaddleWidth(current, power, initialWidth, minWidth, maxWidth) {
  if (power.kind === "reset") return initialWidth;
  if (power.kind !== "paddle") return current;
  const next = power.operation === "divide" ? current / power.value : current * power.value;
  return Math.max(minWidth, Math.min(maxWidth, next));
}
