import { buildLevelSpec } from "./levels.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvasWrap");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");

const W = canvas.width;
const H = canvas.height;
const TOTAL_LEVELS = 24;
const INITIAL_PADDLE = 120;
const BALL_R = 7;
const MAX_BALLS = 128;
const MAX_ITEMS = 48;
const BRICK_CELL = 64;
const POWER_TYPES = [
  { kind: "paddle", factor: 2, label: "2×", good: true },
  { kind: "balls", factor: 2, label: "2×", good: true },
  { kind: "paddle", factor: 0.5, label: "0.5×", good: false },
  { kind: "balls", factor: 10, label: "10×", good: true },
  { kind: "balls", factor: 0.5, label: "÷2", good: false },
  { kind: "paddle", factor: 4, label: "4×", good: true },
  { kind: "balls", factor: 0.1, label: "÷10", good: false },
  { kind: "balls", factor: 20, label: "20×", good: true },
  { kind: "balls", factor: 0.05, label: "÷20", good: false },
];

let levelIndex = 0;
let score = 0;
let bricks = [];
let brickBuckets = new Map();
let walls = [];
let balls = [];
let powers = [];
const ballPool = Array.from({ length: MAX_BALLS }, () => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0, r: BALL_R, primary: false,
}));
const itemPool = Array.from({ length: MAX_ITEMS }, () => ({
  active: false, x: 0, y: 0, w: 40, h: 22, vy: 105,
  kind: "balls", factor: 2, label: "2×", good: true,
}));
const particlePool = Array.from({ length: 120 }, () => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, hue: 320,
}));
let running = false;
let paused = false;
let lastTime = 0;
let animationId = 0;
let fpsAverage = 60;
let lowFpsFrames = 0;
let reducedVisuals = false;
let lastHapticAt = 0;
let paddle = { x: W / 2 - INITIAL_PADDLE / 2, y: H - 43, w: INITIAL_PADDLE, h: 12 };
const keys = { left: false, right: false };

function seeded(seed) {
  let n = seed >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function makeLevel(index) {
  const cfg = buildLevelSpec(index);
  const rand = seeded(cfg.seed);
  const field = { x: 142, y: 78, w: 616, h: 258 };
  const gap = 5;
  const brickW = (field.w - gap * (cfg.cols - 1)) / cfg.cols;
  const brickH = (field.h - gap * (cfg.rows - 1)) / cfg.rows;

  bricks = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (!cfg.mask[r][c]) continue;
      bricks.push({
        x: field.x + c * (brickW + gap),
        y: field.y + r * (brickH + gap),
        w: brickW,
        h: brickH,
        hp: index >= 12 && (r * 5 + c * 3 + index) % 11 === 0 ? 2 : 1,
        hue: 318 + Math.round(rand() * 18),
      });
    }
  }

  rebuildBrickBuckets();
  walls = makeMazeWalls(cfg, field);
  releaseAllBalls();
  releaseAllItems();
  releaseAllParticles();
  paddle = { x: W / 2 - INITIAL_PADDLE / 2, y: H - 43, w: INITIAL_PADDLE, h: 12 };
  activateBall(cfg.speed, null, true);
  updateHud();
  document.getElementById("levelText").textContent =
    `LEVEL ${String(cfg.number).padStart(2, "0")} / ${TOTAL_LEVELS}`;
}

