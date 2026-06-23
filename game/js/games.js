import { getBarLang } from "./userBar.js";

/** 各游戏在大厅 / 房间内展示的元信息 */
export const GAMES = {
  osn: {
    id: "osn",
    nameEn: "One Sentence Novel",
    nameZh: {
      zh: "一人一句写小说",
      en: "One Sentence Novel",
      ja: "一文執筆",
      bo: "ཚིག་གཅིག་དེབ་འབྲི།",
    },
    lobbyTitle: {
      zh: "大厅之：一人一句写小说",
      en: "Lobby: One Sentence Novel",
      ja: "ロビー：一文執筆",
      bo: "སྒོ་འབྱེད། ཚིག་གཅིག་དེབ་འབྲི།",
    },
  },
};

export function getGame(gameId) {
  const lang = getBarLang();
  const raw = GAMES[gameId];
  if (!raw) {
    return {
      id: gameId || "game",
      nameEn: gameId?.toUpperCase() || "Game",
      nameZh: gameId || "游戏",
      lobbyTitle: `大厅之：${gameId || "游戏"}`,
    };
  }
  return {
    id: raw.id,
    nameEn: raw.nameEn,
    nameZh: raw.nameZh[lang] || raw.nameZh.zh,
    lobbyTitle: raw.lobbyTitle[lang] || raw.lobbyTitle.zh,
  };
}
