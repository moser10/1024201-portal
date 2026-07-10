/** Client-side image watermark before upload */

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    img.src = url;
  });
}

function regionBrightness(ctx, x, y, w, h) {
  const sw = Math.max(1, Math.min(w, 120));
  const sh = Math.max(1, Math.min(h, 60));
  const sx = Math.max(0, Math.min(x, w - sw));
  const sy = Math.max(0, Math.min(y, h - sh));
  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n += 1;
  }
  return n ? sum / n : 128;
}

function watermarkPalette(brightness) {
  const light = brightness > 140;
  return light
    ? { fill: "rgba(0,0,0,0.28)", stroke: "rgba(255,255,255,0.22)" }
    : { fill: "rgba(255,255,255,0.34)", stroke: "rgba(0,0,0,0.2)" };
}

function stampPalette(brightness) {
  const light = brightness > 140;
  return light
    ? { text: "rgba(0,0,0,0.72)", shadow: "rgba(255,255,255,0.55)" }
    : { text: "rgba(255,255,255,0.88)", shadow: "rgba(0,0,0,0.55)" };
}

export async function watermarkImage(file, { text = "", stampLine = "" } = {}) {
  const img = await loadImageFromFile(file);
  const maxEdge = 2400;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (Math.max(w, h) > maxEdge) {
    const scale = maxEdge / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  const overall = regionBrightness(ctx, w * 0.25, h * 0.25, w * 0.5, h * 0.5);

  if (text?.trim()) {
    const fontSize = Math.max(14, Math.round(w / 22));
    const palette = watermarkPalette(overall);
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = 1;
    const step = fontSize * 5;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 7);
    for (let y = -h; y < h; y += step) {
      for (let x = -w; x < w; x += step * 1.8) {
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();
  }

  if (stampLine?.trim()) {
    const fs = Math.max(11, Math.round(w / 48));
    ctx.font = `500 ${fs}px system-ui, -apple-system, sans-serif`;
    const pad = Math.max(10, Math.round(w * 0.012));
    const tw = ctx.measureText(stampLine).width;
    const textX = w - pad - tw;
    const textY = h - pad;
    const corner = regionBrightness(ctx, textX - pad, textY - fs - pad, tw + pad * 2, fs + pad * 2);
    const palette = stampPalette(corner);
    ctx.save();
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur = 3;
    ctx.fillStyle = palette.text;
    ctx.fillText(stampLine, textX, textY);
    ctx.restore();
  }

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.9));
  if (!blob) throw new Error("encode_failed");
  const ext = mime === "image/png" ? "png" : "jpg";
  const base = (file.name || "work").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}-wm.${ext}`, { type: mime });
}

export async function fetchStampLine() {
  try {
    const res = await fetch("/api/portal?action=geo");
    const geo = await res.json();
    const loc = geo.label || geo.country || "";
    const time = geo.localTime || "";
    const tz = geo.timezone || "";
    const parts = [];
    if (loc) parts.push(loc);
    if (time) parts.push(tz ? `${time} (${tz})` : time);
    return parts.join(" · ");
  } catch {
    return "";
  }
}
