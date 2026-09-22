import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AVATARS,
  WEAPON_ICON_PX,
  AVATAR_PX,
  WEAPONS,
  BOOST_MUL,
  START_SPEED,
  MIN_INWARD,
  applyBoost,
  armWeapon,
  bounceArena,
  bounceFighters,
  canFire,
  createMatch,
  pickAvatar,
  stepMatch,
  stepShots,
  triggerWeapon,
} from "./duel.js";
import { DUA_COPY } from "./copy.js";

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

test("AK trigger spends one of two bursts and queues three bullets", () => {
  const match = createMatch();
  armWeapon(match.player, "ak");
  triggerWeapon(match, match.player, match.foe.x, match.foe.y);
  assert.equal(match.shots.length, 1);
  assert.equal(match.player.ammo, 1);
  assert.equal(match.player.burstLeft, 2);
  stepMatch(match, 0.08, {}, () => 0.5);
  assert.ok(match.shots.length >= 2);
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
  bounceFighters(match.player, match.foe);
  assert.ok(match.player.vx < 80);

  const before = match.foe.vx;
  match.shots.push({
    owner: "player", kind: "pistol", x: match.foe.x, y: match.foe.y,
    vx: 200, vy: 0, r: 6, damage: 1, knock: 240, life: 1,
  });
  stepShots(match, 0.01);
  assert.ok(match.foe.vx > before);
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
  assert.ok(inward >= MIN_INWARD - 0.01, `inward=${inward}`);
  assert.ok(f.x < match.arena.x + match.arena.r - f.r);
});

test("boost pickup makes a fighter extra fast", () => {
  const match = createMatch();
  match.player.vx = START_SPEED;
  match.player.vy = 0;
  applyBoost(match.player);
  assert.ok(Math.abs(match.player.vx - START_SPEED * BOOST_MUL) < 0.01);
  assert.ok(match.player.boostT > 0);
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
