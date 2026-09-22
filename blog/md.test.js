import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown } from "./md.js";

const dir = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(dir, "blog-app.js"), "utf8");
const html = readFileSync(join(dir, "index.html"), "utf8");
const css = readFileSync(join(dir, "blog.css"), "utf8");

test("markdown reader renders headings, emphasis, lists, and code", () => {
  const htmlOut = renderMarkdown(`# Hello\n\nA **bold** and *em* line.\n\n- one\n- two\n\n\`\`\`\ncode\n\`\`\``);
  assert.match(htmlOut, /<h1>Hello<\/h1>/);
  assert.match(htmlOut, /<strong>bold<\/strong>/);
  assert.match(htmlOut, /<em>em<\/em>/);
  assert.match(htmlOut, /<ul>/);
  assert.match(htmlOut, /<pre><code>code<\/code><\/pre>/);
});

test("list clicks open the reader; edit is a separate control", () => {
  assert.match(app, /goRead\(a\.dataset\.id\)/);
  assert.match(app, /goEdit\(btn\.dataset\.id\)/);
  assert.match(app, /function goRead\(/);
  assert.match(html, /id="readView"/);
  assert.match(html, /class="btn-ghost blog-item-edit"/);
  assert.match(html, /id="readBodyEl"/);
  assert.match(html, /blog-textarea-md/);
  assert.equal(/goEdit\(a\.dataset\.id\)/.test(app), false);
});

test("read uses \\?id= and edit uses \\?edit= or \\?new=1", () => {
  assert.match(app, /\/blog\/\?id=\$\{encodeURIComponent/);
  assert.match(app, /\/blog\/\?edit=\$\{encodeURIComponent/);
  assert.match(app, /\/blog\/\?new=1/);
  assert.match(html, /\/blog\/\?edit=/);
});

test("reader keeps Edit out of the top chrome cluster", () => {
  assert.match(html, /id="readToolbar"/);
  assert.equal(html.includes("blog-read-actions"), false);
  const readTop = html.slice(html.indexOf('id="readView"'), html.indexOf('id="readArticle"'));
  assert.equal(readTop.includes("readEditBtn"), false);
});

test("reader uses StackEdit-like serif markdown type", () => {
  assert.match(css, /\.blog-md\s*\{[^}]*Georgia/s);
  assert.match(css, /\.blog-textarea-md/);
  assert.match(css, /\.blog-item-edit/);
});
