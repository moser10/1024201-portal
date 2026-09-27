import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./openroom.js", import.meta.url), "utf8");

test("room hot path does not migrate schema before every join/sync", () => {
  assert.match(src, /if \(action === "create"\) await ensureOpenRoomSchema/);
  assert.doesNotMatch(src, /await ensureOpenRoomSchema\(db\);\s*\n\s*const body = await readBodyUser/);
  assert.match(src, /chat: false/);
  assert.match(src, /missingRoomsSchema/);
});
