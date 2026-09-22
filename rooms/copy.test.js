import test from "node:test";
import assert from "node:assert/strict";
import { ROOMS_COPY, roomsCopy } from "./copy.js";

test("rooms tile labels stay distinct in the three portal languages", () => {
  assert.equal(ROOMS_COPY.zh.title, "开房");
  assert.equal(ROOMS_COPY.en.title, "Rooms");
  assert.equal(ROOMS_COPY.ja.title, "ルーム");
  assert.notEqual(roomsCopy("zh").tabGame, roomsCopy("zh").tabChat);
  assert.match(roomsCopy("en").sub, /Dua/);
  assert.equal(roomsCopy("zh").close, "关闭房间");
  assert.match(roomsCopy("zh").closeAsk, /聊天记录/);
  assert.equal(roomsCopy("zh").practice, "练习");
  assert.equal(roomsCopy("zh").gameDua, "对圈");
  assert.equal(roomsCopy("en").gameDua, "Dua");
  assert.equal(roomsCopy("ja").gameDua, "ガツン");
  assert.equal(roomsCopy("zh").create, "开房");
  assert.equal(roomsCopy("en").create, "Get a room");
  assert.equal(roomsCopy("ja").create, "休憩する");
  assert.equal(roomsCopy("zh").ready, "准备");
  assert.equal(roomsCopy("zh").startMatch, "开始");
  assert.equal(roomsCopy("zh").enterDua, "进入联机对战");
  assert.equal(roomsCopy("en").enterDua, "Online Battle");
  assert.equal(roomsCopy("ja").enterDua, "オンライン対戦");
  assert.equal(roomsCopy("en").unready, "Unready");
  assert.equal(roomsCopy("ja").unready, "準備解除");
  assert.equal(roomsCopy("zh").call, "呼叫");
});
