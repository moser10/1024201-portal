/** Local cache + IndexedDB thumbnails for instant syncnote paint */

const LS_PREFIX = "syncnote_v1_";
const IDB_NAME = "portal_syncnote";
const IDB_STORE = "thumbs";
const THUMB_MAX_PX = 144;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }
  return dbPromise;
}

export function readLocalCache(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalCache(uid, data) {
  if (!uid) return;
  try {
    localStorage.setItem(`${LS_PREFIX}${uid}`, JSON.stringify({ ...data, cachedAt: Date.now() }));
  } catch {
    /* quota */
  }
}

export function patchLocalCache(uid, patch) {
  const prev = readLocalCache(uid) || {};
  writeLocalCache(uid, { ...prev, ...patch });
}

export async function getThumbBlob(fileId) {
  if (!fileId) return null;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(fileId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function putThumbBlob(fileId, blob) {
  if (!fileId || !blob) return false;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(blob, fileId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function deleteThumbBlob(fileId) {
  if (!fileId) return;
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export async function blobToThumbBlob(blob, maxPx = THUMB_MAX_PX) {
  if (!blob?.type?.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(maxPx / bitmap.width, maxPx / bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  } catch {
    return null;
  }
}

export async function fileToThumbBlob(file) {
  return blobToThumbBlob(file);
}