function makeMazeWalls(cfg, field) {
  const thick = 16;
  const bottomY = field.y + field.h + 17;
  const result = [
    { x: field.x - 25, y: field.y - 24, w: field.w + 50, h: thick },
    { x: field.x - 25, y: field.y - 24, w: thick, h: field.h + 58 },
    { x: field.x + field.w + 9, y: field.y - 24, w: thick, h: field.h + 58 },
  ];

  const gateW = cfg.gates.length === 1 ? 68 : cfg.gates.length === 2 ? 54 : 46;
  const centers = cfg.gates.map((offset) => W / 2 + offset);

  const left = field.x - 25;
  const right = field.x + field.w + 25;
  let cursor = left;
  for (const [gateIndex, center] of centers.sort((a, b) => a - b).entries()) {
    const gx = Math.max(left + 25, Math.min(right - 25 - gateW, center - gateW / 2));
    if (gx > cursor) result.push({ x: cursor, y: bottomY, w: gx - cursor, h: thick });
    cursor = gx + gateW;

    // Short alternating channel guides make each trap entrance distinct.
    const channelDepth = 30 + ((cfg.number * 13 + Math.round(center)) % 44);
    if (cfg.guides[gateIndex] > 0) {
      result.push({ x: gx - thick, y: bottomY, w: thick, h: channelDepth });
      result.push({ x: gx + gateW, y: bottomY - channelDepth + thick, w: thick, h: channelDepth });
    } else {
      result.push({ x: gx - thick, y: bottomY - channelDepth + thick, w: thick, h: channelDepth });
      result.push({ x: gx + gateW, y: bottomY, w: thick, h: channelDepth });
    }
  }
  if (cursor < right) result.push({ x: cursor, y: bottomY, w: right - cursor, h: thick });

  // Hand-curated bars make the lower maze topology unique for every level.
  for (const [y, openingOffset] of cfg.bars) {
    const openingX = W / 2 + openingOffset;
    result.push({ x: 90, y, w: Math.max(70, openingX - 90), h: 12 });
    result.push({ x: openingX + 80, y, w: Math.max(70, 810 - openingX - 80), h: 12 });
  }
  return result;
}

function activateBall(speed = buildLevelSpec(levelIndex).speed, source, primary = false) {
  const ball = ballPool.find((entry) => !entry.active);
  if (!ball) return null;
  const angle = source
    ? Math.atan2(source.vy, source.vx) + (Math.random() - 0.5) * 0.55
    : -Math.PI / 2 + (Math.random() - 0.5) * 0.65;
  ball.active = true;
  ball.primary = primary;
  ball.x = source?.x ?? W / 2;
  ball.y = source?.y ?? H - 70;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.r = BALL_R;
  balls.push(ball);
  return ball;
}

function releaseBallAt(index) {
  const ball = balls[index];
  if (!ball) return;
  ball.active = false;
  ball.primary = false;
  balls.splice(index, 1);
}

function releaseAllBalls() {
  for (const ball of balls) {
    ball.active = false;
    ball.primary = false;
  }
  balls.length = 0;
}

function releaseAllItems() {
  for (const item of powers) item.active = false;
  powers.length = 0;
}

function releaseAllParticles() {
  for (const particle of particlePool) particle.active = false;
}

function bucketKey(x, y) {
  return `${Math.floor(x / BRICK_CELL)}:${Math.floor(y / BRICK_CELL)}`;
}

function rebuildBrickBuckets() {
  brickBuckets = new Map();
  for (const brick of bricks) {
    const key = bucketKey(brick.x + brick.w / 2, brick.y + brick.h / 2);
    brick.bucket = key;
    const bucket = brickBuckets.get(key) || [];
    bucket.push(brick);
    brickBuckets.set(key, bucket);
  }
}

function removeBrick(brick) {
  const index = bricks.indexOf(brick);
  if (index >= 0) bricks.splice(index, 1);
  const bucket = brickBuckets.get(brick.bucket);
  if (!bucket) return;
  const bucketIndex = bucket.indexOf(brick);
  if (bucketIndex >= 0) bucket.splice(bucketIndex, 1);
  if (!bucket.length) brickBuckets.delete(brick.bucket);
}

function hitNearbyBrick(ball) {
  const cellX = Math.floor(ball.x / BRICK_CELL);
  const cellY = Math.floor(ball.y / BRICK_CELL);
  for (let y = cellY - 1; y <= cellY + 1; y++) {
    for (let x = cellX - 1; x <= cellX + 1; x++) {
      const bucket = brickBuckets.get(`${x}:${y}`);
      if (!bucket) continue;
      for (const brick of bucket) {
        if (bounceRect(ball, brick)) return brick;
      }
    }
  }
  return null;
}

