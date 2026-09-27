const USER_KEY = "osn_user";
const ROOM_KEY = "osn_room";

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function setUser(user) {
  const prev = getUser();
  if (prev?.id && user?.id && prev.id !== user.id) {
    clearRoom();
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

export function forceLogout() {
  clearUser();
  clearRoom();
  const ret = `${location.pathname}${location.search}`;
  const dest = ret.startsWith("/game/register") ? "/" : ret;
  location.assign(`/game/register/?return=${encodeURIComponent(dest)}`);
}

let aliveWatch = 0;
export function watchAccountAlive() {
  const user = getUser();
  if (!user?.id) return;
  if (aliveWatch) return;
  const ping = () => {
    const u = getUser();
    if (!u?.id) return;
    fetch(`/api/auth?action=me&user_id=${encodeURIComponent(u.id)}`, { cache: "no-store" })
      .then((res) => {
        if (res.status === 401) forceLogout();
      })
      .catch(() => {});
  };
  ping();
  aliveWatch = setInterval(ping, 8000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ping();
  });
}

export function getRoom() {
  try {
    return JSON.parse(localStorage.getItem(ROOM_KEY));
  } catch {
    return null;
  }
}

export function setRoom(room) {
  localStorage.setItem(ROOM_KEY, JSON.stringify(room));
}

export function clearRoom() {
  localStorage.removeItem(ROOM_KEY);
}

export function requireAuth(returnPath) {
  if (getUser()) {
    watchAccountAlive();
    return true;
  }
  const ret = returnPath ? `?return=${encodeURIComponent(returnPath.startsWith("/") ? returnPath : `/${returnPath}`)}` : "";
  window.location.href = `/game/register/${ret}`;
  return false;
}
