/** Confirm dialogs must live on document.body, above .feature-top. */
export function showPortalModal(el) {
  if (!el) return null;
  if (el.parentNode !== document.body) document.body.appendChild(el);
  el.hidden = false;
  return el;
}

export function hidePortalModal(el) {
  if (!el) return null;
  el.hidden = true;
  return el;
}
