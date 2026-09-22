import test from "node:test";
import assert from "node:assert/strict";
import { hallBackLabel, roomBackLabel, resolveNavBack, setNavBack, roomReturnId, clearNavBack } from "./navBack.js";

const mem = {};
globalThis.sessionStorage = {
  setItem(k, v) { mem[k] = String(v); },
  getItem(k) { return Object.hasOwn(mem, k) ? mem[k] : null; },
};

test("hall back is one shared lobby phrase", () => {
  assert.equal(hallBackLabel("zh"), "返回大厅");
  assert.equal(hallBackLabel("en"), "Back to lobby");
  assert.equal(hallBackLabel("ja"), "ロビーへ");
});

test("entry context can send Dua back to a room without the room name", () => {
  setNavBack({ type: "room", roomId: "AB12", roomTitle: "夜场" });
  const nav = resolveNavBack("zh", { follow: true, fallback: "game" });
  assert.equal(nav.href, "/rooms/");
  assert.equal(nav.label, "返回房间");
  assert.equal(roomBackLabel("en"), "Back to room");
  assert.equal(roomBackLabel("ja"), "部屋へ");
  assert.equal(resolveNavBack("en", "rooms").href, "/rooms/");
});

test("only an explicit room return reopens a room", () => {
  setNavBack({ type: "room", roomId: "AB12", roomTitle: "夜场" });
  assert.equal(roomReturnId(), "AB12");
  clearNavBack("hall");
  assert.equal(roomReturnId(), "");
  setNavBack({ type: "rooms" });
  assert.equal(roomReturnId(), "");
  assert.equal(resolveNavBack("zh", "hall").href, "/");
  assert.equal(resolveNavBack("zh", "hall").label, "返回大厅");
});
