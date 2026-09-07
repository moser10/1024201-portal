const app = document.getElementById("app");
const TOKEN_KEY = "gamebgp_token";

let state = {
  tab: "users",
  users: [],
  rooms: [],
  overview: { users: 0, rooms: 0, pending: 0 },
  me: {
    username: "sa",
    adminmail: "",
    mustChangePassword: false,
    loginUrl: "https://1024201.com/game/gamebgp/",
    sessionHours: 12,
  },
  userQ: "",
  roomQ: "",
  loadError: "",
};

async function api(action, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const qs = new URLSearchParams({ action });
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v != null && v !== "") qs.set(k, String(v));
    }
  }
  const { query: _q, ...fetchOpts } = options;
  const res = await fetch(`/api/admin?${qs}`, { ...fetchOpts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "请求失败");
    err.status = res.status;
    throw err;
  }
  return data;
}

function isAuthError(e) {
  return e?.status === 401 || /未登录|会话|过期/.test(String(e?.message || ""));
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
  }, 3200);
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

function renderLogin(errorMsg = "") {
  app.innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <p class="brand">1024201</p>
        <h1>管理后台</h1>
        <p class="sub">门户与游戏数据管理。会话 12 小时有效。</p>
        ${errorMsg ? `<div class="banner" style="margin-bottom:14px">${esc(errorMsg)}</div>` : ""}
        <form id="loginForm" autocomplete="off">
          <div class="field">
            <label for="user">用户名</label>
            <input id="user" name="gbp-user" type="text" autocomplete="username" spellcheck="false" required>
          </div>
          <div class="field">
            <label for="pass">密码</label>
            <input id="pass" name="gbp-pass" type="password" autocomplete="current-password" required>
          </div>
          <button id="loginBtn" class="btn btn-block" type="submit">登录</button>
        </form>
      </div>
    </div>`;
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin();
  });
}

async function doLogin() {
  const userEl = document.getElementById("user");
  const passEl = document.getElementById("pass");
  const btn = document.getElementById("loginBtn");
  const username = userEl?.value.trim() || "";
  const password = passEl?.value || "";
  if (!username || !password) {
    toast("请输入用户名和密码");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "登录中…";
  }
  try {
    const data = await api("login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!data?.token) throw new Error("登录响应无效");
    sessionStorage.setItem(TOKEN_KEY, data.token);
    state.me = {
      username: data.username || username,
      adminmail: data.adminmail || "",
      mustChangePassword: !!data.mustChangePassword,
      loginUrl: "https://1024201.com/game/gamebgp/",
      sessionHours: data.sessionHours || 12,
    };
    if (data.mustChangePassword) state.tab = "settings";
    else state.tab = "settings";
    await renderDashboard();
  } catch (e) {
    toast(e.message || "登录失败");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "登录";
    }
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
  state.loadError = "";
  const me = await api("me");
  state.me = {
    username: me.username || state.me.username,
    adminmail: me.adminmail || "",
    mustChangePassword: !!me.mustChangePassword,
    loginUrl: me.loginUrl || "https://1024201.com/game/gamebgp/",
    sessionHours: me.sessionHours || 12,
  };

  const jobs = [
    api("overview")
      .then((d) => {
        state.overview = d;
      })
      .catch((e) => {
        state.loadError = e.message;
      }),
    api("users", { query: { q: state.userQ } })
      .then((d) => {
        state.users = d.users || [];
      })
      .catch((e) => {
        state.users = [];
        state.loadError = e.message;
      }),
    api("rooms", { query: { q: state.roomQ } })
      .then((d) => {
        state.rooms = d.rooms || [];
      })
      .catch((e) => {
        state.rooms = [];
        state.loadError = e.message;
      }),
  ];
  await Promise.all(jobs);
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
  const mail = state.me.adminmail || "";
  return `
    <div class="card" data-panel="settings">
      <h2>登录信息</h2>
      <div class="info-grid">
        <div><span class="info-k">用户名</span><span class="info-v">${esc(state.me.username)}</span></div>
        <div><span class="info-k">管理员邮箱</span><span class="info-v">${esc(mail || "未设置")}</span></div>
        <div><span class="info-k">登录地址</span><span class="info-v"><a href="${esc(state.me.loginUrl)}" target="_blank" rel="noopener">${esc(state.me.loginUrl)}</a></span></div>
        <div><span class="info-k">会话</span><span class="info-v">${esc(String(state.me.sessionHours || 12))} 小时</span></div>
      </div>
    </div>

    <div class="card">
      <h2>管理员邮箱（adminmail）</h2>
      <p class="sub">存放在 D1 <code>admin_auth.adminmail</code>。改密后会把新密码明文发到此邮箱。</p>
      <form class="form-grid" id="mailForm" onsubmit="return false">
        <div class="field">
          <label for="adminMail">邮箱</label>
          <input id="adminMail" type="email" value="${esc(mail)}" autocomplete="email" placeholder="admin@1024201.com">
        </div>
        <button type="button" class="btn" id="saveMailBtn">保存邮箱</button>
      </form>
    </div>

    <div class="card">
      <h2>更改密码</h2>
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
        <button type="button" class="btn" id="savePwBtn">保存新密码并邮件通知</button>
      </form>
      <p class="hint">保存后其他会话失效；系统会向管理员邮箱发送一封含<strong>明文新密码</strong>的通知邮件。</p>
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
  document.getElementById("saveMailBtn")?.addEventListener("click", saveAdminMail);

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

async function saveAdminMail() {
  const adminmail = document.getElementById("adminMail")?.value.trim() || "";
  const btn = document.getElementById("saveMailBtn");
  btn.disabled = true;
  try {
    const data = await api("save_adminmail", {
      method: "POST",
      body: JSON.stringify({ adminmail }),
    });
    state.me.adminmail = data.adminmail;
    toast("管理员邮箱已保存");
    paintShell();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function savePassword() {
  const current_password = document.getElementById("curPw")?.value || "";
  const password = document.getElementById("newPw")?.value || "";
  const password2 = document.getElementById("newPw2")?.value || "";
  const btn = document.getElementById("savePwBtn");
  btn.disabled = true;
  try {
    const data = await api("change_password", {
      method: "POST",
      body: JSON.stringify({ current_password, password, password2 }),
    });
    state.me.mustChangePassword = false;
    toast(
      data.emailSent
        ? `密码已更新，通知已发至 ${data.adminmail}`
        : data.emailError
          ? `密码已更新，但邮件未发出：${data.emailError}`
          : "密码已更新"
    );
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
          <p class="sub">已登录为 ${esc(state.me.username)}${state.me.adminmail ? ` · ${esc(state.me.adminmail)}` : ""}</p>
        </div>
        <div class="topbar-actions">
          <button type="button" class="btn btn-ghost btn-small" id="logoutBtn">退出</button>
        </div>
      </div>

      ${
        state.me.mustChangePassword
          ? `<div class="banner"><strong>安全提示：</strong>当前使用默认或临时管理员密码，请先在「设置」中修改管理员邮箱与密码。</div>`
          : ""
      }
      ${state.loadError ? `<div class="banner"><strong>部分数据加载失败：</strong>${esc(state.loadError)}</div>` : ""}

      <div class="stats">
        <div class="stat"><div class="stat-n">${state.overview.users ?? "—"}</div><div class="stat-l">注册用户</div></div>
        <div class="stat"><div class="stat-n">${state.overview.rooms ?? "—"}</div><div class="stat-l">游戏房间</div></div>
        <div class="stat"><div class="stat-n">${state.overview.pending ?? "—"}</div><div class="stat-l">待验证注册</div></div>
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
    if (isAuthError(e)) {
      sessionStorage.removeItem(TOKEN_KEY);
      renderLogin(e.message);
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
    else if (!state.tab) state.tab = "settings";
    paintShell();
  } catch (e) {
    if (isAuthError(e)) {
      sessionStorage.removeItem(TOKEN_KEY);
      renderLogin(e.message);
      return;
    }
    // Keep session; still show settings shell with whatever we have
    state.tab = "settings";
    state.loadError = e.message || "加载失败";
    paintShell();
    toast(e.message);
  }
}

if (sessionStorage.getItem(TOKEN_KEY)) renderDashboard();
else renderLogin();
