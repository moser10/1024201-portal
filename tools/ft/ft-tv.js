/* Classic script for Android 9 / projector WebView. No modules, no ?. / ??. */
(function () {
  if (!document.documentElement.classList.contains("ft-tv")) return;

  var USER_KEY = "osn_user";
  var DEFAULT_LIMIT = 20 * 1024 * 1024;
  var filesCache = [];
  var quota = { used: 0, limit: DEFAULT_LIMIT };
  var apkMeta = { versionCode: 11, file: "ft-tv-debug.apk", download: "ft-tv.apk", notes: "" };
  var updateOpen = false;
  var pickIndex = -1;
  var editing = false;

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

  function installedCode() {
    if (!hasShell() || typeof window.FtShell.versionCode !== "function") return 0;
    try {
      return Number(window.FtShell.versionCode()) || 0;
    } catch (e) {
      return 0;
    }
  }

  function hasUpdate() {
    var remote = Number(apkMeta.versionCode) || 0;
    var local = installedCode();
    if (!remote) return false;
    if (!local) return true;
    return remote > local;
  }

  function rememberSurvive() {
    if (!hasShell()) return;
    var user = getUser();
    var ident = "";
    var password = "";
    try {
      if (typeof window.FtShell.getLoginIdent === "function") ident = window.FtShell.getLoginIdent() || "";
      if (typeof window.FtShell.getLoginPass === "function") password = window.FtShell.getLoginPass() || "";
    } catch (e) {}
    if (typeof window.FtShell.keepLogin === "function") {
      window.FtShell.keepLogin(ident, password, user ? JSON.stringify(user) : "");
      return;
    }
    if (user) persistNative(user);
    if (typeof window.FtShell.keepAcrossUninstall === "function") window.FtShell.keepAcrossUninstall();
  }

  function syncSurvive() {
    if (!hasShell()) return;
    if (hasUpdate()) rememberSurvive();
    else if (typeof window.FtShell.dropAcrossUninstall === "function") window.FtShell.dropAcrossUninstall();
  }

  function navTargets() {
    var out = [];
    var form = $("tvLoginForm");
    if (form && !form.hidden) {
      if ($("accountIn")) out.push($("accountIn"));
      if ($("passIn")) out.push($("passIn"));
      if ($("loginBtn")) out.push($("loginBtn"));
    }
    var wrap = $("appWrap");
    if (wrap && !wrap.hidden) {
      var buttons = document.querySelectorAll("#fileList .ft-get, #ftUpdateBtn");
      var i;
      for (i = 0; i < buttons.length; i++) {
        if (buttons[i].disabled) continue;
        out.push(buttons[i]);
      }
    }
    return out;
  }

  function clearPick() {
    var all = document.querySelectorAll(".ft-tv-pick");
    var i;
    for (i = 0; i < all.length; i++) all[i].classList.remove("ft-tv-pick");
  }

  function applyPick() {
    clearPick();
    var list = navTargets();
    if (pickIndex < 0 || pickIndex >= list.length) return;
    var el = list[pickIndex];
    el.classList.add("ft-tv-pick");
    if (el.scrollIntoView) el.scrollIntoView(false);
  }

  function setEditing(on) {
    editing = !!on;
    if (hasShell() && typeof window.FtShell.setEditing === "function") window.FtShell.setEditing(editing);
  }

  function leaveEdit() {
    var a = document.activeElement;
    if (a && a.blur) a.blur();
    setEditing(false);
  }

  window.ftTvNav = {
    back: function () {
      if (editing) {
        leaveEdit();
        applyPick();
        return "moved";
      }
      var list = navTargets();
      if (!list.length) return "exit";
      if (pickIndex < 0) {
        pickIndex = 0;
        applyPick();
        return "moved";
      }
      if (pickIndex >= list.length - 1) return "exit";
      pickIndex += 1;
      applyPick();
      return "moved";
    },
    ok: function () {
      if (editing) return "edit";
      var list = navTargets();
      if (pickIndex < 0 || pickIndex >= list.length) return "skip";
      var el = list[pickIndex];
      if (!el) return "skip";
      if (el.tagName === "INPUT") {
        setEditing(true);
        el.focus();
        return "edit";
      }
      if (el.click) el.click();
      return "ok";
    },
  };

  function pageReady() {
    if (hasShell() && typeof window.FtShell.ready === "function") window.FtShell.ready();
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
    if (line) line.textContent = text || "下载中…";
    if (box) box.hidden = false;
  }

  function hideBusy() {
    var box = $("ftBusy");
    if (box) box.hidden = true;
  }

  window.ftDownloadDone = hideBusy;

  function officialHref() {
    var file = apkMeta.file || "ft-tv-debug.apk";
    return "https://1024201.com/tools/ft/dist/" + file + "?v=" + encodeURIComponent(apkMeta.versionCode || Date.now());
  }

  function askManual() {
    hideBusy();
    if (hasShell() && typeof window.FtShell.needManual === "function") {
      window.FtShell.needManual();
      return;
    }
    window.alert("请卸载后重新安装");
  }

  function startDownload(url, text, filename, official) {
    showBusy(text || "下载中…");
    if (official) rememberSurvive();
    try {
      if (hasShell() && typeof window.FtShell.pull === "function") {
        window.FtShell.pull(JSON.stringify({ url: url, name: filename || "" }));
        return;
      }
    } catch (e) {
      if (official) askManual();
      else hideBusy();
      return;
    }
    if (official) {
      askManual();
      return;
    }
    location.assign(url);
  }

  function takeOfficial() {
    rememberSurvive();
    if (!hasUpdate()) return;
    startDownload(officialHref(), "更新中…", apkMeta.download || "ft-tv.apk", true);
  }

  function takeFile(row, uid) {
    if (!row) return;
    startDownload(
      "https://1024201.com/api/portal?action=file_get&id=" +
        encodeURIComponent(row.id) +
        "&user_id=" +
        encodeURIComponent(uid),
      "下载中…",
      row.name || "",
      false
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
    if (bar && space) {
      var n = String(space.textContent || "").replace(/\s/g, "").length;
      bar.style.setProperty("--ft-hp-w", Math.max(3.2, n * 0.36) + "em");
    }
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

  function paintUpdate() {
    var wrap = $("ftUpdateWrap");
    var btn = $("ftUpdateBtn");
    var sub = $("ftUpdateSub");
    if (!wrap || !btn || !sub) return;
    wrap.hidden = false;
    updateOpen = hasUpdate();
    btn.disabled = !updateOpen;
    btn.className = "ft-update-btn" + (updateOpen ? " is-on" : " is-off");
    btn.textContent = updateOpen ? "有更新可用" : "暂无更新";
    sub.textContent = updateOpen ? apkMeta.notes || "有更新可用" : "暂无更新";
    btn.onclick = function () {
      rememberSurvive();
      if (!updateOpen) return;
      takeOfficial();
    };
    syncSurvive();
  }

  function paintFiles(files, uid) {
    filesCache = files && files.length ? files : [];
    var list = $("fileList");
    var empty = $("emptyBox");
    if (!list || !empty) return;
    var html = [];
    var i;
    for (i = 0; i < filesCache.length; i++) {
      var f = filesCache[i];
      var apk = /\.apk$/i.test(f.name || "");
      html.push(
        '<li class="ft-row ft-row-btn" data-id="' +
          esc(f.id) +
          '"><button type="button" class="btn-primary ft-get ft-row-hit">' +
          esc(f.name) +
          " · " +
          formatStorageMb(f.size) +
          " · " +
          (apk ? "安装" : "下载") +
          "</button></li>"
      );
    }
    list.innerHTML = html.join("");
    empty.hidden = filesCache.length > 0;
    empty.textContent = "还没有文件";
    var buttons = list.querySelectorAll(".ft-get");
    for (i = 0; i < buttons.length; i++) {
      buttons[i].onclick = function () {
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
    paintUpdate();
  }

  function loadApkMeta() {
    fetch("/tools/ft/dist/ft-tv.json?v=" + Date.now())
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data) apkMeta = data;
        paintUpdate();
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
    pickIndex = -1;
    leaveEdit();
    clearPick();
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
    pageReady();
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
    if (sub) {
      sub.textContent = "";
      sub.hidden = true;
    }
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
      form.hidden = true;
      ["accountIn", "passIn", "loginBtn"].forEach(function (id) {
        var el = $(id);
        if (el) el.setAttribute("tabindex", "-1");
      });
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
