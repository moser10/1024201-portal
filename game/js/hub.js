import { getUser } from "./store.js";
import { mountAccountChrome } from "/js/accountChrome.js?v=3";
import { getPortalLang } from "/js/langTabs.js";
import { hallBackLabel, setNavBack } from "/js/navBack.js?v=3";
import { GAME_NAMES } from "./gameNames.js?v=1";

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
    title: GAME_NAMES.paddle,
    fullName: GAME_NAMES.paddle.en,
    href: "paddlemaze/",
    gradient: "linear-gradient(135deg, #ff42bb 0%, #8b0aa8 58%, #24113f 100%)",
  },
  {
    id: "dua",
    code: "DUA",
    title: GAME_NAMES.dua,
    fullName: GAME_NAMES.dua.en,
    href: "dua/",
    gradient: "linear-gradient(160deg, #64d2ff 0%, #00c7be 48%, #0040c7 100%)",
  },
];

const HUB_I18N = {
  zh: { title: "游戏中心" },
  en: { title: "Game Center" },
  ja: { title: "ゲームセンター" },
};

const lang = getPortalLang();
const t = HUB_I18N[lang] || HUB_I18N.zh;

document.getElementById("hubTitle").textContent = t.title;
document.getElementById("hubBack").textContent = hallBackLabel(lang);

mountAccountChrome(document.getElementById("hubAccountChrome"), {
  variant: "game",
  returnPath: "game/",
  layout: "horizontal",
});

const grid = document.getElementById("gameGrid");
for (const game of GAMES) {
  const label = grid.querySelector(`[data-label="${game.id}"]`);
  if (label) label.textContent = game.title[lang] || game.title.zh;
  const full = grid.querySelector(`[data-full="${game.id}"]`);
  if (full) full.textContent = game.fullName;
}

grid.querySelectorAll(".game-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    e.preventDefault();
    const href = card.dataset.href;
    if (!getUser()) {
      window.location.href = `/game/register/?return=${encodeURIComponent(href)}`;
      return;
    }
    setNavBack({ type: href.includes("dua") ? "game" : "hall" });
    window.location.href = href;
  });
});