function spawnParticles(brick) {
  if (reducedVisuals) return;
  let made = 0;
  for (const particle of particlePool) {
    if (particle.active) continue;
    particle.active = true;
    particle.x = brick.x + brick.w / 2;
    particle.y = brick.y + brick.h / 2;
    particle.vx = (Math.random() - 0.5) * 150;
    particle.vy = (Math.random() - 0.8) * 140;
    particle.life = 0.28 + Math.random() * 0.18;
    particle.hue = brick.hue;
    if (++made >= 4) break;
  }
}

function haptic(duration = 8) {
  if (!navigator.vibrate || !matchMedia("(pointer: coarse)").matches) return;
  const now = performance.now();
  if (now - lastHapticAt < 90) return;
  lastHapticAt = now;
  navigator.vibrate(duration);
}

function circleRectHit(ball, rect) {
  const nx = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
  const dx = ball.x - nx;
  const dy = ball.y - ny;
  return dx * dx + dy * dy <= ball.r * ball.r;
}

function bounceRect(ball, rect) {
  if (!circleRectHit(ball, rect)) return false;
  const left = Math.abs(ball.x + ball.r - rect.x);
  const right = Math.abs(rect.x + rect.w - (ball.x - ball.r));
  const top = Math.abs(ball.y + ball.r - rect.y);
  const bottom = Math.abs(rect.y + rect.h - (ball.y - ball.r));
  const m = Math.min(left, right, top, bottom);
  if (m === left) {
    ball.x = rect.x - ball.r - 0.1;
    ball.vx = -Math.abs(ball.vx);
  } else if (m === right) {
    ball.x = rect.x + rect.w + ball.r + 0.1;
    ball.vx = Math.abs(ball.vx);
  } else if (m === top) {
    ball.y = rect.y - ball.r - 0.1;
    ball.vy = -Math.abs(ball.vy);
  } else {
    ball.y = rect.y + rect.h + ball.r + 0.1;
    ball.vy = Math.abs(ball.vy);
  }
  return true;
}

function spawnPower(brick) {
  if ((bricks.length + score + levelIndex) % 9 !== 0) return;
  const power = itemPool.find((entry) => !entry.active);
  if (!power) return;
  const type = POWER_TYPES[(score / 10 + levelIndex * 3) % POWER_TYPES.length | 0];
  Object.assign(power, type, {
    active: true,
    x: brick.x + brick.w / 2 - 20,
    y: brick.y + brick.h / 2 - 11,
    w: 40,
    h: 22,
    vy: 105,
  });
  powers.push(power);
}

function applyPower(power) {
  if (power.kind === "paddle") {
    paddle.w = Math.max(INITIAL_PADDLE, Math.min(W, paddle.w * power.factor));
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
  } else {
    const remaining = Math.max(1, bricks.length);
    if (power.factor >= 1) {
      const target = Math.min(remaining, MAX_BALLS, Math.max(1, Math.floor(balls.length * power.factor)));
      const source = balls[0];
      while (source && balls.length < target) {
        if (!activateBall(undefined, source, false)) break;
      }
    } else {
      const target = Math.max(1, Math.ceil(balls.length * power.factor));
      while (balls.length > target) releaseBallAt(balls.length - 1);
    }
  }
  haptic(16);
  updateHud();
}

