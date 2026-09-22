import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { applyNavBack } from "/js/navBack.js?v=3";
import { getUser, setUser, requireAuth } from "/game/js/store.js";
import { accountCopy } from "./copy.js?v=3";

const root = document.getElementById("accountRoot");
const backLink = document.getElementById("backLink");
const pageTitle = document.getElementById("pageTitle");
const pageSub = document.getElementById("pageSub");

let openPanel = "";

if (!requireAuth("account/")) {
  /* redirected */
} else {
  boot();
}

function boot() {
  const lang = getPortalLang();
  const copy = accountCopy(lang);
  applyNavBack(backLink, lang, "hall");
  pageTitle.textContent = copy.title;
  pageSub.textContent = copy.sub;
  document.title = `${copy.title} | 1024201`;
  mountLangTabs(document.getElementById("langSlot"), {
    onChange: () => boot(),
  });
  paint(copy);
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rowAction(copy, key, open) {
  if (open) return copy.cancel;
  return key === "pass" ? copy.change : copy.edit;
}

function row(copy, key, label, value) {
  const open = openPanel === key;
  return `
    <section class="account-row" data-panel="${key}">
      <div class="account-row-head">
        <div>
          <h2>${esc(label)}</h2>
          <p class="account-now">${esc(value)}</p>
        </div>
        <button type="button" class="btn-secondary account-edit" data-edit="${key}">${esc(rowAction(copy, key, open))}</button>
      </div>
      ${open ? `<div class="account-panel" data-open="${key}"></div>` : ""}
    </section>`;
}

function paint(copy) {
  const user = getUser();
  root.innerHTML = [
    row(copy, "name", copy.username, `@${user.username}`),
    row(copy, "pass", copy.password, "••••••"),
    row(copy, "mail", copy.email, user.email || "—"),
  ].join("");

  root.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.edit;
      openPanel = openPanel === key ? "" : key;
      paint(copy);
    });
  });

  const panel = root.querySelector("[data-open]");
  if (!panel) return;
  if (openPanel === "name") fillName(panel, copy, user);
  if (openPanel === "pass") fillPass(panel, copy);
  if (openPanel === "mail") fillMail(panel, copy);
}

function fillName(panel, copy, user) {
  panel.innerHTML = `
    <form class="account-form" id="nameForm">
      <input id="nameInput" maxlength="24" value="${esc(user.username)}" autocomplete="username">
      <button class="btn-primary" type="submit">${esc(copy.saveName)}</button>
      <p class="account-msg" id="nameMsg"></p>
    </form>`;
  document.getElementById("nameForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await post("change_username", { username: document.getElementById("nameInput").value }, "nameMsg", copy)) {
      openPanel = "";
      paint(copy);
    }
  });
}

function fillPass(panel, copy) {
  panel.innerHTML = `
    <form class="account-form" id="passForm">
      <label>${esc(copy.current)}</label>
      <input id="passNow" type="password" autocomplete="current-password">
      <label>${esc(copy.next)}</label>
      <input id="passNext" type="password" autocomplete="new-password">
      <label>${esc(copy.next2)}</label>
      <input id="passNext2" type="password" autocomplete="new-password">
      <button class="btn-primary" type="submit">${esc(copy.savePass)}</button>
      <p class="account-msg" id="passMsg"></p>
    </form>`;
  document.getElementById("passForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await post("change_password", {
      current_password: document.getElementById("passNow").value,
      password: document.getElementById("passNext").value,
      password2: document.getElementById("passNext2").value,
    }, "passMsg", copy)) {
      openPanel = "";
      paint(copy);
    }
  });
}

function fillMail(panel, copy) {
  panel.innerHTML = `
    <form class="account-form" id="mailForm">
      <label>${esc(copy.newEmail)}</label>
      <input id="mailInput" type="email" autocomplete="email">
      <label>${esc(copy.current)}</label>
      <input id="mailPass" type="password" autocomplete="current-password">
      <button class="btn-secondary" type="submit">${esc(copy.sendCode)}</button>
      <label>${esc(copy.code)}</label>
      <input id="mailCode" maxlength="8" autocomplete="one-time-code">
      <button class="btn-primary" type="button" id="mailConfirm">${esc(copy.confirmEmail)}</button>
      <p class="account-msg" id="mailMsg"></p>
    </form>`;
  document.getElementById("mailForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await post("request_email_change", {
      email: document.getElementById("mailInput").value,
      password: document.getElementById("mailPass").value,
    }, "mailMsg", copy, copy.sent);
  });
  document.getElementById("mailConfirm").addEventListener("click", async () => {
    if (await post("confirm_email_change", { code: document.getElementById("mailCode").value }, "mailMsg", copy)) {
      openPanel = "";
      paint(copy);
    }
  });
}

async function post(action, body, msgId, copy, okText) {
  const box = document.getElementById(msgId);
  box.classList.remove("is-err");
  box.textContent = "";
  const user = getUser();
  try {
    const res = await fetch(`/api/auth?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, user_id: user.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "fail");
    if (data.user) setUser(data.user);
    box.textContent = okText || copy.ok;
    return true;
  } catch (err) {
    box.classList.add("is-err");
    box.textContent = err.message;
    return false;
  }
}
