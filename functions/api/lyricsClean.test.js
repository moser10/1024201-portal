import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanLyricsText } from "./lyricsClean.js";

const fixtures = JSON.parse(
  readFileSync(new URL("./lyricsClean.fixtures.json", import.meta.url), "utf8"),
);

const wang = { title: "再见青春", artist: "汪峰" };
const compass = { title: "无法逃脱", artist: "指南针" };

test("real NetEase 394756 无法逃脱: [00:38.0] lyric stays, credits go", () => {
  const fixture = fixtures.netease394756;
  assert.equal(fixture.kind, "real-excerpt");
  assert.equal(fixture.containsExact, "[00:38.0]");
  assert.ok(fixture.text.includes("[00:38.0]不知不觉"));
  const out = cleanLyricsText(fixture.text, compass);
  assert.equal(
    out,
    [
      "你眼中怎么　还有一团火",
      "叫我不知道　该如何",
      "我试着想从你眼中逃脱",
      "可心里还想把你挽留",
      "不知不觉　不知不觉",
      "已被你看透",
      "",
      "你问我 这些日子 是怎么过",
    ].join("\n"),
  );
  assert.equal(out.includes("[00:38.0]"), false);
  assert.equal(out.includes("00:38"), false);
  assert.equal(out.includes("作词"), false);
  assert.equal(out.includes("主唱"), false);
  assert.equal(out.includes("吉他"), false);
  assert.equal(out.includes("贝司"), false);
  assert.equal(out.includes("萨克斯"), false);
  assert.equal(cleanLyricsText(out, compass), out);
});

test("real NetEase 155897 再见青春: head and tail credits go, sung 再见 青春 stays", () => {
  const fixture = fixtures.netease155897;
  assert.equal(fixture.kind, "real-excerpt");
  assert.ok(fixture.text.includes("[00:00.00] 作词 : 汪峰"));
  assert.ok(fixture.text.includes("再见 青春"));
  assert.ok(fixture.text.includes("吉他 : 贾轶男"));
  const out = cleanLyricsText(fixture.text, wang);
  assert.equal(
    out,
    [
      "我将在深秋的黎明出发",
      "伴着铁皮车厢的摇晃",
      "伴着野菊花开的芬芳",
      "在梦碎的黎明出发",
      "",
      "再见 青春",
      "再见美丽的疼痛",
    ].join("\n"),
  );
  assert.equal(out.includes("作词"), false);
  assert.equal(out.includes("贾轶男"), false);
  assert.equal(out.includes("编程"), false);
  assert.equal(cleanLyricsText(out, wang), out);
});

test("real NetEase 5274986: three-decimal credit and a different one-decimal stamp", () => {
  const fixture = fixtures.netease5274986;
  assert.equal(fixture.kind, "real-excerpt");
  assert.ok(fixture.text.includes("[00:00.000]"));
  assert.ok(fixture.text.includes("[02:02.0]"));
  assert.equal(fixture.text.includes("[00:38.0]"), false);
  const out = cleanLyricsText(fixture.text, compass);
  assert.equal(out, ["我真的没有你想象好", "想让你和我不一样"].join("\n"));
});

test("real LRCLIB 16665: artist-title banner goes, spaced chorus stays", () => {
  const fixture = fixtures.lrclib16665;
  assert.equal(fixture.kind, "real-excerpt");
  assert.ok(fixture.text.startsWith("汪峰 - 再见青春"));
  const out = cleanLyricsText(fixture.text, wang);
  assert.equal(
    out,
    ["我将在深秋的黎明出发", "伴着铁皮车厢的摇晃", "再见 青春", "再见美丽的疼痛"].join("\n"),
  );
  assert.equal(out.includes("汪峰 - 再见青春"), false);
});

