/**
 * Lyrics body cleaner for 找歌词.
 *
 * Rules (deterministic, no model call):
 * - Strip LRC timestamps anywhere: [mm:ss], [mm:ss.s], [mm:ss.ss], [mm:ss.sss],
 *   several on one line, and the same forms in the middle of a line.
 * - Drop a line only when its shape is metadata: role label plus ：/:, "by",
 *   a title/artist banner, a legal/company credit, or a bracket whose inside
 *   is only that kind of note.
 * - A sung line that merely contains 吉他 / guitar stays. "我抱着吉他" stays.
 * - A leading title/artist echo is removed only in the opening header, and only
 *   when a credit, a "artist - title" banner, or both a title echo and an artist
 *   echo are also there. A real first line that equals the title and is followed
 *   by a lyric stays. Later repeats stay.
 */

const ROLES = [
  "母带工程师",
  "制作人",
  "录音师",
  "混音师",
  "电吉他",
  "木吉他",
  "架子鼓",
  "打击乐",
  "小提琴",
  "大提琴",
  "萨克斯",
  "合成器",
  "编程",
  "作词",
  "作曲",
  "编曲",
  "填词",
  "词曲",
  "监制",
  "出品",
  "发行",
  "策划",
  "企划",
  "和声",
  "合声",
  "和音",
  "伴唱",
  "主唱",
  "原唱",
  "演唱",
  "歌手",
  "吉他",
  "贝斯",
  "贝司",
  "键盘",
  "钢琴",
  "弦乐",
  "混音",
  "母带",
  "录音",
  "二胡",
  "古筝",
  "琵琶",
  "口琴",
  "笛子",
  "长笛",
  "小号",
  "长号",
  "圆号",
  "统筹",
  "宣传",
  "人声",
  "词",
  "曲",
  "鼓",
  "executive",
  "publisher",
  "marketing",
  "distribution",
  "arrangement",
  "arranger",
  "percussion",
  "saxophone",
  "featuring",
  "production",
  "producer",
  "produced",
  "recording",
  "recorded",
  "engineer",
  "keyboard",
  "harmony",
  "strings",
  "mastered",
  "mastering",
  "lyricist",
  "composer",
  "lyrics",
  "written",
  "guitars",
  "guitar",
  "vocals",
  "vocal",
  "piano",
  "drums",
  "drum",
  "bass",
  "label",
  "mixed",
  "mixer",
  "program",
  "cover",
  "music",
  "words",
  "feat",
  "a&r",
  "op",
  "sp",
];

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ROLE_SRC = [...ROLES]
  .sort((a, b) => b.length - a.length)
  .map(escapeRe)
  .join("|");

const ROLE_GROUP = `(?:${ROLE_SRC})(?:\\s*[/、,&+＋]\\s*(?:${ROLE_SRC}))*`;
const CREDIT_LINE = new RegExp(`^${ROLE_GROUP}\\s*[:：]\\s*(.+)$`, "i");
const BY_LINE = /^(?:produced|written|composed|arranged|lyrics|lyric|music|words|performed)\s+by\s+(.+)$/i;
const FEAT_LINE = /^(?:feat\.?|featuring)\s+(.+)$/i;
const LABELED_TITLE = /^(?:歌名|歌曲|曲名|曲目|title|track|song)\s*[:：]\s*\S/i;
const BANNED =
  /版权|保留一切权利|All Rights Reserved|未经.*授权|不得.*(翻唱|使用|转载)|未经授权|©|℗|发行公司|唱片公司|制作公司|音乐发行/i;
const SECTION =
  /^(?:副歌|主歌|前奏|间奏|尾奏|桥段|预副歌|导歌|chorus|verse|bridge|intro|outro|hook|refrain|interlude|pre-chorus|solo|break)$/i;
const LRC_META_SRC =
  "\\[(?:ar|ti|al|by|offset|length|re|ve|au|tool|id|la|hash|sign|total|qq)\\s*:[^\\]]*\\]";
const BRACKET_PAIRS = [
  ["（", "）"],
  ["(", ")"],
  ["【", "】"],
  ["[", "]"],
  ["［", "］"],
];

function trimLine(value) {
  return String(value ?? "").replace(/^[\t \u00a0\u3000]+|[\t \u00a0\u3000]+$/g, "");
}

