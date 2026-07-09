const LANGS = ["en", "ja", "zh"];

export function getPortalLang() {
  const lang = localStorage.getItem("portal_lang") || "en";
  return LANGS.includes(lang) ? lang : "en";
}

export function setPortalLang(lang) {
  if (!LANGS.includes(lang)) lang = "en";
  localStorage.setItem("portal_lang", lang);
}

function setActive(tabs, lang) {
  tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.lang === lang));
}

export function mountLangTabs(container, { onChange, active, layout = "vertical" } = {}) {
  if (!container) return;
  const current = active ?? getPortalLang();
  const rowClass = layout === "horizontal" ? " lang-tabs--row" : "";
  container.className = "lang-tabs-host";
  container.innerHTML = `
    <div class="lang-tabs${rowClass}" role="group" aria-label="Language">
      <button type="button" class="lang-tab" data-lang="en">EN</button>
      <button type="button" class="lang-tab" data-lang="ja">日</button>
      <button type="button" class="lang-tab" data-lang="zh">中</button>
    </div>`;

  const tabs = [...container.querySelectorAll(".lang-tab")];
  setActive(tabs, current);

  container.querySelector(".lang-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".lang-tab");
    if (!btn) return;
    const lang = btn.dataset.lang;
    if (lang === getPortalLang()) return;
    setPortalLang(lang);
    setActive(tabs, lang);
    if (onChange) onChange(lang);
    else location.reload();
  });
}
