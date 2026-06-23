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
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
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
