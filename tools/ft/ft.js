import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser, setUser, clearUser } from "/game/js/store.js";
import { paintToolUser } from "../js/toolPageBoot.js";
import { uploadFile, deleteFile, downloadFileEntry } from "../js/attachGrid.js";
import { fetchFileStorage, formatStorageMb } from "../js/storageQuota.js";

const UI = {
  zh: {
    title: "超快传",
    sub: "投屏安装包 · 同账号取文件",
    back: "返回工具箱",
    account: "用户名或邮箱",
    password: "密码",
    login: "登录",
    upload: "上传",
    exit: "退出",
    empty: "还没有文件",
    space: (used, limit) => `已用 ${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    del: "删除",
    get: "下载",
    install: "安装",
    err: "失败",
    full: "容量不够，删几个或让后台加 MB",
  },
  en: {
    title: "Fast Transfer",
    sub: "Drop APKs here · pick them up on the projector",
    back: "Toolbox",
    account: "Username or email",
    password: "Password",
    login: "Sign in",
    upload: "Upload",
    exit: "Exit",
    empty: "No files yet",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)} used`,
    del: "Delete",
    get: "Download",
    install: "Install",
    err: "Failed",
    full: "Not enough space. Delete a file or ask admin for more MB.",
  },
  ja: {
    title: "超速転送",
    sub: "APKを置いてプロジェクターで取る",
    back: "ツールへ",
    account: "ユーザー名またはメール",
    password: "パスワード",
    login: "ログイン",
    upload: "アップロード",
    exit: "戻る",
    empty: "ファイルなし",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    del: "削除",
    get: "ダウンロード",
    install: "インストール",
    err: "失敗",
    full: "容量不足です",
  },
};

const tv = new URLSearchParams(location.search).get("client") === "tv";
let lang = getPortalLang();
let copy = UI[lang] || UI.en;

function t() {
  lang = getPortalLang();
  copy = UI[lang] || UI.en;
  return copy;
}

function showErr(msg) {
  const box = document.getElementById("errBox");
  box.hidden = !msg;
  box.textContent = msg || "";
}

function applyChrome() {
  const ui = t();
  document.getElementById("pageTitle").textContent = ui.title;
  document.getElementById("pageSub").textContent = ui.sub;
  document.getElementById("backLink").textContent = ui.back;
  document.getElementById("lblAccount").textContent = ui.account;
  document.getElementById("lblPass").textContent = ui.password;
  document.getElementById("loginBtn").textContent = ui.login;
  document.getElementById("uploadBtn").textContent = ui.upload;
  document.getElementById("exitBtn").textContent = ui.exit;
  document.title = `${ui.title} | 1024201`;
  document.body.classList.toggle("ft-tv", tv);
  paintToolUser();
}

async function login(ident, password) {
  const res = await fetch("/api/auth?action=login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ident, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || copy.err);
  setUser(data.user);
}

async function loadList() {
  const user = getUser();
  if (!user?.id) return;
  const [listRes, storage] = await Promise.all([
    fetch(`/api/portal?action=file_list&purpose=ft&user_id=${encodeURIComponent(user.id)}`).then((r) => r.json()),
    fetchFileStorage(user.id, "ft"),
  ]);
  document.getElementById("spaceLine").textContent = copy.space(storage.used, storage.limit);
  const files = listRes.files || [];
  const list = document.getElementById("fileList");
  const empty = document.getElementById("emptyBox");
  empty.hidden = files.length > 0;
  empty.textContent = copy.empty;
  list.innerHTML = files
    .map((f) => {
      const apk = /\.apk$/i.test(f.name || "");
      return `<li class="ft-row" data-id="${esc(f.id)}">
        <div class="ft-row-name">${esc(f.name)}<span class="ft-row-meta">${formatStorageMb(f.size)}</span></div>
        <button type="button" class="btn-primary ft-get">${esc(apk ? copy.install : copy.get)}</button>
        ${tv ? "" : `<button type="button" class="btn-danger ft-del">${esc(copy.del)}</button>`}
      </li>`;
    })
    .join("");
  async function takeFile(row) {
    if (!row) return;
    try {
      if (tv) {
        location.assign(
          `/api/portal?action=file_get&id=${encodeURIComponent(row.id)}&user_id=${encodeURIComponent(user.id)}`
        );
        return;
      }
      await downloadFileEntry(row, user.id, { userGesture: true });
    } catch (e) {
      showErr(e.message || copy.err);
    }
  }
  list.querySelectorAll(".ft-row").forEach((li) => {
    if (!tv) return;
    li.onclick = () => takeFile(files.find((f) => f.id === li.dataset.id));
  });
  list.querySelectorAll(".ft-get").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      takeFile(files.find((f) => f.id === btn.closest(".ft-row").dataset.id));
    };
  });
  list.querySelectorAll(".ft-del").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.closest(".ft-row").dataset.id;
      try {
        await deleteFile({ id, userId: user.id });
        await loadList();
      } catch (e) {
        showErr(e.message || copy.err);
      }
    };
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function paintAuth() {
  const user = getUser();
  document.getElementById("loginForm").hidden = !!user;
  document.getElementById("appWrap").hidden = !user;
  paintToolUser();
  if (user) loadList().catch((e) => showErr(e.message || copy.err));
}

function boot() {
  if (tv) document.getElementById("deskActions").querySelector("#uploadBtn").hidden = true;
  applyChrome();
  if (!tv) {
    mountLangTabs(document.getElementById("langSlot"), {
      onChange: () => {
        applyChrome();
        paintAuth();
      },
    });
  }
  document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    showErr("");
    try {
      await login(document.getElementById("accountIn").value, document.getElementById("passIn").value);
      applyChrome();
      paintAuth();
    } catch (err) {
      showErr(err.message || copy.err);
    }
  };
  document.getElementById("uploadBtn").onclick = () => document.getElementById("fileIn").click();
  document.getElementById("fileIn").onchange = async () => {
    const file = document.getElementById("fileIn").files?.[0];
    document.getElementById("fileIn").value = "";
    const user = getUser();
    if (!file || !user?.id) return;
    showErr("");
    try {
      await uploadFile({ file, purpose: "ft", userId: user.id });
      await loadList();
    } catch (err) {
      showErr(err.message === "storage_full" ? copy.full : err.message || copy.err);
    }
  };
  document.getElementById("exitBtn").onclick = () => {
    if (tv) {
      clearUser();
      paintAuth();
      return;
    }
    location.assign("/tools/");
  };
  paintAuth();
}

boot();
