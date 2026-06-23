import { authApi, roomApi } from "./api.js";
import { bindNameCheck } from "./nameCheck.js";
import { getUser, setRoom } from "./store.js";

export function renderLobby(app, onEnterRoom) {
  const user = getUser();

  app.innerHTML = `
    <div class="card">
      <div class="header-row">
        <h1>大厅</h1>
        <span class="badge">@${user.username}</span>
      </div>

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

      <section class="section" id="ownerPanel" hidden>
        <h2>房主管理</h2>
        <div id="pendingList"></div>
        <h3>拉人进群（搜昵称）</h3>
        <div class="row">
          <input type="text" id="pullSearch" placeholder="搜索用户昵称">
          <button id="pullSearchBtn" class="btn-secondary">搜索</button>
        </div>
        <div id="pullResults"></div>
      </section>

      <section class="section">
        <h2>我的房间</h2>
        <div id="myRooms"></div>
      </section>
    </div>`;

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
      enterRoom({ id: data.story_id, title: data.title, invite_code: data.invite_code, role: "owner" });
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
      enterRoom({ id: data.story.id, title: data.story.title, role: "member" });
    } catch (e) {
      alert(e.message);
    }
  };

  document.getElementById("searchBtn").onclick = async () => {
    const q = document.getElementById("searchTitle").value.trim();
    const box = document.getElementById("searchResults");
    if (!q) return (box.innerHTML = "");
    try {
      const data = await roomApi.search(q);
      box.innerHTML = data.rooms.length
        ? data.rooms
            .map(
              (r) => `
          <div class="list-item">
            <div><strong>${r.title}</strong> · 房主 ${r.owner_name}</div>
            <button data-id="${r.id}" class="btn-small apply-btn">申请加入</button>
          </div>`
            )
            .join("")
        : `<p class="sub">未找到房间</p>`;
      box.querySelectorAll(".apply-btn").forEach((btn) => {
        btn.onclick = async () => {
          try {
            const res = await roomApi.requestJoin(Number(btn.dataset.id), user.id);
            alert(res.message || "已提交申请");
          } catch (e) {
            alert(e.message);
          }
        };
      });
    } catch (e) {
      box.innerHTML = `<p class="hint err">${e.message}</p>`;
    }
  };

  document.getElementById("pullSearchBtn").onclick = async () => {
    const q = document.getElementById("pullSearch").value.trim();
    const box = document.getElementById("pullResults");
    const room = getCurrentOwnerRoom();
    if (!room) return alert("请先创建或进入一个你拥有的房间");
    if (!q) return (box.innerHTML = "");
    try {
      const data = await authApi.searchUsers(q);
      const members = ownerRoom ? (await roomApi.members(ownerRoom.id)).members : [];
      const memberIds = new Set(members.map((m) => m.user_id));

      box.innerHTML = data.users
        .filter((u) => u.id !== user.id)
        .map((u) => {
          const inGroup = memberIds.has(u.id);
          return `
        <div class="list-item">
          <span>@${u.username}${inGroup ? ' <em class="hint ok">已在群</em>' : ""}</span>
          ${inGroup ? "" : `<button data-uid="${u.id}" class="btn-small pull-btn">拉进群</button>`}
        </div>`;
        })
        .join("");
      box.querySelectorAll(".pull-btn").forEach((btn) => {
        btn.onclick = async () => {
          try {
            await roomApi.pullUser(room.id, user.id, Number(btn.dataset.uid));
            alert("已拉入群组");
            loadPending(room);
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
    setRoom(room);
    onEnterRoom(room);
  }

  let ownerRoom = null;
  function getCurrentOwnerRoom() {
    return ownerRoom;
  }

  async function loadMyRooms() {
    const box = document.getElementById("myRooms");
    try {
      const data = await roomApi.myRooms(user.id);
      if (!data.rooms.length) {
        box.innerHTML = `<p class="sub">暂无房间，请创建或加入</p>`;
        return;
      }
      ownerRoom = data.rooms.find((r) => r.role === "owner") || null;
      if (ownerRoom) {
        document.getElementById("ownerPanel").hidden = false;
        loadPending(ownerRoom);
      }
      box.innerHTML = data.rooms
        .map(
          (r) => `
        <div class="list-item">
          <div><strong>${r.title}</strong> ${r.role === "owner" ? "（房主）" : ""}</div>
          <button data-id="${r.id}" data-title="${r.title}" data-role="${r.role}" class="btn-small enter-btn">进入</button>
        </div>`
        )
        .join("");
      box.querySelectorAll(".enter-btn").forEach((btn) => {
        btn.onclick = () =>
          enterRoom({
            id: Number(btn.dataset.id),
            title: btn.dataset.title,
            role: btn.dataset.role,
          });
      });
    } catch (e) {
      box.innerHTML = `<p class="hint err">${e.message}</p>`;
    }
  }

  async function loadPending(room) {
    const box = document.getElementById("pendingList");
    try {
      const data = await roomApi.pending(room.id, user.id);
      if (!data.pending.length) {
        box.innerHTML = `<p class="sub">暂无待审批申请</p>`;
        return;
      }
      box.innerHTML = `<h3>待审批</h3>` + data.pending
        .map(
          (p) => `
        <div class="list-item">
          <span>@${p.username}</span>
          <button data-uid="${p.user_id}" class="btn-small approve-btn">同意</button>
        </div>`
        )
        .join("");
      box.querySelectorAll(".approve-btn").forEach((btn) => {
        btn.onclick = async () => {
          await roomApi.approve(room.id, user.id, Number(btn.dataset.uid));
          loadPending(room);
          loadMyRooms();
        };
      });
    } catch (e) {
      box.innerHTML = `<p class="hint err">${e.message}</p>`;
    }
  }

  loadMyRooms();
}
