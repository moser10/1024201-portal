import { authApi, roomApi } from "../onesentence/js/api.js";
import { getUser, setUser } from "./store.js";
import { showToast } from "./toast.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {HTMLElement} box
 * @param {object} options
 * @param {HTMLElement} [options.section]
 * @param {number} [options.roomId] - current room for in-room pull UI
 * @param {boolean} [options.isOwner]
 * @param {() => void} [options.onChange]
 */
export async function renderTodos(box, options = {}) {
  const { section, roomId, isOwner, onChange } = options;
  const currentUser = getUser();
  if (!box || !currentUser) return;

  try {
    const data = await roomApi.todos(currentUser.id);
    const parts = [];

    if (currentUser.must_change_password) {
      parts.push(`<div class="todo-group">
           <h3>账户安全</h3>
           <p class="sub">你正在使用临时密码，请尽快修改</p>
           <input type="password" id="todoNewPass1" placeholder="新密码">
           <input type="password" id="todoNewPass2" placeholder="确认新密码">
           <p id="todoPwdHint" class="hint"></p>
           <button id="todoChangePwdBtn" class="btn-primary" disabled>修改密码</button>
         </div>`);
    }

    for (const g of data.to_approve) {
      for (const r of g.requests) {
        parts.push(`<div class="todo-item">
          <span class="todo-text">@${escapeHtml(r.username)} 申请进入《${escapeHtml(g.title)}》</span>
          <div class="todo-actions">
            <button class="btn-approve approve-btn" data-sid="${g.story_id}" data-uid="${r.user_id}">通过</button>
            <button class="btn-reject reject-btn" data-sid="${g.story_id}" data-uid="${r.user_id}">拒绝</button>
          </div>
        </div>`);
      }
    }

    for (const w of data.waiting) {
      parts.push(`<div class="todo-item"><span class="todo-text">《${escapeHtml(w.title)}》待通过</span></div>`);
    }

    if (roomId && isOwner) {
      parts.push(`<div class="todo-group" id="todoPullGroup">
        <h3>拉入房间</h3>
        <p class="sub">搜索昵称，将用户直接拉入当前房间</p>
        <div class="row">
          <input type="text" id="todoPullSearch" placeholder="搜索用户昵称">
          <button type="button" id="todoPullSearchBtn" class="btn-secondary btn-small">搜索</button>
        </div>
        <div id="todoPullResults"></div>
      </div>`);
    }

    if (section) section.hidden = parts.length === 0;
    box.innerHTML = parts.join("");

    box.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.onclick = async () => {
        await roomApi.approve(Number(btn.dataset.sid), currentUser.id, Number(btn.dataset.uid));
        showToast("已通过申请");
        await renderTodos(box, options);
        onChange?.();
      };
    });

    box.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.onclick = async () => {
        await roomApi.reject(Number(btn.dataset.sid), currentUser.id, Number(btn.dataset.uid));
        showToast("已拒绝申请");
        await renderTodos(box, options);
        onChange?.();
      };
    });

    const pwdBtn = document.getElementById("todoChangePwdBtn");
    if (pwdBtn) {
      const p1 = document.getElementById("todoNewPass1");
      const p2 = document.getElementById("todoNewPass2");
      const hint = document.getElementById("todoPwdHint");
      const sync = () => {
        if (!p1.value || !p2.value) {
          pwdBtn.disabled = true;
          hint.textContent = "";
          return;
        }
        if (p1.value !== p2.value) {
          pwdBtn.disabled = true;
          hint.textContent = "两次密码不一致";
          hint.className = "hint err";
        } else if (p1.value.length < 6) {
          pwdBtn.disabled = true;
          hint.textContent = "密码至少 6 位";
          hint.className = "hint err";
        } else {
          pwdBtn.disabled = false;
          hint.textContent = "✓ 可以提交";
          hint.className = "hint ok";
        }
      };
      p1.oninput = sync;
      p2.oninput = sync;
      pwdBtn.onclick = async () => {
        try {
          const res = await authApi.changePassword(currentUser.id, p1.value, p2.value);
          currentUser.must_change_password = false;
          setUser(currentUser);
          showToast(res.message);
          await renderTodos(box, options);
          onChange?.();
        } catch (e) {
          showToast(e.message);
        }
      };
    }

    const pullBtn = document.getElementById("todoPullSearchBtn");
    if (pullBtn && roomId) {
      pullBtn.onclick = async () => {
        const q = document.getElementById("todoPullSearch")?.value.trim();
        const results = document.getElementById("todoPullResults");
        if (!q) {
          results.innerHTML = "";
          return;
        }
        try {
          const search = await authApi.searchUsers(q);
          const members = (await roomApi.members(roomId)).members;
          const memberIds = new Set(members.map((m) => m.user_id));
          results.innerHTML = search.users
            .filter((u) => u.id !== currentUser.id)
            .map((u) => {
              const inRoom = memberIds.has(u.id);
              return `<div class="list-item">
                <span>@${escapeHtml(u.username)}${inRoom ? ' <em class="hint ok">已在房间</em>' : ""}</span>
                ${inRoom ? "" : `<button data-uid="${u.id}" class="btn-small pull-btn">拉入房间</button>`}
              </div>`;
            })
            .join("");
          results.querySelectorAll(".pull-btn").forEach((btn) => {
            btn.onclick = async () => {
              try {
                await roomApi.pullUser(roomId, currentUser.id, Number(btn.dataset.uid));
                showToast("已拉入房间");
                await renderTodos(box, options);
                onChange?.();
              } catch (e) {
                showToast(e.message);
              }
            };
          });
        } catch (e) {
          results.innerHTML = `<p class="hint err">${escapeHtml(e.message)}</p>`;
        }
      };
    }
  } catch (e) {
    if (section) section.hidden = false;
    box.innerHTML = `<p class="hint err">${escapeHtml(e.message)}</p>`;
  }
}
