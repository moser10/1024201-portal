export const MAX_HEARTS = 10;
export const ARENA_R = 420;
export const FIGHTER_R = 28;
export const AVATAR_PX = FIGHTER_R * 2;
export const WEAPON_ICON_PX = Math.round(AVATAR_PX * 0.8);
export const START_SPEED = 210;

export const AVATARS = Object.freeze([
  "😀", "😎", "🤖", "🦊", "🐼", "🐸", "🎃", "👻", "😈", "👽", "🐱", "🌸",
]);

export const WEAPONS = Object.freeze({
  pistol: Object.freeze({
    speed: 480, damage: 1, cooldown: 0.32, life: 1.2, r: 5,
    shots: 5, burst: 1, spread: 0, knock: 240, emoji: "🔫",
  }),
  ak: Object.freeze({
    speed: 520, damage: 1, cooldown: 0.9, life: 1.05, r: 4,
    shots: 2, burst: 3, burstGap: 0.07, spread: 0.07, knock: 190, emoji: "🔫",
  }),
  rpg: Object.freeze({
    speed: 240, damage: 2, cooldown: 0.4, life: 1.7, r: 8,
    shots: 1, burst: 1, spread: 0, knock: 360, emoji: "🚀",
  }),
  knife: Object.freeze({
    speed: 0, damage: 2, cooldown: 0.2, life: 0.16, r: 18,
    shots: 1, burst: 1, melee: true, range: 58, knock: 300, emoji: "🔪",
  }),
  shotgun: Object.freeze({
    speed: 390, damage: 1, cooldown: 0.75, life: 0.5, r: 4,
    shots: 2, burst: 3, spread: 0.28, simultaneous: true, knock: 210, emoji: "💥",
  }),
});

const GUN_KINDS = Object.freeze(Object.keys(WEAPONS));

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
    spawnAt: 1.1,
    elapsed: 0,
    over: null,
  };
}

export function bounceArena(f, arena) {
  const dx = f.x - arena.x;
  const dy = f.y - arena.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const max = arena.r - f.r;
  if (dist <= max) return f;
  const nx = dx / dist;
  const ny = dy / dist;
  f.x = arena.x + nx * max;
  f.y = arena.y + ny * max;
  const dot = f.vx * nx + f.vy * ny;
  if (dot > 0) {
    f.vx -= 2 * dot * nx;
    f.vy -= 2 * dot * ny;
  }
  return f;
}

export function bounceFighters(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const min = a.r + b.r;
  if (dist >= min) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel > 0) return true;
  a.vx += rel * nx;
  a.vy += rel * ny;
  b.vx -= rel * nx;
  b.vy -= rel * ny;
  return true;
}

export function knockback(f, nx, ny, force) {
  const mag = Math.hypot(nx, ny) || 1;
  f.vx += (nx / mag) * force;
  f.vy += (ny / mag) * force;
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
  if (roll >= 0.2) kind = GUN_KINDS[Math.floor(((roll - 0.2) / 0.8) * GUN_KINDS.length)] || "pistol";
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

export function integrateFighter(f, dt, arena) {
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  bounceArena(f, arena);
}

export function stepMatch(state, dt, input = {}, rng = Math.random) {
  if (state.over) return state.over;
  state.elapsed += dt;
  for (const f of [state.player, state.foe]) {
    f.cooldown = Math.max(0, f.cooldown - dt);
    integrateFighter(f, dt, state.arena);
    tickBurst(state, f, dt);
  }
  bounceFighters(state.player, state.foe);
  bounceArena(state.player, state.arena);
  bounceArena(state.foe, state.arena);

  collectPickups(state.player, state.pickups);
  collectPickups(state.foe, state.pickups);

  if (input.fire && input.aimX != null) {
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
