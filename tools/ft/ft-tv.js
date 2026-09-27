/* Classic script for Android 9 / projector WebView. No modules, no ?. / ??. */
(function () {
  if (!document.documentElement.classList.contains("ft-tv")) return;

  var USER_KEY = "osn_user";
  var DEFAULT_LIMIT = 20 * 1024 * 1024;
  var filesCache = [];
  var quota = { used: 0, limit: DEFAULT_LIMIT };
  var apkMeta = { version: "1.6", file: "ft-tv-debug.apk", download: "ft-tv-1.6.apk" };

  function $(id) {
    return document.getElementById(id);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch (e) {
      return null;
    }
  }

  function hasShell() {
    return typeof window.FtShell !== "undefined" && window.FtShell;
  }

  function persistNative(user, ident, password) {
    if (!hasShell()) return;
    if (user && typeof window.FtShell.saveSession === "function") {
      window.FtShell.saveSession(JSON.stringify(user));
    }
    if (ident && password && typeof window.FtShell.saveLogin === "function") {
      window.FtShell.saveLogin(ident, password);
    }
  }

  function restoreNative() {
    if (!hasShell() || typeof window.FtShell.getSession !== "function") return;
    var raw = window.FtShell.getSession();
    if (!raw) return;
    try {
      var user = JSON.parse(raw);
      if (user && (user.id || user.user_id)) localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {}
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    persistNative(user);
  }

  function clearUser() {
    localStorage.removeItem(USER_KEY);
    if (hasShell() && typeof window.FtShell.clearSession === "function") window.FtShell.clearSession();
  }

  function userIdOf() {
    var user = getUser();
    var n = user && (user.id != null ? user.id : user.user_id);
    n = Number(n);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function formatStorageMb(bytes) {
    var mb = Number(bytes || 0) / (1024 * 1024);
    if (mb >= 100) return Math.round(mb) + " MB";
    if (mb >= 10) return mb.toFixed(1) + " MB";
    return mb.toFixed(2) + " MB";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function showErr(msg) {
    var box = $("errBox");
    if (!box) return;
    box.hidden = !msg;
    box.textContent = msg || "";
  }

  function showBusy(text) {
    var box = $("ftBusy");
    var line = $("ftBusyText");
    if (line) line.textContent = text || "更新中…";
    if (box) box.hidden = false;
  }

  function hideBusy() {
    var box = $("ftBusy");
    if (box) box.hidden = true;
  }

  window.ftDownloadDone = hideBusy;
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) hideBusy();
  });

  function officialHref() {
    var file = apkMeta.file || "ft-tv-debug.apk";
    var v = apkMeta.version || "1.6";
    return "https://1024201.com/tools/ft/dist/" + file + "?v=" + encodeURIComponent(v);
  }

  function startDownload(url, text) {
    showBusy(text || "更新中…");
    if (window.FtShell && typeof window.FtShell.download === "function") {
      window.FtShell.download(url);
      return;
    }
    location.assign(url);
  }

  function takeOfficial() {
    var user = getUser();
    if (user) persistNative(user);
    startDownload(officialHref(), "更新中…");
  }

  function takeFile(row, uid) {
    if (!row) return;
    if (row.official) {
      takeOfficial();
      return;
    }
    startDownload(
      "https://1024201.com/api/portal?action=file_get&id=" +
        encodeURIComponent(row.id) +
        "&user_id=" +
        encodeURIComponent(uid),
      "下载中…"
    );
  }

  function paintQuota(used, limit) {
    quota = {
      used: Number(used) || 0,
      limit: Number(limit) || DEFAULT_LIMIT,
    };
    var bar = $("hpBar");
    var fill = $("hpFill");
    var space = $("spaceLine");
    if (fill) {
      var left = Math.max(0, quota.limit - quota.used);
      var pct = Math.max(0, Math.min(100, (left / quota.limit) * 100));
      fill.style.width = pct + "%";
      if (bar) {
        bar.setAttribute(
          "data-level",
          pct >= 70 ? "ok" : pct >= 40 ? "warn" : pct > 0 ? "low" : "empty"
        );
      }
    }
    if (space) space.textContent = formatStorageMb(quota.used) + " / " + formatStorageMb(quota.limit);
  }

  function paintUser() {
    var el = $("userLine");
    if (!el) return;
    var user = getUser();
    var name = user && user.username;
    if (!name) {
      el.hidden = true;
      return;
    }
    el.textContent = "@" + name;
    el.hidden = false;
  }

  function userFilesOnly(files) {
    var out = [];
    var i;
    for (i = 0; i < (files || []).length; i++) {
      if (!/\.apk$/i.test(files[i].name || "")) out.push(files[i]);
    }
    return out;
  }

  function paintFiles(files, uid) {
    filesCache = userFilesOnly(files);
    var list = $("fileList");
    var empty = $("emptyBox");
    if (!list || !empty) return;
    var html = [];
    html.push(
      '<li class="ft-row ft-row-btn ft-row-official" data-id="official-ft">' +
        '<button type="button" class="btn-primary ft-get ft-row-hit" data-official="1">' +
        "更新超快传 " +
        esc(apkMeta.version || "") +
        " · 安装</button></li>"
    );
    var i;
    for (i = 0; i < filesCache.length; i++) {
      var f = filesCache[i];
      html.push(
        '<li class="ft-row ft-row-btn" data-id="' +
          esc(f.id) +
          '"><button type="button" class="btn-primary ft-get ft-row-hit">' +
          esc(f.name) +
          " · " +
          formatStorageMb(f.size) +
          " · 下载</button></li>"
      );
    }
    list.innerHTML = html.join("");
    empty.hidden = filesCache.length > 0;
    empty.textContent = "还没有自己的文件（官方安装包不占容量）";
    var buttons = list.querySelectorAll(".ft-get");
    for (i = 0; i < buttons.length; i++) {
      buttons[i].onclick = function () {
        if (this.getAttribute("data-official") === "1") {
          takeOfficial();
          return;
        }
        var rowEl = this.closest ? this.closest(".ft-row") : this.parentNode;
        var id = rowEl ? rowEl.getAttribute("data-id") : "";
        var row = null;
        var j;
        for (j = 0; j < filesCache.length; j++) {
          if (String(filesCache[j].id) === String(id)) {
            row = filesCache[j];
            break;
          }
        }
        takeFile(row, uid);
      };
    }
  }

  function loadApkMeta() {
    fetch("/tools/ft/dist/ft-tv.json?v=" + Date.now())
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.version) apkMeta = data;
        if (userIdOf()) paintFiles(filesCache, userIdOf());
      })
      .catch(function () {});
  }

  function refreshRemote() {
    var uid = userIdOf();
    if (!uid) return;
    paintFiles(filesCache, uid);
    fetch("/api/portal?action=file_list&purpose=ft&user_id=" + encodeURIComponent(uid))
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, data: data || {} };
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error(res.data.error || "失败");
        paintFiles(res.data.files || [], uid);
      })
      .catch(function (e) {
        showErr((e && e.message) || "失败");
      });
    fetch("/api/portal?action=file_storage&purpose=ft&user_id=" + encodeURIComponent(uid))
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && (data.used != null || data.limit != null)) {
          paintQuota(data.used, data.limit);
        }
      })
      .catch(function () {});
  }

  function paintAuth() {
    var loggedIn = !!userIdOf();
    var form = $("tvLoginForm");
    var wrap = $("appWrap");
    var gate = $("gatePanel");
    if (form) form.hidden = loggedIn;
    if (wrap) wrap.hidden = !loggedIn;
    if (gate) gate.hidden = true;
    paintUser();
    if (loggedIn) {
      paintQuota(quota.used, quota.limit);
      paintFiles(filesCache, userIdOf());
      refreshRemote();
    }
  }

  function login(ident, password) {
    return fetch("/api/auth?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ident, password: password }),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || "失败");
        if (!data || !data.user) throw new Error("登录态不完整");
        setUser(data.user);
        persistNative(data.user, ident, password);
      });
    });
  }

  function trySilentLogin(done) {
    if (userIdOf()) {
      done();
      return;
    }
    if (!hasShell() || typeof window.FtShell.getLoginIdent !== "function") {
      done();
      return;
    }
    var ident = window.FtShell.getLoginIdent();
    var password = window.FtShell.getLoginPass ? window.FtShell.getLoginPass() : "";
    if (!ident || !password) {
      done();
      return;
    }
    login(ident, password)
      .then(function () {
        done();
      })
      .catch(function () {
        done();
      });
  }

  window.ftRestoreSession = function () {
    restoreNative();
    if (userIdOf()) {
      paintAuth();
      return;
    }
    trySilentLogin(function () {
      paintAuth();
    });
  };

  function boot() {
    var title = $("pageTitle");
    if (title) title.textContent = "超快传 / Fast Transfer / 超速転送";
    var sub = $("pageSub");
    if (sub) sub.textContent = "登录后显示可下载文件";
    var lblA = $("lblAccount");
    var lblP = $("lblPass");
    var btn = $("loginBtn");
    if (lblA) lblA.textContent = "用户名或邮箱";
    if (lblP) lblP.textContent = "密码";
    if (btn) btn.textContent = "登录";
    document.title = "超快传 / Fast Transfer / 超速転送 | 1024201";
    loadApkMeta();

    var form = $("tvLoginForm");
    if (form) {
      form.onsubmit = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        showErr("");
        var ident = ($("accountIn") && $("accountIn").value) || "";
        var password = ($("passIn") && $("passIn").value) || "";
        login(ident, password)
          .then(function () {
            persistNative(getUser(), ident, password);
            paintAuth();
          })
          .catch(function (err) {
            showErr((err && err.message) || "失败");
          });
        return false;
      };
    }
    var exitBtn = $("exitBtn");
    if (exitBtn) {
      exitBtn.onclick = function () {
        clearUser();
        filesCache = [];
        paintAuth();
      };
    }
    restoreNative();
    if (userIdOf()) {
      persistNative(getUser());
      paintAuth();
    } else {
      trySilentLogin(function () {
        paintAuth();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
