import { buildLevelSpec } from "./levels.js?v=22";
import { buildWallRects } from "./walls.js?v=22";
import { materializePower, pickPower, resourceLabel, RESOURCE_LABEL_COLOR, targetBallCount, targetPaddleWidth } from "./resources.js?v=22";
import { createWelfareState, noteWelfareBrickHit, pickWelfarePower, tickWelfare, welfareNextKind, welfareRemaining } from "./welfare.js?v=22";
import { createPaddleCapState, paddleCapClock, syncPaddleCap, tickPaddleCap } from "./paddleCap.js?v=22";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvasWrap");
const controlZone = document.getElementById("controlZone");
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
const MIN_PADDLE = INITIAL_PADDLE;

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
  active: false, x: 0, y: 0, w: 72, h: 26, vy: 105,
  kind: "balls", operation: "subtract", value: 2, label: "-2", color: "#bf5af2", buff: false,
}));
const particlePool = Array.from({ length: 120 }, () => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, hue: 320,
}));
const brickCountEl = document.getElementById("brickCount");
const ballCountEl = document.getElementById("ballCount");
const paddleCountEl = document.getElementById("paddleCount");
const levelTextEl = document.getElementById("levelText");
const targetIconEl = document.getElementById("targetIcon");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayTextEl = document.getElementById("overlayText");
const overlayEyebrowEl = document.getElementById("overlayEyebrow");
const runTimeEl = document.getElementById("runTime");
const welfareTimeEl = document.getElementById("welfareTime");
const welfarePreviewEl = document.getElementById("welfarePreview");
const controlGap = document.getElementById("controlGap");
const PADDLE_UP_ICON = '<svg viewBox="0 0 48 30"><rect x="3" y="12" width="42" height="7" rx="3.5"/></svg>';
const BALLS_UP_ICON = '<svg viewBox="0 0 58 30"><circle cx="7" cy="15" r="5"/><path d="M15 15h10m-4-4 4 4-4 4"/><circle cx="34" cy="8" r="4"/><circle cx="34" cy="22" r="4"/><circle cx="46" cy="15" r="4"/></svg>';
const staticLayer = document.createElement("canvas");
staticLayer.width = W;
staticLayer.height = H;
const staticCtx = staticLayer.getContext("2d", { alpha: false });
let lastHudKey = "";
let running = false;
let paused = false;
let lastTime = 0;
let animationId = 0;
let fpsAverage = 60;
let lowFpsFrames = 0;
let reducedVisuals = false;
let lastHapticAt = 0;
let consecutiveHits = 0;
let hitsSinceDrop = 0;
let initialDropInterval = 5;
let dropsSinceBallMultiplier = 0;
const welfare = createWelfareState();
const paddleCap = createPaddleCapState();
const paddleCapTimeEl = document.getElementById("paddleCapTime");
let nextWelfare = null;
let levelElapsed = 0;
let sessionElapsed = 0;
let paddle = { x: W / 2 - INITIAL_PADDLE / 2, y: H - 43, w: INITIAL_PADDLE, h: 12 };
let paddleDrag = null;
const keys = { left: false, right: false };

function makeLevel(index) {
  const cfg = buildLevelSpec(index);
  const levelHue = (292 + cfg.number * 29) % 360;
  const field = { x: 142, y: 190, w: 616, h: 430 };
  const fineRows = cfg.rows;
  const fineCols = cfg.cols;
  const gap = 2;
  const brickW = (field.w - gap * (fineCols - 1)) / fineCols;
  const brickH = (field.h - gap * (fineRows - 1)) / fineRows;

  bricks = [];
  for (let r = 0; r < fineRows; r++) {
    for (let c = 0; c < fineCols; c++) {
      if (!cfg.mask[r]?.[c]) continue;
      bricks.push({
        x: field.x + c * (brickW + gap),
        y: field.y + r * (brickH + gap),
        w: brickW,
        h: brickH,
        hp: 1,
        hue: levelHue,
      });
    }
  }

  rebuildBrickBuckets();
  consecutiveHits = 0;
  hitsSinceDrop = 0;
  dropsSinceBallMultiplier = 0;
  noteWelfareBrickHit(welfare);
  levelElapsed = 0;
  armNextWelfare();
  initialDropInterval = bricks.length <= 60 ? 3 : bricks.length <= 90 ? 4 : 5;
  walls = buildWallRects(index, field, { w: W, h: H, paddleY: H - 58 });
  bakeStaticLayer();
  releaseAllBalls();
  releaseAllItems();
  releaseAllParticles();
  paddle = { x: W / 2 - INITIAL_PADDLE / 2, y: H - 58, w: INITIAL_PADDLE, h: 12 };
  syncPaddleCap(paddleCap, paddle.w, W);
  activateBall(cfg.speed, null, true);
  targetIconEl.style.background = `hsl(${levelHue} 90% 52%)`;
  lastHudKey = "";
  updateHud();
  levelTextEl.textContent =
    `LEVEL ${String(cfg.number).padStart(2, "0")} / ${TOTAL_LEVELS}`;
}

