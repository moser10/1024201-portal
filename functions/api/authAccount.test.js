import test from "node:test";
import assert from "node:assert/strict";
import { parseUsername, parseNewEmail, parsePasswordPair } from "./authAccount.js";

test("settings username and email rules", () => {
  assert.equal(parseUsername("ab").error, "short_name");
  assert.equal(parseUsername("abcdef").username, "abcdef");
  assert.equal(parseNewEmail("nope").error, "bad_email");
  assert.equal(parseNewEmail("a@b.com", "a@b.com").error, "same_email");
  assert.equal(parseNewEmail("New@B.com", "old@b.com").email, "new@b.com");
  assert.equal(parsePasswordPair("123", "123").error, "short_pass");
  assert.equal(parsePasswordPair("123456", "654321").error, "pass_mismatch");
});
