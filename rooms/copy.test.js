import test from "node:test";
import assert from "node:assert/strict";
import { ROOMS_COPY, roomsCopy } from "./copy.js";

test("rooms tile labels stay distinct in the three portal languages", () => {
  assert.equal(ROOMS_COPY.zh.title, "开房");
  assert.equal(ROOMS_COPY.en.title, "Rooms");
  assert.equal(ROOMS_COPY.ja.title, "ルーム");
  assert.notEqual(roomsCopy("zh").tabGame, roomsCopy("zh").tabChat);
  assert.match(roomsCopy("en").sub, /Dua/);
});
