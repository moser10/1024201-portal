export const MAX_HEARTS = 10;
export const ARENA_R = 420;
export const FIGHTER_R = 28;
export const AVATAR_PX = FIGHTER_R * 2;
export const WEAPON_ICON_PX = Math.round(AVATAR_PX * 0.8);
export const START_SPEED = 262;
export const BOOST_MUL = 1.85;
export const BOOST_TIME = 5.2;
export const RIM_DRIFT = 5 * Math.PI / 180;
export const MIN_INWARD = 250;
export const MIN_INWARD_RATIO = 0.97;
export const RIM_TUCK = 52;
export const TANGENT_KEEP = 0.12;
export const RECOIL_TIME = 0.2;
export const SEPARATE_MUL = 2.05;
export const SEPARATE_GAP = 88;
export const SEPARATE_TIME = 0.48;
export const FLY_DEG_NEAR = Object.freeze([30, 80]);
export const FLY_DEG_FAR = Object.freeze([115, 170]);
export const WEAPON_DIR = "/icons/weapon";
export const EMOJI_STACK = '"Noto Color Emoji","Noto Emoji","Segoe UI Emoji","Apple Color Emoji","Android Emoji","Twemoji Mozilla",sans-serif';

export const AVATARS = Object.freeze([
  "😀", "😎", "🤖", "🦊", "🐼", "🐸", "🎃", "👻", "😈", "👽", "🐱", "🌸",
]);

export const WEAPONS = Object.freeze({
  pistol: Object.freeze({
    speed: 540, damage: 1, cooldown: 0.32, life: 1.2, r: 5,
    shots: 5, burst: 1, spread: 0, knock: 240, emoji: "🔫", file: "glock",
    icon: `${WEAPON_DIR}/glock.png`, svg: `${WEAPON_DIR}/glock.svg`,
  }),
  ak: Object.freeze({
    speed: 580, damage: 1, cooldown: 0.9, life: 1.05, r: 4,
    shots: 2, burst: 3, burstGap: 0.07, spread: 0.07, knock: 190, emoji: "🔫", file: "ak",
    icon: `${WEAPON_DIR}/ak.png`, svg: `${WEAPON_DIR}/ak.svg`,
  }),
  rpg: Object.freeze({
    speed: 270, damage: 2, cooldown: 0.4, life: 1.7, r: 8,
    shots: 1, burst: 1, spread: 0, knock: 360, emoji: "🚀", file: "rpg",
    icon: `${WEAPON_DIR}/rpg.png`, svg: `${WEAPON_DIR}/rpg.svg`,
  }),
  knife: Object.freeze({
    speed: 0, damage: 2, cooldown: 0.2, life: 0.16, r: 18,
    shots: 1, burst: 1, melee: true, range: 58, knock: 300, emoji: "🔪", file: "knife",
    icon: `${WEAPON_DIR}/knife.png`, svg: `${WEAPON_DIR}/knife.svg`,
  }),
  shotgun: Object.freeze({
    speed: 430, damage: 1, cooldown: 0.75, life: 0.5, r: 4,
    shots: 2, burst: 3, spread: 0.28, simultaneous: true, knock: 210, emoji: "💥", file: "sg",
    icon: `${WEAPON_DIR}/sg.png`, svg: `${WEAPON_DIR}/sg.svg`,
  }),
});

export const GUN_KINDS = Object.freeze(Object.keys(WEAPONS));
export const PICKUP_ICONS = Object.freeze({
  heart: `${WEAPON_DIR}/heart.png`,
  boost: `${WEAPON_DIR}/boost.png`,
});

export function artPaths(kind) {
  const gun = WEAPONS[kind];
  if (gun) return { icon: gun.icon, svg: gun.svg };
  const icon = PICKUP_ICONS[kind];
  return icon ? { icon, svg: null } : null;
}

export function pickAvatar(used, rng = Math.random) {
  const pool = AVATARS.filter((face) => face !== used);
  return pool[Math.floor(rng() * pool.length)] || AVATARS[0];
}

