import test from "node:test";
import assert from "node:assert/strict";
import { GAME_NAMES, gameName } from "./gameNames.js";

test("paddle and dua names stay short in each portal language", () => {
  assert.equal(GAME_NAMES.paddle.zh, "打砖块");
  assert.equal(GAME_NAMES.paddle.en, "Paddle");
  assert.equal(GAME_NAMES.paddle.ja, "ブロック崩し");
  assert.equal(gameName("dua", "en"), "Dua");
  assert.equal(gameName("dua", "ja"), "ガツン");
  assert.equal(gameName("dua", "zh"), "对圈");
});
