const FREE_LIMIT = 32;

export function guessQuota() {
  return {
    remaining: FREE_LIMIT,
    allowed: FREE_LIMIT,
    uses: 0,
    unlimited: false,
    starred: false,
    needStar: false,
    freeLimit: FREE_LIMIT,
  };
}

export function readQuotaCache() {
  try {
    const raw = sessionStorage.getItem("quota_cache");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeQuotaCache(q) {
  try {
    sessionStorage.setItem("quota_cache", JSON.stringify(q));
  } catch {
    /* ignore */
  }
}
