import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser, setUser, clearUser } from "/game/js/store.js";
import { loginHref } from "../js/quotaClient.js";
import { paintToolUser } from "../js/toolPageBoot.js";
import { uploadFile, deleteFile, downloadFileEntry } from "../js/attachGrid.js";
import { fetchFileStorage, formatStorageMb } from "../js/storageQuota.js";
import { hallBackLabel } from "/js/navBack.js?v=3";

const TRI_TITLE = "超快传 / Fast Transfer / 超速転送";

const UI = {
  zh: {
    title: "超快传",
    sub: "同一门户账号：电脑上传 APK，投影/电视装壳后打开即可下载安装。默认 20MB，后台可扩容。首次把壳 APK 用 U 盘装到设备上。",
    guestBtn: "去门户登录",
    account: "用户名或邮箱",
    password: "密码",
    login: "登录",
    upload: "上传",
    uploading: "上传中…",
    exit: "退出",
    empty: "还没有文件",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    apk: "下载投影仪/电视机 APK",
    del: "删除",
    get: "下载",
    install: "安装",
    err: "失败",
    full: "容量不够，删几个或让后台扩容",
    needStore: "超过 5MB 需要先配置 VPS 文件库",
    noUser: "登录态不完整，请回门户重新登录",
  },
  en: {
    title: "Fast Transfer",
    sub: "Same portal account: upload on a computer, open the kiosk app on the projector/TV to install. 20MB default. First time: USB-install the shell APK.",
    guestBtn: "Sign in on the portal",
    account: "Username or email",
    password: "Password",
    login: "Sign in",
    upload: "Upload",
    uploading: "Uploading…",
    exit: "Exit",
    empty: "No files yet",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    apk: "Download projector/TV APK",
    del: "Delete",
    get: "Download",
    install: "Install",
    err: "Failed",
    full: "Not enough space. Delete a file or ask admin for more MB.",
    needStore: "Files over 5MB need the VPS file store",
    noUser: "Session is incomplete. Sign in again on the portal.",
  },
  ja: {
    title: "超速転送",
    sub: "同じアカウントでPCから上げ、プロジェクター/テレビの専用アプリで受け取る。初期20MB。初回はシェルAPKをUSBで入れる。",
    guestBtn: "ポータルでログイン",
    account: "ユーザー名またはメール",
    password: "パスワード",
    login: "ログイン",
    upload: "アップロード",
    uploading: "送信中…",
    exit: "戻る",
    empty: "ファイルなし",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    apk: "プロジェクター/テレビ用APKをダウンロード",
    del: "削除",
    get: "ダウンロード",
    install: "インストール",
    err: "失敗",
    full: "容量不足です",
    needStore: "5MB超はVPSファイル庫が必要です",
    noUser: "ログイン情報が不完全です。ポータルで再ログインしてください",
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

function userIdOf(user = getUser()) {
  const n = Number(user?.id ?? user?.user_id);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function showErr(msg) {
  const box = document.getElementById("errBox");
  box.hidden = !msg;
  box.textContent = msg || "";
}

function paintHp(used, limit) {
  const bar = document.getElementById("hpBar");
  const fill = document.getElementById("hpFill");
  if (!bar || !fill) return;
  const cap = Number(limit) || 1;
  const left = Math.max(0, cap - (Number(used) || 0));
  const pct = Math.max(0, Math.min(100, (left / cap) * 100));
  fill.style.width = `${pct}%`;
  bar.dataset.level = pct >= 70 ? "ok" : pct >= 40 ? "warn" : pct > 0 ? "low" : "empty";
}

function applyChrome() {
  const ui = t();
  document.getElementById("pageTitle").textContent = tv ? TRI_TITLE : ui.title;
  document.getElementById("pageSub").textContent = ui.sub;
  const back = document.getElementById("backLink");
  if (back) {
    back.textContent = hallBackLabel(lang);
    back.href = "/";
  }
  document.getElementById("gateLogin").textContent = ui.guestBtn;
  document.getElementById("gateLogin").href = loginHref("/tools/ft/");
  const apk = document.getElementById("apkLink");
  if (apk) apk.textContent = ui.apk;
  document.getElementById("lblAccount").textContent = ui.account;
  document.getElementById("lblPass").textContent = ui.password;
  document.getElementById("loginBtn").textContent = ui.login;
  document.getElementById("uploadLabText").textContent = ui.upload;
  document.getElementById("exitBtn").textContent = ui.exit;
  document.title = `${tv ? TRI_TITLE : ui.title} | 1024201`;
  document.body.classList.toggle("ft-tv", tv);
  if (tv) {
    const back = document.getElementById("backLink");
    const apk = document.getElementById("apkLink");
    if (back) back.remove();
    if (apk) apk.remove();
  }
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
  const uid = userIdOf();
  if (!uid) return;
  const [listRes, storage] = await Promise.all([
    fetch(`/api/portal?action=file_list&purpose=ft&user_id=${encodeURIComponent(uid)}`).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || copy.err);
      return data;
    }),
    fetchFileStorage(uid, "ft"),
  ]);
  document.getElementById("spaceLine").textContent = copy.space(storage.used, storage.limit);
  paintHp(storage.used, storage.limit);
  const files = listRes.files || [];
  const list = document.getElementById("fileList");
  const empty = document.getElementById("emptyBox");
  empty.hidden = files.length > 0;
  empty.textContent = copy.empty;
  list.innerHTML = files
    .map((f) => {
      const apk = /\.apk$/i.test(f.name || "");
      const action = apk ? copy.install : copy.get;
      if (tv) {
        return `<li class="ft-row ft-row-btn" data-id="${esc(f.id)}">
          <button type="button" class="btn-primary ft-get ft-row-hit">${esc(f.name)} · ${formatStorageMb(f.size)} · ${esc(action)}</button>
        </li>`;
      }
      return `<li class="ft-row" data-id="${esc(f.id)}">
        <div class="ft-row-name">${esc(f.name)}<span class="ft-row-meta">${formatStorageMb(f.size)}</span></div>
        <button type="button" class="btn-primary ft-get">${esc(action)}</button>
        <button type="button" class="btn-danger ft-del">${esc(copy.del)}</button>
      </li>`;
    })
    .join("");
  async function takeFile(row) {
    if (!row) return;
    try {
      if (tv) {
        location.assign(`/api/portal?action=file_get&id=${encodeURIComponent(row.id)}&user_id=${encodeURIComponent(uid)}`);
        return;
      }
      await downloadFileEntry(row, uid, { userGesture: true });
    } catch (e) {
      showErr(e.message || copy.err);
    }
  }
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
        await deleteFile({ id, userId: uid });
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
  const loggedIn = !!userIdOf();
  document.getElementById("gatePanel").hidden = loggedIn || tv;
  document.getElementById("tvLoginForm").hidden = loggedIn || !tv;
  document.getElementById("appWrap").hidden = !loggedIn;
  paintToolUser();
  if (loggedIn) loadList().catch((e) => showErr(e.message || copy.err));
}

async function runUpload(file) {
  const uid = userIdOf();
  if (!file) return;
  if (!uid) {
    showErr(copy.noUser);
    return;
  }
  const lab = document.getElementById("uploadLabText");
  showErr("");
  lab.textContent = copy.uploading;
  try {
    await uploadFile({ file, purpose: "ft", userId: uid });
    await loadList();
  } catch (err) {
    const code = err.message || "";
    showErr(code === "storage_full" ? copy.full : code === "need_filestore" ? copy.needStore : code || copy.err);
  } finally {
    lab.textContent = copy.upload;
  }
}

function boot() {
  if (!tv && location.hostname.toLowerCase() === "ft.1024201.com") {
    location.replace(`https://1024201.com/tools/ft/${location.search}${location.hash}`);
    return;
  }
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
  document.getElementById("fileIn").onchange = async () => {
    const file = document.getElementById("fileIn").files?.[0];
    document.getElementById("fileIn").value = "";
    await runUpload(file);
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
