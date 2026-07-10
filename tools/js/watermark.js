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

function drawStampBlock(ctx, w, h, { stampLine = "", titleLine = "" } = {}) {
  const lines = [];
  if (titleLine?.trim()) {
    lines.push({ text: titleLine.trim(), fs: Math.max(10, Math.round(w / 52)) });
  }
  if (stampLine?.trim()) {
    lines.push({ text: stampLine.trim(), fs: Math.max(11, Math.round(w / 48)) });
  }
  if (!lines.length) return;

  const pad = Math.max(10, Math.round(w * 0.012));
  const gap = Math.max(3, Math.round(lines[0].fs * 0.35));
  const measured = lines.map((line) => {
    ctx.font = `500 ${line.fs}px system-ui, -apple-system, sans-serif`;
    return { ...line, tw: ctx.measureText(line.text).width };
  });
  const blockW = Math.max(...measured.map((l) => l.tw));
  const blockH = measured.reduce((sum, l, i) => sum + l.fs + (i ? gap : 0), 0);
  const corner = regionBrightness(ctx, w - blockW - pad * 2, h - blockH - pad * 2, blockW + pad, blockH + pad);
  const palette = stampPalette(corner);

  let y = h - pad;
  for (const line of measured) {
    const textX = w - pad - line.tw;
    ctx.save();
    ctx.font = `500 ${line.fs}px system-ui, -apple-system, sans-serif`;
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur = 3;
    ctx.fillStyle = palette.text;
    ctx.fillText(line.text, textX, y);
    ctx.restore();
    y -= line.fs + gap;
  }
}

export async function watermarkImage(file, { text = "", stampLine = "", titleLine = "" } = {}) {
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

  drawStampBlock(ctx, w, h, { stampLine, titleLine });

  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.9));
  if (!blob) throw new Error("encode_failed");
  const ext = mime === "image/png" ? "png" : "jpg";
  const base = (file.name || "work").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}-wm.${ext}`, { type: mime });
}

/** Time only (uses upload IP timezone via geo API, no location text). */
export async function fetchStampTime() {
  try {
    const res = await fetch("/api/portal?action=geo");
    const geo = await res.json();
    return geo.localTime || "";
  } catch {
    return "";
  }
}

/** @deprecated use fetchStampTime */
export async function fetchStampLine() {
  return fetchStampTime();
}
