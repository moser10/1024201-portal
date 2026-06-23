const GAMES = [
  {
    id: "onesentence",
    title: "一人一句，一句成书",
    icon: "📝",
    href: "onesentence/",
  },
];

const app = document.getElementById("app");

app.innerHTML = `
  <div class="hub">
    <a href="/" class="back">← 返回门户</a>
    <h1>游戏中心</h1>
    <p class="sub">选择一个游戏开始</p>
    <div class="grid">
      ${GAMES.map(
        (g) => `
        <a class="game-card" href="${g.href}">
          <div class="game-icon">${g.icon}</div>
          <div class="game-label">${g.title}</div>
        </a>`
      ).join("")}
    </div>
  </div>`;
