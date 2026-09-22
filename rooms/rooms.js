import { getPortalLang } from "/js/langTabs.js";
import { mountAccountChrome } from "/js/accountChrome.js?v=3";
import { getUser, requireAuth } from "/game/js/store.js";
import { applyNavBack, setNavBack, roomReturnId } from "/js/navBack.js?v=4";
import { roomsCopy } from "./copy.js?v=7";
import { showPortalModal, hidePortalModal } from "/js/portalModal.js?v=1";

const root = document.getElementById("roomsRoot");
const backLink = document.getElementById("backLink");
const pageTitle = document.getElementById("pageTitle");
const LOBBY_CACHE = "portal_open_room_list";

let lang = getPortalLang();
let copy = roomsCopy(lang);
let kind = "dua";
let view = "lobby";
let current = null;
let pulse = 0;
let askingClose = false;
const lastList = { dua: null, chat: null };
let listPaintKey = "";

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
  document.title = `${copy.title} | 1024201`;
  paintCloseAsk();
  mountAccountChrome(document.getElementById("accountSlot"), {
    variant: "game",
    returnPath: "rooms/",
    onLangChange: () => {
      applyChrome();
      if (view === "lobby") renderLobby(readCachedList(kind));
      else if (current) renderInside(current);
    },
  });
}

