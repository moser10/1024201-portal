import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWallRects, playField, wallRole } from "./walls.js";
import {
  STALL_WINDOW_SEC,
  applyStallActions,
  brickChangeRatio,
  createStallReliefState,
  pickFrameHole,
  pickInteriorCuts,
  resetStallRelief,
  tickStallRelief,
} from "./stallRelief.js";

const first = () => 0;
const walls = [
  { x: 10, y: 10, w: 10, h: 10, role: "frame-top" },
  { x: 80, y: 10, w: 10, h: 10, role: "frame-top" },
  { x: 10, y: 40, w: 10, h: 10, role: "frame-left" },
  { x: 200, y: 40, w: 10, h: 10, role: "frame-right" },
  { x: 40, y: 200, w: 10, h: 10, role: "frame-bottom" },
  { x: 50, y: 50, w: 10, h: 10, role: "interior" },
  { x: 70, y: 50, w: 10, h: 10, role: "interior" },
  { x: 90, y: 50, w: 10, h: 10, role: "interior" },
  { x: 110, y: 50, w: 10, h: 10, role: "interior" },
  { x: 130, y: 50, w: 10, h: 10, role: "interior" },
  { x: 150, y: 50, w: 10, h: 10, role: "interior" },
  { x: 170, y: 50, w: 10, h: 10, role: "interior" },
];

function fire(state, elapsed, brickCount, extra = {}) {
  return tickStallRelief(state, {
    elapsed,
    brickCount,
    walls: extra.walls || walls,
    bricks: extra.bricks || [],
    rng: extra.rng || first,
  });
}

test("4 minutes of <20% brick change opens one top-frame cell only", () => {
  const state = resetStallRelief(createStallReliefState(), 100);
  assert.deepEqual(fire(state, 239, 90), []);
  const actions = fire(state, 240, 90);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "hole");
  assert.equal(walls[actions[0].index].role, "frame-top");
  assert.equal(state.windowsFired, 1);
});

test("20% progress in the first window skips the top hole", () => {
  const state = resetStallRelief(createStallReliefState(), 100);
  assert.deepEqual(fire(state, 240, 80), []);
  assert.equal(state.markBricks, 80);
});

test("second window measures change since the 4-minute snapshot, not start", () => {
  const state = resetStallRelief(createStallReliefState(), 100);
  fire(state, 240, 70);
  const actions = fire(state, 480, 60);
  assert.equal(actions.some((a) => a.type === "hole"), true);
  assert.ok(["frame-top", "frame-left", "frame-right"].includes(walls[actions.find((a) => a.type === "hole").index].role));
});

test("at 8 minutes remaining bricks above 50% cut 6 interior steel, never the frame", () => {
  const state = resetStallRelief(createStallReliefState(), 100);
  fire(state, 240, 90);
  const actions = fire(state, 480, 85);
  const interior = actions.find((a) => a.type === "interior");
  assert.ok(interior);
  assert.equal(interior.indices.length, 6);
  assert.ok(interior.indices.every((i) => walls[i].role === "interior"));
  const next = applyStallActions(walls, actions);
  assert.equal(next.some((w) => w.role === "frame-bottom"), true);
  assert.ok(next.filter((w) => w.role === "interior").length < walls.filter((w) => w.role === "interior").length);
});

test("8 minutes at or below 50% remaining does not cut interior steel", () => {
  const state = resetStallRelief(createStallReliefState(), 100);
  fire(state, 240, 40);
  const actions = fire(state, 480, 40);
  assert.equal(actions.some((a) => a.type === "interior"), false);
});

test("after 8 minutes a stalled 4-minute window punches another T/L/R hole", () => {
  const state = resetStallRelief(createStallReliefState(), 100);
  fire(state, 240, 90);
  fire(state, 480, 85);
  const actions = fire(state, 720, 80);
  assert.equal(actions.some((a) => a.type === "hole"), true);
  assert.notEqual(walls[actions.find((a) => a.type === "hole").index].role, "frame-bottom");
});

test("hole pick prefers a frame cell next to remaining bricks", () => {
  const bricks = [{ x: 80, y: 22, w: 10, h: 10 }];
  const index = pickFrameHole(walls, ["frame-top"], first, bricks);
  assert.equal(index, 1);
});

test("pickFrameHole never returns the paddle-side frame", () => {
  const index = pickFrameHole(walls, ["frame-top", "frame-left", "frame-right"], first, []);
  assert.notEqual(walls[index].role, "frame-bottom");
  assert.equal(pickInteriorCuts(walls, 6, first).length, 6);
});

test("brick change ratio and wall roles stay in the documented bands", () => {
  assert.equal(brickChangeRatio(100, 81), 0.19);
  assert.ok(brickChangeRatio(100, 80) >= 0.2);
  assert.equal(wallRole(0, 4, 26, 32), "frame-top");
  assert.equal(wallRole(25, 4, 26, 32), "frame-bottom");
  assert.equal(wallRole(4, 0, 26, 32), "frame-left");
  assert.equal(wallRole(4, 31, 26, 32), "frame-right");
  assert.equal(wallRole(4, 4, 26, 32), "interior");
  assert.equal(STALL_WINDOW_SEC, 240);
});

test("live level steel is tagged so relief can tell frame from interior", () => {
  const field = playField({ w: 900, h: 1100, paddleY: 1042 }, { rows: 26, cols: 32, seed: 1042 + 1 * 201 });
  const rects = buildWallRects(0, field, { w: 900, h: 1100, paddleY: 1042 });
  assert.ok(rects.some((w) => w.role === "frame-top"));
  assert.ok(rects.some((w) => w.role === "interior"));
  assert.ok(rects.some((w) => w.role === "frame-bottom"));
});

test("game page hides the stall clock and still wires the relief tick", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const js = readFileSync(join(dir, "game.js"), "utf8");
  const html = readFileSync(join(dir, "index.html"), "utf8");
  assert.match(js, /tickStallRelief/);
  assert.match(js, /resetStallRelief\(stallRelief, bricks\.length\)/);
  assert.match(js, /launchHeldBalls[\s\S]*resetStallRelief/);
  assert.equal(js.includes("stallTime"), false);
  assert.equal(html.includes("stall"), false);
});
