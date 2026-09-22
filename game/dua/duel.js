export const MAX_HEARTS = 10;
export const ARENA_R = 360;
export const FIGHTER_R = 24;
export const REACH_LEN = 92;
export const REACH_TIME = 0.42;

export const WEAPONS = Object.freeze({
  pistol: Object.freeze({ speed: 430, damage: 1, cooldown: 0.5, life: 1.15, r: 5 }),
  rpg: Object.freeze({ speed: 250, damage: 2, cooldown: 1.05, life: 1.55, r: 8 }),
});

export function createMatch(board = { w: 900, h: 1000 }) {
  const arena = { x: board.w / 2, y: board.h / 2, r: ARENA_R };
  return {
    arena,
    player: makeFighter("player", arena.x, arena.y + 150, "#ff3b30"),
    foe: makeFighter("foe", arena.x, arena.y - 150, "#ffd60a"),
    pickups: [],
    shots: [],
    reach: null,
    spawnAt: 1.2,
    elapsed: 0,
    over: null,
  };
}

export function makeFighter(id, x, y, color) {
  return {
    id, x, y, vx: 0, vy: 0, r: FIGHTER_R, color,
    hearts: MAX_HEARTS,
    weapon: null,
    cooldown: 0,
  };
}

export function clampToArena(f, arena) {
  const dx = f.x - arena.x;
  const dy = f.y - arena.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const max = arena.r - f.r;
  if (dist <= max) return f;
  const nx = dx / dist;
  const ny = dy / dist;
  f.x = arena.x + nx * max;
  f.y = arena.y + ny * max;
  const push = f.vx * nx + f.vy * ny;
  if (push > 0) {
    f.vx -= 1.6 * push * nx;
    f.vy -= 1.6 * push * ny;
  }
  return f;
}

export function steerFighter(f, tx, ty, speed, dt) {
  const dx = tx - f.x;
  const dy = ty - f.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) {
    f.vx *= 0.8;
    f.vy *= 0.8;
    return;
  }
  f.vx = (dx / dist) * speed;
  f.vy = (dy / dist) * speed;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
}

export function placeOnRing(arena, rng, inset = 70) {
  const ang = rng() * Math.PI * 2;
  const rad = inset + rng() * (arena.r - inset - 36);
  return { x: arena.x + Math.cos(ang) * rad, y: arena.y + Math.sin(ang) * rad };
}

export function spawnPickup(state, rng = Math.random) {
  if (state.pickups.length >= 5) return null;
  const roll = rng();
  const kind = roll < 0.34 ? "heart" : roll < 0.72 ? "pistol" : "rpg";
  const pos = placeOnRing(state.arena, rng);
  const item = { kind, x: pos.x, y: pos.y, r: kind === "heart" ? 12 : 14 };
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
    else fighter.weapon = item.kind;
    got = item;
  }
  pickups.length = 0;
  pickups.push(...left);
  return got;
}

export function fireShot(state, fighter, tx, ty) {
  if (!fighter.weapon || fighter.cooldown > 0) return null;
  const spec = WEAPONS[fighter.weapon];
  if (!spec) return null;
  const dx = tx - fighter.x;
  const dy = ty - fighter.y;
  const dist = Math.hypot(dx, dy) || 1;
  const shot = {
    owner: fighter.id,
    kind: fighter.weapon,
    x: fighter.x + (dx / dist) * (fighter.r + 8),
    y: fighter.y + (dy / dist) * (fighter.r + 8),
    vx: (dx / dist) * spec.speed,
    vy: (dy / dist) * spec.speed,
    r: spec.r,
    damage: spec.damage,
    life: spec.life,
  };
  fighter.cooldown = spec.cooldown;
  state.shots.push(shot);
  return shot;
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
      hits.push({ shot, target: target.id, damage: shot.damage });
      continue;
    }
    next.push(shot);
  }
  state.shots = next;
  return hits;
}

export function startReach(state, fighter) {
  if (state.reach) return null;
  state.reach = { owner: fighter.id, t: REACH_TIME, holding: null };
  return state.reach;
}

