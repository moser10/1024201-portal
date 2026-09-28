/** Cheap portal IP watch: full geo only when the visible IP actually changed. */

export const GEO_HEARTBEAT_MS = 60_000;

export function geoNeedsFullLookup(shownIp, liveIp) {
  const live = String(liveIp || "").trim();
  if (!live) return false;
  return String(shownIp || "").trim() !== live;
}

export function clientIpFromPing(data) {
  const ip = String(data?.ip || "").trim();
  return ip && ip !== "0.0.0.0" ? ip : "";
}
