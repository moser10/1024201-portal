package com.p1024201.ft;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
  static final String HOME = "https://1024201.com/tools/ft/?client=tv";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WebView web = new WebView(this);
    setContentView(web);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    CookieManager.getInstance().setAcceptCookie(true);
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

  boolean allowed(Uri uri) {
    if (uri == null) return false;
    String host = String.valueOf(uri.getHost()).toLowerCase();
    return host.equals("1024201.com") || host.equals("www.1024201.com") || host.equals("ft.1024201.com");
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
