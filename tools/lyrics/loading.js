const NET_FACTOR = {
  "slow-2g": 3.2,
  "2g": 2.4,
  "3g": 1.5,
  "4g": 1,
};

export function estimateEtaMs(baseSec) {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const factor = conn?.effectiveType ? NET_FACTOR[conn.effectiveType] || 1.3 : 1.2;
  return Math.round(baseSec * factor * 1000);
}

/** Progress tied to actual work — no fake countdown that ends early. */
export function mountProgress(host, { label, indeterminate = false } = {}) {
  if (!host) return { done() {}, fail() {} };
  host.hidden = false;
  host.innerHTML = indeterminate
    ? `
    <p class="loading-label">${label}</p>
    <div class="loading-bar loading-bar--busy" role="progressbar" aria-busy="true">
      <div class="loading-bar-fill loading-bar-fill--busy"></div>
    </div>`
    : `
    <p class="loading-label">${label}</p>
    <div class="loading-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100">
      <div class="loading-bar-fill"></div>
    </div>`;

  const fill = host.querySelector(".loading-bar-fill");
  const bar = host.querySelector(".loading-bar");
  let stopped = false;
  let timer = null;

  if (!indeterminate) {
    let pct = 8;
    const tick = () => {
      if (stopped) return;
      pct = Math.min(92, pct + 4);
      fill.style.width = `${pct}%`;
      bar.setAttribute("aria-valuenow", String(pct));
    };
    tick();
    timer = setInterval(tick, 280);
  }

  return {
    done() {
      stopped = true;
      if (timer) clearInterval(timer);
      fill.style.width = "100%";
      bar.setAttribute("aria-valuenow", "100");
      bar.removeAttribute("aria-busy");
      setTimeout(() => {
        host.hidden = true;
        host.innerHTML = "";
      }, 180);
    },
    fail() {
      stopped = true;
      if (timer) clearInterval(timer);
      host.hidden = true;
      host.innerHTML = "";
    },
  };
}