function readCachedList(k) {
  if (Array.isArray(lastList[k])) return lastList[k];
  try {
    const all = JSON.parse(sessionStorage.getItem(LOBBY_CACHE) || "{}");
    if (Array.isArray(all[k])) {
      lastList[k] = all[k];
      return all[k];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedList(k, rooms) {
  lastList[k] = rooms;
  try {
    const all = JSON.parse(sessionStorage.getItem(LOBBY_CACHE) || "{}");
    all[k] = rooms;
    sessionStorage.setItem(LOBBY_CACHE, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function listKey(rooms, error = "") {
  return JSON.stringify({
    kind,
    error,
    rooms: (rooms || []).map((r) => [r.id, r.title, r.seats, r.max_seats, r.has_pin, r.host_name]),
  });
}

function lobbyIsPainted() {
  return view === "lobby" && root.querySelector("#createForm") && root.dataset.kind === kind;
}

function bindLobbyJoins() {
  root.querySelectorAll("[data-join]").forEach((btn) => {
    btn.addEventListener("click", () => tryJoin(btn.dataset.join, btn.dataset.pin === "1"));
  });
}

function fillRoomList(list, error = "") {
  const errSlot = root.querySelector(".rooms-err-slot");
  if (errSlot) errSlot.innerHTML = error ? `<p class="rooms-err">${esc(errText(error))}</p>` : "";
  const box = document.getElementById("roomList");
  if (!box || !list) return;
  const key = listKey(list, error);
  if (key === listPaintKey && box.innerHTML) return;
  listPaintKey = key;
  box.innerHTML = paintList(list);
  bindLobbyJoins();
}

function prefetchLobby() {
  api("list")
    .then((data) => writeCachedList(kind, data.rooms || []))
    .catch(() => {});
}

function renderLobby(list = null, error = "") {
  view = "lobby";
  const rooms = list ?? readCachedList(kind);
  listPaintKey = rooms ? listKey(rooms, error) : "";
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
      <button type="button" class="rooms-game-btn" id="gamePick">${esc(copy.gameDua)} ✓</button>
      <p class="rooms-game-blurb">${esc(copy.gameBlurb)}</p>` : `<p class="rooms-game-blurb">${esc(copy.unlimited)}</p>`}
      <label>${esc(copy.pin)}</label>
      <input id="roomPin" inputmode="numeric" maxlength="4" placeholder="${esc(copy.pinPh)}" autocomplete="off">
      <button class="btn-primary" type="submit">${esc(copy.create)}</button>
    </form>
    <h2 style="font-size:15px;margin:8px 0 0">${esc(copy.list)}</h2>
    <div class="rooms-err-slot">${error ? `<p class="rooms-err">${esc(errText(error))}</p>` : ""}</div>
    <div class="rooms-list" id="roomList">${rooms ? paintList(rooms) : ""}</div>
  `;
  root.dataset.kind = kind;
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
  bindLobbyJoins();
  document.getElementById("gamePick")?.addEventListener("click", () => {
    showPortalModal(document.getElementById("gameAsk"));
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
  const cached = readCachedList(kind);
  if (lobbyIsPainted()) {
    if (cached) fillRoomList(cached, error);
    paintBack();
  } else {
    renderLobby(cached, error);
  }
  try {
    const data = await api("list");
    const rooms = data.rooms || [];
    writeCachedList(kind, rooms);
    if (view !== "lobby") return;
    if (lobbyIsPainted()) fillRoomList(rooms, error);
    else renderLobby(rooms, error);
  } catch (err) {
    if (view !== "lobby") return;
    const code = err.code || "fail";
    const fallback = readCachedList(kind);
    if (lobbyIsPainted()) fillRoomList(fallback || [], code);
    else renderLobby(fallback || [], code);
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
  prefetchLobby();
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
    <div class="seat-list">${seats.map((s) => `<span class="seat-chip">@${esc(s.username)}${s.ready ? " ✓" : ""}</span>`).join("")}</div>
    ${room.kind === "dua" ? `${room.called ? `<p class="rooms-note rooms-call-note">${esc(copy.callNote)}</p>` : ""}
    <div class="rooms-practice rooms-actions">
      <button type="button" class="btn-secondary" id="readyBtn">${esc(seats.some((s) => Number(s.user_id) === Number(getUser()?.id) && s.ready) ? copy.unready : copy.ready)}</button>
      <a class="btn-primary" id="enterDua" href="/game/dua/">${esc(copy.enterDua)}</a>
      <a class="btn-secondary" id="practiceDua" href="/game/dua/">${esc(copy.practice)}</a>
      <button type="button" class="btn-secondary" id="callBtn">${esc(room.called ? copy.called : copy.call)}</button>
    </div>` : ""}
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
    showPortalModal(document.getElementById("closeAsk"));
  });
  document.getElementById("readyBtn")?.addEventListener("click", async () => {
    const mine = seats.some((s) => Number(s.user_id) === Number(getUser()?.id) && s.ready);
    try {
      current = await api("ready", { room_id: room.id, ready: !mine });
      renderInside(current);
    } catch (err) {
      if (err.code === "closed") showRoomsLobby();
    }
  });
  document.getElementById("practiceDua")?.addEventListener("click", () => goDua(room, "practice"));
  document.getElementById("enterDua")?.addEventListener("click", () => goDua(room, "online"));
  document.getElementById("callBtn")?.addEventListener("click", async () => {
    try {
      current = await api("call", { room_id: room.id });
      renderInside(current);
    } catch (err) {
      if (err.code === "closed") showRoomsLobby();
    }
  });
  paintBack();
}

function goDua(room, mode = "practice") {
  setNavBack({ type: "room", roomId: room.id, roomTitle: room.title, mode });
}

function paintCloseAsk() {
  const text = document.getElementById("closeAskText");
  const no = document.getElementById("closeNo");
  const yes = document.getElementById("closeYes");
  if (text) text.textContent = copy.closeAsk;
  if (no) no.textContent = copy.cancel;
  if (yes) yes.textContent = copy.ok;
  const gameTitle = document.getElementById("gameAskTitle");
  const gameLabel = document.getElementById("gameOptDuaLabel");
  if (gameTitle) gameTitle.textContent = copy.game;
  if (gameLabel) gameLabel.textContent = copy.gameDua;
}

function bindGameAsk() {
  const box = document.getElementById("gameAsk");
  box?.addEventListener("click", (e) => {
    if (e.target === box) hidePortalModal(box);
  });
  document.getElementById("gameOptDua")?.addEventListener("click", () => {
    hidePortalModal(box);
  });
}

function bindCloseAsk() {
  document.getElementById("closeNo")?.addEventListener("click", () => {
    askingClose = false;
    hidePortalModal(document.getElementById("closeAsk"));
  });
  document.getElementById("closeYes")?.addEventListener("click", async () => {
    askingClose = false;
    hidePortalModal(document.getElementById("closeAsk"));
    const id = current?.room?.id;
    if (id) await api("close", { room_id: id }).catch(() => {});
    showRoomsLobby();
  });
}

function showRoomsLobby() {
  stopPulse();
  askingClose = false;
  hidePortalModal(document.getElementById("closeAsk"));
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
  bindCloseAsk();
  bindGameAsk();
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
