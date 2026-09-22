import { AVATARS, WEAPON_ICON_PX, AVATAR_PX, WEAPONS, PICKUP_ICONS, artPaths, EMOJI_STACK, canFire, createMatch, pickAvatar, stepMatch } from "./duel.js?v=10";
import { duaCopy } from "./copy.js?v=4";
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
const weaponArt = document.getElementById("weaponArt");
const aimHint = document.getElementById("aimHint");
const stick = document.getElementById("stick");
const stickKnob = document.getElementById("stickKnob");
const gameBack = document.getElementById("gameBack");

const W = canvas.width;
const H = canvas.height;
const EMOJI_FONT = `${AVATAR_PX}px ${EMOJI_STACK}`;
const GUN_FONT = `${WEAPON_ICON_PX}px ${EMOJI_STACK}`;
const pickupImgs = {};
function loadArt(kind) {
  const spec = artPaths(kind);
  if (!spec) return null;
  const png = new Image();
  png.src = spec.icon;
  const svg = new Image();
  if (spec.svg) svg.src = spec.svg;
  return { png, svg };
}
for (const kind of [...Object.keys(WEAPONS), ...Object.keys(PICKUP_ICONS)]) {
  pickupImgs[kind] = loadArt(kind);
}

function pickupImage(kind) {
  const pack = pickupImgs[kind];
  if (pack?.png?.complete && pack.png.naturalWidth) return pack.png;
  if (pack?.svg?.complete && pack.svg.naturalWidth) return pack.svg;
  return null;
}

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
let fireQueue = 0;
let overlayMode = "pick";

function heartsRow(count, glyph) {
  return Array.from({ length: 10 }, (_, i) => (i < count ? glyph : "🖤")).join("");
}

function weaponLabel(f) {
  const boost = f.boostT > 0 ? ` ⚡️${Math.ceil(f.boostT)}` : "";
  if (!f.weapon) return copy.unarmed + boost;
  return `${f.weapon.toUpperCase()} ${f.ammo}${boost}`;
}

function applyLang() {
  lang = getPortalLang();
  copy = duaCopy(lang);
  if (gameBack) gameBack.textContent = copy.back;
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
    overlayTitle.textContent = "对圈 Dua";
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
  const art = match.player.weapon ? pickupImage(match.player.weapon) : null;
  if (weaponArt) {
    if (art) {
      weaponArt.hidden = false;
      weaponArt.src = art.src;
    } else {
      weaponArt.hidden = true;
      weaponArt.removeAttribute("src");
    }
  }
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
  fireQueue = 0;
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

function pickupGlyph(kind) {
  if (kind === "heart") return "❤️";
  if (kind === "boost") return "⚡️";
  return WEAPONS[kind]?.emoji || "•";
}

function drawPickupArt(x, y, kind) {
  const img = pickupImage(kind);
  if (!img) return false;
  const s = WEAPON_ICON_PX;
  ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  return true;
}

function drawFlashes() {
  for (const flash of match.flashes) {
    const t = 1 - flash.age / flash.life;
    const reach = 18 + (1 - t) * 26;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * t})`;
    ctx.lineWidth = 5 * t;
    ctx.arc(flash.x, flash.y, reach, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,214,10,${0.55 * t})`;
    ctx.lineWidth = 7 * t;
    const ang = Math.atan2(flash.ny, flash.nx);
    ctx.arc(match.arena.x, match.arena.y, match.arena.r, ang - 0.18, ang + 0.18);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const tang = ang + Math.PI / 2;
      const u = (i / 5 - 0.5) * 34;
      ctx.fillStyle = `rgba(255,255,255,${0.7 * t})`;
      ctx.beginPath();
      ctx.arc(flash.x + Math.cos(tang) * u - flash.nx * 8 * t, flash.y + Math.sin(tang) * u - flash.ny * 8 * t, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFighter(f) {
  if (f.boostT > 0) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,214,10,.7)";
    ctx.lineWidth = 3;
    ctx.arc(f.x, f.y, f.r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawEmoji(f.x, f.y, f.emoji, EMOJI_FONT);
  if (f.weapon) {
    const ang = f.id === "player"
      ? Math.atan2(aimY - f.y, aimX - f.x)
      : Math.atan2(match.player.y - f.y, match.player.x - f.x);
    drawPickupArt(f.x + Math.cos(ang) * (f.r + 10), f.y + Math.sin(ang) * (f.r + 10), f.weapon)
      || drawEmoji(f.x + Math.cos(ang) * (f.r + 8), f.y + Math.sin(ang) * (f.r + 8), pickupGlyph(f.weapon), GUN_FONT);
  }
}

function draw() {
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,.88)";
  ctx.lineWidth = 3;
  ctx.arc(match.arena.x, match.arena.y, match.arena.r, 0, Math.PI * 2);
  ctx.stroke();
  drawFlashes();

  for (const item of match.pickups) {
    if (!drawPickupArt(item.x, item.y, item.kind)) {
      drawEmoji(item.x, item.y, pickupGlyph(item.kind), GUN_FONT);
    }
  }
  for (const shot of match.shots) {
    ctx.fillStyle = shot.kind === "rpg" ? "#34c759" : "#f2f2f7";
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawAim();
  drawFighter(match.foe);
  drawFighter(match.player);
}

function update(dt) {
  const over = stepMatch(match, dt, {
    fire: fireOnce,
    queuedFire: fireQueue > 0,
    aimX,
    aimY,
  });
  if (fireOnce || fireQueue > 0) {
    if (!canFire(match.player) && match.player.weapon) fireQueue = 0;
    else if (match.player.cooldown > 0) fireQueue = 0;
  }
  fireOnce = false;
  if (fireQueue > 0) fireQueue -= dt;
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
  if (!running || paused) return;
  if (canFire(match.player)) fireOnce = true;
  else fireQueue = 0.45;
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
