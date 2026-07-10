/** Strip LRC timestamps, credits, labels — lyrics body only. */
export function cleanLyricsText(text) {
  if (!text) return "";
  const credit =
    /^(作词|作曲|编曲|制作|制作人|监制|出品|发行|策划|和声|吉他|贝斯|鼓|键盘|钢琴|混音|母带|录音|弦乐|打击乐|Program|OP|SP|Label|Publisher|Executive|A&R|Marketing|Distribution|Cover|Featuring|Feat\.?|Produced|Production|Mixed|Mastered|Recorded|Engineer|Guitar|Bass|Drum|Keyboard|Piano|Vocal|Harmony|Strings|Percussion|Arrangement)/i;
  const banned =
    /版权|保留一切权利|All Rights Reserved|未经.*授权|不得.*(翻唱|使用|转载)|未经授权|©|℗|发行公司|唱片公司|制作公司|音乐发行/i;

  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\[\d{1,2}:\d{2}(?:\.\d{2,3})?\]/g, "")
    .replace(/\[[a-z]+:[^\]]*\]/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (credit.test(line)) return false;
      if (banned.test(line)) return false;
      if (/^(—|--|——|·{2,})\s*$/.test(line)) return false;
      if (/^[\w\s./,&+-]+\s*(厂牌|唱片|工作室|Studio|Records|Entertainment|Music)$/i.test(line)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