function moveBallStep(ball, dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.r > W) {
    ball.x = W - ball.r;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
  }

  if (ball.vy > 0 && circleRectHit(ball, paddle)) {
    const hit = ((ball.x - paddle.x) / paddle.w - 0.5) * 1.65;
    const mag = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.sin(hit) * mag;
    ball.vy = -Math.abs(Math.cos(hit) * mag);
    ball.y = paddle.y - ball.r - 0.2;
    if (ball.primary) haptic(6);
  }

  for (const wall of walls) {
    if (bounceRect(ball, wall)) break;
  }

  const brick = hitNearbyBrick(ball);
  if (brick) {
    brick.hp--;
    score += brick.hp <= 0 ? 10 : 3;
    if (brick.hp <= 0) {
      removeBrick(brick); // immediately leaves spatial collision buckets
      spawnPower(brick);
      spawnParticles(brick);
    }
  }
}

function update(dt) {
  const speed = 500;
  if (keys.left) paddle.x -= speed * dt;
  if (keys.right) paddle.x += speed * dt;
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

  // Only the main ball receives limited CCD substeps; split balls use cheap discrete physics.
  for (const ball of balls) {
    const travel = Math.hypot(ball.vx, ball.vy) * dt;
    const steps = ball.primary ? Math.min(4, Math.max(1, Math.ceil(travel / (ball.r * 0.75)))) : 1;
    const stepDt = dt / steps;
    for (let step = 0; step < steps; step++) moveBallStep(ball, stepDt);
  }

  for (let i = balls.length - 1; i >= 0; i--) {
    if (balls[i].y - balls[i].r >= H + 20) releaseBallAt(i);
  }
  if (balls.length && !balls.some((ball) => ball.primary)) balls[0].primary = true;

  for (let i = powers.length - 1; i >= 0; i--) {
    const power = powers[i];
    power.y += power.vy * dt;
    if (
      power.y + power.h >= paddle.y &&
      power.y <= paddle.y + paddle.h &&
      power.x + power.w >= paddle.x &&
      power.x <= paddle.x + paddle.w
    ) {
      applyPower(power);
      power.active = false;
      powers.splice(i, 1);
    } else if (power.y > H) {
      power.active = false;
      powers.splice(i, 1);
    }
  }

  for (const particle of particlePool) {
    if (!particle.active) continue;
    particle.life -= dt;
    if (particle.life <= 0 || reducedVisuals) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 260 * dt;
  }

  if (!bricks.length) {
    score += 500 + (levelIndex + 1) * 50;
    releaseAllBalls();
    if (levelIndex + 1 >= TOTAL_LEVELS) {
      running = false;
      showOverlay("全部通关", `最终得分 ${score}。24 个迷宫已全部清除。`, "再玩一次", "COMPLETE");
      levelIndex = 0;
    } else {
      running = false;
      levelIndex++;
      showOverlay(
        `LEVEL ${String(levelIndex).padStart(2, "0")} CLEAR`,
        "通道结构即将改变。准备进入下一层。",
        "下一关",
        `SCORE ${score}`
      );
    }
  } else if (!balls.length) {
    running = false;
    releaseAllItems();
    haptic(35);
    showOverlay(
      "游戏结束",
      `接球失败。得分 ${score}，当前进度 LEVEL ${String(levelIndex + 1).padStart(2, "0")}。`,
      "重新挑战",
      "NO BALLS LEFT"
    );
  }
  updateHud();
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function draw() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#11111b");
  gradient.addColorStop(1, "#050509");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid gives the board a technical maze look.
  ctx.strokeStyle = "rgba(255,255,255,.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  for (const brick of bricks) {
    const g = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
    g.addColorStop(0, `hsl(${brick.hue} 92% ${brick.hp > 1 ? 67 : 57}%)`);
    g.addColorStop(1, `hsl(${brick.hue} 88% 39%)`);
    ctx.fillStyle = g;
    drawRoundedRect(brick.x, brick.y, brick.w, brick.h, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.stroke();
  }

  for (const wall of walls) {
    ctx.fillStyle = "#393945";
    drawRoundedRect(wall.x, wall.y, wall.w, wall.h, 3);
    ctx.fill();
    ctx.strokeStyle = "#5b5b69";
    ctx.stroke();
  }

  for (const power of powers) {
    const g = ctx.createLinearGradient(power.x, power.y, power.x + power.w, power.y + power.h);
    g.addColorStop(0, power.good ? "#35c759" : "#ff453a");
    g.addColorStop(1, power.good ? "#0d7530" : "#8c1714");
    ctx.fillStyle = g;
    drawRoundedRect(power.x, power.y, power.w, power.h, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(power.label, power.x + power.w / 2, power.y + power.h / 2);
  }

  if (!reducedVisuals) {
    for (const particle of particlePool) {
      if (!particle.active) continue;
      ctx.globalAlpha = Math.min(1, particle.life * 3);
      ctx.fillStyle = `hsl(${particle.hue} 90% 58%)`;
      ctx.fillRect(particle.x, particle.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  const pg = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h);
  pg.addColorStop(0, "#ff9c98");
  pg.addColorStop(1, "#ff5e57");
  ctx.fillStyle = pg;
  ctx.shadowColor = "rgba(255,94,87,.45)";
  ctx.shadowBlur = reducedVisuals ? 0 : 12;
  drawRoundedRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(255,255,255,.7)";
  ctx.shadowBlur = reducedVisuals ? 0 : 10;
  for (const ball of balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function updateHud() {
  document.getElementById("brickCount").textContent = bricks.length;
  document.getElementById("ballCount").textContent = balls.length;
  document.getElementById("paddleCount").textContent =
    `${Math.max(1, Math.round((paddle.w / INITIAL_PADDLE) * 10) / 10)}×`;
  document.getElementById("scoreCount").textContent = score;
}

function loop(time) {
  const rawDt = Math.max(0, (time - lastTime) / 1000 || 0);
  const dt = Math.min(0.025, rawDt);
  lastTime = time;
  if (rawDt > 0) {
    const fps = Math.min(120, 1 / rawDt);
    fpsAverage = fpsAverage * 0.94 + fps * 0.06;
    lowFpsFrames = fpsAverage < 45 ? lowFpsFrames + 1 : Math.max(0, lowFpsFrames - 2);
    reducedVisuals = balls.length > 40 || lowFpsFrames > 20;
  }
  if (running && !paused) update(dt);
  draw();
  animationId = requestAnimationFrame(loop);
}

function showOverlay(title, text, button, eyebrow = "PADDLE BLOCK MAZE") {
  document.getElementById("overlayTitle").textContent = title;
  document.getElementById("overlayText").textContent = text;
  document.getElementById("overlayEyebrow").textContent = eyebrow;
  startBtn.textContent = button;
  overlay.hidden = false;
}

function startLevel() {
  if (levelIndex === 0 && document.getElementById("overlayTitle").textContent === "全部通关") score = 0;
  makeLevel(levelIndex);
  overlay.hidden = true;
  paused = false;
  running = true;
  pauseBtn.textContent = "Ⅱ";
  lastTime = performance.now();
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "▶" : "Ⅱ";
  if (paused) {
    showOverlay("已暂停", "当前进度已保留。", "继续", `LEVEL ${String(levelIndex + 1).padStart(2, "0")}`);
  } else {
    overlay.hidden = true;
    lastTime = performance.now();
  }
}

function movePaddle(clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * W;
  paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
}

wrap.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas) return;
  wrap.setPointerCapture?.(e.pointerId);
  movePaddle(e.clientX);
});
wrap.addEventListener("pointermove", (e) => {
  if (e.buttons || e.pointerType === "touch") movePaddle(e.clientX);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.key === " " || e.key.toLowerCase() === "p") {
    e.preventDefault();
    togglePause();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
});

startBtn.addEventListener("click", () => {
  if (paused && running) {
    paused = false;
    overlay.hidden = true;
    pauseBtn.textContent = "Ⅱ";
    lastTime = performance.now();
  } else {
    startLevel();
  }
});
pauseBtn.addEventListener("click", togglePause);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) togglePause();
});

makeLevel(0);
draw();
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame(loop);