function fold(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[《》「」『』“”"'‘’〈〉（）()【】[\]［］<>]/g, "")
    .replace(/[.,，。!！?？:：;；\-—–~～·•|｜/／\\]+/g, "");
}

function bandStem(value) {
  return value.replace(/(?:乐队|乐团|组合|樂隊)$/u, "");
}

function sameName(a, b) {
  const left = fold(a);
  const right = fold(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const ls = bandStem(left);
  const rs = bandStem(right);
  return ls.length >= 2 && ls === rs;
}

function matchesIdentity(line, value) {
  if (!value) return false;
  if (sameName(line, value)) return true;
  return String(value)
    .split(/[/／|｜]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => sameName(line, part));
}

function isNameLike(value) {
  const text = trimLine(value);
  if (!text || text.length > 40) return false;
  if (/[。！？?!；;]/.test(text)) return false;
  const parts = text.split(/\s*[/、,&，,＋+]\s*/).filter(Boolean);
  if (!parts.length || parts.length > 8) return false;
  return parts.every((part) => {
    const cjk = part.match(/[\u4e00-\u9fff]/g);
    if (cjk) {
      if (/[ \t]/.test(part)) return false;
      return cjk.length <= 4 && part.length <= 12;
    }
    const words = part.split(/\s+/).filter(Boolean);
    return words.length <= 4 && part.length <= 32 && /^[\p{L}\p{N}.'’\-]+(?:\s+[\p{L}\p{N}.'’\-]+)*$/u.test(part);
  });
}

function creditValue(line) {
  const text = trimLine(line);
  for (const re of [CREDIT_LINE, BY_LINE, FEAT_LINE]) {
    const match = text.match(re);
    if (match && isNameLike(match[1])) return match[1];
  }
  const wrapped = text.match(/^[【\[]([^【】\[\]]+)[】\]]\s*(.+)$/);
  if (wrapped && isRoleOnly(wrapped[1]) && isNameLike(wrapped[2])) return wrapped[2];
  return null;
}

function isCreditText(line) {
  return creditValue(line) != null;
}

function isRoleOnly(text) {
  return new RegExp(`^${ROLE_GROUP}$`, "i").test(trimLine(text));
}

function isSectionTag(text) {
  return SECTION.test(trimLine(text));
}

function isSeparator(text) {
  return /^(?:—+|-{2,}|–+|·{2,}|…+|\.{3,}|_{3,})$/.test(trimLine(text));
}

function isBanned(text) {
  return BANNED.test(trimLine(text));
}

function isCompanyLine(text) {
  return /^[\w\s./,&+-]+\s*(?:厂牌|工作室|Studio|Records|Entertainment)$/i.test(trimLine(text));
}

function isLabeledTitle(text) {
  return LABELED_TITLE.test(trimLine(text));
}

function isArtistTitleBanner(line, ctx) {
  if (!ctx.title || !ctx.artist) return false;
  const parts = trimLine(line)
    .split(/\s*[-—–~～－|｜/／]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 2) return false;
  const [a, b] = parts;
  return (
    (matchesIdentity(a, ctx.artist) && matchesIdentity(b, ctx.title)) ||
    (matchesIdentity(a, ctx.title) && matchesIdentity(b, ctx.artist))
  );
}

export function stripLrcTimestamps(text) {
  const time = "\\d{1,2}\\s*:\\s*\\d{2}(?:\\s*\\.\\s*\\d{1,3})?";
  const bracket = new RegExp(`[\\[［]\\s*${time}\\s*[\\]］]`, "g");
  const angle = new RegExp(`<\\s*${time}\\s*>`, "g");
  return String(text ?? "").replace(bracket, "").replace(angle, "");
}

function stripLrcMeta(text) {
  return String(text ?? "").replace(new RegExp(LRC_META_SRC, "gi"), "");
}

function stripBracketAnnotations(line) {
  let next = line;
  for (const [open, close] of BRACKET_PAIRS) {
    const re = new RegExp(`${escapeRe(open)}([^${escapeRe(open)}${escapeRe(close)}]*)${escapeRe(close)}`, "g");
    next = next.replace(re, (full, inner) => {
      const text = trimLine(inner);
      if (!text) return full;
      if (isSectionTag(text) || isRoleOnly(text) || isCreditText(text)) return "";
      return full;
    });
  }
  return next.replace(/[ \t]{2,}/g, " ");
}

function wholeBracketKind(line) {
  const match = trimLine(line).match(/^[（(【\[［]([^（）()【】\[\]［］]*)[）)】\]］]$/);
  if (!match) return null;
  const text = trimLine(match[1]);
  if (isSectionTag(text) || isRoleOnly(text) || isCreditText(text)) return "credit";
  return null;
}

function stripEdgeCredits(line) {
  let text = line;
  const lead = text.match(new RegExp(`^(?:${ROLE_GROUP})\\s*[:：]\\s*([^\\s：:]{1,16})\\s+(\\S.*)$`, "i"));
  if (lead && isNameLike(lead[1]) && /[\u4e00-\u9fff]/.test(lead[1])) text = lead[2];
  const trail = text.match(new RegExp(`^(.*\\S)\\s+(?:${ROLE_GROUP})\\s*[:：]\\s*(.+)$`, "i"));
  if (trail && isNameLike(trail[2])) text = trail[1];
  return trimLine(text.replace(/[ \t]{2,}/g, " "));
}

function prepare(raw, ctx) {
  const trimmed = trimLine(raw);
  if (!trimmed) return { text: "", kind: "blank" };

  const bracketKind = wholeBracketKind(trimmed);
  let text = trimLine(stripBracketAnnotations(trimmed).replace(/[ \t]{2,}/g, " "));
  if (!text) return { text: "", kind: bracketKind || "drop" };

  const bulleted = text.replace(/^(?:[-*·•※]+)\s+/, "");
  if (bulleted !== text && (isCreditText(bulleted) || isSeparator(bulleted) || isLabeledTitle(bulleted))) {
    text = bulleted;
  }

  if (isSeparator(text)) return { text, kind: "sep" };
  if (isBanned(text)) return { text, kind: "banned" };
  if (isCompanyLine(text) || isCreditText(text) || isLabeledTitle(text)) return { text, kind: "credit" };
  if (isArtistTitleBanner(text, ctx)) return { text, kind: "banner" };

  text = stripEdgeCredits(text);
  if (!text) return { text: "", kind: "credit" };
  if (isCreditText(text) || isLabeledTitle(text)) return { text, kind: "credit" };
  if (ctx.title && matchesIdentity(text, ctx.title)) return { text, kind: "titleEcho" };
  if (ctx.artist && matchesIdentity(text, ctx.artist)) return { text, kind: "artistEcho" };
  return { text, kind: "lyric" };
}

export function cleanLyricsText(text, context = {}) {
  const ctx = {
    title: context?.title || context?.trackName || "",
    artist: context?.artist || context?.artistName || "",
  };
  let raw = String(text ?? "");
  if (!raw.trim()) return "";
  raw = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  raw = stripLrcMeta(stripLrcTimestamps(raw));

  const items = [];
  for (const line of raw.split("\n")) {
    const item = prepare(line, ctx);
    if (item.kind !== "drop") items.push(item);
  }

  let headerEnd = 0;
  for (; headerEnd < items.length; headerEnd++) {
    if (items[headerEnd].kind === "lyric") break;
  }
  const header = items.slice(0, headerEnd);
  const strong =
    header.some((item) => item.kind === "credit" || item.kind === "banner" || item.kind === "banned") ||
    (header.some((item) => item.kind === "titleEcho") && header.some((item) => item.kind === "artistEcho"));

  function nextNonBlank(index) {
    for (let cursor = index + 1; cursor < items.length; cursor++) {
      if (items[cursor].kind !== "blank") return items[cursor].kind;
    }
    return "end";
  }

  const out = [];
  for (let index = 0; index < items.length; index++) {
    const kind = items[index].kind;
    if (kind === "credit" || kind === "banned" || kind === "sep") continue;
    if (index < headerEnd && kind === "banner") continue;
    if (index < headerEnd && strong && kind === "blank") continue;
    if (index < headerEnd && strong && (kind === "titleEcho" || kind === "artistEcho")) {
      if (kind === "titleEcho" && nextNonBlank(index) === "lyric") out.push(items[index].text);
      continue;
    }
    out.push(items[index].text);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