test("user sample [00:38.0] and the other LRC stamp shapes", () => {
  assert.equal(cleanLyricsText("[00:38.0]不知不觉"), "不知不觉");
  assert.equal(cleanLyricsText("前[00:38.0]后"), "前后");
  assert.equal(cleanLyricsText("[00:38.00]两位\n[00:38.000]三位\n[00:38]无小数"), "两位\n三位\n无小数");
  assert.equal(cleanLyricsText("[00:12.00][00:15.50]同一行"), "同一行");
  assert.equal(cleanLyricsText("[00:12.0][00:15.50]同一行一位"), "同一行一位");
  assert.equal(cleanLyricsText("正文[00:38.0]中间还有[01:02.003]字"), "正文中间还有字");
  assert.equal(cleanLyricsText("<00:38.0>词"), "词");
  assert.equal(cleanLyricsText("[ 00:38.0 ]词"), "词");
  assert.equal(cleanLyricsText("[00:01.0]上段\n\n[00:02.00]下段"), "上段\n\n下段");
});

test("synthetic repeated title plus author: header goes, later title stays", () => {
  const raw = ["再见青春", "汪峰", "作词：汪峰", "作曲：汪峰", "", "青春走远了", "再见青春"].join("\n");
  assert.equal(cleanLyricsText(raw, wang), "青春走远了\n再见青春");
});

test("synthetic explicit lyric and composer labels", () => {
  const raw = ["词：张三", "曲：李四", "作词/作曲：王五", "Lyrics: Ada Lovelace", "Guitar: John Smith", "", "正文一句"].join(
    "\n",
  );
  assert.equal(cleanLyricsText(raw, wang), "正文一句");
});

test("synthetic clean lyric is unchanged, including a real first line equal to the title", () => {
  const clean = "海鸥飞过\n\n天空很蓝";
  assert.equal(cleanLyricsText(clean, { title: "海鸥", artist: "某人" }), clean);
  const sungTitle = "再见青春\n青春就这样走远\n再见青春";
  assert.equal(cleanLyricsText(sungTitle, wang), sungTitle);
  const afterCredit = "作词：汪峰\n再见青春\n青春就这样走远";
  assert.equal(cleanLyricsText(afterCredit, wang), "再见青春\n青春就这样走远");
});

test("paragraph blanks collapse only past one empty line", () => {
  assert.equal(cleanLyricsText("甲\n\n乙"), "甲\n\n乙");
  assert.equal(cleanLyricsText("甲\n\n\n\n乙"), "甲\n\n乙");
  assert.equal(cleanLyricsText("\n\n甲\n\n\n乙\n\n"), "甲\n\n乙");
});

test("instrument words inside sung lines stay; credit shapes go", () => {
  const raw = [
    "我抱着吉他",
    "吉他声在夜里响起",
    "鼓声阵阵敲在心上",
    "（我抱着吉他）",
    "不知不觉（吉他：周笛）",
    "不知不觉 吉他：周笛",
    "吉他：周笛 我抱着吉他",
    "（吉他）",
    "（作词：汪峰）",
    "（和声）",
    "吉他：张三",
    "主唱:刘峥嵘",
    "Open your eyes",
    "Cover me",
    "已被你看透（编曲：指南针）继续",
  ].join("\n");
  assert.equal(
    cleanLyricsText(raw, compass),
    [
      "我抱着吉他",
      "吉他声在夜里响起",
      "鼓声阵阵敲在心上",
      "（我抱着吉他）",
      "不知不觉",
      "不知不觉",
      "我抱着吉他",
      "Open your eyes",
      "Cover me",
      "已被你看透继续",
    ].join("\n"),
  );
});

test("predeploy sample still strips the credit line and the legal line", () => {
  const raw = "[00:12.00]海鸥飞过\n吉他：张三\n未经著作权人许可不得翻唱\n天空很蓝";
  const out = cleanLyricsText(raw);
  assert.ok(out.includes("海鸥飞过"));
  assert.ok(out.includes("天空很蓝"));
  assert.equal(out.includes("吉他"), false);
  assert.equal(out.includes("未经著作权"), false);
});

test("print css centers the title and leaves one blank line", () => {
  const css = readFileSync(new URL("../../tools/lyrics/lyrics.css", import.meta.url), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /\.view-title-row h1\s*\{[^}]*text-align:\s*center/s);
  assert.match(print, /margin:\s*0\s+0\s+1\.15em/);
  assert.doesNotMatch(print, /margin:\s*0\s+0\s+2mm/);
});
