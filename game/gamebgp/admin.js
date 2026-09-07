const app = document.getElementById("app");
const TOKEN_KEY = "gamebgp_token";

let state = {
  tab: "users",
  users: [],
  rooms: [],
  overview: { users: 0, rooms: 0, pending: 0 },
  me: { username: "sa", mustChangePassword: false },
  userQ: "",
  roomQ: "",
};

async function api(action, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`/api/admin?action=${action}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "请求失败");
  return data;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(msg) {
  let el = document.getElementById("gbpToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "gbpToast";
    el.className = "gbp-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

function confirmDialog({ title, message, confirmText = "确定", cancelText = "取消", danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "gbp-modal";
    backdrop.innerHTML = `
      <div class="gbp-modal-card" role="dialog" aria-modal="true">
        <h2>${esc(title)}</h2>
        <p class="gbp-modal-msg">${esc(message)}</p>
        <div class="gbp-modal-actions">
          <button type="button" class="gbp-btn gbp-btn-cancel">${esc(cancelText)}</button>
          <button type="button" class="gbp-btn ${danger ? "gbp-btn-danger" : "gbp-btn-primary"}">${esc(confirmText)}</button>
        </div>
      </div>`;
    const close = (ok) => {
      backdrop.remove();
      resolve(ok);
    };
    backdrop.querySelector(".gbp-btn-cancel").onclick = () => close(false);
    backdrop.querySelector(danger ? ".gbp-btn-danger" : ".gbp-btn-primary").onclick = () => close(true);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(false);
    });
    document.body.appendChild(backdrop);
  });
}

function clearLoginFields() {
  const userEl = document.getElementById("user");
  const passEl = document.getElementById("pass");
  if (!userEl || !passEl) return;
  userEl.value = "";
  passEl.value = "";
}

function bindLoginAntiAutofill() {
  const userEl = document.getElementById("user");
  const passEl = document.getElementById("pass");
  userEl.readOnly = true;
  passEl.readOnly = true;
  userEl.addEventListener("focus", () => {
    userEl.readOnly = false;
  });
  passEl.addEventListener("focus", () => {
    passEl.readOnly = false;
  });
  clearLoginFields();
  requestAnimationFrame(clearLoginFields);
  setTimeout(clearLoginFields, 50);
}

function renderLogin() {
  app.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <p class="brand">1024201</p>
        <h1>管理后台</h1>
        <p class="sub">门户与游戏数据管理。会话 12 小时有效。</p>
        <form id="loginForm" autocomplete="off" onsubmit="return false">
          <input type="text" tabindex="-1" aria-hidden="true" class="login-trap" autocomplete="username">
          <input type="password" tabindex="-1" aria-hidden="true" class="login-trap" autocomplete="current-password">
          <div class="field">
            <label for="user">用户名</label>
            <input id="user" name="gbp-user" type="text" autocomplete="off" spellcheck="false">
          </div>
          <div class="field">
            <label for="pass">密码</label>
            <input id="pass" name="gbp-pass" type="password" autocomplete="new-password">
          </div>
          <button id="loginBtn" class="btn btn-block" type="button">登录</button>
        </form>
      </div>
    </div>`;
  bindLoginAntiAutofill();
  document.getElementById("loginBtn").onclick = doLogin;
  document.getElementById("pass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
}

async function doLogin() {
  const userEl = document.getElementById("user");
  const passEl = document.getElementById("pass");
  const username = userEl.value.trim();
  const password = passEl.value;
  clearLoginFields();
  try {
    const data = await api("login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    sessionStorage.setItem(TOKEN_KEY, data.token);
    state.me = {
      username: data.username || username,
      mustChangePassword: !!data.mustChangePassword,
    };
    if (data.mustChangePassword) state.tab = "settings";
    await renderDashboard();
  } catch (e) {
    toast(e.message);
  }
}

async function logoutAdmin() {
  try {
    await api("logout", { method: "POST", body: "{}" });
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(TOKEN_KEY);
  renderLogin();
}

async function loadAll() {
  const userQs = state.userQ ? `&q=${encodeURIComponent(state.userQ)}` : "";
  const roomQs = state.roomQ ? `&q=${encodeURIComponent(state.roomQ)}` : "";
  const [me, overview, users, rooms] = await Promise.all([
    api("me"),
    api("overview"),
    api(`users${userQs}`),
    api(`rooms${roomQs}`),
  ]);
  state.me = me;
  state.overview = overview;
  state.users = users.users || [];
  state.rooms = rooms.rooms || [];
}

function userRowHtml(u, i) {
  const flags = [];
  if (Number(u.must_change_password) === 1) flags.push(`<span class="badge badge-warn">需改密</span>`);
  if (Number(u.has_temp_password) === 1) flags.push(`<span class="badge">临时密码</span>`);
  return `
    <tr data-user-id="${u.id}">
      <td>${i + 1}</td>
      <td>${esc(u.username)}</td>
      <td>${esc(u.email)}</td>
      <td>${esc(u.created_at || "—")}</td>
      <td>${flags.join(" ") || `<span class="badge badge-ok">正常</span>`}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-small reset-user" data-id="${u.id}">重置密码</button>
          <button type="button" class="btn btn-danger btn-small del-user" data-id="${u.id}">删除</button>
        </div>
      </td>
    </tr>`;
}

function roomRowHtml(r, i) {
  return `
    <tr data-room-id="${r.id}">
      <td>${i + 1}</td>
      <td>${esc(r.display_name)}</td>
      <td>${esc(r.full_name)}</td>
      <td>${esc(r.owner_name)}</td>
      <td><code>${esc(r.invite_code)}</code></td>
      <td>${esc(r.created_at || "—")}</td>
      <td>
        <button type="button" class="btn btn-danger btn-small del-room" data-id="${r.id}">删除</button>
      </td>
    </tr>`;
}

function panelUsers() {
  return `
    <div class="card" data-panel="users">
      <h2>用户</h2>
      <div class="toolbar">
        <input class="search" id="userSearch" type="search" placeholder="搜索用户名 / 邮箱" value="${esc(state.userQ)}">
        <button type="button" class="btn btn-ghost btn-small" id="userSearchBtn">搜索</button>
      </div>
      <div class="table-wrap">
        ${
          state.users.length
            ? `<table>
          <thead><tr><th>#</th><th>用户名</th><th>邮箱</th><th>注册时间</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${state.users.map((u, i) => userRowHtml(u, i)).join("")}</tbody>
        </table>`
            : `<p class="empty">没有匹配的用户</p>`
        }
      </div>
    </div>`;
}

function panelRooms() {
  return `
    <div class="card" data-panel="rooms">
      <h2>游戏房间</h2>
      <div class="toolbar">
        <input class="search" id="roomSearch" type="search" placeholder="搜索书名 / 邀请码 / 房主" value="${esc(state.roomQ)}">
        <button type="button" class="btn btn-ghost btn-small" id="roomSearchBtn">搜索</button>
      </div>
      <div class="table-wrap">
        ${
          state.rooms.length
            ? `<table>
          <thead><tr><th>#</th><th>显示名</th><th>全称</th><th>房主</th><th>邀请码</th><th>创建时间</th><th></th></tr></thead>
          <tbody>${state.rooms.map((r, i) => roomRowHtml(r, i)).join("")}</tbody>
        </table>`
            : `<p class="empty">没有匹配的房间</p>`
        }
      </div>
    </div>`;
}

function panelSettings() {
  return `
    <div class="card" data-panel="settings">
      <h2>管理员设置</h2>
      <p class="sub" style="margin-bottom:14px">当前账号：<strong>${esc(state.me.username)}</strong></p>
      <form class="form-grid" id="pwForm" onsubmit="return false">
        <div class="field">
          <label for="curPw">当前密码</label>
          <input id="curPw" type="password" autocomplete="current-password">
        </div>
        <div class="field">
          <label for="newPw">新密码（至少 8 位）</label>
          <input id="newPw" type="password" autocomplete="new-password">
        </div>
        <div class="field">
          <label for="newPw2">确认新密码</label>
          <input id="newPw2" type="password" autocomplete="new-password">
        </div>
        <button type="button" class="btn" id="savePwBtn">保存新密码</button>
      </form>
      <p class="hint">修改成功后，其他已登录会话会失效。请妥善保存新密码；后台不提供邮箱找回。</p>
    </div>`;
}

function bindDashboardEvents() {
  document.getElementById("logoutBtn").onclick = logoutAdmin;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => {
      state.tab = tab.dataset.tab;
      paintShell();
    };
  });

  const userSearch = document.getElementById("userSearch");
  const roomSearch = document.getElementById("roomSearch");
  document.getElementById("userSearchBtn")?.addEventListener("click", async () => {
    state.userQ = userSearch?.value.trim() || "";
    await refreshQuiet();
  });
  document.getElementById("roomSearchBtn")?.addEventListener("click", async () => {
    state.roomQ = roomSearch?.value.trim() || "";
    await refreshQuiet();
  });
  userSearch?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      state.userQ = userSearch.value.trim();
      await refreshQuiet();
    }
  });
  roomSearch?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      state.roomQ = roomSearch.value.trim();
      await refreshQuiet();
    }
  });

  document.getElementById("savePwBtn")?.addEventListener("click", savePassword);

  document.querySelectorAll(".del-user").forEach((btn) => {
    btn.onclick = async () => {
      const row = btn.closest("tr");
      const name = row?.querySelector("td:nth-child(2)")?.textContent || "";
      const ok = await confirmDialog({
        title: "删除用户",
        message: `确定删除用户「${name}」？其房间与关联数据将一并清除。`,
        confirmText: "删除",
        danger: true,
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        await api("delete_user", { method: "POST", body: JSON.stringify({ user_id: Number(btn.dataset.id) }) });
        toast("用户已删除");
        await refreshQuiet();
      } catch (e) {
        btn.disabled = false;
        toast(e.message);
      }
    };
  });

  document.querySelectorAll(".reset-user").forEach((btn) => {
    btn.onclick = async () => {
      const row = btn.closest("tr");
      const name = row?.querySelector("td:nth-child(2)")?.textContent || "";
      const ok = await confirmDialog({
        title: "重置用户密码",
        message: `将为「${name}」生成 24 小时有效的临时密码，并要求下次登录修改。`,
        confirmText: "生成",
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        const data = await api("reset_user_password", {
          method: "POST",
          body: JSON.stringify({ user_id: Number(btn.dataset.id) }),
        });
        await confirmDialog({
          title: "临时密码已生成",
          message: `用户：${data.username}\n邮箱：${data.email}\n临时密码：${data.temp_password}\n\n请立即告知用户。此密码仅显示一次。`,
          confirmText: "已复制记住",
          cancelText: "关闭",
        });
        toast("临时密码已生成");
        await refreshQuiet();
      } catch (e) {
        toast(e.message);
      } finally {
        btn.disabled = false;
      }
    };
  });

  document.querySelectorAll(".del-room").forEach((btn) => {
    btn.onclick = async () => {
      const row = btn.closest("tr");
      const name = row?.querySelector("td:nth-child(2)")?.textContent || "";
      const ok = await confirmDialog({
        title: "删除房间",
        message: `确定删除房间「${name}」及全部写书内容？`,
        confirmText: "删除",
        danger: true,
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        await api("delete_room", { method: "POST", body: JSON.stringify({ story_id: Number(btn.dataset.id) }) });
        toast("房间已删除");
        await refreshQuiet();
      } catch (e) {
        btn.disabled = false;
        toast(e.message);
      }
    };
  });
}

async function savePassword() {
  const current_password = document.getElementById("curPw")?.value || "";
  const password = document.getElementById("newPw")?.value || "";
  const password2 = document.getElementById("newPw2")?.value || "";
  const btn = document.getElementById("savePwBtn");
  btn.disabled = true;
  try {
    await api("change_password", {
      method: "POST",
      body: JSON.stringify({ current_password, password, password2 }),
    });
    state.me.mustChangePassword = false;
    toast("密码已更新");
    document.getElementById("curPw").value = "";
    document.getElementById("newPw").value = "";
    document.getElementById("newPw2").value = "";
    paintShell();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

function paintShell() {
  const panel =
    state.tab === "rooms" ? panelRooms() : state.tab === "settings" ? panelSettings() : panelUsers();
  app.innerHTML = `
    <div class="wrap">
      <div class="topbar">
        <div>
          <p class="brand">1024201</p>
          <h1>管理后台</h1>
          <p class="sub">已登录为 ${esc(state.me.username)}</p>
        </div>
        <div class="topbar-actions">
          <button type="button" class="btn btn-ghost btn-small" id="logoutBtn">退出</button>
        </div>
      </div>

      ${
        state.me.mustChangePassword
          ? `<div class="banner"><strong>安全提示：</strong>当前使用默认或临时管理员密码，请先在「设置」中修改后再继续操作。</div>`
          : ""
      }

      <div class="stats">
        <div class="stat"><div class="stat-n">${state.overview.users}</div><div class="stat-l">注册用户</div></div>
        <div class="stat"><div class="stat-n">${state.overview.rooms}</div><div class="stat-l">游戏房间</div></div>
        <div class="stat"><div class="stat-n">${state.overview.pending}</div><div class="stat-l">待验证注册</div></div>
      </div>

      <div class="tabs">
        <button type="button" class="tab ${state.tab === "users" ? "active" : ""}" data-tab="users">用户</button>
        <button type="button" class="tab ${state.tab === "rooms" ? "active" : ""}" data-tab="rooms">房间</button>
        <button type="button" class="tab ${state.tab === "settings" ? "active" : ""}" data-tab="settings">设置</button>
      </div>

      ${panel}
    </div>`;
  bindDashboardEvents();
}

async function refreshQuiet() {
  try {
    await loadAll();
    paintShell();
  } catch (e) {
    if (String(e.message || "").includes("登录") || String(e.message || "").includes("会话")) {
      sessionStorage.removeItem(TOKEN_KEY);
      toast(e.message);
      renderLogin();
      return;
    }
    toast(e.message);
  }
}

async function renderDashboard() {
  app.innerHTML = `<div class="wrap"><p class="sub">加载中…</p></div>`;
  try {
    await loadAll();
    if (state.me.mustChangePassword) state.tab = "settings";
    paintShell();
  } catch (e) {
    sessionStorage.removeItem(TOKEN_KEY);
    toast(e.message);
    renderLogin();
  }
}

window.addEventListener("pageshow", () => {
  if (sessionStorage.getItem(TOKEN_KEY)) return;
  if (document.getElementById("user")) clearLoginFields();
  else renderLogin();
});

if (sessionStorage.getItem(TOKEN_KEY)) renderDashboard();
else renderLogin();
