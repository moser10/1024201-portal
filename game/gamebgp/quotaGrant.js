export const PDF_DEFAULT = 5;
export const LYRICS_DEFAULT = 5;
export const FT_DEFAULT_MB = 20;

export function dateOnly(value) {
  const match = String(value || "").trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "—";
}

export function displayFtMb(extra) {
  const n = Math.max(0, Number(extra) || 0);
  return n > 0 ? n : FT_DEFAULT_MB;
}

export function dialogFilledValue(tool, { pdfAllowed, lyricsAllowed, ftExtra } = {}) {
  if (tool === "ft") return displayFtMb(ftExtra);
  if (tool === "lyrics") return Math.max(LYRICS_DEFAULT, Number(lyricsAllowed) || LYRICS_DEFAULT);
  return Math.max(PDF_DEFAULT, Number(pdfAllowed) || PDF_DEFAULT);
}

/** Persist filled totals: FT extra is total MB; PDF/lyrics extra is add-on above 5. */
export function grantExtraFromFilled(tool, filled) {
  const n = Number.parseInt(String(filled ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 10000) return null;
  if (tool === "ft") return n;
  const base = tool === "lyrics" ? LYRICS_DEFAULT : PDF_DEFAULT;
  return Math.max(0, n - base);
}
