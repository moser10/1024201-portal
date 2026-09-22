import { getPortalLang } from "/js/langTabs.js";
import { getUser } from "/game/js/store.js";
import { renderMarkdown, formatBlogDate } from "./md.js";

const UI = {
  en: {
    back: "Blog",
    backPortal: "Back to lobby",
    updated: "Updated",
    author: "By",
    like: "Like",
    liked: "Liked",
    likes: (n) => `${n} likes`,
    notFound: "This post is unavailable.",
    privateNote: "Private post",
  },
  zh: {
    back: "博客",
    backPortal: "返回大厅",
    updated: "更新",
    author: "作者",
    like: "点赞",
    liked: "已赞",
    likes: (n) => `${n} 赞`,
    notFound: "这篇博客不可用或不存在。",
    privateNote: "仅自己可见",
  },
  ja: {
    back: "ブログ",
    backPortal: "ロビーへ",
    updated: "更新",
    author: "作者",
    like: "いいね",
    liked: "いいね済み",
    likes: (n) => `${n} いいね`,
    notFound: "この投稿は表示できません。",
    privateNote: "非公開",
  },
};

function t() {
  return UI[getPortalLang()] || UI.en;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function boot() {
  const id = new URLSearchParams(location.search).get("id")?.trim();
  const errBox = document.getElementById("errBox");
  const article = document.getElementById("article");
  const ui = t();
  const lang = getPortalLang();

  document.getElementById("backLink").textContent = ui.backPortal;

  if (!id) {
    errBox.hidden = false;
    errBox.textContent = ui.notFound;
    return;
  }

  const user = getUser();
  const qs = new URLSearchParams({ action: "get", id });
  if (user?.id) qs.set("user_id", String(user.id));

  let data;
  try {
    const res = await fetch(`/api/blog?${qs}`);
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ui.notFound);
  } catch {
    errBox.hidden = false;
    errBox.textContent = ui.notFound;
    return;
  }

  const isPublic = data.status === "published" && data.visibility === "public";
  const robots = document.getElementById("robotsMeta");
  if (isPublic) {
    robots.setAttribute("content", "index, follow");
  } else {
    robots.setAttribute("content", "noindex, nofollow");
  }

  document.title = `${data.title || "Blog"} | 1024201`;
  document.getElementById("titleEl").textContent = data.title || "";
  const metaBits = [];
  if (data.author) metaBits.push(`${ui.author} @${data.author}`);
  metaBits.push(formatBlogDate(data.created_at, lang));
  if (!isPublic) metaBits.push(ui.privateNote);
  document.getElementById("metaEl").textContent = metaBits.join(" · ");

  const bodyHtml = renderMarkdown(data.body_md || "");
  const updatedBlock = data.updated_at
    ? `<p class="blog-updated-in-body">${esc(ui.updated)} ${esc(formatBlogDate(data.updated_at, lang))}</p>`
    : "";
  document.getElementById("bodyEl").innerHTML = `${updatedBlock}${bodyHtml}`;

  article.hidden = false;

  const likeBar = document.getElementById("likeBar");
  const likeBtn = document.getElementById("likeBtn");
  const likeCount = document.getElementById("likeCount");

  if (isPublic) {
    likeBar.hidden = false;
    likeCount.textContent = ui.likes(data.like_count || 0);
    if (data.liked) {
      likeBtn.disabled = true;
      likeBtn.classList.add("is-liked");
      likeBtn.textContent = ui.liked;
    } else {
      likeBtn.textContent = ui.like;
      likeBtn.onclick = async () => {
        likeBtn.disabled = true;
        try {
          const res = await fetch(`/api/blog?action=like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const out = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(out.error || "fail");
          likeBtn.classList.add("is-liked");
          likeBtn.textContent = ui.liked;
          likeCount.textContent = ui.likes(out.like_count || data.like_count || 0);
        } catch {
          likeBtn.disabled = false;
        }
      };
    }
  }

  document.getElementById("backLink").href = "/";
  document.getElementById("backLink").textContent = ui.backPortal;
}

boot();
