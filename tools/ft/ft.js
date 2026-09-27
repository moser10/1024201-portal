import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser, setUser, clearUser } from "/game/js/store.js";
import { loginHref } from "../js/quotaClient.js";
import { paintToolUser } from "../js/toolPageBoot.js";
import { uploadFile, deleteFile, downloadFileEntry } from "../js/attachGrid.js";
import { fetchFileStorage, formatStorageMb } from "../js/storageQuota.js";
import { hallBackLabel } from "/js/navBack.js?v=3";

const UI = {
  zh: {
    title: "超快传",
    sub: "同一门户账号：电脑上传 APK，投影装壳后打开即可下载安装。默认 20MB，后台可扩容。首次把壳 APK 用 U 盘装到投影上。",
    guestBtn: "去门户登录",
    account: "用户名或邮箱",
    password: "密码",
    login: "登录",
    upload: "上传",
    exit: "退出",
    empty: "还没有文件",
    space: (used, limit) => `已用 ${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    apk: "下载投影壳 APK",
    del: "删除",
    get: "下载",
    install: "安装",
    err: "失败",
    full: "容量不够，删几个或让后台扩容",
  },
  en: {
    title: "Fast Transfer",
    sub: "Same portal account: upload on a computer, open the kiosk app on the projector to install. 20MB default. First time: USB-install the shell APK.",
    guestBtn: "Sign in on the portal",
    account: "Username or email",
    password: "Password",
    login: "Sign in",
    upload: "Upload",
    exit: "Exit",
    empty: "No files yet",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)} used`,
    apk: "Download projector APK",
    del: "Delete",
    get: "Download",
    install: "Install",
    err: "Failed",
    full: "Not enough space. Delete a file or ask admin for more MB.",
  },
  ja: {
    title: "超速転送",
    sub: "同じアカウントでPCから上げ、プロジェクターの専用アプリで受け取る。初期20MB。初回はシェルAPKをUSBで入れる。",
    guestBtn: "ポータルでログイン",
    account: "ユーザー名またはメール",
    password: "パスワード",
    login: "ログイン",
    upload: "アップロード",
    exit: "戻る",
    empty: "ファイルなし",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    apk: "プロジェクター用APK",
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
  document.getElementById("backLink").textContent = hallBackLabel(lang);
  document.getElementById("backLink").href = "/";
  document.getElementById("gateLogin").textContent = ui.guestBtn;
  document.getElementById("gateLogin").href = loginHref("/tools/ft/");
  document.getElementById("apkLink").textContent = ui.apk;
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
  const loggedIn = !!(user && (user.id || user.username));
  document.getElementById("gatePanel").hidden = loggedIn || tv;
  document.getElementById("tvLoginForm").hidden = loggedIn || !tv;
  document.getElementById("appWrap").hidden = !loggedIn;
  paintToolUser();
  if (loggedIn) loadList().catch((e) => showErr(e.message || copy.err));
}

function boot() {
  // Share portal localStorage: never stay on ft.* host for the desk UI.
  if (!tv && location.hostname.toLowerCase() === "ft.1024201.com") {
    location.replace(`https://1024201.com/tools/ft/${location.search}${location.hash}`);
    return;
  }
  if (tv) document.getElementById("uploadBtn").hidden = true;
  applyChrome();
  if (!tv) {
    mountLangTabs(document.getElementById("langSlot"), {
      onChange: () => {
        applyChrome();
        paintAuth();
      },
    });
  }
  document.getElementById("tvLoginForm").onsubmit = async (e) => {
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
