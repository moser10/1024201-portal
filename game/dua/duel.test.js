import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_HEARTS,
  clampToArena,
  collectPickups,
  cpuTarget,
  createMatch,
  fireShot,
  heal,
  hurt,
  spawnPickup,
  startReach,
  stepMatch,
  stepReach,
  stepShots,
  winnerOf,
} from "./duel.js";

test("fighters bounce back inside the white circle", () => {
  const match = createMatch();
  match.player.x = match.arena.x + 800;
  match.player.y = match.arena.y;
  clampToArena(match.player, match.arena);
  const d = Math.hypot(match.player.x - match.arena.x, match.player.y - match.arena.y);
  assert.ok(d <= match.arena.r - match.player.r + 0.01);
});

test("pistol costs 1 heart and rpg costs 2", () => {
  const match = createMatch();
  match.player.weapon = "pistol";
  match.player.cooldown = 0;
  fireShot(match, match.player, match.foe.x, match.foe.y);
  match.shots[0].x = match.foe.x;
  match.shots[0].y = match.foe.y;
  stepShots(match, 0.01);
  assert.equal(match.foe.hearts, 9);

  match.player.weapon = "rpg";
  match.player.cooldown = 0;
  fireShot(match, match.player, match.foe.x, match.foe.y);
  match.shots[0].x = match.foe.x;
  match.shots[0].y = match.foe.y;
  stepShots(match, 0.01);
  assert.equal(match.foe.hearts, 7);
});

test("touching a heart heals and guns replace the loadout", () => {
  const match = createMatch();
  match.player.hearts = 6;
  match.pickups.push({ kind: "heart", x: match.player.x, y: match.player.y, r: 12 });
  collectPickups(match.player, match.pickups);
  assert.equal(match.player.hearts, 7);
  match.pickups.push({ kind: "rpg", x: match.player.x, y: match.player.y, r: 14 });
  collectPickups(match.player, match.pickups);
  assert.equal(match.player.weapon, "rpg");
  heal(match.player, 20);
  assert.equal(match.player.hearts, MAX_HEARTS);
});

test("reach slaps the foe for one heart when the tip lands", () => {
  const match = createMatch();
  match.foe.x = match.player.x + 40;
  match.foe.y = match.player.y;
  startReach(match, match.player);
  const event = stepReach(match, 1);
  assert.equal(event.type, "slap");
  assert.equal(match.foe.hearts, 9);
});

test("empty hearts decide the winner", () => {
  const match = createMatch();
  assert.equal(winnerOf(match), null);
  hurt(match.player, 10);
  assert.equal(winnerOf(match), "foe");
});

test("CPU hunts a gun when unarmed and keeps inside the circle during a step", () => {
  const match = createMatch();
  match.pickups.push({ kind: "pistol", x: match.arena.x + 80, y: match.arena.y - 40, r: 14 });
  const aim = cpuTarget(match);
  assert.equal(aim.x, match.arena.x + 80);
  stepMatch(match, 0.05, { tx: match.arena.x, ty: match.arena.y }, () => 0.1);
  const d = Math.hypot(match.foe.x - match.arena.x, match.foe.y - match.arena.y);
  assert.ok(d <= match.arena.r - match.foe.r + 0.01);
});

test("spawn stays on the ring and the spec stays original Dua", () => {
  const match = createMatch();
  const item = spawnPickup(match, () => 0.2);
  const d = Math.hypot(item.x - match.arena.x, item.y - match.arena.y);
  assert.ok(d < match.arena.r);
  const dir = dirname(fileURLToPath(import.meta.url));
  const spec = readFileSync(join(dir, "../../docs/dua.md"), "utf8");
  assert.match(spec, /对圈 Dua/);
  assert.match(spec, /不是\*\* PIXLOOP|不是 PIXLOOP/);
});
