/** VPS file blob store — Worker calls with FILE_STORE_URL + FILE_STORE_SECRET */

function baseUrl(env) {
  const raw = String(env?.FILE_STORE_URL || "").trim();
  return raw.replace(/\/+$/, "");
}

export function vpsStoreEnabled(env) {
  return !!(baseUrl(env) && env?.FILE_STORE_SECRET);
}

function authHeaders(env) {
  return { Authorization: `Bearer ${env.FILE_STORE_SECRET}` };
}

export async function vpsPut(env, { fileId, userId, bytes, mime }) {
  const url = `${baseUrl(env)}/files/${encodeURIComponent(fileId)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeaders(env),
      "Content-Type": mime || "application/octet-stream",
      "X-User-Id": String(userId),
    },
    body: bytes,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`vps_put_${res.status}:${err.slice(0, 80)}`);
  }
}

export async function vpsGet(env, fileId, userId = null) {
  const url = `${baseUrl(env)}/files/${encodeURIComponent(fileId)}`;
  const headers = { ...authHeaders(env) };
  if (userId) headers["X-User-Id"] = String(userId);
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

export async function vpsDelete(env, fileId, userId = null) {
  const url = `${baseUrl(env)}/files/${encodeURIComponent(fileId)}`;
  const headers = { ...authHeaders(env) };
  if (userId) headers["X-User-Id"] = String(userId);
  const res = await fetch(url, { method: "DELETE", headers });
  return res.ok || res.status === 404;
}

export function fileStoreStatus(env) {
  return {
    enabled: vpsStoreEnabled(env),
    url: vpsStoreEnabled(env) ? baseUrl(env) : null,
  };
}
