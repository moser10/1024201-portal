import test from "node:test";
import assert from "node:assert/strict";
import { wrapSystemMail, accountClosedMailHtml, MAIL_AUTO_LINE, MAIL_CLOSE_LINE } from "./_mail.js";

test("system mail appends auto-notice and closing when missing", () => {
  const out = wrapSystemMail("<p>hello</p>");
  assert.match(out, new RegExp(MAIL_AUTO_LINE));
  assert.match(out, new RegExp(MAIL_CLOSE_LINE));
  const once = wrapSystemMail(out);
  assert.equal(once.split(MAIL_AUTO_LINE).length, 2);
  assert.equal(once.split(MAIL_CLOSE_LINE).length, 2);
});

test("祝好 counts as a closing so 此致敬礼 is not added", () => {
  const html = wrapSystemMail("<p>账号已注销。</p><p>感谢陪伴，祝好。</p>");
  assert.match(html, /请勿回复/);
  assert.equal(html.includes(MAIL_CLOSE_LINE), false);
});

test("account closed mail names the user", () => {
  assert.match(accountClosedMailHtml("moser"), /moser/);
  assert.match(accountClosedMailHtml("moser"), /已经被注销/);
});
