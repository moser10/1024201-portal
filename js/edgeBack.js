/**
 * Restore iOS edge-swipe back when document overflow tricks break Safari's gesture,
 * and provide the same affordance in standalone (Add to Home Screen) mode.
 */
(function mountEdgeBack() {
  if (window.__edgeBackMounted) return;
  window.__edgeBackMounted = true;

  const EDGE = 28;
  const MIN_DX = 70;
  const MAX_DY = 56;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  function canGoBack() {
    try {
      return window.history.length > 1;
    } catch {
      return false;
    }
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = startX <= EDGE;
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx >= MIN_DX && dy <= MAX_DY && canGoBack()) {
        window.history.back();
      }
    },
    { passive: true, capture: true }
  );
})();
