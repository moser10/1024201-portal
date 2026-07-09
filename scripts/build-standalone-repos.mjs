#!/usr/bin/env node
import { cpSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "..");
const ST = join(ROOT, "scripts/standalone");

const portal = readFileSync(join(ROOT, "functions/api/portal.js"), "utf8");
const lyricsCore = portal.split("const ARTIST_ALIASES = {")[1];
const lyricsCoreBody = "const ARTIST_ALIASES = {" + lyricsCore.split("function parseUserId")[0];

writeFileSync(
  join(ST, "api-findLytics.js"),
  readFileSync(join(ST, "api-findLytics-head.js"), "utf8") + "\n" + lyricsCoreBody
);

function w(p, c) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, c);
}

function cp(s, d) {
  mkdirSync(dirname(d), { recursive: true });
  cpSync(s, d);
}

function sharedBackend(dir) {
  cp(join(ST, "quota.js"), join(dir, "functions/api/quota.js"));
  cp(join(ST, "github.js"), join(dir, "functions/api/github.js"));
  cp(join(ST, "_shared.template.js"), join(dir, "functions/api/_shared.js"));
}

function sharedFrontend(dir) {
  const js = join(dir, "js");
  mkdirSync(js, { recursive: true });
  cp(join(ROOT, "js/langTabs.js"), join(js, "langTabs.js"));
  cp(join(ROOT, "js/langTabs.css"), join(js, "langTabs.css"));
  cp(join(ROOT, "js/featurePage.css"), join(js, "featurePage.css"));
  cp(join(ST, "quotaUi.js"), join(js, "quotaUi.js"));
  cp(join(ST, "toolI18n.js"), join(js, "toolI18n.js"));
}

function wrangler(repoName, workerName) {
  const wn = workerName || repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return readFileSync(join(ST, "wrangler.template.toml"), "utf8")
    .replaceAll("{{NAME}}", wn)
    .replaceAll("{{REPO_NAME}}", repoName)
    .replaceAll("{{DB_NAME}}", `${wn}-db`);
}

function pkg(name, desc) {
  return JSON.stringify(
    { name: name.toLowerCase(), private: false, description: desc, type: "module", scripts: { dev: "wrangler dev", deploy: "wrangler deploy", "db:create": `wrangler d1 create ${name}-db` }, license: "MIT" },
    null,
    2
  );
}

const SCHEMA = `CREATE TABLE IF NOT EXISTS usage_quota (
  quota_key TEXT PRIMARY KEY,
  uses INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS github_sessions (
  session_id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL,
  github_login TEXT NOT NULL,
  access_token TEXT NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL
);
`;

function readme(repo, title, blurb, credits) {
  return readFileSync(join(ST, "README.template.md"), "utf8")
    .replaceAll("{{TITLE}}", title)
    .replaceAll("{{REPO}}", repo)
    .replaceAll("{{BLURB}}", blurb)
    .replaceAll("{{CREDITS}}", credits);
}

const STAR_PANEL = `
      <div class="pdf-quota" id="quotaBox"></div>
      <div class="unlock-panel" id="starPanel" hidden>
        <p class="unlock-title" id="starTitle"></p>
        <p class="unlock-desc" id="starDesc"></p>
        <a class="btn-primary btn-link" id="starBtn" href="/api/github/login">GitHub</a>
      </div>`;

const HTML_HEAD = (title, css) => `<!DOCTYPE html>
<html lang="en" class="feature-page">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${title}</title>
  <link rel="stylesheet" href="/js/langTabs.css">
  <link rel="stylesheet" href="/js/featurePage.css">
  <link rel="stylesheet" href="${css}">
</head>
<body class="feature-page">
  <div class="feature-shell">
    <div class="feature-top">
      <span></span>
      <div id="langSlot"></div>
    </div>`;

function finishRepo(dir, name, title, desc, credits, extraFiles) {
  w(join(dir, "worker.js"), readFileSync(join(ST, "worker.template.js"), "utf8"));
  // wrangler.toml written by caller with correct worker name
  w(join(dir, "package.json"), pkg(name, desc));
  w(join(dir, "schema.sql"), SCHEMA);
  w(join(dir, ".gitignore"), ".wrangler/\nnode_modules/\n.dev.vars\n");
  w(join(dir, "LICENSE"), "MIT License\nCopyright (c) 2026\n");
  w(join(dir, "README.md"), readme(name, title, desc, credits));
  for (const [p, c] of extraFiles) w(join(dir, p), c);
  console.log("✓", name, "→", dir);
}