export function makeFighter(id, x, y, emoji, angle) {
  return {
    id, x, y, r: FIGHTER_R, emoji,
    vx: Math.cos(angle) * START_SPEED,
    vy: Math.sin(angle) * START_SPEED,
    hearts: MAX_HEARTS,
    weapon: null,
    ammo: 0,
    cooldown: 0,
    burstLeft: 0,
    burstGap: 0,
    aimLock: null,
    boostT: 0,
    recoilT: 0,
    recoilVx: 0,
    recoilVy: 0,
    separateT: 0,
  };
}

export function canFire(fighter) {
  return Boolean(fighter?.weapon && fighter.ammo > 0 && fighter.cooldown <= 0 && fighter.burstLeft <= 0);
}

export function createMatch(board = { w: 900, h: 900 }, faces = {}) {
  const side = Math.min(board.w, board.h);
  const arena = { x: board.w / 2, y: board.h / 2, r: Math.min(ARENA_R, side / 2 - 18) };
  const playerEmoji = faces.player && AVATARS.includes(faces.player) ? faces.player : AVATARS[0];
  const foeEmoji = faces.foe && faces.foe !== playerEmoji ? faces.foe : pickAvatar(playerEmoji);
  return {
    arena,
    player: makeFighter("player", arena.x, arena.y + 140, playerEmoji, -Math.PI / 2 + 0.35),
    foe: makeFighter("foe", arena.x, arena.y - 140, foeEmoji, Math.PI / 2 + 0.35),
    pickups: [],
    shots: [],
    rimHits: Object.create(null),
    flashes: [],
    spawnAt: 1.1,
    elapsed: 0,
    over: null,
  };
}

export function rimBin(nx, ny) {
  const ang = Math.atan2(ny, nx);
  return Math.round((ang + Math.PI) / (Math.PI / 18));
}

export function rotateVec(vx, vy, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { vx: vx * c - vy * s, vy: vx * s + vy * c };
}

export function cruiseSpeed(f) {
  return f.boostT > 0 ? START_SPEED * BOOST_MUL : START_SPEED;
}

export function restoreCruise(f) {
  const mag = Math.hypot(f.vx, f.vy) || 1;
  const c = cruiseSpeed(f);
  f.vx = (f.vx / mag) * c;
  f.vy = (f.vy / mag) * c;
  return f;
}

export function peelOffWall(f, nx, ny) {
  const speed = cruiseSpeed(f);
  const radial = f.vx * nx + f.vy * ny;
  const tx = f.vx - radial * nx;
  const ty = f.vy - radial * ny;
  const minIn = Math.max(MIN_INWARD, speed * MIN_INWARD_RATIO);
  f.vx = -minIn * nx + tx * TANGENT_KEEP;
  f.vy = -minIn * ny + ty * TANGENT_KEEP;
  restoreCruise(f);
}

export function bounceArena(f, arena, rimHits = null) {
  const dx = f.x - arena.x;
  const dy = f.y - arena.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const max = arena.r - f.r;
  if (dist <= max) return null;
  const nx = dx / dist;
  const ny = dy / dist;
  f.x = arena.x + nx * (max - RIM_TUCK);
  f.y = arena.y + ny * (max - RIM_TUCK);
  let vx = f.vx + (f.recoilVx || 0);
  let vy = f.vy + (f.recoilVy || 0);
  const dot = vx * nx + vy * ny;
  if (dot > 0) {
    vx -= 2 * dot * nx;
    vy -= 2 * dot * ny;
  }
  f.vx = vx;
  f.vy = vy;
  peelOffWall(f, nx, ny);
  if (rimHits) {
    const key = `${f.id}:${rimBin(nx, ny)}`;
    const seen = rimHits[key] || 0;
    const drift = (seen % 4) * RIM_DRIFT;
    if (drift) {
      const spun = rotateVec(f.vx, f.vy, drift);
      if (spun.vx * nx + spun.vy * ny <= 0) {
        f.vx = spun.vx;
        f.vy = spun.vy;
      }
    }
    rimHits[key] = seen + 1;
  }
  f.recoilVx = 0;
  f.recoilVy = 0;
  f.recoilT = 0;
  return { x: f.x, y: f.y, nx, ny, id: f.id };
}

