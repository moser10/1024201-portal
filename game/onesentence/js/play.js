import { roomApi } from "./api.js";
import { bindNameCheck } from "./nameCheck.js";
import { getUser, getRoom } from "./store.js";

let pollTimer = null;

export function renderPlay(app, onLeave) {
  const user = getUser();
  const room = getRoom();
  if (!room?.id) return onLeave();

  app.innerHTML = `
    <div class="card">
      <div class="header-row">
        <div>
          <h1 id="roomTitle">${room.title}</h1>
          <p class="sub" id="roomMeta"></p>
        </div>
        <button id="leaveBtn" class="btn-secondary btn-small">离开大厅</button>
      </div>

      <section id="ownerRename" class="section" hidden>
        <h3>修改书名（仅房主）</h3>
        <div class="row">
          <input type="text" id="renameInput" maxlength="30">
          <button type="button" id="renameSuggest" class="btn-secondary disabled" disabled>推荐</button>
        </div>
        <p id="renameHint" class="hint"></p>
        <button id="renameBtn" class="btn-secondary btn-small">保存书名</button>
      </section>

      <section class="section book-section">
        <div class="section-head">
          <h2>📖 共享写书</h2>
          <button id="pdfBtn" class="btn-secondary btn-small">一键下载 PDF</button>
        </div>
        <div id="bookWindow" class="book-window">等待第一句...</div>
      </section>

      <section class="section">
        <h2>💬 聊天</h2>
        <div id="chatWindow" class="chat-window"></div>
      </section>

      <section class="section compose">
        <textarea id="composeInput" placeholder="输入内容（共享写书限50字）" maxlength="200"></textarea>
        <div class="row">
          <button id="chatBtn" class="btn-secondary">聊天</button>
          <button id="bookBtn" class="btn-primary">共享写书</button>
        </div>
      </section>
    </div>`;

  if (room.role === "owner") {
    document.getElementById("ownerRename").hidden = false;
    bindNameCheck({
      input: document.getElementById("renameInput"),
      btn: document.getElementById("renameSuggest"),
      hint: document.getElementById("renameHint"),
      checkFn: roomApi.checkTitle,
    });
    document.getElementById("renameBtn").onclick = async () => {
      const title = document.getElementById("renameInput").value.trim();
      if (!title) return;
      try {
        await roomApi.updateTitle(room.id, user.id, title);
        room.title = title;
        document.getElementById("roomTitle").textContent = title;
        alert("书名已更新");
      } catch (e) {
        alert(e.message);
      }
    };
  }

  document.getElementById("leaveBtn").onclick = () => {
    clearInterval(pollTimer);
    onLeave();
  };

  document.getElementById("chatBtn").onclick = () => publish("chat");
  document.getElementById("bookBtn").onclick = () => publish("book");

  document.getElementById("pdfBtn").onclick = downloadPdf;

  async function publish(type) {
    const text = document.getElementById("composeInput").value.trim();
    if (!text) return alert("写点什么吧");
    if (type === "book" && text.length > 50) return alert("共享写书限50字");
    try {
      await roomApi.publish(room.id, user.id, type, text);
      document.getElementById("composeInput").value = "";
      await refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function refresh() {
    try {
      const data = await roomApi.content(room.id, user.id);
      renderBook(data.book);
      renderChat(data.chat);
      document.getElementById("roomMeta").textContent = `共 ${data.book.length} 句 · @${user.username}`;
    } catch (e) {
      document.getElementById("bookWindow").innerHTML = `<p class="hint err">${e.message}</p>`;
    }
  }

  function renderBook(items) {
    const box = document.getElementById("bookWindow");
    if (!items.length) {
      box.innerHTML = "等待第一位作者开启世界线...";
      return;
    }
    box.innerHTML = items
      .map((item) => {
        const info = `@${item.author} · ${item.time}`;
        return `<span class="book-line" data-id="${item.id}" data-info="${info}" title="${info}">${item.text}</span>`;
      })
      .join("");
    box.querySelectorAll(".book-line").forEach((el) => {
      el.onclick = () => tryRecall(Number(el.dataset.id));
    });
  }

  function renderChat(items) {
    const box = document.getElementById("chatWindow");
    if (!items.length) {
      box.innerHTML = `<p class="sub">暂无聊天</p>`;
      return;
    }
    box.innerHTML = items
      .map(
        (item) => `
      <div class="chat-item" data-id="${item.id}">
        <span class="chat-author">@${item.author}</span>
        <span class="chat-time">${item.time}</span>
        <p>${item.text}</p>
      </div>`
      )
      .join("");
    box.querySelectorAll(".chat-item").forEach((el) => {
      el.onclick = () => tryRecall(Number(el.dataset.id));
    });
  }

  async function tryRecall(contentId) {
    if (!confirm("撤回这条内容？（半小时内有效，半小时内最多撤回10次写书相关）")) return;
    try {
      await roomApi.recall(contentId, user.id);
      await refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  function downloadPdf() {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => {
      const el = document.getElementById("bookWindow");
      const title = room.title || "OneSentenceNovel";
      html2pdf()
        .set({
          margin: 1,
          filename: `${title}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        })
        .from(el)
        .save();
    };
    document.head.appendChild(script);
  }

  refresh();
  pollTimer = setInterval(refresh, 8000);
}
