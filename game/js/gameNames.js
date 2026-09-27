/** Display names only. Paths stay paddlemaze / dua. */
export const GAME_NAMES = Object.freeze({
  paddle: Object.freeze({ zh: "打砖块", en: "Paddle", ja: "ブロック崩し" }),
  dua: Object.freeze({ zh: "对圈", en: "Dua", ja: "ガツン" }),
});

export function gameName(id, lang) {
  const row = GAME_NAMES[id];
  if (!row) return "";
  return row[lang] || row.en;
}