export function applyBoost(fighter) {
  fighter.boostT = BOOST_TIME;
  restoreCruise(fighter);
  return fighter;
}

export function tickBoost(fighter, dt) {
  if (fighter.boostT <= 0) return;
  fighter.boostT -= dt;
  if (fighter.boostT <= 0) {
    fighter.boostT = 0;
    restoreCruise(fighter);
  }
}

export function headingUp(rad) {
  return { x: Math.cos(rad), y: -Math.sin(rad) };
}

function mixDeg(range, t) {
  return (range[0] + (range[1] - range[0]) * t) * Math.PI / 180;
}

function clampInArena(f, arena) {
  if (!arena) return;
  const dx = f.x - arena.x;
  const dy = f.y - arena.y;
  const max = arena.r - f.r - 10;
  const d = Math.hypot(dx, dy) || 1;
  if (d > max) {
    f.x = arena.x + (dx / d) * max;
    f.y = arena.y + (dy / d) * max;
  }
}

export function bounceFighters(a, b, rng = Math.random, arena = null) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const min = a.r + b.r;
  const cooling = (a.separateT || 0) > 0 || (b.separateT || 0) > 0;
  if (dist >= min + (cooling ? 12 : 0)) return false;
  if (cooling) {
    const push = (min + 24 - dist) * 0.5;
    const nx = dx / dist;
    const ny = dy / dist;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    clampInArena(a, arena);
    clampInArena(b, arena);
    return false;
  }
  const base = Math.atan2(-dy, dx);
  const angA = base + mixDeg(FLY_DEG_FAR, rng());
  const angB = base + mixDeg(FLY_DEG_NEAR, rng());
  const dirA = headingUp(angA);
  const dirB = headingUp(angB);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const leap = min + SEPARATE_GAP;
  a.x = mx + dirA.x * leap;
  a.y = my + dirA.y * leap;
  b.x = mx + dirB.x * leap;
  b.y = my + dirB.y * leap;
  const sa = cruiseSpeed(a) * SEPARATE_MUL;
  const sb = cruiseSpeed(b) * SEPARATE_MUL;
  a.vx = dirA.x * sa;
  a.vy = dirA.y * sa;
  b.vx = dirB.x * sb;
  b.vy = dirB.y * sb;
  a.separateT = SEPARATE_TIME;
  b.separateT = SEPARATE_TIME;
  a.recoilT = 0;
  a.recoilVx = 0;
  a.recoilVy = 0;
  b.recoilT = 0;
  b.recoilVx = 0;
  b.recoilVy = 0;
  clampInArena(a, arena);
  clampInArena(b, arena);
  return true;
}

export function tickSeparate(f, dt) {
  if (!f.separateT) return;
  f.separateT -= dt;
  if (f.separateT <= 0) {
    f.separateT = 0;
    restoreCruise(f);
  }
}

export function knockback(f, nx, ny, force) {
  const mag = Math.hypot(nx, ny) || 1;
  f.recoilVx = (nx / mag) * force;
  f.recoilVy = (ny / mag) * force;
  f.recoilT = RECOIL_TIME;
}

export function tickRecoil(f, dt) {
  if (f.recoilT <= 0) {
    f.recoilVx = 0;
    f.recoilVy = 0;
    return;
  }
  f.recoilT -= dt;
  if (f.recoilT <= 0) {
    f.recoilT = 0;
    f.recoilVx = 0;
    f.recoilVy = 0;
    restoreCruise(f);
    return;
  }
  const k = Math.max(0, f.recoilT / RECOIL_TIME);
  f.recoilVx *= k;
  f.recoilVy *= k;
}

export function placeOnRing(arena, rng, inset = 70) {
  const ang = rng() * Math.PI * 2;
  const rad = inset + rng() * (arena.r - inset - 40);
  return { x: arena.x + Math.cos(ang) * rad, y: arena.y + Math.sin(ang) * rad };
}

