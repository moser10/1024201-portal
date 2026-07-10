import { getPortalLang, mountLangTabs } from "/js/langTabs.js";

const UI = {
  en: { back: "Portfolio", err: "Work not found", by: (u) => `by @${u}` },
  zh: { back: "作品展示", err: "作品不存在", by: (u) => `@${u}` },
  ja: { back: "作品展示", err: "作品が見つかりません", by: (u) => `@${u}` },
};

let lang = getPortalLang();
let t = UI[lang] || UI.en;

const params = new URLSearchParams(location.search);
const id = params.get("id");

function applyI18n() {
  document.getElementById("backLink").textContent = t.back;
}

async function load() {
  const errBox = document.getElementById("errBox");
  const card = document.getElementById("viewCard");
  if (!id) {
    errBox.textContent = t.err;
    errBox.hidden = false;
    return;
  }
  try {
    const res = await fetch(`/api/portal?action=showcase_get&id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.err);
    document.getElementById("workTitle").textContent = data.title || "—";
    document.getElementById("workMeta").textContent = t.by(data.author || "");
    document.getElementById("workImg").src = data.imageUrl;
    document.getElementById("workImg").alt = data.title || "";
    document.getElementById("workViews").textContent = `${data.views} views`;
    card.hidden = false;
  } catch (e) {
    errBox.textContent = e.message || t.err;
    errBox.hidden = false;
  }
}

mountLangTabs(document.getElementById("langSlot"), {
  layout: "horizontal",
  onChange: (next) => {
    lang = next;
    t = UI[lang] || UI.en;
    applyI18n();
  },
});

applyI18n();
load();