function bakeStaticLayer() {
  const s = staticCtx;
  s.fillStyle = "#0c0c14";
  s.fillRect(0, 0, W, H);
  s.strokeStyle = "rgba(255,255,255,.03)";
  s.lineWidth = 1;
  s.beginPath();
  for (let x = 0; x <= W; x += 60) {
    s.moveTo(x + 0.5, 0);
    s.lineTo(x + 0.5, H);
  }
  for (let y = 0; y <= H; y += 60) {
    s.moveTo(0, y + 0.5);
    s.lineTo(W, y + 0.5);
  }
  s.stroke();
  for (const wall of walls) paintSteel(s, wall);
}

function paintSteel(s, wall) {
  const joint = 2;
  const seg = 20;
  const horizontal = wall.w >= wall.h;
  const span = horizontal ? wall.w : wall.h;
  for (let offset = 0; offset < span; offset += seg) {
    const slice = Math.min(seg - joint, span - offset);
    const block = horizontal
      ? { x: wall.x + offset, y: wall.y, w: slice, h: wall.h }
      : { x: wall.x, y: wall.y + offset, w: wall.w, h: slice };
    s.fillStyle = "#4c5566";
    s.fillRect(block.x, block.y, block.w, block.h);
    if (reducedVisuals || block.w < 5 || block.h < 5) continue;
    s.fillStyle = "#8b93a6";
    s.fillRect(block.x, block.y, block.w, 3);
    s.fillRect(block.x, block.y, 3, block.h);
    s.fillStyle = "#2a303c";
    s.fillRect(block.x, block.y + block.h - 3, block.w, 3);
    s.fillRect(block.x + block.w - 3, block.y, 3, block.h);
  }
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

function activatePowerDrop(type, x, y) {
  const power = itemPool.find((entry) => !entry.active);
  if (!power) return;
  const spec = materializePower(type);
  if (spec.kind === "balls" && spec.operation === "multiply") dropsSinceBallMultiplier = 0;
  else dropsSinceBallMultiplier++;
  Object.assign(power, spec, {
    active: true,
    x,
    y,
    w: 56,
    h: 26,
    vy: 105,
    label: resourceLabel(spec.operation, spec.value),
    color: spec.color,
  });
  powers.push(power);
}

function spawnPower(brick) {
  const type = pickPower(Math.random, { forceBallMultiplier: dropsSinceBallMultiplier >= 2 });
  activatePowerDrop(type, brick.x + brick.w / 2 - 28, brick.y + brick.h / 2 - 13);
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds + 1e-6));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function paintWelfarePreview(power) {
  if (!welfarePreviewEl || !power) return;
  const isPaddle = power.kind === "paddle";
  welfarePreviewEl.className = `hud-welfare-preview ${isPaddle ? "paddle-up" : "balls-up"}`;
  welfarePreviewEl.style.color = isPaddle ? "#30d158" : "#ff453a";
  welfarePreviewEl.innerHTML = isPaddle ? PADDLE_UP_ICON : BALLS_UP_ICON;
}

function armNextWelfare() {
  nextWelfare = pickWelfarePower(welfareNextKind(welfare));
  paintWelfarePreview(nextWelfare);
}

function sizeTouchZone() {
  const vh = window.innerHeight;
  const rows = vh >= 920 ? 5 : vh >= 780 ? 4 : vh >= 660 ? 3 : 2;
  document.documentElement.style.setProperty("--touch-rows", String(rows));
  if (controlGap) controlGap.style.minHeight = `${rows * 22}px`;
}

