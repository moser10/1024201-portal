import { json, requireDb, ensureAppSchema, resolveUserId } from "./_shared.js";
import { vpsStoreEnabled, vpsPut, vpsGet, vpsDelete } from "./vpsStore.js";

/** D1 免费存储：单文件上限（整库免费约 5GB，不宜过大） */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const SYNCNOTE_MAX_FILES = 12;
const CHUNK_BYTES = 48 * 1024;
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);

export async function ensureFilesSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_files (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        purpose TEXT NOT NULL,
        slot INTEGER,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        meta TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  const { results: cols } = await db.prepare("PRAGMA table_info(user_files)").all();
  if (!cols.some((c) => c.name === "meta")) {
    await db.prepare(`ALTER TABLE user_files ADD COLUMN meta TEXT NOT NULL DEFAULT '{}'`).run().catch(() => {});
  }
  if (!cols.some((c) => c.name === "backend")) {
    await db.prepare(`ALTER TABLE user_files ADD COLUMN backend TEXT NOT NULL DEFAULT 'd1'`).run().catch(() => {});
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_file_chunks (
        file_id TEXT NOT NULL,
        chunk_idx INTEGER NOT NULL,
        data BLOB NOT NULL,
        PRIMARY KEY (file_id, chunk_idx)
      )`
    )
    .run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_files_owner ON user_files(user_id, purpose, slot)`).run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS showcase_works (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        file_id TEXT NOT NULL,
        watermark TEXT NOT NULL DEFAULT '',
        stamp_enabled INTEGER NOT NULL DEFAULT 0,
        stamp_label TEXT NOT NULL DEFAULT '',
        views INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_showcase_user ON showcase_works(user_id)`).run();
}

export function newFileId() {
  return crypto.randomUUID();
}

export async function requireRegisteredUser(db, userId) {
  if (!userId) return { ok: false, status: 403, body: { error: "login_required", needLogin: true } };
  const row = await db.prepare("SELECT id, username FROM users WHERE id = ?").bind(userId).first();
  if (!row) return { ok: false, status: 403, body: { error: "login_required", needLogin: true } };
  return { ok: true, user: row };
}

function fileRow(r) {
  let meta = {};
  try {
    meta = JSON.parse(r.meta || "{}");
  } catch {
    /* ignore */
  }
  return {
    id: r.id,
    name: r.name,
    mime: r.mime,
    size: r.size,
    purpose: r.purpose,
    slot: r.slot,
    meta,
    createdAt: r.created_at,
    url: `/api/portal?action=file_get&id=${encodeURIComponent(r.id)}`,
  };
}

export async function listUserFiles(db, userId, purpose, slot = null) {
  let q = "SELECT * FROM user_files WHERE user_id = ? AND purpose = ?";
  const binds = [userId, purpose];
  if (slot !== null && slot !== undefined) {
    q += " AND slot = ?";
    binds.push(slot);
  }
  q += " ORDER BY created_at ASC";
  const { results } = await db.prepare(q).bind(...binds).all();
  return results.map(fileRow);
}

async function bytesToBase64(u8) {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < u8.length; i += step) {
    bin += String.fromCharCode(...u8.subarray(i, i + step));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function writeChunks(db, fileId, bytes) {
  const total = bytes.byteLength;
  let idx = 0;
  for (let offset = 0; offset < total; offset += CHUNK_BYTES) {
    const slice = bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, total));
    const b64 = await bytesToBase64(slice);
    await db
      .prepare(`INSERT INTO user_file_chunks (file_id, chunk_idx, data) VALUES (?, ?, ?)`)
      .bind(fileId, idx, b64)
      .run();
    idx += 1;
  }
}

async function readChunks(db, fileId) {
  const { results } = await db
    .prepare(`SELECT data FROM user_file_chunks WHERE file_id = ? ORDER BY chunk_idx ASC`)
    .bind(fileId)
    .all();
  if (!results.length) return null;
  const parts = [];
  for (const r of results) {
    const d = r.data;
    if (typeof d === "string") {
      parts.push(base64ToBytes(d));
      continue;
    }
    if (d instanceof ArrayBuffer) {
      parts.push(new Uint8Array(d));
      continue;
    }
    if (d instanceof Uint8Array) {
      parts.push(d);
      continue;
    }
    if (ArrayBuffer.isView(d)) {
      parts.push(new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
    }
  }
  if (!parts.length) return null;
  const len = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(len);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.byteLength;
  }
  return out;
}

async function deleteChunks(db, fileId) {
  await db.prepare(`DELETE FROM user_file_chunks WHERE file_id = ?`).bind(fileId).run();
}

function fileBackend(row) {
  return row?.backend === "vps" ? "vps" : "d1";
}

async function readFileBody(env, db, row) {
  if (fileBackend(row) === "vps" && vpsStoreEnabled(env)) {
    return vpsGet(env, row.id, row.user_id);
  }
  return readChunks(db, row.id);
}

async function writeFileBody(env, db, row, bytes) {
  if (fileBackend(row) === "vps") {
    await vpsPut(env, { fileId: row.id, userId: row.user_id, bytes, mime: row.mime });
    return;
  }
  await writeChunks(db, row.id, bytes);
}

async function deleteFileBody(env, db, row) {
  if (fileBackend(row) === "vps" && vpsStoreEnabled(env)) {
    await vpsDelete(env, row.id, row.user_id);
    return;
  }
  await deleteChunks(db, row.id);
}

export async function handleFileUpload(env, request, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  await ensureFilesSchema(db);

  const userId = await resolveUserId(request, env, url);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);

  const purpose = url.searchParams.get("purpose") || "syncnote";
  const slotRaw = url.searchParams.get("slot");
  const slot = slotRaw !== null && slotRaw !== "" ? parseInt(slotRaw, 10) : null;

  if (purpose === "syncnote") {
    if (slot !== 2) return json({ error: "invalid_slot" }, 400);
    const existing = await listUserFiles(db, userId, "syncnote", 2);
    if (existing.length >= SYNCNOTE_MAX_FILES) return json({ error: "too_many_files", max: SYNCNOTE_MAX_FILES }, 413);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "no_file" }, 400);

  const mime = file.type || "application/octet-stream";
  if (purpose === "showcase" && !IMAGE_MIMES.has(mime)) {
    return json({ error: "images_only" }, 400);
  }

  const size = file.size || 0;
  if (size <= 0 || size > MAX_FILE_BYTES) {
    return json({ error: "file_too_large", maxMb: MAX_FILE_BYTES / (1024 * 1024) }, 413);
  }

  const id = newFileId();
  const name = file.name || "upload";
  const meta = form.get("meta");
  const metaStr = typeof meta === "string" ? meta : "{}";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const backend = vpsStoreEnabled(env) ? "vps" : "d1";

  await db
    .prepare(
      `INSERT INTO user_files (id, user_id, purpose, slot, name, mime, size, meta, backend)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, userId, purpose, slot, name.slice(0, 200), mime, size, metaStr, backend)
    .run();

  const row = { id, user_id: userId, mime };
  try {
    await writeFileBody(env, db, row, bytes);
  } catch {
    await db.prepare("DELETE FROM user_files WHERE id = ?").bind(id).run();
    return json({ error: "storage_failed" }, 500);
  }

  const saved = await db.prepare("SELECT * FROM user_files WHERE id = ?").bind(id).first();
  return json({ ok: true, file: fileRow(saved), backend });
}

