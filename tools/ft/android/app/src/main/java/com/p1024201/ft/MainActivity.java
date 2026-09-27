package com.p1024201.ft;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
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
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
  static final String HOME = "https://1024201.com/tools/ft/?client=tv";
  WebView web;
  View busy;
  TextView busyText;
  AlertDialog exitDialog;
  boolean exitPromptOpen;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    FrameLayout root = new FrameLayout(this);
    web = new WebView(this);
    root.addView(
      web,
      new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    );
    busy = buildBusy();
    root.addView(
      busy,
      new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    );
    setContentView(root);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setUserAgentString(settings.getUserAgentString() + " 1024201-FT-TV/1.5");
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
          }
        }
      }
    );
    web.setDownloadListener(
      new DownloadListener() {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mime, long len) {
          startDownload(url, mime, contentDisposition);
        }
      }
    );
    web.loadUrl(HOME);
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
    busyText.setText("更新中…");
    busyText.setTextColor(Color.WHITE);
    busyText.setTextSize(18);
    busyText.setTypeface(Typeface.DEFAULT_BOLD);
    busyText.setPadding(0, 28, 0, 0);
    box.addView(spin);
    box.addView(busyText);
    return box;
  }

  boolean isApk(String src) {
    String s = src == null ? "" : src.toLowerCase();
    return s.contains(".apk") || s.contains("ft-tv");
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

  void startDownload(String url, String mime, String disposition) {
    if (!allowed(Uri.parse(url))) return;
    showBusy(isApk(url) ? "更新中…" : "下载中…");
    new Thread(() -> saveAndOpen(url, mime, disposition)).start();
  }

  public class FtShell {
    @JavascriptInterface
    public void download(String url) {
      startDownload(url, "", "");
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

  void saveAndOpen(String src, String mime, String disposition) {
    try {
      URL url = new URL(src);
      HttpURLConnection c = (HttpURLConnection) url.openConnection();
      String cookie = CookieManager.getInstance().getCookie(src);
      if (cookie != null && !cookie.isEmpty()) c.setRequestProperty("Cookie", cookie);
      c.connect();
      String name = URLUtil.guessFileName(src, disposition, mime);
      if (name == null || name.isEmpty() || name.equals("downloadfile")) {
        name = isApk(src) ? "ft-tv.apk" : "download.bin";
      }
      File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
      if (dir == null) return;
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
      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.setDataAndType(uri, name.toLowerCase().endsWith(".apk") ? "application/vnd.android.package-archive" : mime);
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(intent);
    } catch (Exception ignored) {
      /* stay on the locked page */
    } finally {
      hideBusy();
    }
  }
}
