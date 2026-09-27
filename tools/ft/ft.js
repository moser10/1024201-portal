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
    apk: (v) => `下载投影仪/电视机 APK ${v}`,
    del: "删除",
    get: "下载",
    install: "安装",
    err: "失败",
    full: "容量不够，删几个或让后台扩容",
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
    apk: (v) => `Download projector/TV APK ${v}`,
    del: "Delete",
    get: "Download",
    install: "Install",
    err: "Failed",
    full: "Not enough space. Delete a file or ask admin for more MB.",
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
    apk: (v) => `プロジェクター/テレビ用APK ${v} をダウンロード`,
    del: "削除",
    get: "ダウンロード",
    install: "インストール",
    err: "失敗",
    full: "容量不足です",
    noUser: "ログイン情報が不完全です。ポータルで再ログインしてください",
  },
};

function isFtTv() {
  return new URLSearchParams(location.search).get("client") === "tv" || /1024201-FT-TV/i.test(navigator.userAgent || "");
}
const tv = isFtTv();
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

const DEFAULT_LIMIT = 20 * 1024 * 1024;
let quota = { used: 0, limit: DEFAULT_LIMIT };
let filesCache = [];

function paintQuota(used = quota.used, limit = quota.limit) {
  quota = { used: Number(used) || 0, limit: Number(limit) || DEFAULT_LIMIT };
  const bar = document.getElementById("hpBar");
  const fill = document.getElementById("hpFill");
  const space = document.getElementById("spaceLine");
  if (fill) {
    const left = Math.max(0, quota.limit - quota.used);
    const pct = Math.max(0, Math.min(100, (left / quota.limit) * 100));
    fill.style.width = `${pct}%`;
    if (bar) bar.dataset.level = pct >= 70 ? "ok" : pct >= 40 ? "warn" : pct > 0 ? "low" : "empty";
  }
  if (space) space.textContent = copy.space(quota.used, quota.limit);
}

let apkMeta = { version: "1.3", file: "ft-tv-debug.apk", download: "ft-tv-1.3.apk" };

async function loadApkMeta() {
  try {
    const data = await fetch(`/tools/ft/dist/ft-tv.json?v=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
    if (data?.version) apkMeta = data;
  } catch {
    /* keep last */
  }
}

function paintApkButton(ui) {
  const apk = document.getElementById("apkLink");
  if (!apk) return;
  const v = apkMeta.version || "1.2";
  const file = apkMeta.file || "ft-tv-debug.apk";
  apk.textContent = typeof ui.apk === "function" ? ui.apk(v) : `${ui.apk} ${v}`;
  apk.href = `/tools/ft/dist/${file}?v=${encodeURIComponent(v)}`;
  apk.setAttribute("download", apkMeta.download || `ft-tv-${v}.apk`);
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
  paintApkButton(ui);
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

function paintFiles(files, uid = userIdOf()) {
  filesCache = Array.isArray(files) ? files : [];
  const list = document.getElementById("fileList");
  const empty = document.getElementById("emptyBox");
  if (!list || !empty) return;
  empty.hidden = filesCache.length > 0;
  empty.textContent = copy.empty;
  list.innerHTML = filesCache
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
  list.querySelectorAll(".ft-get").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const row = filesCache.find((f) => f.id === btn.closest(".ft-row").dataset.id);
      takeFile(row, uid);
    };
  });
  list.querySelectorAll(".ft-del").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.closest(".ft-row").dataset.id;
      try {
        const gone = filesCache.find((f) => f.id === id);
        await deleteFile({ id, userId: uid });
        filesCache = filesCache.filter((f) => f.id !== id);
        paintFiles(filesCache, uid);
        paintQuota(Math.max(0, quota.used - (Number(gone?.size) || 0)), quota.limit);
        refreshRemote();
      } catch (e) {
        showErr(e.message || copy.err);
      }
    };
  });
}

async function takeFile(row, uid) {
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

async function refreshRemote() {
  const uid = userIdOf();
  if (!uid) return;
  const listP = fetch(`/api/portal?action=file_list&purpose=ft&user_id=${encodeURIComponent(uid)}`).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || copy.err);
    return data.files || [];
  });
  const storeP = fetchFileStorage(uid, "ft").catch(() => null);
  try {
    const files = await listP;
    paintFiles(files, uid);
  } catch (e) {
    showErr(e.message || copy.err);
  }
  const storage = await storeP;
  if (storage) paintQuota(storage.used, storage.limit);
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
  if (loggedIn) {
    paintQuota(quota.used, quota.limit);
    if (!filesCache.length) {
      const empty = document.getElementById("emptyBox");
      if (empty) {
        empty.hidden = false;
        empty.textContent = copy.empty;
      }
    }
    refreshRemote();
  }
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
    const saved = await uploadFile({ file, purpose: "ft", userId: uid });
    const next = /\.apk$/i.test(saved.name || "")
      ? [...filesCache.filter((f) => !/\.apk$/i.test(f.name || "")), saved]
      : [...filesCache.filter((f) => f.id !== saved.id), saved];
    paintFiles(next, uid);
    paintQuota(quota.used + (Number(saved.size) || file.size || 0), quota.limit);
    refreshRemote();
  } catch (err) {
    const code = err.message || "";
    showErr(code === "storage_full" ? copy.full : code || copy.err);
  } finally {
    lab.textContent = copy.upload;
  }
}

function boot() {
  if (!tv && location.hostname.toLowerCase() === "ft.1024201.com") {
    location.replace(`https://1024201.com/tools/ft/${location.search}${location.hash}`);
    return;
  }
  loadApkMeta().then(() => paintApkButton(copy)).catch(() => {});
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
