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

  if (text?.trim()) {
    const fontSize = Math.max(14, Math.round(w / 22));
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
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
    const pad = 10;
    const tw = ctx.measureText(stampLine).width;
    const boxH = fs + pad * 2;
    const boxW = tw + pad * 2;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(pad, h - boxH - pad, boxW, boxH);
    ctx.fillStyle = "#fff";
    ctx.fillText(stampLine, pad * 2, h - pad - fs * 0.35);
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
    if (!loc && !time) return "";
    const hint = geo.proxy ? "（若使用代理/VPN，时间可能非真实所在地）" : "（按上传 IP 所在地时区）";
    if (time && tz) return `${loc} · ${time} ${hint}`;
    return loc ? `${loc} ${hint}` : "";
  } catch {
    return "";
  }
}
