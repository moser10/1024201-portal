import { getUser } from "./store.js";
import { mountAccountChrome } from "/js/accountChrome.js";
import { getPortalLang } from "/js/langTabs.js";

const GAMES = [
  {
    id: "osn",
    code: "OSN",
    title: { zh: "一人一句，一句成书", en: "One sentence, one novel", ja: "一文執筆" },
    fullName: "One Sentence Novel",
    href: "onesentence/",
    gradient: "linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)",
  },
  {
    id: "paddlemaze",
    code: "PBM",
    title: { zh: "挡板方块迷宫", en: "Paddle Block Maze", ja: "パドルブロック迷路" },
    fullName: "Paddle Block Maze",
    href: "paddlemaze/",
    gradient: "linear-gradient(135deg, #ff42bb 0%, #8b0aa8 58%, #24113f 100%)",
  },
];

const HUB_I18N = {
  zh: { title: "游戏中心", back: "返回门户" },
  en: { title: "Game Center", back: "Back to portal" },
  ja: { title: "ゲームセンター", back: "ポータルへ" },
};

const lang = getPortalLang();
const t = HUB_I18N[lang] || HUB_I18N.zh;

document.getElementById("hubTitle").textContent = t.title;
document.getElementById("hubBack").textContent = t.back;

mountAccountChrome(document.getElementById("hubAccountChrome"), {
  variant: "game",
  returnPath: "game/",
  layout: "horizontal",
});

const grid = document.getElementById("gameGrid");
for (const game of GAMES) {
  const label = grid.querySelector(`[data-label="${game.id}"]`);
  if (label) label.textContent = game.title[lang] || game.title.zh;
}

grid.querySelectorAll(".game-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    e.preventDefault();
    const href = card.dataset.href;
    if (!getUser()) {
      window.location.href = `/game/register/?return=${encodeURIComponent(href)}`;
      return;
    }
    window.location.href = href;
  });
});
