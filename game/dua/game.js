import { AVATARS, WEAPON_ICON_PX, PICKUP_PX, AVATAR_PX, WEAPONS, PICKUP_ICONS, artPaths, EMOJI_STACK, canFire, createMatch, pickAvatar, stepMatch, triggerWeapon } from "./duel.js?v=12";
import { duaCopy } from "./copy.js?v=4";
import { getPortalLang } from "/js/langTabs.js";
import { AIM_REACH, STICK_TRAVEL, STICK_DEADZONE, clampStick, aimFromDir, lerpToward } from "./stick.js?v=2";

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
const controlZone = document.getElementById("controlZone");
const gameBack = document.getElementById("gameBack");

const W = canvas.width;
const H = canvas.height;
const EMOJI_FONT = `${AVATAR_PX}px ${EMOJI_STACK}`;
const GUN_FONT = `${PICKUP_PX}px ${EMOJI_STACK}`;
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
let lastNx = 1;
let lastNy = 0;
let aimX = match.foe.x;
let aimY = match.foe.y;
let fireOnce = false;
let fireQueue = 0;
let overlayMode = "pick";
let knobX = 0;
let knobY = 0;
let knobTx = 0;
let knobTy = 0;
let stickPointer = null;

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

function faceFoe() {
  const dx = match.foe.x - match.player.x;
  const dy = match.foe.y - match.player.y;
  const dist = Math.hypot(dx, dy) || 1;
  lastNx = dx / dist;
  lastNy = dy / dist;
  applyAim();
}

function applyAim() {
  const pt = aimFromDir(match.player.x, match.player.y, lastNx, lastNy);
  aimX = pt.x;
  aimY = pt.y;
}

function resetMatch() {
  const foe = pickAvatar(chosenFace);
  match = createMatch({ w: W, h: H }, { player: chosenFace, foe });
  fireOnce = false;
  fireQueue = 0;
  aiming = false;
  stickPointer = null;
  knobX = 0;
  knobY = 0;
  knobTx = 0;
  knobTy = 0;
  faceFoe();
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
  applyAim();
  const reach = Math.min(AIM_REACH, match.arena.r * 0.62);
  const x0 = match.player.x;
  const y0 = match.player.y;
  const x1 = x0 + lastNx * reach;
  const y1 = y0 + lastNy * reach;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,.42)";
  ctx.lineWidth = 1.25;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
}

function pickupGlyph(kind) {
  if (kind === "heart") return "❤️";
  if (kind === "boost") return "⚡️";
  return WEAPONS[kind]?.emoji || "•";
}

function drawPickupArt(x, y, kind, size = PICKUP_PX) {
  const img = pickupImage(kind);
  if (!img) return false;
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
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
    drawPickupArt(f.x + Math.cos(ang) * (f.r + 10), f.y + Math.sin(ang) * (f.r + 10), f.weapon, WEAPON_ICON_PX)
      || drawEmoji(f.x + Math.cos(ang) * (f.r + 8), f.y + Math.sin(ang) * (f.r + 8), pickupGlyph(f.weapon), `${WEAPON_ICON_PX}px ${EMOJI_STACK}`);
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
  applyAim();
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
  tickKnob(dt);
  if (running && !paused) update(dt);
  draw();
  animationId = requestAnimationFrame(loop);
}

function setKnob(dx, dy) {
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}

function tickKnob(dt) {
  knobX = lerpToward(knobX, knobTx, dt);
  knobY = lerpToward(knobY, knobTy, dt);
  if (knobTx === 0 && knobTy === 0 && Math.hypot(knobX, knobY) < 0.2) {
    knobX = 0;
    knobY = 0;
  }
  setKnob(knobX, knobY);
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
  const cap = Math.min(dist, STICK_TRAVEL);
  const nx = dist > 0.0001 ? dx / dist : lastNx;
  const ny = dist > 0.0001 ? dy / dist : lastNy;
  knobTx = Number.isFinite(nx * cap) ? nx * cap : 0;
  knobTy = Number.isFinite(ny * cap) ? ny * cap : 0;
  const s = clampStick(dx, dy, STICK_TRAVEL, STICK_DEADZONE);
  if (s.aiming) {
    lastNx = s.nx;
    lastNy = s.ny;
  }
  applyAim();
}

function onStickDown(e) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  e.preventDefault();
  aiming = true;
  stickPointer = e.pointerId;
  (controlZone || stick).setPointerCapture?.(e.pointerId);
  aimFromStick(stickDelta(e).x, stickDelta(e).y);
}

function onStickMove(e) {
  if (!aiming || (stickPointer != null && e.pointerId !== stickPointer)) return;
  e.preventDefault();
  aimFromStick(stickDelta(e).x, stickDelta(e).y);
}

function tryFireNow() {
  applyAim();
  if (!running || paused) return;
  if (canFire(match.player)) {
    triggerWeapon(match, match.player, aimX, aimY);
    fireOnce = false;
    fireQueue = 0;
    syncHud();
    return;
  }
  fireQueue = 0.45;
}

function releaseStick(e) {
  if (e && stickPointer != null && e.pointerId !== stickPointer) return;
  if (!aiming) return;
  aiming = false;
  stickPointer = null;
  knobTx = 0;
  knobTy = 0;
  tryFireNow();
}

const stickSurface = controlZone || stick;
stickSurface.addEventListener("pointerdown", onStickDown, { passive: false });
stickSurface.addEventListener("pointermove", onStickMove, { passive: false });
stickSurface.addEventListener("pointerup", releaseStick);
stickSurface.addEventListener("pointercancel", releaseStick);

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
