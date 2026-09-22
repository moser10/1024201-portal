import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AVATARS,
  WEAPON_ICON_PX,
  PICKUP_PX,
  AVATAR_PX,
  WEAPONS,
  PICKUP_ICONS,
  BOOST_MUL,
  START_SPEED,
  MIN_INWARD_RATIO,
  applyBoost,
  integrateFighter,
  armWeapon,
  bounceArena,
  bounceFighters,
  canFire,
  createMatch,
  knockback,
  pickAvatar,
  stepMatch,
  stepShots,
  tickRecoil,
  triggerWeapon,
} from "./duel.js";
import { DUA_COPY } from "./copy.js";
import { STICK_TRAVEL, clampStick, aimFromDir, lerpToward } from "./stick.js";

test("avatar picker only returns catalog faces and never the used one", () => {
  assert.ok(AVATARS.length >= 8);
  for (let i = 0; i < 20; i++) {
    const face = pickAvatar("😀", () => i / 20);
    assert.notEqual(face, "😀");
    assert.equal(AVATARS.includes(face), true);
  }
});

test("weapon icons are 80 percent of the avatar size", () => {
  assert.equal(WEAPON_ICON_PX, Math.round(AVATAR_PX * 0.8));
  assert.equal(PICKUP_PX, 135);
  assert.ok(AVATAR_PX >= Math.round(28 * 1.3) * 2 - 1);
  assert.match(WEAPONS.pistol.svg, /\/icons\/weapon\/glock\.svg$/);
  assert.match(WEAPONS.pistol.icon, /\/icons\/weapon\/pistol\.png$/);
  assert.match(WEAPONS.shotgun.svg, /\/icons\/weapon\/sg\.svg$/);
  assert.match(WEAPONS.ak.svg, /\/icons\/weapon\/ak\.svg$/);
  assert.match(WEAPONS.rpg.svg, /\/icons\/weapon\/rpg\.svg$/);
  assert.match(WEAPONS.knife.svg, /\/icons\/weapon\/knife\.svg$/);
  assert.match(PICKUP_ICONS.heart, /\/icons\/weapon\/heart\.png$/);
  assert.match(PICKUP_ICONS.boost, /\/icons\/weapon\/boost\.png$/);
});

test("ammo: pistol 5, ak two bursts of 3, rpg 1, knife 1, shotgun two sprays of 3", () => {
  assert.deepEqual(
    [WEAPONS.pistol.shots, WEAPONS.ak.shots, WEAPONS.ak.burst, WEAPONS.rpg.shots, WEAPONS.knife.shots, WEAPONS.shotgun.shots, WEAPONS.shotgun.burst],
    [5, 2, 3, 1, 1, 2, 3],
  );
  const match = createMatch();
  armWeapon(match.player, "pistol");
  for (let i = 0; i < 5; i++) {
    match.player.cooldown = 0;
    assert.ok(triggerWeapon(match, match.player, match.foe.x, match.foe.y));
  }
  match.player.cooldown = 0;
  assert.equal(triggerWeapon(match, match.player, match.foe.x, match.foe.y), null);
  assert.equal(match.player.weapon, null);
});

test("AK trigger spends one of two bursts and fires three bullets at once", () => {
  const match = createMatch();
  armWeapon(match.player, "ak");
  triggerWeapon(match, match.player, match.foe.x, match.foe.y);
  assert.equal(match.shots.length, 3);
  assert.equal(match.player.ammo, 1);
  assert.equal(match.player.burstLeft, 0);
});

test("knife fires one flying shot like the pistol", () => {
  const match = createMatch();
  armWeapon(match.player, "knife");
  assert.equal(WEAPONS.knife.melee, undefined);
  assert.ok(triggerWeapon(match, match.player, match.foe.x, match.foe.y));
  assert.equal(match.shots.length, 1);
  assert.equal(match.shots[0].kind, "knife");
  assert.ok(match.shots[0].vx !== 0 || match.shots[0].vy !== 0);
  assert.equal(match.player.weapon, null);
});