function spawnWelfareDrop() {
  const type = nextWelfare || pickWelfarePower(welfareNextKind(welfare));
  activatePowerDrop(type, paddle.x + paddle.w / 2 - 28, Math.max(36, paddle.y - 220));
  armNextWelfare();
}

function registerBrickHit(brick) {
  noteWelfareBrickHit(welfare);
  armNextWelfare();
  consecutiveHits++;
  hitsSinceDrop++;
  const interval =
    consecutiveHits >= 27 ? 3 :
      consecutiveHits >= 15 ? Math.min(4, initialDropInterval) :
        initialDropInterval;
  if (hitsSinceDrop < interval) return;
  hitsSinceDrop = 0;
  spawnPower(brick);
}

function applyPower(power) {
  const spec = materializePower(power);
  if (spec.kind === "paddle") {
    paddle.w = targetPaddleWidth(paddle.w, spec, INITIAL_PADDLE, MIN_PADDLE, W);
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
    syncPaddleCap(paddleCap, paddle.w, W);
  } else if (spec.kind === "balls") {
    const ballCap = Math.max(1, Math.min(MAX_BALLS, bricks.length));
    const target = targetBallCount(balls.length, spec, ballCap);
    if (target > balls.length) {
      if (spec.operation === "add") {
        while (balls.length < target) {
          const paddleSource = {
            x: paddle.x + paddle.w / 2,
            y: paddle.y - BALL_R - 1,
            vx: (Math.random() - 0.5) * 90,
            vy: -buildLevelSpec(levelIndex).speed,
          };
          if (!activateBall(undefined, paddleSource, false)) break;
        }
      } else {
        const sources = balls.slice();
        let sourceIndex = 0;
        while (sources.length && balls.length < target) {
          if (!activateBall(undefined, sources[sourceIndex % sources.length], false)) break;
          sourceIndex++;
        }
      }
    } else {
      while (balls.length > target) releaseBallAt(balls.length - 1);
    }
  } else if (spec.kind === "reset") {
    paddle.w = INITIAL_PADDLE;
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
    syncPaddleCap(paddleCap, paddle.w, W);
    while (balls.length > 1) releaseBallAt(balls.length - 1);
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
    registerBrickHit(brick);
    brick.hp--;
    score += brick.hp <= 0 ? 10 : 3;
    if (brick.hp <= 0) {
      removeBrick(brick); // immediately leaves spatial collision buckets
      spawnParticles(brick);
    }
  }
}

function update(dt) {
  const speed = 500;
  if (keys.left) paddle.x -= speed * dt;
  if (keys.right) paddle.x += speed * dt;
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
  if (tickPaddleCap(paddleCap, dt)) {
    paddle.w = INITIAL_PADDLE;
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
  }
  levelElapsed += dt;
  sessionElapsed += dt;

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

  if (bricks.length && balls.length) {
    const drop = tickWelfare(welfare, dt);
    if (drop) spawnWelfareDrop();
  }

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
    const spent = formatClock(levelElapsed);
    releaseAllBalls();
    if (levelIndex + 1 >= TOTAL_LEVELS) {
      running = false;
      showOverlay("全部通关", `最终得分 ${score}。本关 ${spent}，总计 ${formatClock(sessionElapsed)}。`, "START", "COMPLETE");
      levelIndex = 0;
    } else {
      running = false;
      levelIndex++;
      showOverlay(
        `LEVEL ${String(levelIndex).padStart(2, "0")} CLEAR`,
        `用时 ${spent}。通道结构即将改变。准备进入下一层。`,
        "NEXT",
        `SCORE ${score}`
      );
    }
  } else if (!balls.length) {
    running = false;
    releaseAllItems();
    haptic(35);
    showOverlay("GAME OVER", `用时 ${formatClock(levelElapsed)}`, "Re-Start", "");
  }
  updateHud();
}

