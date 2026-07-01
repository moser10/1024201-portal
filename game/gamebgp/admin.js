const app = document.getElementById("app");

const TOKEN_KEY = "gamebgp_token";

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
        <h2>${title}</h2>
        <p class="gbp-modal-msg">${message}</p>
        <div class="gbp-modal-actions">
          <button type="button" class="gbp-btn gbp-btn-cancel">${cancelText}</button>
          <button type="button" class="gbp-btn ${danger ? "gbp-btn-danger" : "gbp-btn-primary"}">${confirmText}</button>
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

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLogin() {
  app.innerHTML = `
    <div class="wrap">
      <div class="card" style="max-width:360px;margin:40px auto;">
        <h1>gamebgp</h1>
        <p class="sub">管理后台登录</p>
        <form id="loginForm" autocomplete="off" onsubmit="return false">
          <input type="text" tabindex="-1" aria-hidden="true" class="login-trap" autocomplete="username">
          <input type="password" tabindex="-1" aria-hidden="true" class="login-trap" autocomplete="current-password">
          <input id="user" name="gbp-user" type="text" placeholder="用户名" autocomplete="off" inputmode="text" spellcheck="false">
          <input id="pass" name="gbp-pass" type="password" placeholder="密码" autocomplete="new-password">
          <button id="loginBtn" type="button" style="width:100%">登录</button>
        </form>
      </div>
    </div>`;
  bindLoginAntiAutofill();
  document.getElementById("loginBtn").onclick = async () => {
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
      clearLoginFields();
      sessionStorage.setItem(TOKEN_KEY, data.token);
      renderDashboard();
    } catch (e) {
      clearLoginFields();
      toast(e.message);
    }
  };
}

function userRowHtml(u, i) {
  return `
    <tr data-user-id="${u.id}">
      <td>${i + 1}</td>
      <td>${esc(u.username)}</td>
      <td>${esc(u.email)}</td>
      <td>${esc(u.created_at || "-")}</td>
      <td><span class="pw-mask" data-pw="${esc(u.password_plain || "")}">******</span><span class="eye">👁</span></td>
      <td><button type="button" class="btn-danger btn-small del-user" data-id="${u.id}">删除</button></td>
    </tr>`;
}

function roomRowHtml(r, i) {
  return `
    <tr data-room-id="${r.id}">
      <td>${i + 1}</td>
      <td>${esc(r.display_name)}</td>
      <td>${esc(r.full_name)}</td>
      <td>${esc(r.owner_name)}</td>
      <td>${esc(r.invite_code)}</td>
      <td>${esc(r.created_at || "-")}</td>
      <td><button type="button" class="btn-danger btn-small del-room" data-id="${r.id}">删除</button></td>
    </tr>`;
}

function bindDashboardEvents() {
  document.getElementById("logoutBtn").onclick = logoutAdmin;

  document.querySelectorAll(".eye").forEach((eye) => {
    eye.onclick = () => {
      const mask = eye.previousElementSibling;
      const pw = mask.dataset.pw;
      mask.textContent = mask.textContent === "******" ? pw || "（未记录）" : "******";
    };
  });

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
        const userId = parseInt(btn.dataset.id, 10);
        await api("delete_user", { method: "POST", body: JSON.stringify({ user_id: userId }) });
        row?.remove();
        toast("用户已删除");
      } catch (e) {
        btn.disabled = false;
        toast(e.message);
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
        const storyId = parseInt(btn.dataset.id, 10);
        await api("delete_room", { method: "POST", body: JSON.stringify({ story_id: storyId }) });
        row?.remove();
        toast("房间已删除");
      } catch (e) {
        btn.disabled = false;
        toast(e.message);
      }
    };
  });
}

async function renderDashboard() {
  app.innerHTML = `<div class="wrap"><p>加载中...</p></div>`;
  try {
    const [users, rooms] = await Promise.all([api("users"), api("rooms")]);
    app.innerHTML = `
      <div class="wrap">
        <h1>gamebgp 数据管理</h1>
        <p class="sub"><button class="btn-small" id="logoutBtn">退出登录</button> · 临时密码在 D1 admin_auth.temp_password 配置</p>
        <div class="card">
          <h2>一票通用户</h2>
          <table>
            <thead><tr><th>#</th><th>用户名</th><th>邮箱</th><th>注册时间</th><th>密码</th><th></th></tr></thead>
            <tbody id="usersBody">
              ${users.users.map((u, i) => userRowHtml(u, i)).join("")}
            </tbody>
          </table>
        </div>
        <div class="card">
          <h2>游戏房间 / 书名</h2>
          <table>
            <thead><tr><th>#</th><th>显示名</th><th>全称</th><th>房主</th><th>邀请码</th><th>创建时间</th><th></th></tr></thead>
            <tbody id="roomsBody">
              ${rooms.rooms.map((r, i) => roomRowHtml(r, i)).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
    bindDashboardEvents();
  } catch (e) {
    sessionStorage.removeItem(TOKEN_KEY);
    toast(e.message);
    renderLogin();
  }
}

function logoutAdmin() {
  sessionStorage.removeItem(TOKEN_KEY);
  renderLogin();
}

window.addEventListener("pageshow", () => {
  if (sessionStorage.getItem(TOKEN_KEY)) return;
  if (document.getElementById("user")) clearLoginFields();
  else renderLogin();
});

if (sessionStorage.getItem(TOKEN_KEY)) renderDashboard();
else renderLogin();
