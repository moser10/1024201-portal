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
  const amount = Math.max(1, Number(value) || 1);
  if (operation === "reset") return "♻️";
  if (operation === "add") return `+${amount}`;
  if (operation === "subtract") return `-${amount}`;
  if (operation === "multiply") return `×${amount}`;
  if (operation === "divide") return `÷${amount}`;
  // Unknown ops must not inherit a leftover plus from the item pool.
  return `-${amount}`;
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
  const buff = kind !== "reset" && isBuffOperation(operation);
  const label = resourceLabel(operation, value);
  if (kind !== "reset" && !buff && label.startsWith("+")) {
    throw new Error(`decrease ${kind}/${operation} cannot show ${label}`);
  }
  return {
    kind,
    operation,
    value,
    weight: Number(source.weight) || 0,
    label,
    color: resourceColor(kind, operation),
    buff,
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

/** Distance from ball center to the paddle rectangle. */
export function paddleDistance(ball, paddle) {
  const nx = Math.max(paddle.x, Math.min(ball.x, paddle.x + paddle.w));
  const ny = Math.max(paddle.y, Math.min(ball.y, paddle.y + paddle.h));
  return Math.hypot(ball.x - nx, ball.y - ny);
}

/** Tray-local resources only touch balls in the apron around the paddle. */
export const PADDLE_NEAR_PX = 176;

export function isNearPaddle(ball, paddle, radius = PADDLE_NEAR_PX) {
  if (ball?.held) return true;
  return paddleDistance(ball, paddle) <= radius;
}

/** + / − act on tray-side balls. × / ÷ act on the whole set. */
export function ballResourceScope(operation) {
  if (operation === "add" || operation === "subtract") return "paddle";
  if (operation === "multiply" || operation === "divide") return "all";
  return "all";
}

export function pickSubtractNear(balls, paddle, amount) {
  const want = Math.max(0, Math.floor(Number(amount) || 0));
  const maxRemove = Math.max(0, balls.length - 1);
  const near = balls
    .filter((ball) => isNearPaddle(ball, paddle) && !ball.held)
    .sort((a, b) => paddleDistance(a, paddle) - paddleDistance(b, paddle));
  return near.slice(0, Math.min(want, maxRemove, near.length));
}

export function pickDivideKeep(balls, keepCount) {
  const keep = Math.max(1, Math.min(balls.length, Math.floor(Number(keepCount) || 1)));
  if (keep >= balls.length) return balls.slice();
  const held = balls.filter((ball) => ball.held);
  const rest = balls.filter((ball) => !ball.held);
  const need = Math.max(0, keep - held.length);
  if (need <= 0) return held.slice(0, keep);
  const step = rest.length / need;
  const chosen = [];
  const used = new Set();
  for (let i = 0; i < need; i++) {
    let index = Math.min(rest.length - 1, Math.floor(i * step));
    while (used.has(index) && index < rest.length - 1) index += 1;
    used.add(index);
    chosen.push(rest[index]);
  }
  return held.concat(chosen);
}

export function multiplyCloneAngles(extra) {
  const n = Math.max(0, Math.floor(Number(extra) || 0));
  if (n <= 0) return [];
  if (n === 1) return [0.22];
  const span = 0.7;
  return Array.from({ length: n }, (_, i) => (i / (n - 1) - 0.5) * span);
}

export function formatPaddleUnits(width, unitPx) {
  const unit = Math.max(1e-6, Number(unitPx) || 1);
  const n = Number(width) / unit;
  return Math.max(0.1, Math.round(n * 10) / 10);
}
