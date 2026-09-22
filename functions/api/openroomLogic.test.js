import test from "node:test";
import assert from "node:assert/strict";
import { makeRoomCode, parseCreate, canJoin, sanitizeMsg, publicRoom, chatFate, CODE_ALPHABET } from "./openroomLogic.js";

test("room codes stay in the readable alphabet", () => {
  for (let i = 0; i < 20; i++) {
    const code = makeRoomCode(() => (i % CODE_ALPHABET.length) / CODE_ALPHABET.length);
    assert.equal(code.length, 4);
    assert.match(code, /^[A-HJ-NP-Z2-9]+$/);
  }
});

test("create accepts dua or chat with optional pin", () => {
  assert.equal(parseCreate({ kind: "house", title: "a" }).error, "bad_kind");
  assert.equal(parseCreate({ kind: "dua", title: "" }).error, "bad_title");
  assert.equal(parseCreate({ kind: "chat", title: "hi", pin: "12" }).error, "bad_pin");
  const ok = parseCreate({ kind: "DUA", title: "  night  ", max_seats: 2, pin: "2048" });
  assert.deepEqual(ok, { kind: "dua", title: "night", pin: "2048", maxSeats: 3 });
  assert.equal(parseCreate({ kind: "chat", title: "talk" }).maxSeats, 0);
});

test("join is blocked when full, closed, or pin is wrong", () => {
  const room = { max_seats: 2, pin: "1024", closed_at: null };
  const seats = [{ user_id: 1 }, { user_id: 2 }];
  assert.equal(canJoin({ room, seats, pin: "1024", userId: 3 }).error, "full");
  assert.equal(canJoin({ room: { ...room, max_seats: 0 }, seats: [{ user_id: 1 }, { user_id: 2 }, { user_id: 9 }], pin: "1024", userId: 3 }).ok, true);
  assert.equal(canJoin({ room, seats: [{ user_id: 1 }], pin: "0000", userId: 3 }).error, "pin");
  assert.equal(canJoin({ room: { ...room, closed_at: "now" }, seats: [], pin: "1024", userId: 3 }).error, "closed");
  assert.equal(canJoin({ room, seats: [{ user_id: 3 }], pin: "nope", userId: 3 }).already, true);
});

test("leave keeps chat; close wipes it for game and chat rooms", () => {
  assert.equal(chatFate("leave"), "keep");
  assert.equal(chatFate("close"), "wipe");
  assert.equal(chatFate("say"), null);
});

test("public rooms hide the pin and chat text is clipped", () => {
  const card = publicRoom({ id: "AB12", kind: "chat", title: "x", host_id: 1, pin: "1111", max_seats: 3, created_at: "t" }, 1);
  assert.equal(card.has_pin, true);
  assert.equal(card.pin, undefined);
  assert.equal(sanitizeMsg("  hi  "), "hi");
  assert.equal(sanitizeMsg("x".repeat(300)), null);
});
