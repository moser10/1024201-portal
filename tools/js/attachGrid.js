/** Attachment grid — syncnote: up to 3 image thumbnails */

export const SYNCNOTE_MAX_ATTACH = 3;

export function isImageMime(mime) {
  return String(mime || "").startsWith("image/");
}

export function isMobileIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
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
 * @param {{ onDelete?: (id)=>void, onPreview?: (file)=>void, readOnly?: boolean, userId?: number|string }} opts
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
    cell.dataset.fileId = f.id;
    if (opts.onPreview && !opts.readOnly) cell.classList.add("attach-cell--preview");
    cell.innerHTML = thumbInner(f);
    if (!opts.readOnly && opts.onDelete) bindDelete(cell, f.id, opts.onDelete);
    if (opts.onPreview && !opts.readOnly) bindPreview(cell, f, opts.onPreview);
    host.appendChild(cell);
  }
}

export function applyThumbToCell(cell, url) {
  if (!cell || !url) return;
  const ph = cell.querySelector(".attach-thumb-ph");
  let img = cell.querySelector(".attach-thumb");
  if (!img) {
    img = document.createElement("img");
    img.className = "attach-thumb";
    img.decoding = "async";
    cell.insertBefore(img, cell.firstChild);
  }
  img.src = url;
  img.hidden = false;
  if (ph) ph.remove();
}

function thumbInner(f) {
  if (isImageMime(f.mime)) {
    if (f.thumbUrl) {
      return `<img class="attach-thumb" src="${esc(f.thumbUrl)}" alt="${esc(f.name)}" decoding="async" />`;
    }
    return `<div class="attach-thumb-ph" aria-hidden="true"></div>`;
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

function bindPreview(cell, file, onPreview) {
  cell.setAttribute("role", "button");
  cell.tabIndex = 0;
  cell.setAttribute("aria-label", file.name || "Preview image");
  const go = (e) => {
    if (e.target.closest(".attach-del")) return;
    e.preventDefault();
    onPreview(file);
  };
  cell.addEventListener("click", go);
  cell.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") go(e);
  });
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

export async function fetchFileBlob(file, userId) {
  const url = fileUrl(file, userId);
  const res = await fetch(url);
  if (!res.ok) throw new Error("download_failed");
  return res.blob();
}

export async function downloadFileEntry(file, userId, { userGesture = false } = {}) {
  const blob = await fetchFileBlob(file, userId);
  const name = file.name || `image-${file.id?.slice(0, 8) || "file"}.jpg`;
  const type = blob.type || file.mime || "image/jpeg";
  const fileObj = new File([blob], name, { type });

  if (userGesture && isMobileIos() && navigator.share && navigator.canShare?.({ files: [fileObj] })) {
    try {
      await navigator.share({ files: [fileObj] });
      return name;
    } catch (e) {
      if (e?.name === "AbortError") throw e;
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), isMobileIos() ? 8000 : 2000);
  return name;
}

export async function shareFileEntries(files, userId) {
  const blobs = [];
  for (const f of files) {
    const blob = await fetchFileBlob(f, userId);
    const name = f.name || `image-${f.id?.slice(0, 8) || "file"}.jpg`;
    blobs.push(new File([blob], name, { type: blob.type || f.mime || "image/jpeg" }));
  }
  if (!navigator.share || !navigator.canShare?.({ files: blobs })) return false;
  await navigator.share({ files: blobs });
  return true;
}
