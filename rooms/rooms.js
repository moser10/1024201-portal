import { getPortalLang } from "/js/langTabs.js";
import { mountAccountChrome } from "/js/accountChrome.js?v=3";
import { getUser, requireAuth } from "/game/js/store.js";
import { applyNavBack, setNavBack, roomReturnId } from "/js/navBack.js?v=3";
import { roomsCopy } from "./copy.js?v=5";

const root = document.getElementById("roomsRoot");
const backLink = document.getElementById("backLink");
const pageTitle = document.getElementById("pageTitle");
const pageSub = document.getElementById("pageSub");

let lang = getPortalLang();
let copy = roomsCopy(lang);
let kind = "dua";
let view = "lobby";
let current = null;
let pulse = 0;
let askingClose = false;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(action, body) {
  const user = getUser();
  const isGet = action === "list" || (action === "get" && !body);
  const url = isGet && action === "list"
    ? `/api/openroom?action=list&kind=${encodeURIComponent(kind)}`
    : `/api/openroom?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method: isGet && action === "list" ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: action === "list" ? undefined : JSON.stringify({ ...(body || {}), user_id: user?.id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "fail"), { code: data.error, status: res.status });
  return data;
}

function errText(code) {
  if (code === "pin") return copy.errPin;
  if (code === "full") return copy.errFull;
  if (code === "closed") return copy.errClosed;
  return String(code || "");
}

function paintBack() {
  applyNavBack(backLink, lang, view === "inside" ? "rooms" : "hall");
}

backLink?.addEventListener("click", (e) => {
  if (view !== "inside") return;
  e.preventDefault();
  showRoomsLobby();
});

function applyChrome() {
  lang = getPortalLang();
  copy = roomsCopy(lang);
  paintBack();
  pageTitle.textContent = copy.title;
  pageSub.textContent = copy.sub;
  document.title = `${copy.title} | 1024201`;
  mountAccountChrome(document.getElementById("accountSlot"), {
    variant: "game",
    returnPath: "rooms/",
    onLangChange: () => {
      applyChrome();
      if (view === "lobby") renderLobby();
      else if (current) renderInside(current);
    },
  });
}

function renderLobby(list = null, error = "") {
  view = "lobby";
  root.innerHTML = `
    <div class="rooms-tabs">
      <button type="button" class="btn-secondary ${kind === "dua" ? "active" : ""}" data-kind="dua">${esc(copy.tabGame)}</button>
      <button type="button" class="btn-secondary ${kind === "chat" ? "active" : ""}" data-kind="chat">${esc(copy.tabChat)}</button>
    </div>
    <form class="rooms-form" id="createForm">
      <label>${esc(copy.name)}</label>
      <input id="roomTitle" maxlength="24" placeholder="${esc(copy.namePh)}" required autocomplete="off">
      ${kind === "dua" ? `
      <label>${esc(copy.game)}</label>
      <select id="roomGame">
        <option value="dua" selected>${esc(copy.gameDua)}</option>
      </select>
      <p class="rooms-game-blurb">${esc(copy.gameBlurb)}</p>` : `<p class="rooms-game-blurb">${esc(copy.unlimited)}</p>`}
      <label>${esc(copy.pin)}</label>
      <input id="roomPin" inputmode="numeric" maxlength="4" placeholder="${esc(copy.pinPh)}" autocomplete="off">
      <button class="btn-primary" type="submit">${esc(copy.create)}</button>
    </form>
    <h2 style="font-size:15px;margin:8px 0 0">${esc(copy.list)}</h2>
    ${error ? `<p class="rooms-err">${esc(errText(error))}</p>` : ""}
    <div class="rooms-list" id="roomList">${list ? paintList(list) : ""}</div>
  `;
  root.querySelectorAll("[data-kind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      kind = btn.dataset.kind;
      loadLobby();
    });
  });
  document.getElementById("createForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api("create", {
        kind,
        title: document.getElementById("roomTitle").value,
        pin: document.getElementById("roomPin").value,
      });
      openInside(data);
    } catch (err) {
      loadLobby(err.code);
    }
  });
  root.querySelectorAll("[data-join]").forEach((btn) => {
    btn.addEventListener("click", () => tryJoin(btn.dataset.join, btn.dataset.pin === "1"));
  });
  paintBack();
}

function seatLine(r) {
  if (!r.max_seats) return `${r.seats} · ${copy.unlimited}`;
  return `${r.seats}/${r.max_seats}`;
}

function paintList(rooms) {
  if (!rooms.length) return `<p class="rooms-empty">${esc(copy.empty)}</p>`;
  return rooms
    .map(
      (r) => `
      <article class="room-card">
        <div>
          <strong>${esc(r.title)}</strong>
          <small>${seatLine(r)}${r.has_pin ? ` · ${esc(copy.locked)}` : ""} · ${esc(copy.host)} @${esc(r.host_name)}</small>
        </div>
        <button type="button" class="btn-primary" data-join="${esc(r.id)}" data-pin="${r.has_pin ? "1" : "0"}">${esc(copy.join)}</button>
      </article>`
    )
    .join("");
}

async function loadLobby(error = "") {
  renderLobby(null, error);
  try {
    const data = await api("list");
    renderLobby(data.rooms || [], error);
  } catch (err) {
    renderLobby([], err.code || "fail");
  }
}

async function tryJoin(id, needPin) {
  let pin = "";
  if (needPin) {
    pin = window.prompt(copy.needPin, "") || "";
  }
  try {
    const data = await api("join", { room_id: id, pin });
    openInside(data);
  } catch (err) {
    loadLobby(err.code);
  }
}

function openInside(data) {
  current = data;
  setNavBack({ type: "rooms" });
  history.replaceState(null, "", "/rooms/");
  renderInside(data);
  startPulse();
}

function renderInside(data) {
  view = "inside";
  const room = data.room;
  const seats = data.seats || [];
  const msgs = data.messages || [];
  root.innerHTML = `
    <div class="rooms-inside">
    <p class="rooms-note"><strong>${esc(room.title)}</strong> · ${seatLine({ seats: seats.length, max_seats: room.max_seats })}</p>
    <div class="seat-list">${seats.map((s) => `<span class="seat-chip">@${esc(s.username)}</span>`).join("")}</div>
    ${room.kind === "dua" ? `<p class="rooms-note">${esc(copy.duaSoon)}</p><div class="rooms-practice"><a class="btn-secondary" id="practiceDua" href="/game/dua/">${esc(copy.practice)}</a></div>` : ""}
    <div class="msg-list">${msgs.map((m) => `<p class="msg-row"><b>@${esc(m.username)}</b> ${esc(m.text)}</p>`).join("")}</div>
    <form class="rooms-say" id="sayForm">
      <input id="sayText" maxlength="280" placeholder="${esc(copy.chatPh)}" autocomplete="off" enterkeyhint="send">
      <button class="btn-primary" type="submit">${esc(copy.say)}</button>
    </form>
    <div class="rooms-actions">
      <button type="button" class="btn-secondary" id="leaveBtn">${esc(copy.leave)}</button>
      ${room.host ? `<button type="button" class="btn-danger" id="closeBtn">${esc(copy.close)}</button>` : ""}
    </div>
    </div>
    <div class="rooms-modal" id="closeAsk" ${askingClose ? "" : "hidden"}>
      <div class="rooms-modal-card">
        <p>${esc(copy.closeAsk)}</p>
        <div class="rooms-actions">
          <button type="button" class="btn-secondary" id="closeNo">${esc(copy.cancel)}</button>
          <button type="button" class="btn-danger" id="closeYes">${esc(copy.ok)}</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("sayForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("sayText").value;
    try {
      current = await api("say", { room_id: room.id, text });
      renderInside(current);
    } catch (err) {
      if (err.code === "closed") showRoomsLobby();
    }
  });
  document.getElementById("leaveBtn").addEventListener("click", async () => {
    await api("leave", { room_id: room.id }).catch(() => {});
    showRoomsLobby();
  });
  document.getElementById("closeBtn")?.addEventListener("click", () => {
    askingClose = true;
    const box = document.getElementById("closeAsk");
    if (box) box.hidden = false;
  });
  document.getElementById("closeNo")?.addEventListener("click", () => {
    askingClose = false;
    const box = document.getElementById("closeAsk");
    if (box) box.hidden = true;
  });
  document.getElementById("closeYes")?.addEventListener("click", async () => {
    askingClose = false;
    await api("close", { room_id: room.id }).catch(() => {});
    showRoomsLobby();
  });
  document.getElementById("practiceDua")?.addEventListener("click", () => {
    setNavBack({ type: "room", roomId: room.id, roomTitle: room.title });
  });
  paintBack();
}

