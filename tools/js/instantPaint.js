(function () {
  const LANGS = ["en", "ja", "zh"];
  const PAGES = {
    lyrics: {
      en: { pageTitle: "Find Lyrics", pageSub: "LRCLIB + Deezer · search by song or artist", backLink: "Toolbox" },
      zh: { pageTitle: "找歌词", pageSub: "LRCLIB + Deezer · 按歌名或歌手搜索", backLink: "返回工具箱" },
      ja: { pageTitle: "歌詞検索", pageSub: "LRCLIB + Deezer · 曲名またはアーティスト", backLink: "ツールボックス" },
    },
    pdf: {
      en: { pageTitle: "PDF Convert", pageSub: "Word / TXT / MD → PDF (client-side)", backLink: "Toolbox" },
      zh: { pageTitle: "PDF 转换", pageSub: "Word / TXT / MD → PDF（本地转换）", backLink: "返回工具箱" },
      ja: { pageTitle: "PDF変換", pageSub: "Word / TXT / MD → PDF（ローカル）", backLink: "ツールボックス" },
    },
    music: {
      en: { pageTitle: "Music", pageSub: "Deezer chart · 30s preview clips", backLink: "Toolbox" },
      zh: { pageTitle: "音乐", pageSub: "Deezer 榜单 · 30 秒试听", backLink: "返回工具箱" },
      ja: { pageTitle: "音楽", pageSub: "Deezerチャート · 30秒プレビュー", backLink: "ツールボックス" },
    },
    syncnote: {
      en: { pageTitle: "Text Relay", pageSub: "Two text fields + attachments (5MB, D1)", backLink: "Toolbox" },
      zh: { pageTitle: "文本中转站", pageSub: "两个文本框 + 附件（5MB/个，D1 免费存储）", backLink: "返回工具箱" },
      ja: { pageTitle: "テキスト中継", pageSub: "テキスト2枠 + 添付（5MB・D1）", backLink: "ツールボックス" },
    },
    showcase: {
      en: { pageTitle: "Portfolio", pageSub: "Watermark images for designers & photographers", backLink: "Toolbox" },
      zh: { pageTitle: "作品展示", pageSub: "设计/摄影作品加水印展示，降低被白嫖风险", backLink: "返回工具箱" },
      ja: { pageTitle: "作品展示", pageSub: "透かし付きで作品を公開", backLink: "ツールボックス" },
    },
    "showcase-view": {
      en: { backLink: "Portfolio" },
      zh: { backLink: "作品展示" },
      ja: { backLink: "作品展示" },
    },
    cli: {
      en: { pageTitle: "CLI", pageSub: "Run 1024201 tools from the terminal · same API & quotas as the web", backLink: "Toolbox" },
      zh: { pageTitle: "命令行", pageSub: "在终端调用 1024201 工具 · 与网页共用接口与配额", backLink: "返回工具箱" },
      ja: { pageTitle: "CLI", pageSub: "ターミナルから 1024201 ツール · Web と同じ API・割当", backLink: "ツールボックス" },
    },
    address: {
      en: { pageTitle: "Address Lookup", pageSub: "Rental & sale addresses · postal codes · phone prefixes", backLink: "Toolbox" },
      zh: { pageTitle: "地址查找", pageSub: "多国租售房源 · 详细地址 · 邮编 · 电话区号", backLink: "返回工具箱" },
      ja: { pageTitle: "住所検索", pageSub: "賃貸・売買 · 住所 · 郵便番号 · 電話", backLink: "ツールボックス" },
    },
    fx: {
      en: { pageTitle: "Exchange Rates", pageSub: "ECB reference · refreshes every 30 minutes", backLink: "Portal" },
      zh: { pageTitle: "实时汇率", pageSub: "欧洲央行参考汇率 · 每 30 分钟更新", backLink: "返回门户" },
      ja: { pageTitle: "為替レート", pageSub: "ECB参考 · 30分ごとに更新", backLink: "ポータル" },
    },
    "lyrics-view": {
      en: { backLink: "Search" },
      zh: { backLink: "返回搜索" },
      ja: { backLink: "検索へ" },
    },
  };

  function lang() {
    const l = localStorage.getItem("portal_lang") || "en";
    return LANGS.includes(l) ? l : "en";
  }

  const key = document.body.dataset.tool;
  const dict = PAGES[key];
  if (!dict) return;
  const t = dict[lang()] || dict.en;
  for (const [id, text] of Object.entries(t)) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
})();
