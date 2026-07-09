import { loadConfig } from "./config.js";

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest(path, { method = "GET", query, body, auth = true, headers: extraHeaders } = {}) {
  const cfg = loadConfig();
  const url = new URL(path, cfg.api_base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (extraHeaders) Object.assign(headers, extraHeaders);
  if (auth && cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(`Invalid JSON (${res.status})`, res.status, text);
  }

  if (!res.ok) {
    const msg = data.error || data.message || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export function portalGet(action, query, opts) {
  return apiRequest("/api/portal", { query: { action, ...query }, ...opts });
}

export function portalPost(action, body, query, opts) {
  return apiRequest("/api/portal", { method: "POST", query: { action, ...query }, body, ...opts });
}

export function authGet(action, opts) {
  return apiRequest("/api/auth", { query: { action }, ...opts });
}

export async function authPost(action, body, opts) {
  const payload = { client: "cli", ...body };
  const headers = { "X-1024201-Client": "cli" };
  return apiRequest("/api/auth", {
    method: "POST",
    query: { action },
    body: payload,
    headers,
    ...opts,
  });
}