function showRoomsLobby() {
  stopPulse();
  askingClose = false;
  current = null;
  setNavBack({ type: "hall" });
  history.replaceState(null, "", "/rooms/");
  loadLobby();
  paintBack();
}

function startPulse() {
  stopPulse();
  pulse = setInterval(async () => {
    if (!current?.room?.id) return;
    try {
      current = await api("heartbeat", { room_id: current.room.id });
      if (view === "inside" && !askingClose) {
        const draft = document.getElementById("sayText")?.value || "";
        renderInside(current);
        const box = document.getElementById("sayText");
        if (box) box.value = draft;
      }
    } catch (err) {
      if (err.code === "closed" || err.code === "member") showRoomsLobby();
    }
  }, 8000);
}

function stopPulse() {
  if (pulse) clearInterval(pulse);
  pulse = 0;
}

if (!requireAuth("rooms/")) {
  /* redirected */
} else {
  applyChrome();
  const fromUrl = new URLSearchParams(location.search).get("r");
  const want = roomReturnId() || fromUrl;
  if (fromUrl) history.replaceState(null, "", "/rooms/");
  if (want) {
    api("get", { room_id: want })
      .then((data) => {
        if (data.room?.member) openInside(data);
        else if (data.room) tryJoin(data.room.id, data.room.has_pin);
        else loadLobby();
      })
      .catch(() => loadLobby());
  } else {
    loadLobby();
  }
}
