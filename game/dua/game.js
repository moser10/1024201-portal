import { AVATARS, WEAPON_ICON_PX, AVATAR_PX, WEAPONS, createMatch, pickAvatar, stepMatch } from "./duel.js?v=2";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvasWrap");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const fireBtn = document.getElementById("fireBtn");
const avatarGrid = document.getElementById("avatarGrid");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayEyebrow = document.getElementById("overlayEyebrow");
const redHeartsEl = document.getElementById("redHearts");
const yellowHeartsEl = document.getElementById("yellowHearts");
const weaponEl = document.getElementById("weaponText");

const W = canvas.width;
const H = canvas.height;
const EMOJI_FONT = `${AVATAR_PX}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
const GUN_FONT = `${WEAPON_ICON_PX}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;

let chosenFace = "";
let match = createMatch({ w: W, h: H }, { player: AVATARS[0], foe: AVATARS[1] });
let running = false;
let paused = false;
let lastTime = 0;
let animationId = 0;
let aiming = false;
let aimX = match.foe.x;
let aimY = match.foe.y;
let holdFire = false;

function heartsRow(count, glyph) {
  return Array.from({ length: 10 }, (_, i) => (i < count ? glyph : "🖤")).join("");
}

function weaponLabel(f) {
  if (!f.weapon) return "UNARMED";
  const spec = WEAPONS[f.weapon];
  return `${spec.emoji} ${f.weapon.toUpperCase()} ${f.ammo}`;
}

function syncHud() {
  redHeartsEl.textContent = heartsRow(match.player.hearts, "❤️");
  yellowHeartsEl.textContent = heartsRow(match.foe.hearts, "💛");
  weaponEl.textContent = weaponLabel(match.player);
}

function showPlayOverlay(title, text, button, eyebrow = "DUA") {
  overlayTitle.innerHTML = title;
  overlayText.textContent = text;
  overlayEyebrow.textContent = eyebrow;
  startBtn.textContent = button;
  overlay.hidden = false;
  avatarGrid.hidden = button === "RESUME";
}

function paintAvatars() {
  avatarGrid.innerHTML = "";
  for (const face of AVATARS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-btn" + (face === chosenFace ? " selected" : "");
    btn.textContent = face;
    btn.setAttribute("aria-label", `avatar ${face}`);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      chosenFace = face;
      paintAvatars();
      startBtn.disabled = false;
    });
    avatarGrid.appendChild(btn);
  }
}

function resetMatch() {
  const foe = pickAvatar(chosenFace);
  match = createMatch({ w: W, h: H }, { player: chosenFace, foe });
  aimX = match.foe.x;
  aimY = match.foe.y;
  holdFire = false;
  aiming = false;
  syncHud();
}

function toArena(e) {
  const rect = wrap.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

function drawEmoji(x, y, glyph, font) {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, x, y);
}

function drawAim() {
  if (!running || paused) return;
  const dx = aimX - match.player.x;
  const dy = aimY - match.player.y;
  const dist = Math.hypot(dx, dy) || 1;
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(match.player.x, match.player.y);
  ctx.lineTo(match.player.x + (dx / dist) * 70, match.player.y + (dy / dist) * 70);
  ctx.stroke();
  ctx.setLineDash([]);
}

function draw() {
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,.88)";
  ctx.lineWidth = 3;
  ctx.arc(match.arena.x, match.arena.y, match.arena.r, 0, Math.PI * 2);
  ctx.stroke();

  for (const item of match.pickups) {
    const glyph = item.kind === "heart" ? "❤️" : (WEAPONS[item.kind]?.emoji || "•");
    drawEmoji(item.x, item.y, glyph, item.kind === "heart" ? GUN_FONT : GUN_FONT);
  }
  for (const shot of match.shots) {
    ctx.fillStyle = shot.kind === "rpg" ? "#34c759" : "#f2f2f7";
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawAim();
  drawEmoji(match.foe.x, match.foe.y, match.foe.emoji, EMOJI_FONT);
  drawEmoji(match.player.x, match.player.y, match.player.emoji, EMOJI_FONT);
}

function update(dt) {
  if (!aiming) {
    aimX = match.foe.x;
    aimY = match.foe.y;
  }
  const over = stepMatch(match, dt, {
    fire: holdFire,
    aimX,
    aimY,
  });
  syncHud();
  if (over) {
    running = false;
    const win = over === "player";
    showPlayOverlay(
      win ? "YOU WIN" : "YOU LOSE",
      win ? "对方心数为零。可重选头像再开。" : "你的心数为零。可重选头像再开。",
      "Re-Start",
    );
    startBtn.disabled = !chosenFace;
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

function setAimFromEvent(e) {
  const p = toArena(e);
  aimX = p.x;
  aimY = p.y;
}

wrap.addEventListener("pointerdown", (e) => {
  if (e.target.closest?.("button, a")) return;
  aiming = true;
  setAimFromEvent(e);
  wrap.setPointerCapture?.(e.pointerId);
});
wrap.addEventListener("pointermove", (e) => {
  if (!aiming) return;
  setAimFromEvent(e);
});
const endAim = () => { aiming = false; };
wrap.addEventListener("pointerup", endAim);
wrap.addEventListener("pointercancel", endAim);

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

fireBtn.addEventListener("pointerdown", (e) => { e.stopPropagation(); holdFire = true; });
fireBtn.addEventListener("pointerup", () => { holdFire = false; });
fireBtn.addEventListener("pointerleave", () => { holdFire = false; });

startBtn.addEventListener("click", () => {
  if (paused && running) {
    paused = false;
    overlay.hidden = true;
    pauseBtn.textContent = "Ⅱ";
    lastTime = performance.now();
    return;
  }
  if (!chosenFace) return;
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
  if (paused) {
    showPlayOverlay("已暂停", "对局进度已保留。", "RESUME");
    startBtn.disabled = false;
  } else overlay.hidden = true;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) pauseBtn.click();
});

startBtn.disabled = true;
paintAvatars();
syncHud();
draw();
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame(loop);
