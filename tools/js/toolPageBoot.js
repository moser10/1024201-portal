import { getUser } from "/game/js/store.js";

export function paintToolUser(elId = "userLine") {
  const el = document.getElementById(elId);
  if (!el) return;
  const name = getUser()?.username;
  if (!name) {
    el.hidden = true;
    return;
  }
  el.textContent = `@${name}`;
  el.hidden = false;
}

export function deferWork(fn) {
  const run = () => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 0);
  }
}
