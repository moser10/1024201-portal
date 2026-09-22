import test from "node:test";
import assert from "node:assert/strict";
import { hallBackLabel, roomBackLabel, resolveNavBack, setNavBack } from "./navBack.js";

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

test("entry context can send Dua back to a named room", () => {
  setNavBack({ type: "room", roomId: "AB12", roomTitle: "夜场" });
  const nav = resolveNavBack("zh", { follow: true, fallback: "game" });
  assert.equal(nav.href, "/rooms/");
  assert.equal(nav.label, "返回夜场房间");
  assert.equal(roomBackLabel("en", "Night"), "Back to Night");
  assert.equal(resolveNavBack("en", "rooms").href, "/rooms/");
});
