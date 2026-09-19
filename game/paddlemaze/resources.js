export const RESOURCE_LABEL_COLOR = "#f5f5f7";

export const RESOURCE_COLORS = Object.freeze({
  paddleUp: "#30d158",
  paddleDown: "#0a84ff",
  ballsUp: "#ff453a",
  ballsDown: "#bf5af2",
  reset: "#e6c200",
});

export function isBuffOperation(operation) {
  return operation === "add" || operation === "multiply";
}

export function resourceLabel(operation, value) {
  if (operation === "reset") return "♻️";
  if (operation === "add") return `+${value}`;
  if (operation === "subtract") return `-${value}`;
  if (operation === "multiply") return `×${value}`;
  if (operation === "divide") return `÷${value}`;
  return `${value}`;
}

export function resourceColor(kind, operation) {
  if (operation === "reset" || kind === "reset") return RESOURCE_COLORS.reset;
  if (kind === "paddle") return isBuffOperation(operation) ? RESOURCE_COLORS.paddleUp : RESOURCE_COLORS.paddleDown;
  return isBuffOperation(operation) ? RESOURCE_COLORS.ballsUp : RESOURCE_COLORS.ballsDown;
}

export function materializePower(source) {
  const kind = source.kind === "paddle" || source.kind === "reset" ? source.kind : "balls";
  const operation = source.operation || "add";
  const value = Math.max(1, Number(source.value) || 1);
  return {
    kind,
    operation,
    value,
    weight: Number(source.weight) || 0,
    label: resourceLabel(operation, value),
    color: resourceColor(kind, operation),
    buff: kind !== "reset" && isBuffOperation(operation),
  };
}

function definePower(kind, operation, value, weight) {
  return Object.freeze(materializePower({ kind, operation, value, weight }));
}

export const POWER_TYPES = Object.freeze([
  definePower("paddle", "multiply", 2, 5),
  definePower("paddle", "multiply", 4, 3),
  definePower("paddle", "divide", 2, 4),
  definePower("paddle", "divide", 4, 2),
  definePower("balls", "add", 2, 2),
  definePower("balls", "add", 5, 1),
  definePower("balls", "subtract", 2, 3),
  definePower("balls", "subtract", 5, 2),
  ...[2, 3, 5, 10, 20].map((value) => definePower(
    "balls",
    "multiply",
    value,
    value === 2 ? 12 : value === 3 ? 10 : value === 5 ? 8 : value === 10 ? 6 : 5,
  )),
  ...[2, 3, 5, 10, 20].map((value) => definePower(
    "balls",
    "divide",
    value,
    value >= 10 ? 3 : 4,
  )),
  definePower("reset", "reset", 1, 0.6),
]);

export function pickPower(random = Math.random, { forceBallMultiplier = false } = {}) {
  const candidates = forceBallMultiplier
    ? POWER_TYPES.filter((power) => power.kind === "balls" && power.operation === "multiply")
    : POWER_TYPES;
  const total = candidates.reduce((sum, power) => sum + power.weight, 0);
  let roll = random() * total;
  for (const power of candidates) {
    roll -= power.weight;
    if (roll < 0) return materializePower(power);
  }
  return materializePower(candidates[candidates.length - 1]);
}

export function targetBallCount(current, power, maxBalls) {
  const count = Math.max(1, Math.floor(Number(current) || 1));
  const cap = Math.max(1, Math.floor(Number(maxBalls) || 1));
  if (power.kind === "reset") return 1;
  if (power.kind !== "balls") return Math.min(count, cap);
  const value = Math.max(1, Number(power.value) || 1);
  if (power.operation === "add") return Math.min(cap, count + Math.floor(value));
  if (power.operation === "subtract") return Math.max(1, Math.min(cap, count - Math.floor(value)));
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