function draw() {
  ctx.drawImage(staticLayer, 0, 0);

  for (const brick of bricks) {
    ctx.fillStyle = `hsl(${brick.hue} 90% ${brick.hp > 1 ? 62 : 52}%)`;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
  }

  for (const power of powers) {
    ctx.fillStyle = power.color;
    ctx.fillRect(power.x, power.y, power.w, power.h);
    ctx.font = "800 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = RESOURCE_LABEL_COLOR;
    ctx.fillText(
      resourceLabel(power.operation, power.value),
      power.x + power.w / 2,
      power.y + power.h / 2 + 0.5,
    );
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

  ctx.fillStyle = "#ff6b64";
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

  ctx.fillStyle = "#fff";
  for (const ball of balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateHud() {
  const capClock = paddleCapClock(paddleCap);
  const remain = Math.ceil(welfareRemaining(welfare));
  const key = `${bricks.length}:${balls.length}:${paddle.w}:${Math.floor(levelElapsed)}:${remain}:${capClock}:${nextWelfare?.label || ""}`;
  if (key === lastHudKey) return;
  lastHudKey = key;
  brickCountEl.textContent = bricks.length;
  ballCountEl.textContent = balls.length;
  paddleCountEl.textContent =
    `${Math.max(1, Math.round((paddle.w / INITIAL_PADDLE) * 10) / 10)}×`;
  if (paddleCapTimeEl) {
    paddleCapTimeEl.hidden = !capClock;
    if (capClock) paddleCapTimeEl.textContent = capClock;
  }
  if (runTimeEl) runTimeEl.textContent = formatClock(levelElapsed);
  if (welfareTimeEl) welfareTimeEl.textContent = formatClock(remain);
}

function loop(time) {
  const rawDt = Math.max(0, (time - lastTime) / 1000 || 0);
  lastTime = time;
  if (rawDt > 0.08) {
    animationId = requestAnimationFrame(loop);
    return;
  }
  const dt = Math.min(0.04, rawDt);
  if (rawDt > 0) {
    const fps = Math.min(120, 1 / rawDt);
    fpsAverage = fpsAverage * 0.94 + fps * 0.06;
    lowFpsFrames = fpsAverage < 45 ? lowFpsFrames + 1 : Math.max(0, lowFpsFrames - 2);
    reducedVisuals = balls.length > 32 || lowFpsFrames > 12;
  }
  if (running && !paused) update(dt);
  draw();
  animationId = requestAnimationFrame(loop);
}

function showOverlay(title, text, button, eyebrow = "PADDLE BLOCK MAZE") {
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayEyebrowEl.textContent = eyebrow;
  startBtn.textContent = button;
  overlay.hidden = false;
}

function startLevel() {
  const title = overlayTitleEl.textContent || "";
  if (title.includes("全部通关") || title.includes("GAME OVER") || title.includes("Paddle Block Maze")) {
    sessionElapsed = 0;
    if (title.includes("全部通关")) score = 0;
  }
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
    showOverlay("已暂停", "当前进度已保留。", "RESUME", `LEVEL ${String(levelIndex + 1).padStart(2, "0")}`);
  } else {
    overlay.hidden = true;
    lastTime = performance.now();
  }
}

function beginPaddleDrag(e, source) {
  const rect = source.getBoundingClientRect();
  paddleDrag = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startPaddleX: paddle.x,
    scale: W / rect.width,
  };
  source.setPointerCapture?.(e.pointerId);
}

function continuePaddleDrag(e) {
  if (!paddleDrag || e.pointerId !== paddleDrag.pointerId) return;
  const delta = (e.clientX - paddleDrag.startClientX) * paddleDrag.scale;
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddleDrag.startPaddleX + delta));
}

function endPaddleDrag(e) {
  if (!paddleDrag || e.pointerId !== paddleDrag.pointerId) return;
  paddleDrag = null;
}

wrap.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas) return;
  beginPaddleDrag(e, wrap);
});
wrap.addEventListener("pointermove", continuePaddleDrag);
wrap.addEventListener("pointerup", endPaddleDrag);
wrap.addEventListener("pointercancel", endPaddleDrag);
controlZone.addEventListener("pointerdown", (e) => {
  beginPaddleDrag(e, controlZone);
});
controlZone.addEventListener("pointermove", continuePaddleDrag);
controlZone.addEventListener("pointerup", endPaddleDrag);
controlZone.addEventListener("pointercancel", endPaddleDrag);
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
window.addEventListener("resize", sizeTouchZone);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) togglePause();
});

sizeTouchZone();
makeLevel(0);
draw();
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame(loop);
