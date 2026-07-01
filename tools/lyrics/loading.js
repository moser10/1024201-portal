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

export function mountProgress(host, { label, etaMs }) {
  if (!host) return { done() {}, fail() {} };
  host.hidden = false;
  host.innerHTML = `
    <p class="loading-label">${label}</p>
    <div class="loading-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100">
      <div class="loading-bar-fill"></div>
    </div>
    <p class="loading-eta"></p>`;

  const fill = host.querySelector(".loading-bar-fill");
  const etaEl = host.querySelector(".loading-eta");
  const bar = host.querySelector(".loading-bar");
  const start = Date.now();
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    const elapsed = Date.now() - start;
    const pct = Math.min(94, (elapsed / etaMs) * 90);
    fill.style.width = `${pct}%`;
    bar.setAttribute("aria-valuenow", String(Math.round(pct)));
    const remain = Math.max(0, Math.ceil((etaMs - elapsed) / 1000));
    etaEl.textContent = remain > 0 ? `~${remain}s` : "…";
  };

  tick();
  const timer = setInterval(tick, 120);

  return {
    done() {
      stopped = true;
      clearInterval(timer);
      fill.style.width = "100%";
      bar.setAttribute("aria-valuenow", "100");
      etaEl.textContent = "";
      setTimeout(() => {
        host.hidden = true;
        host.innerHTML = "";
      }, 220);
    },
    fail() {
      stopped = true;
      clearInterval(timer);
      host.hidden = true;
      host.innerHTML = "";
    },
  };
}
