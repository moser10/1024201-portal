import { getUser, clearUser, clearRoom } from "./store.js";

const LOGIN_IMG = '<img src="/icons/apps/login.svg" alt="">';

import { getPortalLang } from "/js/langTabs.js";

const TEXT = {
  zh: { logout: "退出登录", settings: "设置" },
  en: { logout: "Sign out", settings: "Settings" },
  ja: { logout: "ログアウト", settings: "設定" },
};

export function getBarLang() {
  return getPortalLang();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLoginUrl(returnPath) {
  let ret = returnPath;
  if (ret == null || ret === "") {
    ret = location.pathname + location.search;
  }
  // Portal root should round-trip to "/" (not empty → auth default)
  if (ret === "/" || ret === "/index.html") ret = "/";
  else if (ret.startsWith("/")) ret = ret;
  else ret = `/${ret}`.replace(/^\/\//, "/");
  return `/game/register/?return=${encodeURIComponent(ret)}`;
}

function bindMenuToggle(container, menu, triggers) {
  let ignoreCloseUntil = 0;

  const toggle = (e) => {
    e.stopPropagation();
    const opening = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open");
    if (opening) {
      ignoreCloseUntil = Date.now() + 500;
    }
  };

  for (const el of triggers) {
    el.addEventListener("click", toggle);
  }

  const onDoc = (e) => {
    if (Date.now() < ignoreCloseUntil) return;
    if (!container.contains(e.target)) menu.classList.remove("is-open");
  };
  document.addEventListener("click", onDoc, true);
  return () => document.removeEventListener("click", onDoc, true);
}

const menuUnbind = new WeakMap();

export function mountUserBar(container, options = {}) {
  if (!container) return;
  if (menuUnbind.has(container)) {
    menuUnbind.get(container)();
    menuUnbind.delete(container);
  }
  const { returnPath, variant = "game", onLogout, menu = "none" } = options;
  const lang = getBarLang();
  const t = TEXT[lang] || TEXT.zh;
  const user = getUser();

  container.className = `user-bar user-bar--${variant}${variant === "ios" ? " user-bar--portal-slot" : ""}`;
  container.replaceChildren();

  if (!user) {
    const link = document.createElement("a");
    link.className = "user-bar-guest";
    link.href = buildLoginUrl(returnPath);
    link.title = "登录";
    link.innerHTML = LOGIN_IMG;
    container.appendChild(link);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "user-bar-signed";

  const nameBtn = document.createElement("button");
  nameBtn.type = "button";
  nameBtn.className = "user-bar-name";
  nameBtn.innerHTML = `<span class="user-bar-handle"><span class="user-bar-at">@</span><span class="user-bar-name-text">${escapeHtml(user.username)}</span></span>`;

  wrap.append(nameBtn);
  container.append(wrap);

  if (menu !== "home") {
    nameBtn.disabled = true;
    nameBtn.style.cursor = "default";
    return;
  }

  const pop = document.createElement("div");
  pop.className = "user-bar-menu";
  const settingsLink = document.createElement("a");
  settingsLink.className = "user-bar-settings";
  settingsLink.href = "/account/";
  settingsLink.textContent = t.settings;
  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "user-bar-logout";
  logoutBtn.textContent = t.logout;
  pop.append(settingsLink, logoutBtn);
  container.append(pop);

  const unbind = bindMenuToggle(container, pop, [nameBtn]);
  menuUnbind.set(container, unbind);

  logoutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    pop.classList.remove("is-open");
    clearRoom();
    clearUser();
    if (onLogout) onLogout();
    else location.reload();
  });
}
