import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, acc);
    else if (/\.(html|js)$/.test(name)) acc.push(abs);
  }
  return acc;
}

function featureTopBlocks(src) {
  const blocks = [];
  const startRe = /<div class="feature-top">/g;
  let m;
  while ((m = startRe.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const nextOpen = src.indexOf("<div", i);
      const nextClose = src.indexOf("</div>", i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + 4;
      } else {
        depth -= 1;
        i = nextClose + 6;
        if (depth === 0) blocks.push(src.slice(m.index + m[0].length, nextClose));
      }
    }
  }
  return blocks;
}

test("feature-top is Back plus language/account chrome, not content actions", () => {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    const rel = relative(root, file);
    for (const block of featureTopBlocks(src)) {
      assert.equal(
        /class="[^"]*\bbtn-primary\b/.test(block) && !/feature-back/.test(block.match(/class="[^"]*\bbtn-primary\b/)?.[0] || ""),
        false,
        `${rel}: btn-primary inside feature-top`,
      );
      assert.equal(
        /id="readEditBtn"|id="editBtn"|id="newBtn"/.test(block),
        false,
        `${rel}: content action inside feature-top`,
      );
    }
  }
});

test("blog reader keeps Edit on the article title row, not beside the lang stack", () => {
  const html = readFileSync(join(root, "blog/index.html"), "utf8");
  const view = readFileSync(join(root, "blog/view.html"), "utf8");
  const css = readFileSync(join(root, "blog/blog.css"), "utf8");
  assert.equal(html.includes("blog-read-actions"), false);
  assert.equal(html.includes("readToolbar"), false);
  assert.match(html, /id="readEditBtn"/);
  const titleRow = html.slice(html.indexOf("blog-article-title"), html.indexOf("readMetaEl"));
  assert.match(titleRow, /readEditBtn/);
  assert.match(titleRow, /blog-title-action/);
  const readTop = html.slice(html.indexOf('id="readView"'), html.indexOf('id="readArticle"'));
  assert.match(readTop, /id="readLangSlot"/);
  assert.equal(readTop.includes("readEditBtn"), false);
  const afterTitle = html.slice(html.indexOf('id="readMetaEl"'), html.indexOf('id="readBodyEl"'));
  assert.equal(afterTitle.includes("readEditBtn"), false);
  const listHead = html.slice(html.indexOf("feature-card-head"), html.indexOf('id="listWrap"'));
  assert.match(listHead, /id="newBtn"/);
  assert.match(listHead, /page-mark-row/);
  assert.equal(html.includes('id="toolbar"'), false);
  const viewTitle = view.slice(view.indexOf("blog-article-title"), view.indexOf("metaEl"));
  assert.match(viewTitle, /id="editBtn"/);
  assert.equal(view.includes("editBar"), false);
  assert.match(css, /blog-title-action/);
  assert.equal(css.includes("blog-read-actions"), false);
});

test("onesentence lobby does not sit Leave beside the vertical lang stack", () => {
  const lobby = readFileSync(join(root, "game/onesentence/js/lobby.js"), "utf8");
  assert.equal(lobby.includes("header-lang-row"), false);
  assert.match(lobby, /class="header-actions"/);
});
