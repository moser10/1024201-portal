/** Per-user file storage remaining (syncnote / showcase). */

export function formatStorageMb(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${Math.round(mb)} MB`;
  if (mb >= 10) return `${mb.toFixed(1)} MB`;
  return `${mb.toFixed(2)} MB`;
}

export async function fetchFileStorage(userId, purpose) {
  const res = await fetch(
    `/api/portal?action=file_storage&purpose=${encodeURIComponent(purpose)}&user_id=${encodeURIComponent(userId)}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "storage_fetch_failed");
  return data;
}

export function storageLeftLabel(t, remaining) {
  if (typeof t.storageLeft === "function") return t.storageLeft(formatStorageMb(remaining));
  return `剩余 ${formatStorageMb(remaining)}`;
}

export function paintStorageMeta({ descEl, spaceEl, t, data }) {
  if (descEl) descEl.textContent = t.storageDesc || "";
  if (spaceEl && data) spaceEl.textContent = storageLeftLabel(t, data.remaining ?? 0);
}
