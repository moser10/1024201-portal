package com.p1024201.ft;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import org.json.JSONObject;

public class MainActivity extends Activity {
  static final String HOME = "https://1024201.com/tools/ft/?client=tv";
  static final String PREF = "ft_session";
  static final String KEY_USER = "osn_user";
  static final String KEY_IDENT = "ident";
  static final String KEY_PASS = "password";
  static final String APK_MIME = "application/vnd.android.package-archive";
  WebView web;
  View busy;
  View splash;
  TextView busyText;
  AlertDialog exitDialog;
  boolean exitPromptOpen;
  boolean splashGone;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().getDecorView().setBackgroundColor(0xFF2B3054);
    FrameLayout root = new FrameLayout(this);
    root.setBackgroundColor(0xFF2B3054);
    web = new WebView(this);
    web.setBackgroundColor(0xFF2B3054);
    root.addView(
      web,
      new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    );
    busy = buildBusy();
    root.addView(
      busy,
      new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    );
    splash = buildSplash();
    root.addView(
      splash,
      new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    );
    setContentView(root);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setUserAgentString(settings.getUserAgentString() + " 1024201-FT-TV/1.7");
    CookieManager cookies = CookieManager.getInstance();
    cookies.setAcceptCookie(true);
    cookies.setAcceptThirdPartyCookies(web, true);
    web.addJavascriptInterface(new FtShell(), "FtShell");
    web.setWebViewClient(
      new WebViewClient() {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
          return !allowed(req.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
          return !allowed(Uri.parse(url));
        }

        @Override
        public void onPageFinished(WebView view, String url) {
          Uri uri = Uri.parse(url);
          if (!allowed(uri)) {
            view.loadUrl(HOME);
            return;
          }
          String path = uri.getPath() == null ? "" : uri.getPath();
          if (path.startsWith("/tools/ft") && !"tv".equals(uri.getQueryParameter("client"))) {
            view.loadUrl(HOME);
            return;
          }
          if (path.startsWith("/tools/ft")) {
            restoreSessionIntoWeb(view);
            hideSplash();
          }
        }
      }
    );
    web.setDownloadListener(
      new DownloadListener() {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mime, long len) {
          startDownload(url, mime, contentDisposition, "");
        }
      }
    );
    web.loadUrl(HOME);
  }

  LinearLayout buildSplash() {
    LinearLayout box = new LinearLayout(this);
    box.setOrientation(LinearLayout.VERTICAL);
    box.setGravity(Gravity.CENTER);
    box.setBackgroundColor(0xFF2B3054);
    box.setClickable(true);
    ImageView mark = new ImageView(this);
    mark.setImageResource(R.mipmap.ic_launcher);
    int size = (int) (96 * getResources().getDisplayMetrics().density);
    box.addView(mark, new LinearLayout.LayoutParams(size, size));
    return box;
  }

  LinearLayout buildBusy() {
    LinearLayout box = new LinearLayout(this);
    box.setOrientation(LinearLayout.VERTICAL);
    box.setGravity(Gravity.CENTER);
    box.setBackgroundColor(0xC72B3054);
    box.setClickable(true);
    box.setVisibility(View.GONE);
    ProgressBar spin = new ProgressBar(this);
    busyText = new TextView(this);
    busyText.setText("下载中…");
    busyText.setTextColor(Color.WHITE);
    busyText.setTextSize(18);
    busyText.setTypeface(Typeface.DEFAULT_BOLD);
    busyText.setPadding(0, 28, 0, 0);
    box.addView(spin);
    box.addView(busyText);
    return box;
  }

  void hideSplash() {
    if (splashGone) return;
    splashGone = true;
    runOnUiThread(
      () -> {
        if (splash != null) splash.setVisibility(View.GONE);
      }
    );
  }

  boolean looksApk(String... parts) {
    for (String part : parts) {
      if (part == null) continue;
      String s = part.toLowerCase();
      if (s.contains(".apk") || s.contains("ft-tv") || s.contains("android.package")) return true;
    }
    return false;
  }

  String sanitizeName(String raw) {
    if (raw == null) return "";
    String name = raw.replace('\\', '/');
    int slash = name.lastIndexOf('/');
    if (slash >= 0) name = name.substring(slash + 1);
    name = name.replaceAll("[\\u0000-\\u001f]", "").trim();
    return name;
  }

  String fromDisposition(String d) {
    if (d == null || d.isEmpty()) return "";
    String lower = d.toLowerCase();
    int star = lower.indexOf("filename*=");
    int plain = lower.indexOf("filename=");
    String rest = "";
    if (star >= 0) {
      rest = d.substring(star + 10).trim();
      int enc = rest.indexOf("''");
      if (enc >= 0) rest = rest.substring(enc + 2);
    } else if (plain >= 0) {
      rest = d.substring(plain + 9).trim();
    } else {
      return "";
    }
    if (rest.startsWith("\"")) {
      int end = rest.indexOf('"', 1);
      rest = end > 0 ? rest.substring(1, end) : rest.substring(1);
    } else {
      int semi = rest.indexOf(';');
      if (semi >= 0) rest = rest.substring(0, semi);
    }
    try {
      return URLDecoder.decode(rest, "UTF-8");
    } catch (Exception e) {
      return rest;
    }
  }

  String pickName(String given, String disposition, String headerDisp, String src, String mime, String headerMime) {
    String[] candidates = new String[] { given, fromDisposition(disposition), fromDisposition(headerDisp) };
    for (String c : candidates) {
      String name = sanitizeName(c);
      if (!name.isEmpty() && !name.equals("downloadfile") && !name.equals("portal")) return name;
    }
    String guessed = sanitizeName(URLUtil.guessFileName(src, headerDisp != null ? headerDisp : disposition, headerMime != null ? headerMime : mime));
    if (!guessed.isEmpty() && !guessed.equals("downloadfile") && !guessed.equals("portal")) return guessed;
    return looksApk(given, src, mime, headerMime, headerDisp) ? "file.apk" : "download.bin";
  }

  void showBusy(String text) {
    runOnUiThread(
      () -> {
        if (busyText != null) busyText.setText(text);
        if (busy != null) busy.setVisibility(View.VISIBLE);
      }
    );
  }

  void hideBusy() {
    runOnUiThread(
      () -> {
        if (busy != null) busy.setVisibility(View.GONE);
        if (web != null) {
          web.evaluateJavascript("window.ftDownloadDone&&window.ftDownloadDone()", null);
        }
      }
    );
  }

  SharedPreferences prefs() {
    return getSharedPreferences(PREF, MODE_PRIVATE);
  }

  void restoreSessionIntoWeb(WebView view) {
    String raw = prefs().getString(KEY_USER, "");
    String js;
    if (raw != null && !raw.isEmpty()) {
      js =
        "(function(){try{localStorage.setItem('osn_user'," +
        JSONObject.quote(raw) +
        ");}catch(e){}if(window.ftRestoreSession)window.ftRestoreSession();})()";
    } else {
      js = "window.ftRestoreSession&&window.ftRestoreSession()";
    }
    view.evaluateJavascript(js, null);
  }

  void startDownload(String url, String mime, String disposition, String filename) {
    if (!allowed(Uri.parse(url))) return;
    prefs().edit().commit();
    boolean official = url != null && url.contains("/tools/ft/dist/");
    showBusy(official ? "更新中…" : "下载中…");
    new Thread(() -> saveAndOpen(url, mime, disposition, filename)).start();
  }

  public class FtShell {
    @JavascriptInterface
    public void download(String url, String name) {
      startDownload(url, "", "", name == null ? "" : name);
    }

    @JavascriptInterface
    public void saveSession(String json) {
      if (json == null || json.isEmpty()) return;
      prefs().edit().putString(KEY_USER, json).commit();
    }

    @JavascriptInterface
    public void saveLogin(String ident, String password) {
      SharedPreferences.Editor ed = prefs().edit();
      if (ident != null) ed.putString(KEY_IDENT, ident);
      if (password != null) ed.putString(KEY_PASS, password);
      ed.commit();
    }

    @JavascriptInterface
    public void clearSession() {
      prefs().edit().remove(KEY_USER).remove(KEY_IDENT).remove(KEY_PASS).commit();
    }

    @JavascriptInterface
    public String getSession() {
      return prefs().getString(KEY_USER, "");
    }

    @JavascriptInterface
    public String getLoginIdent() {
      return prefs().getString(KEY_IDENT, "");
    }

    @JavascriptInterface
    public String getLoginPass() {
      return prefs().getString(KEY_PASS, "");
    }
  }

  @Override
  public boolean onKeyDown(int keyCode, KeyEvent event) {
    if (keyCode == KeyEvent.KEYCODE_BACK && event.getRepeatCount() == 0) {
      if (busy != null && busy.getVisibility() == View.VISIBLE) {
        return true;
      }
      if (exitPromptOpen && exitDialog != null && exitDialog.isShowing()) {
        exitDialog.dismiss();
        return true;
      }
      confirmExit();
      return true;
    }
    return super.onKeyDown(keyCode, event);
  }

  @Override
  public void onBackPressed() {
    if (busy != null && busy.getVisibility() == View.VISIBLE) return;
    confirmExit();
  }

  void confirmExit() {
    if (exitPromptOpen && exitDialog != null && exitDialog.isShowing()) return;
    exitPromptOpen = true;
    exitDialog =
      new AlertDialog.Builder(this)
        .setMessage("要退出超快传吗？")
        .setNegativeButton("否", (DialogInterface d, int w) -> {})
        .setPositiveButton("是", (DialogInterface d, int w) -> finish())
        .setCancelable(true)
        .setOnDismissListener((DialogInterface d) -> {
          exitPromptOpen = false;
        })
        .create();
    exitDialog.setOnShowListener(
      (DialogInterface d) -> {
        Button no = exitDialog.getButton(AlertDialog.BUTTON_NEGATIVE);
        if (no != null) {
          no.setFocusable(true);
          no.setFocusableInTouchMode(true);
          no.requestFocus();
        }
      }
    );
    exitDialog.show();
  }

  boolean allowed(Uri uri) {
    if (uri == null) return false;
    if (!"https".equals(uri.getScheme())) return false;
    String host = String.valueOf(uri.getHost()).toLowerCase();
    if (!(host.equals("1024201.com") || host.equals("www.1024201.com") || host.equals("ft.1024201.com"))) {
      return false;
    }
    String path = uri.getPath() == null ? "" : uri.getPath();
    if (path.equals("/") || path.equals("/index.html") || path.equals("/tools") || path.equals("/tools/")) {
      return false;
    }
    if (path.startsWith("/tools/js/")) return true;
    if (path.startsWith("/tools/") && !path.startsWith("/tools/ft")) return false;
    if (path.startsWith("/game/") && !path.startsWith("/game/js/")) return false;
    return path.startsWith("/tools/ft")
        || path.startsWith("/api/")
        || path.startsWith("/js/")
        || path.startsWith("/icons/")
        || path.startsWith("/game/js/")
        || path.startsWith("/sw.js");
  }

  void openFile(Uri uri, String type, boolean apk) {
    Intent view = new Intent(Intent.ACTION_VIEW);
    view.setDataAndType(uri, type);
    view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      startActivity(view);
      return;
    } catch (Exception ignored) {
      /* try install */
    }
    if (!apk) throw new RuntimeException("open_failed");
    Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE);
    install.setDataAndType(uri, APK_MIME);
    install.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
    install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
    startActivity(install);
  }

  void saveAndOpen(String src, String mime, String disposition, String givenName) {
    try {
      URL url = new URL(src);
      HttpURLConnection c = (HttpURLConnection) url.openConnection();
      String cookie = CookieManager.getInstance().getCookie(src);
      if (cookie != null && !cookie.isEmpty()) c.setRequestProperty("Cookie", cookie);
      c.connect();
      String headerDisp = c.getHeaderField("Content-Disposition");
      String headerMime = c.getContentType();
      String name = pickName(givenName, disposition, headerDisp, src, mime, headerMime);
      boolean apk = looksApk(name, src, mime, headerMime, givenName);
      if (apk && !name.toLowerCase().endsWith(".apk")) name = name + ".apk";
      File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
      if (dir == null) {
        runOnUiThread(() -> Toast.makeText(this, "失败", Toast.LENGTH_SHORT).show());
        return;
      }
      dir.mkdirs();
      File out = new File(dir, name);
      InputStream in = c.getInputStream();
      FileOutputStream fos = new FileOutputStream(out);
      byte[] buf = new byte[8192];
      int n;
      while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
      fos.close();
      in.close();
      Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".files", out);
      String type = apk ? APK_MIME : (headerMime != null && !headerMime.isEmpty() ? headerMime : "application/octet-stream");
      openFile(uri, type, apk);
    } catch (Exception e) {
      runOnUiThread(() -> Toast.makeText(this, "失败", Toast.LENGTH_SHORT).show());
    } finally {
      hideBusy();
    }
  }
}
