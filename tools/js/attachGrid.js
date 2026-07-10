/** Attachment grid — syncnote: up to 3 image thumbnails */

export const SYNCNOTE_MAX_ATTACH = 3;

export function isImageMime(mime) {
  return String(mime || "").startsWith("image/");
}

export function fileIconSvg() {
  return `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6m-1 1v5h5M8 13h8v2H8v-2m0 4h5v2H8v-2"/></svg>`;
}

function fileUrl(f, userId) {
  const base = f.url || `/api/portal?action=file_get&id=${encodeURIComponent(f.id)}`;
  if (!userId || base.includes("user_id=")) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}user_id=${encodeURIComponent(userId)}`;
}

/**
 * @param {HTMLElement} host
 * @param {Array<{id,name,mime,url,size}>} files
 * @param {{ onDelete?: (id)=>void, readOnly?: boolean, userId?: number|string }} opts
 */
export function renderAttachGrid(host, files, opts = {}) {
  if (!host) return;
  const list = (files || []).slice(0, SYNCNOTE_MAX_ATTACH);
  host.innerHTML = "";

  if (!list.length) {
    host.classList.add("attach-grid--empty");
    return;
  }
  host.classList.remove("attach-grid--empty");

  for (const f of list) {
    const cell = document.createElement("div");
    cell.className = "attach-cell attach-cell--thumb";
    cell.innerHTML = thumbInner(f, opts.userId);
    if (!opts.readOnly && opts.onDelete) bindDelete(cell, f.id, opts.onDelete);
    host.appendChild(cell);
  }
}

function thumbInner(f, userId) {
  if (isImageMime(f.mime)) {
    const src = fileUrl(f, userId);
    return `<img class="attach-thumb" src="${esc(src)}" alt="${esc(f.name)}" loading="lazy" decoding="async" />`;
  }
  return `<div class="attach-file-badge">${fileIconSvg()}<span>${esc(shortName(f.name))}</span></div>`;
}

function bindDelete(cell, id, onDelete) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "attach-del";
  btn.setAttribute("aria-label", "Delete");
  btn.textContent = "×";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onDelete(id);
  });
  cell.appendChild(btn);
}

function shortName(name) {
  const s = String(name || "");
  return s.length > 10 ? `${s.slice(0, 8)}…` : s;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export async function uploadFile({ file, purpose, slot, userId, meta }) {
  const fd = new FormData();
  fd.append("file", file);
  if (meta) fd.append("meta", JSON.stringify(meta));
  const q = new URLSearchParams({ action: "file_upload", purpose, user_id: String(userId) });
  if (slot !== undefined && slot !== null) q.set("slot", String(slot));
  const res = await fetch(`/api/portal?${q}`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "upload_failed");
  return data.file;
}

export async function deleteFile({ id, userId }) {
  const res = await fetch("/api/portal?action=file_delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "delete_failed");
  return data;
}

export async function downloadFileEntry(file, userId) {
  const url = fileUrl(file, userId);
  const res = await fetch(url);
  if (!res.ok) throw new Error("download_failed");
  const blob = await res.blob();
  const name = file.name || `image-${file.id?.slice(0, 8) || "file"}.jpg`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  return name;
}
