import { createMatch, reachTip, stepMatch } from "./duel.js?v=1";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvasWrap");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const fireBtn = document.getElementById("fireBtn");
const grabBtn = document.getElementById("grabBtn");
const redHeartsEl = document.getElementById("redHearts");
const yellowHeartsEl = document.getElementById("yellowHearts");
const weaponEl = document.getElementById("weaponText");

const W = canvas.width;
const H = canvas.height;

let match = createMatch({ w: W, h: H });
let running = false;
let paused = false;
let lastTime = 0;
let animationId = 0;
let pointer = { active: false, x: match.arena.x, y: match.arena.y };
let holdFire = false;
let holdGrab = false;

function heartsRow(count, glyph) {
  return Array.from({ length: 10 }, (_, i) => (i < count ? glyph : "🖤")).join("");
}

function syncHud() {
  redHeartsEl.textContent = heartsRow(match.player.hearts, "❤️");
  yellowHeartsEl.textContent = heartsRow(match.foe.hearts, "💛");
  const load = match.player.weapon === "rpg" ? "RPG" : match.player.weapon === "pistol" ? "PISTOL" : "UNARMED";
  weaponEl.textContent = load;
}

function showOverlay(title, text, button, eyebrow = "DUA") {
  document.getElementById("overlayTitle").textContent = title;
  document.getElementById("overlayText").textContent = text;
  document.getElementById("overlayEyebrow").textContent = eyebrow;
  startBtn.textContent = button;
  overlay.hidden = false;
}

function resetMatch() {
  match = createMatch({ w: W, h: H });
  pointer = { active: false, x: match.arena.x, y: match.arena.y };
  holdFire = false;
  holdGrab = false;
  syncHud();
}

function toArena(e, source) {
  const rect = source.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function drawFace(f, emoji) {
  ctx.beginPath();
  ctx.fillStyle = f.color;
  ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c1c1e";
  ctx.font = "22px 'Apple Color Emoji','Segoe UI Emoji',sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, f.x, f.y + 1);
}

function drawPickup(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  if (item.kind === "heart") {
    ctx.font = "22px 'Apple Color Emoji','Segoe UI Emoji',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("❤️", 0, 0);
  } else if (item.kind === "pistol") {
    ctx.fillStyle = "#d8d8de";
    ctx.fillRect(-16, -3, 22, 6);
    ctx.fillRect(2, -3, 6, 12);
  } else {
    ctx.fillStyle = "#6b8f3a";
    ctx.fillRect(-18, -4, 28, 8);
    ctx.fillStyle = "#3d3d42";
    ctx.fillRect(8, -6, 10, 12);
  }
  ctx.restore();
}

function draw() {
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,.88)";
  ctx.lineWidth = 3;
  ctx.arc(match.arena.x, match.arena.y, match.arena.r, 0, Math.PI * 2);
  ctx.stroke();

  if (match.reach) {
    const owner = match.reach.owner === "player" ? match.player : match.foe;
    const tip = reachTip(match, owner);
    ctx.strokeStyle = "#c59a6c";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(owner.x, owner.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.fillStyle = match.reach.holding === "heart" ? "#ff2d55" : "#e8b86d";
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 9, 0, Math.PI * 2);
    ctx.fill();
    if (match.reach.holding === "heart") {
      ctx.font = "16px 'Apple Color Emoji','Segoe UI Emoji',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("❤️", tip.x, tip.y);
    }
  }

  for (const item of match.pickups) drawPickup(item);
  for (const shot of match.shots) {
    ctx.fillStyle = shot.kind === "rpg" ? "#34c759" : "#f2f2f7";
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFace(match.foe, "🙂");
  drawFace(match.player, "☺️");
}

function update(dt) {
  const over = stepMatch(match, dt, {
    tx: pointer.active ? pointer.x : null,
    ty: pointer.active ? pointer.y : null,
    fire: holdFire,
    grab: holdGrab,
  });
  holdGrab = false;
  syncHud();
  if (over) {
    running = false;
    const win = over === "player";
    showOverlay(
      win ? "YOU WIN" : "YOU LOSE",
      win ? "黄方心数为零。" : "红方心数为零。",
      "Re-Start",
      "DUA",
    );
  }
}

function loop(time) {
  const rawDt = Math.max(0, (time - lastTime) / 1000 || 0);
  lastTime = time;
  if (rawDt > 0.08) {
    animationId = requestAnimationFrame(loop);
    return;
  }
  const dt = Math.min(0.04, rawDt);
  if (running && !paused) update(dt);
  draw();
  animationId = requestAnimationFrame(loop);
}

function bindPointer(el, movePlayer) {
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest?.("button, a")) return;
    pointer.active = true;
    if (movePlayer) {
      const p = toArena(e, wrap);
      pointer.x = p.x;
      pointer.y = p.y;
    } else {
      const rect = el.getBoundingClientRect();
      pointer.x = match.player.x + (e.clientX - rect.left - rect.width / 2) * 2.1;
      pointer.y = match.player.y + (e.clientY - rect.top - rect.height / 2) * 2.1;
    }
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!pointer.active) return;
    if (movePlayer) {
      const p = toArena(e, wrap);
      pointer.x = p.x;
      pointer.y = p.y;
    } else {
      const rect = el.getBoundingClientRect();
      pointer.x = match.player.x + (e.clientX - rect.left - rect.width / 2) * 2.1;
      pointer.y = match.player.y + (e.clientY - rect.top - rect.height / 2) * 2.1;
    }
  });
  const end = () => { pointer.active = false; };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

function blockSystemGesture(e) { e.preventDefault(); }
["contextmenu", "selectstart", "dragstart", "gesturestart", "dblclick"].forEach((type) => {
  document.addEventListener(type, blockSystemGesture, { capture: true });
});
document.addEventListener("selectionchange", () => {
  const sel = window.getSelection?.();
  if (sel && sel.rangeCount) sel.removeAllRanges();
});
document.addEventListener("touchstart", (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { capture: true, passive: false });

bindPointer(wrap, true);
bindPointer(document.getElementById("controlZone"), false);

fireBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); holdFire = true; });
fireBtn.addEventListener("pointerup", () => { holdFire = false; });
fireBtn.addEventListener("pointerleave", () => { holdFire = false; });
grabBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); holdGrab = true; });

startBtn.addEventListener("click", () => {
  if (paused && running) {
    paused = false;
    overlay.hidden = true;
    pauseBtn.textContent = "Ⅱ";
    lastTime = performance.now();
    return;
  }
  resetMatch();
  overlay.hidden = true;
  paused = false;
  running = true;
  lastTime = performance.now();
});

pauseBtn.addEventListener("click", () => {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "▶" : "Ⅱ";
  if (paused) showOverlay("已暂停", "对局进度已保留。", "RESUME", "DUA");
  else overlay.hidden = true;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) pauseBtn.click();
});

syncHud();
draw();
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame(loop);
