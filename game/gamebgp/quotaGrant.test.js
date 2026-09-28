import test from "node:test";
import assert from "node:assert/strict";
import {
  dateOnly,
  dialogFilledValue,
  displayFtMb,
  grantExtraFromFilled,
} from "./quotaGrant.js";

test("registration date keeps calendar day only", () => {
  assert.equal(dateOnly("2026-09-27 18:04:11"), "2026-09-27");
  assert.equal(dateOnly("2026-09-27T18:04:11.000Z"), "2026-09-27");
  assert.equal(dateOnly(""), "—");
});

test("quota dialog opens on defaults, not zero extra", () => {
  assert.equal(dialogFilledValue("pdf", { pdfAllowed: 5, ftExtra: 0 }), 5);
  assert.equal(dialogFilledValue("lyrics", { lyricsAllowed: 5, ftExtra: 0 }), 5);
  assert.equal(dialogFilledValue("ft", { ftExtra: 0 }), 20);
  assert.equal(dialogFilledValue("ft", { ftExtra: 74 }), 74);
});

test("saved FT capacity is the filled size, not filled plus 20", () => {
  assert.equal(grantExtraFromFilled("ft", "74"), 74);
  assert.equal(displayFtMb(74), 74);
  assert.equal(displayFtMb(0), 20);
  assert.equal(grantExtraFromFilled("pdf", "10"), 5);
  assert.equal(grantExtraFromFilled("pdf", "5"), 0);
});