export async function handleFileGet(env, request, url) {
  const db = requireDb(env);
  await ensureFilesSchema(db);

  const id = url.searchParams.get("id");
  if (!id) return json({ error: "missing_id" }, 400);

  const row = await db.prepare("SELECT * FROM user_files WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "not_found" }, 404);

  if (row.purpose !== "showcase") {
    const userId = await resolveUserId(request, env, url);
    if (userId !== row.user_id) return json({ error: "forbidden" }, 403);
  }

  const body = await readFileBody(env, db, row);
  if (!body) return json({ error: "not_found" }, 404);

  const cache = row.purpose === "showcase" ? "public, max-age=86400" : "private, max-age=3600";
  return new Response(body, {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(body.byteLength),
      "Cache-Control": cache,
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.name)}"`,
    },
  });
}

export async function handleFileDelete(env, request, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  await ensureFilesSchema(db);

  const body = await request.json().catch(() => ({}));
  const userId = await resolveUserId(request, env, url, body);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);

  const id = body.id || url.searchParams.get("id");
  if (!id) return json({ error: "missing_id" }, 400);

  const row = await db.prepare("SELECT * FROM user_files WHERE id = ? AND user_id = ?").bind(id, userId).first();
  if (!row) return json({ error: "not_found" }, 404);

  await deleteFileBody(env, db, row);
  await db.prepare("DELETE FROM user_files WHERE id = ?").bind(id).run();
  await db.prepare("DELETE FROM showcase_works WHERE file_id = ?").bind(id).run();
  return json({ ok: true, id });
}

export async function handleFileList(env, request, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  await ensureFilesSchema(db);

  const userId = await resolveUserId(request, env, url);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);

  const purpose = url.searchParams.get("purpose") || "syncnote";
  const slotRaw = url.searchParams.get("slot");
  const slot = slotRaw !== null && slotRaw !== "" ? parseInt(slotRaw, 10) : null;
  const files = await listUserFiles(db, userId, purpose, slot);
  return json({ files });
}