// findLytics
{
  const dir = join(OUT, "findLytics");
  sharedBackend(dir);
  sharedFrontend(dir);
  cp(join(ROOT, "tools/lyrics/lyrics.css"), join(dir, "lyrics.css"));
  cp(join(ROOT, "tools/lyrics/loading.js"), join(dir, "loading.js"));
  cp(join(ST, "api-findLytics.js"), join(dir, "functions/api/index.js"));
  w(
    join(dir, "index.html"),
    `${HTML_HEAD("findLytics", "lyrics.css")}
    <div class="feature-card lyrics-card">
      <div class="feature-card-head">
        <h1 id="pageTitle">Find Lyrics</h1>
        <p class="sub" id="pageSub"></p>
      </div>
      ${STAR_PANEL}
      <form class="search-form" id="searchForm">
        <label><span id="lblTitle"></span><input type="search" id="qTitle" autocomplete="off"></label>
        <label><span id="lblArtist"></span><input type="search" id="qArtist" autocomplete="off"></label>
        <p class="hint" id="searchHint"></p>
        <button type="submit" class="btn-primary" id="searchBtn">Search</button>
      </form>
      <p class="err" id="errBox" hidden></p>
      <div id="searchLoading" class="loading-panel" hidden></div>
      <div class="results-wrap" id="resultsWrap" hidden>
        <table class="results-table">
          <thead><tr>
            <th id="thTitle"></th><th id="thArtist"></th><th id="thAlbum"></th><th id="thYear"></th>
          </tr></thead>
          <tbody id="resultsBody"></tbody>
        </table>
      </div>
    </div></div>
  <script type="module" src="lyrics.js"></script>
</body></html>`
  );
  w(
    join(dir, "view.html"),
    readFileSync(join(ROOT, "tools/lyrics/view.html"), "utf8")
      .replace("| 1024201", "")
      .replace("/api/portal", "/api")
  );
  w(join(dir, "lyrics.js"), readFileSync(join(ST, "lyrics.front.js"), "utf8"));
  w(join(dir, "view.js"), readFileSync(join(ST, "view.front.js"), "utf8"));
  finishRepo(dir, "findLytics", "findLytics", "LRCLIB + Deezer lyrics search.", "Third-party: LRCLIB, Deezer, LibreTranslate.", []);
  w(join(dir, "wrangler.toml"), wrangler("findLytics", "find-lytics"));
}

// 2PDF
{
  const dir = join(OUT, "2PDF");
  sharedBackend(dir);
  sharedFrontend(dir);
  cp(join(ROOT, "tools/pdf/pdf.css"), join(dir, "pdf.css"));
  cp(join(ST, "api-2PDF.js"), join(dir, "functions/api/index.js"));
  w(
    join(dir, "index.html"),
    `${HTML_HEAD("2PDF", "pdf.css")}
    <div class="feature-card pdf-card">
      <div class="feature-card-head"><h1 id="pageTitle"></h1><p class="sub" id="pageSub"></p></div>
      ${STAR_PANEL}
      <label class="file-drop" id="fileDrop">
        <input type="file" id="fileInput" accept=".txt,.md,.docx,.doc" hidden>
        <span class="file-drop-icon">📄</span>
        <span id="pickLabel"></span>
        <span class="file-hint" id="pickHint"></span>
      </label>
      <p class="file-name" id="fileName" hidden></p>
      <button type="button" class="btn-primary" id="convertBtn" disabled>PDF</button>
      <p class="err" id="errBox" hidden></p>
      <div class="rules" id="rulesBox"><h3 id="rulesTitle"></h3><ul id="rulesList"></ul></div>
    </div></div>
  <script type="module" src="pdf.js"></script>
</body></html>`
  );
  w(join(dir, "pdf.js"), readFileSync(join(ST, "pdf.front.js"), "utf8"));
  finishRepo(dir, "2PDF", "2PDF", "Convert .docx / .txt / .md to PDF in the browser.", "Third-party: mammoth, html2pdf.js (cdnjs).", []);
  w(join(dir, "wrangler.toml"), wrangler("2PDF", "to-pdf"));
}

// latestRates
{
  const dir = join(OUT, "latestRates");
  sharedBackend(dir);
  sharedFrontend(dir);
  cp(join(ROOT, "fx/fx.css"), join(dir, "fx.css"));
  cp(join(ST, "api-latestRates.js"), join(dir, "functions/api/index.js"));
  w(
    join(dir, "index.html"),
    `${HTML_HEAD("latestRates", "fx.css")}
    <div class="feature-card">
      <div class="feature-card-head"><h1 id="pageTitle"></h1><p class="sub" id="pageSub"></p></div>
      ${STAR_PANEL}
      <div class="base-row"><label id="baseLabel" for="baseSelect"></label><select id="baseSelect"></select></div>
      <p class="updated" id="updatedAt">—</p>
      <div class="feature-scroll-panel"><ul class="rate-list" id="rateList"></ul></div>
      <p class="err" id="errBox" hidden></p>
    </div></div>
  <script type="module" src="fx.js"></script>
</body></html>`
  );
  w(join(dir, "fx.js"), readFileSync(join(ST, "fx.front.js"), "utf8"));
  finishRepo(dir, "latestRates", "latestRates", "ECB reference FX rates (Frankfurter API).", "Rates: Frankfurter / ECB reference data.", []);
  w(join(dir, "wrangler.toml"), wrangler("latestRates", "latest-rates"));
}

console.log("\nRepos ready under", OUT);