test("shotgun spends one of two shells and sprays three pellets", () => {
  const match = createMatch();
  armWeapon(match.player, "shotgun");
  triggerWeapon(match, match.player, match.foe.x, match.foe.y);
  assert.equal(match.shots.length, 3);
  assert.equal(match.player.ammo, 1);
});

test("circle bounce reflects the outward velocity", () => {
  const match = createMatch();
  const f = match.player;
  f.x = match.arena.x + match.arena.r;
  f.y = match.arena.y;
  f.vx = 120;
  f.vy = 0;
  bounceArena(f, match.arena);
  assert.ok(f.vx < 0);
});

test("fighters bounce apart and shots knock the target back", () => {
  const match = createMatch();
  match.player.x = 400;
  match.player.y = 500;
  match.foe.x = 410;
  match.foe.y = 500;
  match.player.vx = 80;
  match.foe.vx = -20;
  match.player.boostT = 3;
  applyBoost(match.foe);
  const ox = match.player.x;
  bounceFighters(match.player, match.foe, () => 0, match.arena);
  assert.equal(match.player.boostT, 0);
  assert.equal(match.foe.boostT, 0);
  assert.ok(match.player.x < match.foe.x);
  assert.ok(match.player.vx < 0);
  assert.ok(match.foe.vx > 0);
  assert.ok(Math.hypot(match.player.x - ox, 0) < 80);
  const gap = Math.hypot(match.foe.x - match.player.x, match.foe.y - match.player.y);
  assert.ok(gap >= match.player.r + match.foe.r - 0.5);
  const vx1 = match.player.vx;
  bounceFighters(match.player, match.foe, () => 0, match.arena);
  assert.equal(match.player.vx, vx1);
  assert.ok(Math.abs(Math.hypot(match.player.vx, match.player.vy) - START_SPEED) < 0.5);

  match.shots.push({
    owner: "player", kind: "pistol", x: match.foe.x, y: match.foe.y,
    vx: 200, vy: 0, r: 6, damage: 1, knock: 240, life: 1,
  });
  const cruise = Math.hypot(match.foe.vx, match.foe.vy);
  stepShots(match, 0.01);
  assert.ok(match.foe.recoilVx > 0);
  assert.ok(Math.abs(Math.hypot(match.foe.vx, match.foe.vy) - cruise) < 0.02);
  assert.equal(match.foe.hearts, 9);
});

test("aim input does not steer the body, only weapons fire", () => {
  const match = createMatch();
  const x = match.player.x;
  const y = match.player.y;
  const vx = match.player.vx;
  stepMatch(match, 0.016, { fire: false, aimX: 10, aimY: 10 }, () => 0.4);
  assert.ok(Math.abs(match.player.vx - vx) < 1e-6 || match.player.x !== x || match.player.y !== y);
  assert.equal(match.player.x, x + vx * 0.016);
  assert.equal(match.player.y, y + match.player.vy * 0.016);
});

test("unarmed fighters cannot fire", () => {
  const match = createMatch();
  assert.equal(canFire(match.player), false);
  assert.equal(triggerWeapon(match, match.player, match.foe.x, match.foe.y), null);
  assert.equal(match.shots.length, 0);
});

test("default board is a square so the ring stays a circle", () => {
  const match = createMatch();
  assert.equal(match.arena.x * 2, 900);
  assert.equal(match.arena.y * 2, 900);
  assert.ok(match.arena.r <= 450);
});

test("aim hint exists in the three portal languages", () => {
  for (const lang of ["zh", "en", "ja"]) {
    assert.ok(DUA_COPY[lang].hint.length > 8);
  }
  const dir = dirname(fileURLToPath(import.meta.url));
  const spec = readFileSync(join(dir, "../../docs/dua.md"), "utf8");
  assert.match(spec, /头像/);
  assert.match(spec, /遥杆|摇杆/);
  assert.match(spec, /正圆|纯圆/);
});

test("grazing the rim must bounce inward instead of sliding around", () => {
  const match = createMatch();
  const f = match.player;
  f.x = match.arena.x + match.arena.r;
  f.y = match.arena.y;
  f.vx = 0;
  f.vy = 180;
  bounceArena(f, match.arena, match.rimHits);
  const nx = 1;
  const inward = -(f.vx * nx + f.vy * 0);
  assert.ok(inward >= START_SPEED * MIN_INWARD_RATIO - 0.5, `inward=${inward}`);
  assert.ok(Math.abs(f.vy) < Math.abs(f.vx));
  assert.ok(f.x < match.arena.x + match.arena.r - f.r);
});