export function spawnPickup(state, rng = Math.random) {
  if (state.pickups.length >= 6) return null;
  const roll = rng();
  let kind = "heart";
  if (roll >= 0.16 && roll < 0.3) kind = "boost";
  else if (roll >= 0.3) kind = GUN_KINDS[Math.floor(((roll - 0.3) / 0.7) * GUN_KINDS.length)] || "pistol";
  const pos = placeOnRing(state.arena, rng);
  const item = { kind, x: pos.x, y: pos.y, r: WEAPON_ICON_PX / 2 };
  state.pickups.push(item);
  return item;
}

export function heal(fighter, n = 1) {
  fighter.hearts = Math.min(MAX_HEARTS, fighter.hearts + n);
  return fighter.hearts;
}

export function hurt(fighter, n = 1) {
  fighter.hearts = Math.max(0, fighter.hearts - n);
  return fighter.hearts;
}

export function armWeapon(fighter, kind) {
  const spec = WEAPONS[kind];
  if (!spec) return fighter;
  fighter.weapon = kind;
  fighter.ammo = spec.shots;
  fighter.burstLeft = 0;
  fighter.burstGap = 0;
  fighter.aimLock = null;
  fighter.cooldown = 0;
  return fighter;
}

export function collectPickups(fighter, pickups) {
  const left = [];
  let got = null;
  for (const item of pickups) {
    const hit = Math.hypot(fighter.x - item.x, fighter.y - item.y) <= fighter.r + item.r;
    if (!hit) {
      left.push(item);
      continue;
    }
    if (item.kind === "heart") heal(fighter, 1);
    else if (item.kind === "boost") applyBoost(fighter);
    else armWeapon(fighter, item.kind);
    got = item;
  }
  pickups.length = 0;
  pickups.push(...left);
  return got;
}

function spawnBullet(state, fighter, spec, tx, ty, spread = 0) {
  let dx = tx - fighter.x;
  let dy = ty - fighter.y;
  let ang = Math.atan2(dy, dx) + spread;
  const shot = {
    owner: fighter.id,
    kind: fighter.weapon,
    x: fighter.x + Math.cos(ang) * (fighter.r + 10),
    y: fighter.y + Math.sin(ang) * (fighter.r + 10),
    vx: Math.cos(ang) * spec.speed,
    vy: Math.sin(ang) * spec.speed,
    r: spec.r,
    damage: spec.damage,
    knock: spec.knock,
    life: spec.life,
  };
  state.shots.push(shot);
  return shot;
}

function slashKnife(state, fighter, spec, tx, ty) {
  const other = fighter.id === "player" ? state.foe : state.player;
  const dx = other.x - fighter.x;
  const dy = other.y - fighter.y;
  const dist = Math.hypot(dx, dy);
  const aim = Math.atan2(ty - fighter.y, tx - fighter.x);
  const facing = Math.atan2(dy, dx);
  const gap = Math.atan2(Math.sin(facing - aim), Math.cos(facing - aim));
  if (dist <= spec.range + other.r && Math.abs(gap) < 0.7) {
    hurt(other, spec.damage);
    knockback(other, dx, dy, spec.knock);
    return true;
  }
  return false;
}

export function triggerWeapon(state, fighter, tx, ty) {
  if (!canFire(fighter)) return null;
  const spec = WEAPONS[fighter.weapon];
  if (!spec) return null;
  fighter.ammo -= 1;
  fighter.cooldown = spec.cooldown;
  fighter.aimLock = { x: tx, y: ty };
  if (spec.melee) {
    slashKnife(state, fighter, spec, tx, ty);
    if (fighter.ammo <= 0) fighter.weapon = null;
    return { kind: "knife" };
  }
  if (spec.simultaneous) {
    const mid = (spec.burst - 1) / 2;
    for (let i = 0; i < spec.burst; i++) {
      spawnBullet(state, fighter, spec, tx, ty, (i - mid) * spec.spread);
    }
    if (fighter.ammo <= 0) fighter.weapon = null;
    return { kind: fighter.weapon, count: spec.burst };
  }
  if (spec.burst > 1) {
    spawnBullet(state, fighter, spec, tx, ty, 0);
    fighter.burstLeft = spec.burst - 1;
    fighter.burstGap = spec.burstGap;
    return { kind: fighter.weapon, count: 1 };
  }
  spawnBullet(state, fighter, spec, tx, ty, 0);
  if (fighter.ammo <= 0) fighter.weapon = null;
  return { kind: fighter.weapon, count: 1 };
}

