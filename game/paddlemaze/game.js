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
let walls = [];
let balls = [];
let powers = [];
let running = false;
let paused = false;
let lastTime = 0;
let animationId = 0;
let paddle = { x: W / 2 - INITIAL_PADDLE / 2, y: H - 43, w: INITIAL_PADDLE, h: 12 };
const keys = { left: false, right: false };

function seeded(seed) {
  let n = seed >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function levelConfig(index) {
  const n = index + 1;
  return {
    number: n,
    rows: 7 + (index % 3),
    cols: 12 + (index % 4),
    pattern: index % 8,
    gates: 1 + (index % 3),
    gateShift: ((index * 47) % 280) - 140,
    speed: Math.min(430, 300 + index * 5),
    seed: 1042 + n * 201,
  };
}

function keepBrick(pattern, row, col, rows, cols) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  switch (pattern) {
    case 0: return !(row > 1 && row < rows - 2 && col > 2 && col < cols - 3);
    case 1: return (row + col) % 3 !== 0;
    case 2: return Math.abs(col - cx) <= row + 2;
    case 3: return row % 2 === 0 || col % 3 !== 1;
    case 4: return Math.abs(col - cx) + Math.abs(row - cy) <= Math.min(rows, cols) * 0.58;
    case 5: return col < 2 || col >= cols - 2 || row < 2 || row >= rows - 2 || (row + col) % 4 === 0;
    case 6: return Math.sin((col / cols) * Math.PI * 3 + row * 0.8) > -0.35;
    default: return (row * 3 + col * 5) % 7 !== 0;
  }
}

function makeLevel(index) {
  const cfg = levelConfig(index);
  const rand = seeded(cfg.seed);
  const field = { x: 142, y: 78, w: 616, h: 258 };
  const gap = 5;
  const brickW = (field.w - gap * (cfg.cols - 1)) / cfg.cols;
  const brickH = (field.h - gap * (cfg.rows - 1)) / cfg.rows;

  bricks = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      if (!keepBrick(cfg.pattern, r, c, cfg.rows, cfg.cols)) continue;
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

  walls = makeMazeWalls(cfg, field);
  powers = [];
  paddle = { x: W / 2 - INITIAL_PADDLE / 2, y: H - 43, w: INITIAL_PADDLE, h: 12 };
  balls = [newBall(cfg.speed)];
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

  const gateW = cfg.gates === 1 ? 68 : cfg.gates === 2 ? 54 : 46;
  const centers =
    cfg.gates === 1
      ? [W / 2 + cfg.gateShift]
      : cfg.gates === 2
        ? [W / 2 - 155 + cfg.gateShift * 0.35, W / 2 + 155 + cfg.gateShift * 0.35]
        : [W / 2 - 205 + cfg.gateShift * 0.2, W / 2, W / 2 + 205 + cfg.gateShift * 0.2];

  const left = field.x - 25;
  const right = field.x + field.w + 25;
  let cursor = left;
  for (const center of centers.sort((a, b) => a - b)) {
    const gx = Math.max(left + 25, Math.min(right - 25 - gateW, center - gateW / 2));
    if (gx > cursor) result.push({ x: cursor, y: bottomY, w: gx - cursor, h: thick });
    cursor = gx + gateW;

    // Short alternating channel guides make each trap entrance distinct.
    const channelDepth = 30 + ((cfg.number * 13 + Math.round(center)) % 44);
    if ((cfg.number + Math.round(center)) % 2 === 0) {
      result.push({ x: gx - thick, y: bottomY, w: thick, h: channelDepth });
      result.push({ x: gx + gateW, y: bottomY - channelDepth + thick, w: thick, h: channelDepth });
    } else {
      result.push({ x: gx - thick, y: bottomY - channelDepth + thick, w: thick, h: channelDepth });
      result.push({ x: gx + gateW, y: bottomY, w: thick, h: channelDepth });
    }
  }
  if (cursor < right) result.push({ x: cursor, y: bottomY, w: right - cursor, h: thick });

  // Extra horizontal maze bars above the gates; openings rotate by level.
  if (cfg.number % 4 !== 1) {
    const y = 410 + (cfg.number % 2) * 28;
    const openingX = 235 + ((cfg.number * 83) % 350);
    result.push({ x: 90, y, w: Math.max(70, openingX - 90), h: 12 });
    result.push({ x: openingX + 80, y, w: Math.max(70, 810 - openingX - 80), h: 12 });
  }
  return result;
}

function newBall(speed = levelConfig(levelIndex).speed, source) {
  const angle = source
    ? Math.atan2(source.vy, source.vx) + (Math.random() - 0.5) * 0.55
    : -Math.PI / 2 + (Math.random() - 0.5) * 0.65;
  return {
    x: source?.x ?? W / 2,
    y: source?.y ?? H - 70,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: BALL_R,
  };
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
  const type = POWER_TYPES[(score / 10 + levelIndex * 3) % POWER_TYPES.length | 0];
  powers.push({
    x: brick.x + brick.w / 2 - 20,
    y: brick.y + brick.h / 2 - 11,
    w: 40,
    h: 22,
    vy: 105,
    ...type,
  });
}

function applyPower(power) {
  if (power.kind === "paddle") {
    paddle.w = Math.max(INITIAL_PADDLE, Math.min(W, paddle.w * power.factor));
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
  } else {
    const remaining = Math.max(1, bricks.length);
    if (power.factor >= 1) {
      const target = Math.min(remaining, Math.max(1, Math.floor(balls.length * power.factor)));
      const source = balls[0] || newBall();
      while (balls.length < target) balls.push(newBall(undefined, source));
    } else {
      const target = Math.max(1, Math.ceil(balls.length * power.factor));
      balls.splice(target);
    }
  }
  updateHud();
}

function update(dt) {
  const speed = 500;
  if (keys.left) paddle.x -= speed * dt;
  if (keys.right) paddle.x += speed * dt;
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

  for (const ball of balls) {
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
    }

    for (const wall of walls) {
      if (bounceRect(ball, wall)) break;
    }

    for (let i = bricks.length - 1; i >= 0; i--) {
      const brick = bricks[i];
      if (!bounceRect(ball, brick)) continue;
      brick.hp--;
      score += brick.hp <= 0 ? 10 : 3;
      if (brick.hp <= 0) {
        bricks.splice(i, 1);
        spawnPower(brick);
      }
      break;
    }
  }

  balls = balls.filter((ball) => ball.y - ball.r < H + 20);
  if (!balls.length && bricks.length) balls.push(newBall());

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
      powers.splice(i, 1);
    } else if (power.y > H) {
      powers.splice(i, 1);
    }
  }

  if (!bricks.length) {
    score += 500 + (levelIndex + 1) * 50;
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

  const pg = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h);
  pg.addColorStop(0, "#ff9c98");
  pg.addColorStop(1, "#ff5e57");
  ctx.fillStyle = pg;
  ctx.shadowColor = "rgba(255,94,87,.45)";
  ctx.shadowBlur = 12;
  drawRoundedRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(255,255,255,.7)";
  ctx.shadowBlur = 10;
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
  const dt = Math.min(0.025, Math.max(0, (time - lastTime) / 1000 || 0));
  lastTime = time;
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
