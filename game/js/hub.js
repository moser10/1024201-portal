import { getUser } from "./store.js";
import { mountUserBar, getBarLang } from "./userBar.js";

const GAMES = [
  {
    id: "osn",
    code: "OSN",
    title: { zh: "一人一句，一句成书", en: "One sentence, one novel", ja: "一文執筆", bo: "ཚིག་གཅིག་དེབ་འབྲི།" },
    fullName: "One Sentence Novel",
    href: "onesentence/",
    gradient: "linear-gradient(135deg, #ff5e62 0%, #ff9966 100%)",
  },
];

const HUB_I18N = {
  zh: { title: "游戏中心", sub: "一票通账号 · 选一个游戏开始", back: "← 返回门户" },
  en: { title: "Game Center", sub: "One account · pick a game", back: "← Back to portal" },
  ja: { title: "ゲームセンター", sub: "共通アカウント · ゲームを選ぶ", back: "← ポータルへ" },
  bo: { title: "རོལ་རྩེད་ལྟེ་གནས།", sub: "ཐོ་ཡིག་གཅིག · རོལ་རྩེད་འདེམས།", back: "← སྒོ་འབྱེད་ལོག" },
};

const app = document.getElementById("app");
const lang = getBarLang();
const t = HUB_I18N[lang] || HUB_I18N.zh;

app.innerHTML = `
  <div class="hub">
    <div class="hub-top">
      <a href="/" class="back">${t.back}</a>
      <div id="hubUserBar"></div>
    </div>
    <h1>${t.title}</h1>
    <p class="sub">${t.sub}</p>
    <div class="grid" id="gameGrid"></div>
  </div>`;

mountUserBar(document.getElementById("hubUserBar"), { variant: "game", returnPath: "game/" });

const grid = document.getElementById("gameGrid");
grid.innerHTML = GAMES.map((g) => {
  const label = g.title[lang] || g.title.zh;
  return `
  <a class="game-card" href="${g.href}" data-href="${g.href}" data-id="${g.id}">
    <div class="game-icon" style="background:${g.gradient}">
      <span class="game-code">${g.code}</span>
    </div>
    <div class="game-label">${label}</div>
    <div class="game-full">${g.fullName}</div>
  </a>`;
}).join("");

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
