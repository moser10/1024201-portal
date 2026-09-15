if ("serviceWorker" in navigator) {
  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  };
  // Register ASAP so home-screen launches can hit cache sooner
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
