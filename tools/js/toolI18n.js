import { getPortalLang } from "/js/langTabs.js";

export function toolLang() {
  return getPortalLang();
}

export function apiErrorText(data, lang = toolLang()) {
  const code = data?.error;
  const map = API_ERRORS[code];
  if (map) return map[lang] || map.en;
  return data?.message || "";
}

export const API_ERRORS = {
  login_required: {
    en: "Free quota used. Sign in to continue.",
    zh: "今日免费次数已用完，请登录后继续使用",
    ja: "本日の無料回数を使い切りました。ログインしてください",
  },
  daily_limit: {
    en: "Daily limit reached. Watch an ad or pay to unlock more.",
    zh: "今日次数已用完，请观看广告或付费解锁",
    ja: "本日の上限に達しました。広告または課金で解除",
  },
  need_login: {
    en: "Please sign in first.",
    zh: "请先登录",
    ja: "先にログインしてください",
  },
};

export function formatQuotaLine(t, quota) {
  if (typeof t.quota === "function") {
    return t.quota(quota.remaining, quota.allowed, quota.loggedIn);
  }
  return "";
}
