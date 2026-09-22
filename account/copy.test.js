import test from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_COPY, accountCopy } from "./copy.js";

test("settings starts as three rows with edit or change", () => {
  const zh = accountCopy("zh");
  assert.equal(ACCOUNT_COPY.zh.title, "设置");
  assert.equal(zh.username, "用户名");
  assert.equal(zh.password, "密码");
  assert.equal(zh.email, "邮箱");
  assert.equal(zh.edit, "编辑");
  assert.equal(zh.change, "更改");
  assert.notEqual(zh.edit, zh.change);
});
