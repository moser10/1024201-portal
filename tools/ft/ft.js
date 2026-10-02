import { getPortalLang, mountLangTabs } from "/js/langTabs.js";
import { getUser, setUser, clearUser } from "/game/js/store.js";
import { loginHref } from "../js/quotaClient.js";
import { paintToolUser } from "../js/toolPageBoot.js";
import { uploadFile, deleteFile, downloadFileEntry } from "../js/attachGrid.js?v=3";
import { fetchFileStorage, formatStorageMb } from "../js/storageQuota.js";
import { hallBackLabel } from "/js/navBack.js?v=3";
import { showToast } from "/game/js/toast.js";

const TRI_TITLE = "超快传 / Fast Transfer / 超速転送";

const UI = {
  zh: {
    title: "超快传",
    sub: "",
    guestBtn: "去门户登录",
    account: "用户名或邮箱",
    password: "密码",
    login: "登录",
    upload: "上传",
    uploading: (pct) => `上传中 ${pct}%…`,
    saving: "上传完成，正在保存…",
    exit: "退出",
    empty: "还没有文件",
    loadingFiles: "正在加载文件列表…",
    listFailed: "文件列表加载失败",
    retry: "重新加载",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    apk: (v) => `下载投影仪/电视机 APK ${v}`,
    del: "删除",
    deleted: "已删除",
    get: "下载",
    install: "安装",
    err: "失败",
    full: "容量不够，删几个或让后台扩容",
    noUser: "登录态不完整，请回门户重新登录",
    networkError: "网络中断，上传未完成。请检查网络后重试。",
  },
  en: {
    title: "Fast Transfer",
    sub: "",
    guestBtn: "Sign in on the portal",
    account: "Username or email",
    password: "Password",
    login: "Sign in",
    upload: "Upload",
    uploading: (pct) => `Uploading ${pct}%…`,
    saving: "Upload sent; saving…",
    exit: "Exit",
    empty: "No files yet",
    loadingFiles: "Loading files…",
    listFailed: "Could not load the file list",
    retry: "Reload",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    apk: (v) => `Download projector/TV APK ${v}`,
    del: "Delete",
    deleted: "Deleted",
    get: "Download",
    install: "Install",
    err: "Failed",
    full: "Not enough space. Delete a file or ask admin for more MB.",
    noUser: "Session is incomplete. Sign in again on the portal.",
    networkError: "Network interrupted; the upload did not finish. Check your connection and retry.",
  },
  ja: {
    title: "超速転送",
    sub: "",
    guestBtn: "ポータルでログイン",
    account: "ユーザー名またはメール",
    password: "パスワード",
    login: "ログイン",
    upload: "アップロード",
    uploading: (pct) => `送信中 ${pct}%…`,
    saving: "送信完了、保存中…",
    exit: "戻る",
    empty: "ファイルなし",
    loadingFiles: "ファイル一覧を読み込み中…",
    listFailed: "ファイル一覧を読み込めませんでした",
    retry: "再読み込み",
    space: (used, limit) => `${formatStorageMb(used)} / ${formatStorageMb(limit)}`,
    apk: (v) => `プロジェクター/テレビ用APK ${v} をダウンロード`,
    del: "削除",
    deleted: "削除しました",
    get: "ダウンロード",
    install: "インストール",
    err: "失敗",
    full: "容量不足です",
    noUser: "ログイン情報が不完全です。ポータルで再ログインしてください",
    networkError: "通信が中断され、アップロードが完了しませんでした。接続を確認して再試行してください。",
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
let quotaLoaded = false;
let filesCache = [];
let listGen = 0;
const deletingIds = new Set();

function sizeQuotaBar(bar, space) {
  if (!bar || !space) return;
  const n = String(space.textContent || "").replace(/\s/g, "").length;
  bar.style.setProperty("--ft-hp-w", `${Math.max(3.2, n * 0.36)}em`);
}

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
  sizeQuotaBar(bar, space);
}

let apkMeta = { version: "2.0", file: "ft-tv-debug.apk", download: "ft-tv-2.0.apk" };

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
  const subEl = document.getElementById("pageSub");
  subEl.textContent = ui.sub || "";
  subEl.hidden = !ui.sub;
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
  document.getElementById("retryList").textContent = ui.retry;
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
        <button type="button" class="btn-danger ft-del"${deletingIds.has(String(f.id)) ? " disabled" : ""}>${esc(copy.del)}</button>
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
      if (btn.disabled) return;
      const id = String(btn.closest(".ft-row").dataset.id || "");
      if (!id || deletingIds.has(id)) return;
      deletingIds.add(id);
      btn.disabled = true;
      showErr("");
      try {
        const gone = filesCache.find((f) => String(f.id) === id);
        await deleteFile({ id, userId: uid, purpose: "ft" });
        filesCache = filesCache.filter((f) => String(f.id) !== id);
        deletingIds.delete(id);
        paintFiles(filesCache, uid);
        paintQuota(Math.max(0, quota.used - (Number(gone?.size) || 0)), quota.limit);
        showToast(copy.deleted);
        refreshRemote();
      } catch (e) {
        deletingIds.delete(id);
        btn.disabled = false;
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
  const empty = document.getElementById("emptyBox");
  const retry = document.getElementById("retryList");
  if (!filesCache.length && empty) {
    empty.hidden = false;
    empty.textContent = copy.loadingFiles;
  }
  if (retry) retry.hidden = true;
  const gen = ++listGen;
  const listP = fetch(`/api/portal?action=file_list&purpose=ft&user_id=${encodeURIComponent(uid)}`).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || copy.err);
    return data.files || [];
  });
  const storeP = fetchFileStorage(uid, "ft").catch(() => null);
  try {
    const files = await listP;
    if (gen !== listGen) return;
    const next = files.slice();
    deletingIds.forEach((id) => {
      if (next.some((f) => String(f.id) === id)) return;
      const local = filesCache.find((f) => String(f.id) === id);
      if (local) next.push(local);
    });
    paintFiles(next, uid);
  } catch (e) {
    if (gen !== listGen) return;
    if (!filesCache.length && empty) {
      empty.hidden = false;
      empty.textContent = copy.listFailed;
      if (retry) retry.hidden = false;
    }
    showErr(e.message || copy.err);
  }
  const storage = await storeP;
  if (gen !== listGen) return;
  if (storage) {
    quotaLoaded = true;
    paintQuota(storage.used, storage.limit);
  }
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
  if (quotaLoaded && file.size > Math.max(0, quota.limit - quota.used)) {
    showErr(copy.full);
    return;
  }
  const lab = document.getElementById("uploadLabText");
  showErr("");
  lab.textContent = copy.uploading(0);
  try {
    const saved = await uploadFile({
      file,
      purpose: "ft",
      userId: uid,
      onProgress: (pct) => {
        lab.textContent = pct >= 100 ? copy.saving : copy.uploading(pct);
      },
    });
    const next = /\.apk$/i.test(saved.name || "")
      ? [...filesCache.filter((f) => !/\.apk$/i.test(f.name || "")), saved]
      : [...filesCache.filter((f) => f.id !== saved.id), saved];
    paintFiles(next, uid);
    paintQuota(quota.used + (Number(saved.size) || file.size || 0), quota.limit);
    refreshRemote();
  } catch (err) {
    const code = err.message || "";
    showErr(code === "storage_full" ? copy.full : code === "network_error" ? copy.networkError : code || copy.err);
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
  document.getElementById("retryList").onclick = () => refreshRemote();
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
