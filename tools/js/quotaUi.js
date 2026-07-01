import { getUser } from "/game/js/store.js";

export function guessQuota() {
  const u = getUser();
  const loggedIn = !!u?.id;
  const allowed = loggedIn ? 5 : 1;
  return {
    remaining: allowed,
    allowed,
    loggedIn,
    needLogin: false,
    needUnlock: false,
    uses: 0,
    bonus: 0,
    adTier: 0,
    adProgress: 0,
    adsNeeded: 1,
    adsRemaining: 1,
  };
}

export function readQuotaCache(tool) {
  try {
    const raw = sessionStorage.getItem(`quota_${tool}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeQuotaCache(tool, q) {
  try {
    sessionStorage.setItem(`quota_${tool}`, JSON.stringify(q));
  } catch {
    /* ignore */
  }
}
