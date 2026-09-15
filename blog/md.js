/** Minimal markdown → HTML for flat blog display (no deps). */

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(md) {
  // Protect images/links before escaping the rest
  const tokens = [];
  const stash = (html) => {
    const key = `\u0000${tokens.length}\u0000`;
    tokens.push(html);
    return key;
  };

  let s = String(md);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, src) => {
    const safe = /^https?:\/\//i.test(src) || src.startsWith("/api/portal?action=file_get");
    if (!safe) return alt || "";
    return stash(`<img class="md-img" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />`);
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    if (!/^(https?:\/\/|\/)/i.test(href)) return text;
    return stash(`<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(text)}</a>`);
  });
  s = s.replace(/`([^`]+)`/g, (_, code) => stash(`<code>${esc(code)}</code>`));

  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/  \n/g, "<br>\n");

  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)] || "");
  return s;
}

/**
 * @param {string} markdown
 * @returns {string} HTML
 */
export function renderMarkdown(markdown) {
  const src = String(markdown || "").replace(/\r\n/g, "\n").trim();
  if (!src) return "";

  const lines = src.split("\n");
  const html = [];
  let i = 0;
  let para = [];
  let listType = null;
  let listItems = [];

  const flushPara = () => {
    if (!para.length) return;
    html.push(`<p>${inline(para.join("\n"))}</p>`);
    para = [];
  };

  const flushList = () => {
    if (!listType) return;
    const tag = listType === "ol" ? "ol" : "ul";
    html.push(`<${tag}>${listItems.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
    listType = null;
    listItems = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flushPara();
      flushList();
      i += 1;
      const code = [];
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      html.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushPara();
      flushList();
      i += 1;
      continue;
    }

    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      html.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      flushList();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote><p>${inline(quote.join("\n"))}</p></blockquote>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      flushList();
      html.push("<hr>");
      i += 1;
      continue;
    }

    const ul = /^[-*+]\s+(.+)$/.exec(line);
    const ol = /^(\d+)\.\s+(.+)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (listType && listType !== type) flushList();
      listType = type;
      listItems.push(ul ? ul[1] : ol[2]);
      i += 1;
      continue;
    }

    if (listType) flushList();
    para.push(line);
    i += 1;
  }

  flushPara();
  flushList();
  return html.join("\n");
}

export function formatBlogDate(raw, lang = "zh") {
  if (!raw) return "";
  const d = new Date(String(raw).includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  const locale = lang === "ja" ? "ja-JP" : lang === "en" ? "en-US" : "zh-CN";
  return d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}