export function reachTip(state, fighter) {
  const other = fighter.id === "player" ? state.foe : state.player;
  let aimX = other.x;
  let aimY = other.y;
  let nearest = Infinity;
  for (const item of state.pickups) {
    if (item.kind !== "heart") continue;
    const d = Math.hypot(item.x - fighter.x, item.y - fighter.y);
    if (d < nearest) {
      nearest = d;
      aimX = item.x;
      aimY = item.y;
    }
  }
  const dx = aimX - fighter.x;
  const dy = aimY - fighter.y;
  const dist = Math.hypot(dx, dy) || 1;
  const len = Math.min(REACH_LEN, dist);
  return {
    x: fighter.x + (dx / dist) * len,
    y: fighter.y + (dy / dist) * len,
  };
}

export function stepReach(state, dt = REACH_TIME) {
  if (!state.reach) return null;
  state.reach.t -= dt;
  if (state.reach.t > 0) return null;
  const fighter = state.reach.owner === "player" ? state.player : state.foe;
  const other = fighter.id === "player" ? state.foe : state.player;
  const tip = reachTip(state, fighter);
  let event = null;
  const heartIdx = state.pickups.findIndex((item) => (
    item.kind === "heart" && Math.hypot(item.x - tip.x, item.y - tip.y) <= 18
  ));
  if (heartIdx >= 0) {
    state.pickups.splice(heartIdx, 1);
    heal(fighter, 1);
    state.reach.holding = "heart";
    event = { type: "heal", owner: fighter.id };
  } else if (Math.hypot(other.x - tip.x, other.y - tip.y) <= other.r + 10) {
    hurt(other, 1);
    event = { type: "slap", owner: fighter.id, target: other.id };
  }
  state.reach = null;
  return event;
}

export function winnerOf(state) {
  if (state.player.hearts <= 0) return "foe";
  if (state.foe.hearts <= 0) return "player";
  return null;
}

export function cpuTarget(state) {
  const foe = state.foe;
  if (foe.hearts <= 4) {
    const heart = state.pickups.find((item) => item.kind === "heart");
    if (heart) return { x: heart.x, y: heart.y, fire: false, grab: true };
  }
  if (!foe.weapon) {
    const gun = state.pickups.find((item) => item.kind === "pistol" || item.kind === "rpg");
    if (gun) return { x: gun.x, y: gun.y, fire: false, grab: false };
  }
  const dx = state.player.x - foe.x;
  const dy = state.player.y - foe.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = 168;
  return {
    x: state.player.x - (dx / dist) * want,
    y: state.player.y - (dy / dist) * want,
    fire: Boolean(foe.weapon) && dist < 280,
    grab: dist < 110,
  };
}

export function stepMatch(state, dt, input = {}, rng = Math.random) {
  if (state.over) return state.over;
  state.elapsed += dt;
  state.player.cooldown = Math.max(0, state.player.cooldown - dt);
  state.foe.cooldown = Math.max(0, state.foe.cooldown - dt);

  if (input.tx != null && input.ty != null) {
    steerFighter(state.player, input.tx, input.ty, 210, dt);
  }
  const cpu = cpuTarget(state);
  steerFighter(state.foe, cpu.x, cpu.y, 175, dt);
  clampToArena(state.player, state.arena);
  clampToArena(state.foe, state.arena);

  collectPickups(state.player, state.pickups);
  collectPickups(state.foe, state.pickups);

  if (input.fire) fireShot(state, state.player, state.foe.x, state.foe.y);
  if (cpu.fire) fireShot(state, state.foe, state.player.x, state.player.y);
  stepShots(state, dt);

  if (input.grab) startReach(state, state.player);
  else if (cpu.grab && rng() < 0.02) startReach(state, state.foe);
  if (state.reach) stepReach(state, dt);

  state.spawnAt -= dt;
  if (state.spawnAt <= 0) {
    spawnPickup(state, rng);
    state.spawnAt = 3.2 + rng() * 1.6;
  }

  state.over = winnerOf(state);
  return state.over;
}
