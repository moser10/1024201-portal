import { getPortalLang } from "./langTabs.js";

const FREE_LIMIT = 32;

export function toolLang() {
  return getPortalLang();
}

export const API_ERRORS = {
  star_required: {
    en: `Free limit (${FREE_LIMIT}) reached. Star this repo on GitHub to unlock unlimited use.`,
    zh: `免费次数（${FREE_LIMIT} 次）已用完。请在 GitHub 上 Star 本仓库以解锁无限次使用。`,
    ja: `無料回数（${FREE_LIMIT}回）を使い切りました。GitHubでStarすると無制限になります。`,
  },
};

export function apiErrorText(data, lang = toolLang()) {
  const code = data?.error;
  const map = API_ERRORS[code];
  if (map) return map[lang] || map.en;
  return data?.message || "";
}

export function formatQuotaLine(t, quota) {
  if (!quota) return "";
  if (quota.unlimited || quota.starred) {
    const who = quota.githubLogin ? `@${quota.githubLogin}` : "";
    if (typeof t.quotaUnlimited === "function") return t.quotaUnlimited(who);
    return t.quotaUnlimited || "Unlimited";
  }
  if (typeof t.quota === "function") {
    return t.quota(quota.remaining ?? 0, quota.allowed ?? FREE_LIMIT);
  }
  return "";
}

export function starRepoUrl(envRepo) {
  return envRepo || "#";
}
