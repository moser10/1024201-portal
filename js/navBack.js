/** One source for top-left back labels and where that button goes. */
export const HALL_BACK = Object.freeze({
  href: "/",
  zh: "返回大厅",
  en: "Back to lobby",
  ja: "ロビーへ",
});

export const ROOMS_BACK = Object.freeze({
  href: "/rooms/",
  zh: "返回开房",
  en: "Back to Rooms",
  ja: "ルームへ",
});

export const GAME_BACK = Object.freeze({
  href: "/game/",
  zh: "返回游戏",
  en: "Game center",
  ja: "ゲームへ",
});

const CTX_KEY = "portal_nav_back";

export function hallBackLabel(lang) {
  return HALL_BACK[lang] || HALL_BACK.en;
}

export function roomsBackLabel(lang) {
  return ROOMS_BACK[lang] || ROOMS_BACK.en;
}

export function roomBackLabel(lang, title) {
  const name = String(title || "").trim() || (lang === "zh" ? "房间" : "room");
  if (lang === "zh") return `返回${name}房间`;
  if (lang === "ja") return `${name}へ`;
  return `Back to ${name}`;
}

export function setNavBack(spec) {
  try {
    sessionStorage.setItem(CTX_KEY, JSON.stringify(spec || { type: "hall" }));
  } catch {
    /* ignore quota */
  }
}

export function readNavBack() {
  try {
    return JSON.parse(sessionStorage.getItem(CTX_KEY) || "null");
  } catch {
    return null;
  }
}

/** Only practice-from-room should reopen a room. Lobby / hall must not. */
export function roomReturnId(spec = readNavBack()) {
  if (spec?.type === "room" && spec.roomId) return String(spec.roomId);
  return "";
}

export function clearNavBack(type = "hall") {
  setNavBack({ type });
}

function pack(lang, type) {
  if (type === "rooms") return { href: ROOMS_BACK.href, label: roomsBackLabel(lang) };
  if (type === "game") return { href: GAME_BACK.href, label: GAME_BACK[lang] || GAME_BACK.en };
  return { href: HALL_BACK.href, label: hallBackLabel(lang) };
}

export function resolveNavBack(lang, opt = "hall") {
  const options = typeof opt === "string" ? { type: opt } : opt || {};
  if (options.follow) {
    const spec = readNavBack();
    if (spec?.type === "room" && (spec.roomId || spec.roomTitle)) {
      return {
        href: ROOMS_BACK.href,
        label: roomBackLabel(lang, spec.roomTitle),
      };
    }
    if (spec?.type === "rooms") return pack(lang, "rooms");
    if (spec?.type === "game") return pack(lang, "game");
    return pack(lang, options.fallback || "hall");
  }
  return pack(lang, options.type || "hall");
}

export function applyNavBack(el, lang, opt = "hall") {
  if (!el) return null;
  const nav = resolveNavBack(lang, opt);
  el.textContent = nav.label;
  if ("href" in el) el.setAttribute("href", nav.href);
  return nav;
}
