import { AVATARS, WEAPON_ICON_PX, AVATAR_PX, WEAPONS, canFire, createMatch, pickAvatar, stepMatch } from "./duel.js?v=3";
import { duaCopy } from "./copy.js?v=3";
import { getPortalLang } from "/js/langTabs.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvasWrap");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const avatarGrid = document.getElementById("avatarGrid");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayEyebrow = document.getElementById("overlayEyebrow");
const redHeartsEl = document.getElementById("redHearts");
const yellowHeartsEl = document.getElementById("yellowHearts");
const weaponEl = document.getElementById("weaponText");
const aimHint = document.getElementById("aimHint");
const stick = document.getElementById("stick");
const stickKnob = document.getElementById("stickKnob");
const gameBack = document.getElementById("gameBack");
const gameSub = document.getElementById("gameSub");

const W = canvas.width;
const H = canvas.height;
const EMOJI_FONT = `${AVATAR_PX}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
const GUN_FONT = `${WEAPON_ICON_PX}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
const STICK_R = 54;

let lang = getPortalLang();
let copy = duaCopy(lang);
let chosenFace = "";
let match = createMatch({ w: W, h: H }, { player: AVATARS[0], foe: AVATARS[1] });
let running = false;
let paused = false;
let lastTime = 0;
let animationId = 0;
let aiming = false;
let aimX = match.foe.x;
let aimY = match.foe.y;
let fireOnce = false;
let overlayMode = "pick";

function heartsRow(count, glyph) {
  return Array.from({ length: 10 }, (_, i) => (i < count ? glyph : "🖤")).join("");
}

function weaponLabel(f) {
  if (!f.weapon) return copy.unarmed;
  const spec = WEAPONS[f.weapon];
  return `${spec.emoji} ${f.weapon.toUpperCase()} ${f.ammo}`;
}

function applyLang() {
  lang = getPortalLang();
  copy = duaCopy(lang);
  if (gameBack) gameBack.textContent = copy.back;
  if (gameSub) gameSub.textContent = copy.subtitle;
  if (aimHint) aimHint.textContent = copy.hint;
  stick.classList.toggle("armed", canFire(match.player));
  if (!running || paused || overlayMode !== "hidden") refreshOverlayCopy();
  syncHud();
}

function refreshOverlayCopy() {
  if (overlayMode === "pause") {
    overlayTitle.textContent = copy.pause;
    overlayText.textContent = copy.keep;
    startBtn.textContent = copy.resume;
    avatarGrid.hidden = true;
  } else if (overlayMode === "win") {
    overlayTitle.textContent = "YOU WIN";
    overlayText.textContent = copy.win;
    startBtn.textContent = copy.restart;
    avatarGrid.hidden = false;
  } else if (overlayMode === "lose") {
    overlayTitle.textContent = "YOU LOSE";
    overlayText.textContent = copy.lose;
    startBtn.textContent = copy.restart;
    avatarGrid.hidden = false;
  } else {
    overlayTitle.innerHTML = "对圈 Dua<br>DUEL CIRCLE";
    overlayText.textContent = copy.pick;
    startBtn.textContent = copy.start;
    avatarGrid.hidden = false;
  }
}

function showPlayOverlay(mode) {
  overlayMode = mode;
  overlay.hidden = false;
  refreshOverlayCopy();
}

function syncHud() {
  redHeartsEl.textContent = heartsRow(match.player.hearts, "❤️");
  yellowHeartsEl.textContent = heartsRow(match.foe.hearts, "💛");
  weaponEl.textContent = weaponLabel(match.player);
  stick.classList.toggle("armed", canFire(match.player));
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
  fireOnce = false;
  aiming = false;
  setKnob(0, 0);
  syncHud();
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
    drawEmoji(item.x, item.y, glyph, GUN_FONT);
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
  const over = stepMatch(match, dt, {
    fire: fireOnce,
    aimX,
    aimY,
  });
  fireOnce = false;
  syncHud();
  if (over) {
    running = false;
    showPlayOverlay(over === "player" ? "win" : "lose");
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

function setKnob(dx, dy) {
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function stickDelta(e) {
  const rect = stick.getBoundingClientRect();
  return {
    x: e.clientX - (rect.left + rect.width / 2),
    y: e.clientY - (rect.top + rect.height / 2),
  };
}

function aimFromStick(dx, dy) {
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const cap = Math.min(dist, STICK_R);
  setKnob(nx * cap, ny * cap);
  aimX = match.player.x + nx * 240;
  aimY = match.player.y + ny * 240;
  aiming = true;
}

stick.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  aiming = true;
  const d = stickDelta(e);
  aimFromStick(d.x, d.y);
  stick.setPointerCapture?.(e.pointerId);
});
stick.addEventListener("pointermove", (e) => {
  if (!aiming) return;
  const d = stickDelta(e);
  aimFromStick(d.x, d.y);
});
function releaseStick() {
  if (!aiming) return;
  aiming = false;
  setKnob(0, 0);
  if (running && !paused && canFire(match.player)) fireOnce = true;
}
stick.addEventListener("pointerup", releaseStick);
stick.addEventListener("pointercancel", releaseStick);

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

startBtn.addEventListener("click", () => {
  if (paused && running) {
    paused = false;
    overlayMode = "hidden";
    overlay.hidden = true;
    pauseBtn.textContent = "Ⅱ";
    lastTime = performance.now();
    return;
  }
  if (!chosenFace) return;
  resetMatch();
  overlayMode = "hidden";
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
    showPlayOverlay("pause");
    startBtn.disabled = false;
  } else {
    overlayMode = "hidden";
    overlay.hidden = true;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) pauseBtn.click();
});
window.addEventListener("storage", (e) => {
  if (e.key === "portal_lang") applyLang();
});

startBtn.disabled = true;
paintAvatars();
applyLang();
draw();
cancelAnimationFrame(animationId);
animationId = requestAnimationFrame(loop);