test("a rim hit leaves the wall instead of hopping along it", () => {
  const match = createMatch();
  const f = match.player;
  f.x = match.arena.x + match.arena.r;
  f.y = match.arena.y;
  f.vx = 40;
  f.vy = START_SPEED;
  bounceArena(f, match.arena, match.rimHits);
  let hits = 0;
  for (let i = 0; i < 24; i++) {
    if (integrateFighter(f, 0.016, match.arena, match.rimHits)) hits += 1;
  }
  assert.equal(hits, 0);
});

test("boost pickup makes a fighter extra fast", () => {
  const match = createMatch();
  match.player.vx = START_SPEED;
  match.player.vy = 0;
  applyBoost(match.player);
  assert.ok(Math.abs(match.player.vx - START_SPEED * BOOST_MUL) < 0.01);
  assert.ok(match.player.boostT > 0);
});

test("recoil fades and cruise speed returns", () => {
  const match = createMatch();
  match.foe.vx = START_SPEED;
  match.foe.vy = 0;
  knockback(match.foe, 1, 0, 300);
  assert.ok(match.foe.recoilT > 0);
  assert.ok(Math.abs(Math.hypot(match.foe.vx, match.foe.vy) - START_SPEED) < 0.01);
  tickRecoil(match.foe, 1);
  assert.equal(match.foe.recoilT, 0);
  assert.ok(Math.abs(Math.hypot(match.foe.vx, match.foe.vy) - START_SPEED) < 0.01);
});

test("queued fire shoots once a weapon is collected", () => {
  const match = createMatch();
  match.pickups.push({ kind: "pistol", x: match.player.x, y: match.player.y, r: 20 });
  stepMatch(match, 0.016, { fire: false, queuedFire: true, aimX: match.foe.x, aimY: match.foe.y }, () => 0.9);
  assert.equal(match.player.weapon, "pistol");
  assert.ok(match.shots.length >= 1);
});

test("a second hit on the same rim bin drifts about five degrees", () => {
  const match = createMatch();
  const f = match.player;
  const launch = () => {
    f.x = match.arena.x + match.arena.r;
    f.y = match.arena.y;
    f.vx = 200;
    f.vy = 0;
  };
  launch();
  bounceArena(f, match.arena, match.rimHits);
  const a1 = Math.atan2(f.vy, f.vx);
  launch();
  bounceArena(f, match.arena, match.rimHits);
  const a2 = Math.atan2(f.vy, f.vx);
  const gap = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
  assert.ok(gap > 0.06 && gap < 0.12, `gap=${gap}`);
});

test("stick travel is finite so the knob never becomes NaN", () => {
  assert.ok(STICK_TRAVEL > 20);
  const stuck = clampStick(40, 0, Number.NaN, 8);
  assert.equal(stuck.aiming, false);
  assert.equal(Number.isNaN(stuck.cap), false);
  const ok = clampStick(80, 0);
  assert.equal(ok.aiming, true);
  assert.equal(ok.nx, 1);
  assert.equal(ok.cap, STICK_TRAVEL);
  const dead = clampStick(2, 1);
  assert.equal(dead.aiming, false);
});

test("aim and fire use the last stick direction", () => {
  const match = createMatch();
  match.player.x = 450;
  match.player.y = 450;
  const aim = aimFromDir(match.player.x, match.player.y, 0, -1);
  armWeapon(match.player, "pistol");
  assert.ok(triggerWeapon(match, match.player, aim.x, aim.y));
  const shot = match.shots[0];
  assert.ok(shot.vy < -10);
  assert.ok(Math.abs(shot.vx) < 20);
});

test("knob lerp eases toward the finger", () => {
  const mid = lerpToward(0, 52, 1 / 60);
  assert.ok(mid > 5 && mid < 30);
});

test("cruise speed is 45 percent faster than the previous 262 base", () => {
  assert.equal(START_SPEED, Math.round(262 * 1.45));
});
