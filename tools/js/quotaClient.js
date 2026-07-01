import { getUser } from "/game/js/store.js";

export function currentUserId() {
  const u = getUser();
  return u?.id ? String(u.id) : "";
}

export function loginHref(returnPath) {
  return `/game/register/?return=${encodeURIComponent(returnPath || location.pathname)}`;
}

export function quotaQuery() {
  const id = currentUserId();
  return id ? `&user_id=${encodeURIComponent(id)}` : "";
}

export function quotaBody() {
  const id = currentUserId();
  return id ? { user_id: Number(id) } : {};
}

export function isLoginRequired(data) {
  return data?.needLogin || data?.error === "login_required";
}
