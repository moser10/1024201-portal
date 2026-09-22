export const PADDLE_COPY = Object.freeze({
  zh: Object.freeze({
    serveTitle: "进入后移动到合适位置，\n松手发送弹珠。",
    paused: "已暂停",
    start: "START",
  }),
  en: Object.freeze({
    serveTitle: "After you enter, move into place.\nRelease to send the marble.",
    paused: "Paused",
    start: "START",
  }),
  ja: Object.freeze({
    serveTitle: "入ったら位置を合わせ、\n指を離してビー玉を出す。",
    paused: "一時停止",
    start: "START",
  }),
});

export function paddleCopy(lang) {
  return PADDLE_COPY[lang] || PADDLE_COPY.en;
}
