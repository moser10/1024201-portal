package com.p1024201.ft;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
  static final String HOME = "https://1024201.com/tools/ft/?client=tv";
  WebView web;
  AlertDialog exitDialog;
  boolean exitPromptOpen;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    web = new WebView(this);
    setContentView(web);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setUserAgentString(settings.getUserAgentString() + " 1024201-FT-TV/1.4");
    CookieManager cookies = CookieManager.getInstance();
    cookies.setAcceptCookie(true);
    cookies.setAcceptThirdPartyCookies(web, true);
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
          new Thread(() -> saveAndOpen(url, mime, contentDisposition)).start();
        }
      }
    );
    web.loadUrl(HOME);
  }

  @Override
  public boolean onKeyDown(int keyCode, KeyEvent event) {
    if (keyCode == KeyEvent.KEYCODE_BACK && event.getRepeatCount() == 0) {
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
    }
  }
}
