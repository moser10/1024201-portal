import test from "node:test";
import assert from "node:assert/strict";
import { FT_BASE_BYTES, ftLimitFromExtraMb } from "./ftQuota.js";

test("FT default pool is 20 MB", () => {
  assert.equal(FT_BASE_BYTES, 20 * 1024 * 1024);
  assert.equal(ftLimitFromExtraMb(0), 20 * 1024 * 1024);
});

test("admin extra is the total capacity in MB", () => {
  assert.equal(ftLimitFromExtraMb(10), 10 * 1024 * 1024);
  assert.equal(ftLimitFromExtraMb(74), 74 * 1024 * 1024);
  assert.equal(ftLimitFromExtraMb(-3), 20 * 1024 * 1024);
});
