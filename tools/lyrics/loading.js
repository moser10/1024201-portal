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

/**
 * Flat progress bar — advances slowly toward ~92% over estimatedMs, completes on done().
 */
export function mountProgress(host, { label, estimatedMs = 10000 } = {}) {
  if (!host) return { done() {}, fail() {} };
  host.hidden = false;
  host.innerHTML = `
    <p class="loading-label">${label}</p>
    <div class="loading-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="loading-bar-fill"></div>
    </div>`;

  const fill = host.querySelector(".loading-bar-fill");
  const bar = host.querySelector(".loading-bar");
  const start = performance.now();
  let stopped = false;
  let raf = 0;

  const tick = (now) => {
    if (stopped) return;
    const elapsed = now - start;
    const pct = Math.min(92, Math.round((elapsed / estimatedMs) * 92));
    fill.style.width = `${pct}%`;
    bar.setAttribute("aria-valuenow", String(pct));
    if (pct < 92) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    done() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      fill.style.width = "100%";
      bar.setAttribute("aria-valuenow", "100");
      setTimeout(() => {
        host.hidden = true;
        host.innerHTML = "";
      }, 200);
    },
    fail() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      host.hidden = true;
      host.innerHTML = "";
    },
  };
}