export async function handleShowcasePublish(env, request, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  await ensureFilesSchema(db);

  const body = await request.json().catch(() => ({}));
  const userId = await resolveUserId(request, env, url, body);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);

  const fileId = body.file_id;
  if (!fileId) return json({ error: "missing_file" }, 400);

  const file = await db
    .prepare("SELECT * FROM user_files WHERE id = ? AND user_id = ? AND purpose = ?")
    .bind(fileId, userId, "showcase")
    .first();
  if (!file) return json({ error: "not_found" }, 404);

  const workId = newFileId();
  const title = String(body.title || "").slice(0, 120);
  const watermark = String(body.watermark || "").slice(0, 80);
  const stampEnabled = body.stamp_enabled ? 1 : 0;
  const stampLabel = String(body.stamp_label || "").slice(0, 120);

  await db
    .prepare(
      `INSERT INTO showcase_works (id, user_id, title, file_id, watermark, stamp_enabled, stamp_label)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(workId, userId, title, fileId, watermark, stampEnabled, stampLabel)
    .run();

  return json({
    ok: true,
    id: workId,
    viewUrl: `/tools/showcase/view.html?id=${workId}`,
    apiUrl: `/api/portal?action=showcase_get&id=${workId}`,
  });
}

export async function handleShowcaseGet(env, request, url) {
  const db = requireDb(env);
  await ensureFilesSchema(db);

  const id = url.searchParams.get("id");
  if (!id) return json({ error: "missing_id" }, 400);

  const work = await db
    .prepare(
      `SELECT w.*, u.username, f.name AS file_name, f.mime, f.size
       FROM showcase_works w
       JOIN users u ON u.id = w.user_id
       JOIN user_files f ON f.id = w.file_id
       WHERE w.id = ?`
    )
    .bind(id)
    .first();
  if (!work) return json({ error: "not_found" }, 404);

  await db.prepare("UPDATE showcase_works SET views = views + 1 WHERE id = ?").bind(id).run();

  return json({
    id: work.id,
    title: work.title,
    watermark: work.watermark,
    stampEnabled: !!work.stamp_enabled,
    stampLabel: work.stamp_label,
    author: work.username,
    views: work.views + 1,
    createdAt: work.created_at,
    imageUrl: `/api/portal?action=file_get&id=${encodeURIComponent(work.file_id)}`,
    fileName: work.file_name,
    mime: work.mime,
    size: work.size,
  });
}

export async function handleShowcaseMine(env, request, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  await ensureFilesSchema(db);

  const userId = await resolveUserId(request, env, url);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);

  const { results } = await db
    .prepare(
      `SELECT w.id, w.title, w.watermark, w.stamp_enabled, w.stamp_label, w.views, w.created_at, f.id AS file_id
       FROM showcase_works w
       JOIN user_files f ON f.id = w.file_id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC
       LIMIT 50`
    )
    .bind(userId)
    .all();

  return json({
    works: results.map((w) => ({
      id: w.id,
      title: w.title,
      views: w.views,
      createdAt: w.created_at,
      thumbUrl: `/api/portal?action=file_get&id=${encodeURIComponent(w.file_id)}`,
      viewUrl: `/tools/showcase/view.html?id=${w.id}`,
    })),
  });
}

export async function clearSyncnoteFiles(env, db, userId, slot) {
  const files = await listUserFiles(db, userId, "syncnote", slot);
  for (const f of files) {
    const row = await db.prepare("SELECT * FROM user_files WHERE id = ?").bind(f.id).first();
    if (row) await deleteFileBody(env, db, row);
    await db.prepare("DELETE FROM user_files WHERE id = ?").bind(f.id).run();
  }
}

export async function handleShowcaseDelete(env, request, url) {
  const db = requireDb(env);
  await ensureAppSchema(db);
  await ensureFilesSchema(db);

  const body = await request.json().catch(() => ({}));
  const userId = await resolveUserId(request, env, url, body);
  const auth = await requireRegisteredUser(db, userId);
  if (!auth.ok) return json(auth.body, auth.status);

  const workId = body.work_id || body.id;
  if (!workId) return json({ error: "missing_id" }, 400);

  const work = await db
    .prepare("SELECT * FROM showcase_works WHERE id = ? AND user_id = ?")
    .bind(workId, userId)
    .first();
  if (!work) return json({ error: "not_found" }, 404);

  const fileRowData = await db.prepare("SELECT * FROM user_files WHERE id = ?").bind(work.file_id).first();
  if (fileRowData) await deleteFileBody(env, db, fileRowData);
  await db.prepare("DELETE FROM user_files WHERE id = ?").bind(work.file_id).run();
  await db.prepare("DELETE FROM showcase_works WHERE id = ?").bind(workId).run();
  return json({ ok: true, id: workId });
}
