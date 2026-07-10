/** Attachment grid display: ≤3 thumbs, 4–6 icons, >6 first thumb + count */

export function isImageMime(mime) {
  return String(mime || "").startsWith("image/");
}

export function fileIconSvg() {
  return `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6m-1 1v5h5M8 13h8v2H8v-2m0 4h5v2H8v-2"/></svg>`;
}

/**
 * @param {HTMLElement} host
 * @param {Array<{id,name,mime,url,size}>} files
 * @param {{ onDelete?: (id)=>void, readOnly?: boolean }} opts
 */
export function renderAttachGrid(host, files, opts = {}) {
  if (!host) return;
  const list = files || [];
  const n = list.length;
  host.innerHTML = "";

  if (!n) {
    host.classList.add("attach-grid--empty");
    return;
  }
  host.classList.remove("attach-grid--empty");

  if (n > 6) {
    const first = list[0];
    const cell = document.createElement("div");
    cell.className = "attach-cell attach-cell--stack";
    cell.innerHTML = thumbInner(first, true) + `<span class="attach-stack-count">+${n - 1}</span>`;
    if (!opts.readOnly && opts.onDelete) bindDelete(cell, first.id, opts.onDelete);
    host.appendChild(cell);
    return;
  }

  const mode = n <= 3 ? "thumb" : "icon";
  for (const f of list) {
    const cell = document.createElement("div");
    cell.className = `attach-cell attach-cell--${mode}`;
    cell.innerHTML = mode === "thumb" ? thumbInner(f, false) : iconInner(f);
    if (!opts.readOnly && opts.onDelete) bindDelete(cell, f.id, opts.onDelete);
    host.appendChild(cell);
  }
}

function thumbInner(f, stack) {
  if (isImageMime(f.mime)) {
    return `<img class="attach-thumb" src="${esc(f.url)}" alt="${esc(f.name)}" loading="lazy" />`;
  }
  return `<div class="attach-file-badge">${fileIconSvg()}<span>${esc(shortName(f.name))}</span></div>`;
}

function iconInner(f) {
  return `<div class="attach-icon" title="${esc(f.name)}">${fileIconSvg()}<span>${esc(shortName(f.name))}</span></div>`;
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
