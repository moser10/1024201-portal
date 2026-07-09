import { roomApi } from "./api.js";
import { bindNameCheck } from "./nameCheck.js";
import { getUser, getRoom, clearRoom } from "../../js/store.js";
import { mountUserBar } from "../../js/userBar.js";
import { renderTodos } from "../../js/todos.js";
import { showToast, confirmSheet } from "../../js/toast.js";

let pollTimer = null;
let heartbeatTimer = null;
let playDisposed = false;
let bookTitle = "";
let savedTitle = "";
let chapters = [];
let canChapter = false;
let canWriteBook = true;
let writeHint = "";
let prevOnlineIds = null;
let prevOnlineNames = new Map();
let presenceFeed = [];
const PRESENCE_TTL_MS = 10000;
let lastChatItems = [];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatText(str) {
  return escapeHtml(str).replace(/\n/g, "<br>");
}

export function renderPlay(app, onLeave, game) {
  const user = getUser();
  const room = getRoom();
  if (!room?.id) return onLeave();

  playDisposed = false;

  function stopPlayTimers() {
    playDisposed = true;
    clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
    pollTimer = null;
    heartbeatTimer = null;
  }

  app.innerHTML = `
    <div class="card">
      <div class="header-row">
        <div>
          <p class="game-brand">${game.nameEn}</p>
          <p class="game-brand game-brand-zh">${game.nameZh}</p>
          <h1 id="roomTitle">${escapeHtml(room.title)}</h1>
          <p class="sub" id="shareCodeLine" hidden></p>
          <p class="sub" id="roomMeta"></p>
        </div>
        <div class="header-actions">
          <div id="playUserBar"></div>
          <button id="leaveBtn" class="btn-secondary btn-small">离开房间</button>
        </div>
      </div>

      <section class="section todo-section">
        <h2>待办事项</h2>
        <div id="todoBox"><p class="sub">加载中...</p></div>
      </section>

      <section id="ownerRename" class="section" hidden>
        <h3>修改书名（仅房主）</h3>
        <div class="row">
          <input type="text" id="renameInput" maxlength="30">
          <button type="button" id="renameSuggest" class="btn-secondary disabled" disabled>推荐</button>
        </div>
        <p id="renameHint" class="hint"></p>
        <button id="renameBtn" class="btn-secondary btn-small disabled" disabled>保存书名</button>
      </section>

      <section class="section">
        <h2>在线</h2>
        <div id="onlineList" class="online-list"><span class="sub">加载中...</span></div>
      </section>

      <section class="section book-section">
        <div class="section-head">
          <h2>📖 共享写书</h2>
          <div class="row" style="margin:0;">
            <button id="chapterBtn" class="btn-secondary btn-small disabled" disabled title="至少 400 字才可分章">自动分章</button>
            <button id="pdfBtn" class="btn-secondary btn-small">下载 PDF</button>
          </div>
        </div>
        <p id="writeTurnHint" class="sub" hidden></p>
        <div id="tocBox" class="toc-box" hidden></div>
        <div id="bookWindow" class="book-window">等待第一句...</div>
      </section>

      <section class="section">
        <h2>💬 聊天</h2>
        <p class="sub">聊天仅在线可见，全员离线后自动清除</p>
        <div id="chatWindow" class="chat-window"></div>
      </section>

      <section class="section compose">
        <textarea id="composeInput" placeholder="输入内容（共享写书限50字）" maxlength="200"></textarea>
        <div class="row">
          <button id="chatBtn" class="btn-secondary disabled" disabled>聊天</button>
          <button id="bookBtn" class="btn-primary disabled" disabled>共享写书</button>
        </div>
      </section>
    </div>`;

  mountUserBar(document.getElementById("playUserBar"), {
    variant: "game",
    returnPath: "onesentence/",
    onLogout: () => {
      stopPlayTimers();
      window.location.href = `/game/register/?return=${encodeURIComponent("onesentence/")}`;
    },
  });

  const renameInput = document.getElementById("renameInput");
  const renameBtn = document.getElementById("renameBtn");
  const renameSuggest = document.getElementById("renameSuggest");
  renameSuggest.dataset.defaultLabel = "推荐";
  const composeInput = document.getElementById("composeInput");
  const chatBtn = document.getElementById("chatBtn");
  const bookBtn = document.getElementById("bookBtn");

  function syncRenameBtn() {
    const next = renameInput.value.trim();
    const unchanged = !next || next === savedTitle;
    renameBtn.disabled = unchanged;
    renameBtn.classList.toggle("disabled", unchanged);
    renameSuggest.disabled = unchanged;
    renameSuggest.classList.toggle("disabled", unchanged);
    if (unchanged) {
      delete renameSuggest.dataset.v;
      renameSuggest.textContent = renameSuggest.dataset.defaultLabel;
      document.getElementById("renameHint").textContent = next ? "与当前书名相同" : "";
    }
  }

  if (room.role === "owner") {
    document.getElementById("ownerRename").hidden = false;
    bindNameCheck({
      input: renameInput,
      btn: renameSuggest,
      hint: document.getElementById("renameHint"),
      checkFn: (title) => roomApi.checkTitle(title, room.id),
      getOriginalName: () => savedTitle,
    });
    renameInput.oninput = syncRenameBtn;
    renameBtn.onclick = async () => {
      const title = renameInput.value.trim();
      if (!title || title === savedTitle) return;
      try {
        await roomApi.updateTitle(room.id, user.id, title);
        room.title = title;
        bookTitle = title;
        savedTitle = title;
        document.getElementById("roomTitle").textContent = title;
        syncRenameBtn();
        showToast("书名已更新");
        await refresh();
      } catch (e) {
        if (e.data?.recommend) {
          renameSuggest.textContent = `推荐: ${e.data.recommend}`;
          renameSuggest.dataset.v = e.data.recommend;
          renameSuggest.disabled = false;
          renameSuggest.classList.remove("disabled");
        }
        showToast(e.message);
      }
    };
  }

  function syncComposeBtns() {
    const raw = composeInput.value;
    const hasChat = raw.trim().length > 0;
    chatBtn.disabled = !hasChat;
    chatBtn.classList.toggle("disabled", !hasChat);
    chatBtn.textContent = hasChat ? "发送" : "聊天";
    bookBtn.disabled = !canWriteBook || !hasChat;
    bookBtn.classList.toggle("disabled", !canWriteBook || !hasChat);
  }

  composeInput.addEventListener("input", syncComposeBtns);

  async function doLeave() {
    stopPlayTimers();
    try {
      await roomApi.leaveRoom(room.id, user.id);
    } catch (_) {}
    onLeave();
  }

  document.getElementById("leaveBtn").onclick = doLeave;
  window.addEventListener("beforeunload", () => {
    navigator.sendBeacon?.(
      "/api/room?action=leave_room",
      new Blob([JSON.stringify({ story_id: room.id, user_id: user.id })], { type: "application/json" })
    );
  });

  document.getElementById("chatBtn").onclick = () => publish("chat");
  document.getElementById("bookBtn").onclick = () => publish("book");

  const chapterBtn = document.getElementById("chapterBtn");
  chapterBtn.onclick = async () => {
    if (chapterBtn.disabled) return;
    try {
      const data = await roomApi.generateChapters(room.id, user.id);
      chapters = data.chapters || [];
      renderToc();
    } catch (e) {
      showToast(e.message);
    }
  };
  document.getElementById("pdfBtn").onclick = downloadPdf;

  heartbeatTimer = setInterval(() => roomApi.heartbeat(room.id, user.id).catch(() => {}), 5000);
  roomApi.heartbeat(room.id, user.id).catch(() => {});

  const POLL_MS = 3000;

  async function publish(type) {
    const raw = composeInput.value;
    const text = type === "chat" ? raw.trim() : raw.replace(/^\s+|\s+$/g, "");
    if (!text) return;
    if (type === "book" && text.length > 50) {
      showToast("共享写书限50字");
      return;
    }
    try {
      await roomApi.publish(room.id, user.id, type, type === "chat" ? raw : text);
      composeInput.value = "";
      syncComposeBtns();
      await refresh();
    } catch (e) {
      showToast(e.message);
    }
  }

  function syncChapterBtn() {
    chapterBtn.disabled = !canChapter;
    chapterBtn.classList.toggle("disabled", !canChapter);
    chapterBtn.title = canChapter ? "按每章至少 200 字自动分章" : "至少 400 字才可分章（每章不少于 200 字）";
  }

  function syncWriteTurn(writing) {
    canWriteBook = !!writing?.can_write_book;
    writeHint = writing?.write_hint || "";
    const hintEl = document.getElementById("writeTurnHint");
    if (!writing) {
      hintEl.hidden = true;
      return;
    }
    const parts = [];
    if (writing.holder_name && writing.phase === "writing") {
      parts.push(`@${writing.holder_name} 写书中（${writing.holder_writes}/${writing.writes_per_turn}）`);
    }
    if (writeHint && !canWriteBook) parts.push(writeHint);
    if (parts.length) {
      hintEl.hidden = false;
      hintEl.textContent = parts.join(" · ");
    } else {
      hintEl.hidden = true;
    }
    syncComposeBtns();
  }

  function renderToc() {
    const box = document.getElementById("tocBox");
    if (!chapters.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = `<h3>目录</h3><ol>${chapters.map((c) => `<li>${escapeHtml(c.title)}</li>`).join("")}</ol>`;
  }

  function prunePresenceFeed() {
    const now = Date.now();
    presenceFeed = presenceFeed.filter((ev) => now - ev.at < PRESENCE_TTL_MS);
  }

  function collectPresenceEvents(online) {
    const ids = new Set(online.map((u) => u.user_id));
    const events = [];
    const now = Date.now();
    if (prevOnlineIds !== null) {
      for (const u of online) {
        if (!prevOnlineIds.has(u.user_id)) {
          events.push({ kind: "join", username: u.username, at: now });
        }
      }
      for (const id of prevOnlineIds) {
        if (!ids.has(id)) {
          events.push({ kind: "leave", username: prevOnlineNames.get(id) || "?", at: now });
        }
      }
    }
    prevOnlineIds = ids;
    prevOnlineNames = new Map(online.map((u) => [u.user_id, u.username]));
    if (events.length) {
      presenceFeed.push(...events);
    }
    prunePresenceFeed();
    return events;
  }

  function renderOnline(list) {
    const box = document.getElementById("onlineList");
    if (!list?.length) {
      box.innerHTML = `<span class="sub">暂无在线成员</span>`;
      return;
    }
    box.innerHTML = list
      .map((u) => `<span class="online-chip">@${escapeHtml(u.username)}</span>`)
      .join("");
  }

  async function refresh() {
    if (playDisposed) return;
    try {
      const data = await roomApi.content(room.id, user.id);
      if (playDisposed) return;
      bookTitle = data.title || room.title;
      savedTitle = bookTitle;
      if (room.role === "owner") {
        renameInput.value = bookTitle;
        syncRenameBtn();
      }
      if (data.invite_code) room.invite_code = data.invite_code;
      chapters = data.chapters || [];
      canChapter = !!data.can_chapter;
      syncChapterBtn();
      syncWriteTurn(data.writing);
      collectPresenceEvents(data.online || []);
      lastChatItems = data.chat || [];
      renderBook(data.book);
      renderChat(lastChatItems);
      renderToc();
      renderOnline(data.online);
      await loadPlayTodos();
      updateRoomMeta(data);
    } catch (e) {
      if (playDisposed) return;
      if (e.message?.includes("不在该房间")) {
        stopPlayTimers();
        clearRoom();
        showToast("你已不在该房间");
        onLeave();
        return;
      }
      const bookWindow = document.getElementById("bookWindow");
      if (bookWindow) {
        bookWindow.innerHTML = `<p class="hint err">${escapeHtml(e.message)}</p>`;
      }
    }
  }

  function updateRoomMeta(data) {
    const shareLine = document.getElementById("shareCodeLine");
    if (room.role === "owner" && (room.invite_code || data.invite_code)) {
      const code = room.invite_code || data.invite_code;
      shareLine.hidden = false;
      shareLine.innerHTML = `分享码 <code class="share-code">${escapeHtml(code)}</code>`;
    } else {
      shareLine.hidden = true;
    }
    document.getElementById("roomMeta").textContent = `《${bookTitle}》 · ${data.total_chars || 0} 字 · @${user.username}`;
  }

  function renderBook(items) {
    const box = document.getElementById("bookWindow");
    const titleHtml = `<h3 class="book-title">《${escapeHtml(bookTitle)}》</h3>`;

    if (!items.length) {
      box.innerHTML = titleHtml + "<p>等待第一位作者开启世界线...</p>";
      return;
    }

    if (chapters.length) {
      box.innerHTML =
        titleHtml +
        chapters
          .map(
            (ch) => `
        <div class="chapter-block">
          <h4 class="chapter-title">${escapeHtml(ch.title)}</h4>
          <div class="chapter-text">${formatText(ch.text)}</div>
        </div>`
          )
          .join("");
      return;
    }

    box.innerHTML =
      titleHtml +
      items
        .map((item) => {
          const info = `@${item.author} · ${item.time}`;
          return `<div class="book-line" data-id="${item.id}" data-info="${escapeHtml(info)}" title="${escapeHtml(info)}">${formatText(item.text)}</div>`;
        })
        .join("");
    box.querySelectorAll(".book-line").forEach((el) => {
      el.onclick = () => tryRecall(Number(el.dataset.id));
    });
  }

  async function loadPlayTodos() {
    if (playDisposed) return;
    await renderTodos(document.getElementById("todoBox"), {
      section: document.querySelector(".todo-section"),
      roomId: room.id,
      isOwner: room.role === "owner",
      onChange: refresh,
    });
  }

  function renderChat(items) {
    const box = document.getElementById("chatWindow");
    prunePresenceFeed();

    const timeline = [
      ...items.map((item) => ({ type: "chat", item })),
      ...presenceFeed.map((ev) => ({ type: "presence", ev })),
    ];

    if (!timeline.length) {
      box.innerHTML = `<p class="sub">暂无聊天</p>`;
      return;
    }

    box.innerHTML = timeline
      .map((entry) => {
        if (entry.type === "presence") {
          const ev = entry.ev;
          return `<div class="chat-presence chat-presence--${ev.kind}">@${escapeHtml(ev.username)} ${ev.kind === "join" ? "进入了房间" : "离开了房间"}</div>`;
        }
        const item = entry.item;
        return `
      <div class="chat-item" data-id="${item.id}">
        <span class="chat-author">@${escapeHtml(item.author)}</span>
        <span class="chat-time">${escapeHtml(item.time)}</span>
        <p>${formatText(item.text)}</p>
      </div>`;
      })
      .join("");

    box.querySelectorAll(".chat-item").forEach((el) => {
      el.onclick = () => tryRecall(Number(el.dataset.id));
    });
    box.scrollTop = box.scrollHeight;
  }

  async function tryRecall(contentId) {
    const ok = await confirmSheet("撤回这条内容？（半小时内有效）");
    if (!ok) return;
    try {
      await roomApi.recall(contentId, user.id);
      await refresh();
    } catch (e) {
      showToast(e.message);
    }
  }

  function downloadPdf() {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => {
      const title = bookTitle || room.title;
      let body = `<h1 style="text-align:center">《${escapeHtml(title)}》</h1>`;
      if (chapters.length) {
        body += `<h2>目录</h2><ol>${chapters.map((c) => `<li>${escapeHtml(c.title)}</li>`).join("")}</ol>`;
        body += chapters.map((c) => `<h2>${escapeHtml(c.title)}</h2><div style="white-space:pre-wrap">${formatText(c.text)}</div>`).join("");
      } else {
        body += document.getElementById("bookWindow").innerHTML;
      }
      const wrap = document.createElement("div");
      wrap.innerHTML = body;
      html2pdf()
        .set({
          margin: 1,
          filename: `${title}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        })
        .from(wrap)
        .save();
    };
    document.head.appendChild(script);
  }

  syncComposeBtns();
  refresh();
  pollTimer = setInterval(refresh, POLL_MS);
  setInterval(() => {
    if (playDisposed) return;
    const before = presenceFeed.length;
    prunePresenceFeed();
    if (before !== presenceFeed.length) renderChat(lastChatItems);
  }, 1000);
}