export function tickBurst(state, fighter, dt) {
  if (fighter.burstLeft <= 0 || !fighter.weapon) return;
  const spec = WEAPONS[fighter.weapon];
  fighter.burstGap -= dt;
  if (fighter.burstGap > 0) return;
  const aim = fighter.aimLock || { x: fighter.x + fighter.vx, y: fighter.y + fighter.vy };
  spawnBullet(state, fighter, spec, aim.x, aim.y, (Math.random() - 0.5) * (spec.spread || 0));
  fighter.burstLeft -= 1;
  fighter.burstGap = spec.burstGap || 0.07;
  if (fighter.burstLeft <= 0 && fighter.ammo <= 0) fighter.weapon = null;
}

export function stepShots(state, dt) {
  const hits = [];
  const next = [];
  for (const shot of state.shots) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.life <= 0) continue;
    if (Math.hypot(shot.x - state.arena.x, shot.y - state.arena.y) > state.arena.r) continue;
    const target = shot.owner === "player" ? state.foe : state.player;
    if (Math.hypot(shot.x - target.x, shot.y - target.y) <= target.r + shot.r) {
      hurt(target, shot.damage);
      knockback(target, shot.vx, shot.vy, shot.knock);
      hits.push({ shot, target: target.id, damage: shot.damage });
      continue;
    }
    next.push(shot);
  }
  state.shots = next;
  return hits;
}

export function winnerOf(state) {
  if (state.player.hearts <= 0) return "foe";
  if (state.foe.hearts <= 0) return "player";
  return null;
}

export function cpuAim(state) {
  const foe = state.foe;
  const dist = Math.hypot(state.player.x - foe.x, state.player.y - foe.y);
  const spec = foe.weapon ? WEAPONS[foe.weapon] : null;
  const range = spec?.melee ? (spec.range + 12) : 320;
  return {
    x: state.player.x,
    y: state.player.y,
    fire: Boolean(spec) && foe.ammo > 0 && foe.cooldown <= 0 && dist < range,
  };
}

export function integrateFighter(f, dt, arena, rimHits) {
  tickRecoil(f, dt);
  tickSeparate(f, dt);
  f.x += (f.vx + (f.recoilVx || 0)) * dt;
  f.y += (f.vy + (f.recoilVy || 0)) * dt;
  return bounceArena(f, arena, rimHits);
}

export function stepMatch(state, dt, input = {}, rng = Math.random) {
  if (state.over) return state.over;
  state.elapsed += dt;
  for (const f of [state.player, state.foe]) {
    f.cooldown = Math.max(0, f.cooldown - dt);
    tickBoost(f, dt);
    const flash = integrateFighter(f, dt, state.arena, state.rimHits);
    if (flash) state.flashes.push({ ...flash, life: 0.28, age: 0 });
    tickBurst(state, f, dt);
  }
  bounceFighters(state.player, state.foe, rng, state.arena);
  const extraA = bounceArena(state.player, state.arena, state.rimHits);
  const extraB = bounceArena(state.foe, state.arena, state.rimHits);
  if (extraA) state.flashes.push({ ...extraA, life: 0.28, age: 0 });
  if (extraB) state.flashes.push({ ...extraB, life: 0.28, age: 0 });
  state.flashes = state.flashes.filter((flash) => {
    flash.age += dt;
    return flash.age < flash.life;
  });

  collectPickups(state.player, state.pickups);
  collectPickups(state.foe, state.pickups);

  if ((input.fire || input.queuedFire) && input.aimX != null) {
    triggerWeapon(state, state.player, input.aimX, input.aimY);
  }
  const cpu = cpuAim(state);
  if (cpu.fire) triggerWeapon(state, state.foe, cpu.x, cpu.y);
  stepShots(state, dt);

  state.spawnAt -= dt;
  if (state.spawnAt <= 0) {
    spawnPickup(state, rng);
    state.spawnAt = 2.8 + rng() * 1.8;
  }

  state.over = winnerOf(state);
  return state.over;
}
