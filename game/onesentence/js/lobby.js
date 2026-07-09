import { roomApi } from "./api.js";
import { bindNameCheck } from "./nameCheck.js";
import { getUser, setRoom, clearRoom } from "../../js/store.js";
import { mountUserBar } from "../../js/userBar.js";
import { mountLangTabs } from "/js/langTabs.js";
import { renderTodos } from "../../js/todos.js";
import { showToast } from "../../js/toast.js";

export function renderLobby(app, onEnterRoom, game) {
  const user = getUser();
  if (!user) {
    window.location.href = `/game/register/?return=${encodeURIComponent("onesentence/")}`;
    return;
  }
  let todoTimer = null;
  let lobbyDisposed = false;

  app.innerHTML = `
    <div class="card">
      <div class="header-row">
        <div>
          <p class="game-brand">${game.nameEn}</p>
          <h1>${game.lobbyTitle}</h1>
        </div>
        <div class="row header-lang-row" style="margin:0;flex-wrap:wrap;justify-content:flex-end;align-items:flex-start;">
          <div id="lobbyLangSlot"></div>
          <div id="lobbyUserBar"></div>
          <button type="button" id="leaveLobbyBtn" class="btn-secondary btn-small">返回游戏中心</button>
        </div>
      </div>

      <section class="section todo-section">
        <h2>待办事项</h2>
        <div id="todoBox"><p class="sub">加载中...</p></div>
      </section>

      <section class="section">
        <h2>创建房间</h2>
        <p class="sub">房间名 = 书名（唯一）</p>
        <div class="row">
          <input type="text" id="createTitle" placeholder="书名..." maxlength="30">
          <button type="button" id="titleSuggest" class="btn-secondary disabled" disabled>推荐可用名</button>
        </div>
        <p id="titleHint" class="hint"></p>
        <button id="createBtn" class="btn-primary">创建房间</button>
      </section>

      <section class="section">
        <h2>加入房间</h2>
        <label>邀请码（有码直接进）</label>
        <div class="row">
          <input type="text" id="inviteCode" placeholder="6位邀请码" maxlength="8">
          <button id="joinCodeBtn" class="btn-secondary">进入</button>
        </div>
        <label>或搜索书名</label>
        <div class="row">
          <input type="text" id="searchTitle" placeholder="输入书名关键词">
          <button id="searchBtn" class="btn-secondary">搜索</button>
        </div>
        <div id="searchResults"></div>
      </section>

      <section class="section">
        <h2>我的房间</h2>
        <div id="myRooms"></div>
      </section>
    </div>`;

  mountLangTabs(document.getElementById("lobbyLangSlot"));
  mountUserBar(document.getElementById("lobbyUserBar"), {
    variant: "game",
    returnPath: "onesentence/",
    onLogout: () => {
      lobbyDisposed = true;
      clearInterval(todoTimer);
      window.location.href = "/game/register/";
    },
  });

  document.getElementById("leaveLobbyBtn").onclick = () => {
    clearInterval(todoTimer);
    clearRoom();
    window.location.href = "/game/";
  };

  bindNameCheck({
    input: document.getElementById("createTitle"),
    btn: document.getElementById("titleSuggest"),
    hint: document.getElementById("titleHint"),
    checkFn: roomApi.checkTitle,
  });

  document.getElementById("createBtn").onclick = async () => {
    const title = document.getElementById("createTitle").value.trim();
    if (!title) return alert("请输入书名");
    try {
      const data = await roomApi.create(title, user.id);
      enterRoom({
        id: data.story_id,
        title: data.title,
        invite_code: data.invite_code,
        role: "owner",
      });
    } catch (e) {
      if (e.data?.recommend) {
        document.getElementById("titleHint").textContent = `已被占用，可点推荐名`;
        const btn = document.getElementById("titleSuggest");
        btn.textContent = `推荐: ${e.data.recommend}`;
        btn.dataset.v = e.data.recommend;
        btn.disabled = false;
        btn.classList.remove("disabled");
      }
      alert(e.message);
    }
  };

  document.getElementById("joinCodeBtn").onclick = async () => {
    const code = document.getElementById("inviteCode").value.trim();
    if (!code) return alert("请输入邀请码");
    try {
      const data = await roomApi.joinByCode(code, user.id);
      enterRoom({
        id: data.story.id,
        title: data.story.title,
        invite_code: code.toUpperCase(),
        role: "member",
      });
    } catch (e) {
      alert(e.message);
    }
  };

  function joinStatusLabel(r) {
    if (r.my_status === "active") return '<em class="hint ok">已加入</em>';
    if (r.my_status === "pending") return '<em class="hint warn">已提交申请</em>';
    return "";
  }

  function joinActionHtml(r) {
    if (r.my_status === "active") return `<span class="hint ok">已加入</span>`;
    if (r.my_status === "pending") return `<span class="hint warn">待通过</span>`;
    return `<button data-id="${r.id}" class="btn-small apply-btn">申请加入</button>`;
  }

  document.getElementById("searchBtn").onclick = async () => {
    const q = document.getElementById("searchTitle").value.trim();
    const box = document.getElementById("searchResults");
    if (!q) return (box.innerHTML = "");
    try {
      const data = await roomApi.search(q, user.id);
      box.innerHTML = data.rooms.length
        ? data.rooms
            .map(
              (r) => `
          <div class="list-item">
            <div>
              <strong>${r.title}</strong><br>
              <span class="sub">房主 ${r.owner_name}</span>
              ${joinStatusLabel(r)}
            </div>
            ${joinActionHtml(r)}
          </div>`
            )
            .join("")
        : `<p class="sub">未找到房间</p>`;
      box.querySelectorAll(".apply-btn").forEach((btn) => {
        btn.onclick = async () => {
          try {
            await roomApi.requestJoin(Number(btn.dataset.id), user.id);
            btn.replaceWith(Object.assign(document.createElement("span"), { className: "hint warn", textContent: "已提交申请" }));
            loadTodos();
          } catch (e) {
            alert(e.message);
          }
        };
      });
    } catch (e) {
      box.innerHTML = `<p class="hint err">${e.message}</p>`;
    }
  };

  function enterRoom(room) {
    clearInterval(todoTimer);
    setRoom(room);
    onEnterRoom(room);
  }

  async function loadTodos() {
    if (lobbyDisposed) return;
    await renderTodos(document.getElementById("todoBox"), {
      section: document.querySelector(".todo-section"),
      onChange: loadMyRooms,
    });
  }

  async function loadMyRooms() {
    if (lobbyDisposed) return;
    if (!getUser()) return;
    const box = document.getElementById("myRooms");
    try {
      const data = await roomApi.myRooms(user.id);

      if (!data.rooms.length) {
        box.innerHTML = `<p class="sub">暂无房间，请创建或加入</p>`;
        return;
      }

      box.innerHTML = data.rooms
        .map(
          (r) => `
        <div class="list-item">
          <div>
            <strong>${r.title}</strong> ${r.role === "owner" ? "（房主）" : ""}
            ${r.role === "owner" && r.invite_code ? `<br><span class="sub">分享码 <code class="share-code">${r.invite_code}</code></span>` : ""}
          </div>
          <button data-id="${r.id}" data-title="${r.title}" data-role="${r.role}" data-code="${r.invite_code || ""}" class="btn-small enter-btn">进入房间</button>
        </div>`
        )
        .join("");
      box.querySelectorAll(".enter-btn").forEach((btn) => {
        btn.onclick = () =>
          enterRoom({
            id: Number(btn.dataset.id),
            title: btn.dataset.title,
            role: btn.dataset.role,
            invite_code: btn.dataset.code || undefined,
          });
      });
    } catch (e) {
      box.innerHTML = `<p class="hint err">${e.message}</p>`;
    }
  }

  loadTodos();
  loadMyRooms();
  todoTimer = setInterval(() => {
    loadTodos();
    loadMyRooms();
  }, 10000);
}
