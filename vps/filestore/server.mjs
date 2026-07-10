#!/usr/bin/env node
/**
 * 1024201 VPS file store — binary blobs only (metadata stays in D1).
 * Env: FILE_STORE_SECRET (required), FILE_STORE_DIR, FILE_STORE_PORT, FILE_STORE_MAX_BYTES
 */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const PORT = parseInt(process.env.FILE_STORE_PORT || "3921", 10);
const SECRET = process.env.FILE_STORE_SECRET || "";
const DATA_DIR = process.env.FILE_STORE_DIR || "/var/lib/1024-files";
const MAX_BYTES = parseInt(process.env.FILE_STORE_MAX_BYTES || String(5 * 1024 * 1024), 10);
const HOST = process.env.FILE_STORE_HOST || "127.0.0.1";

if (!SECRET || SECRET.length < 16) {
  console.error("FILE_STORE_SECRET required (min 16 chars)");
  process.exit(1);
}

await fsp.mkdir(DATA_DIR, { recursive: true });

function okAuth(req) {
  const h = req.headers.authorization || "";
  return h === `Bearer ${SECRET}`;
}

function safeId(id) {
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function safeUserId(raw) {
  const n = parseInt(String(raw || ""), 10);
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function diskPath(userId, fileId) {
  return path.join(DATA_DIR, userId, fileId);
}

async function readBodyLimited(req, max) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > max) throw new Error("too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function send(res, status, body, type = "text/plain") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, JSON.stringify({ ok: true, store: "1024-vps-filestore" }), "application/json");
    }

    if (!okAuth(req)) return send(res, 401, "unauthorized");

    const m = url.pathname.match(/^\/files\/([^/]+)$/);
    if (!m) return send(res, 404, "not_found");

    const fileId = safeId(decodeURIComponent(m[1]));
    if (!fileId) return send(res, 400, "invalid_id");

    if (req.method === "GET") {
      const userId = safeUserId(req.headers["x-user-id"]);
      const candidates = userId ? [diskPath(userId, fileId)] : [];
      if (!candidates.length) {
        const dirs = await fsp.readdir(DATA_DIR).catch(() => []);
        for (const d of dirs) {
          const p = diskPath(d, fileId);
          try {
            await fsp.access(p);
            candidates.push(p);
            break;
          } catch {
            /* continue */
          }
        }
      }
      const fp = candidates[0];
      if (!fp) return send(res, 404, "not_found");
      const stat = await fsp.stat(fp);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(stat.size),
        "Cache-Control": "private, max-age=3600",
      });
      fs.createReadStream(fp).pipe(res);
      return;
    }

    if (req.method === "PUT") {
      const userId = safeUserId(req.headers["x-user-id"]);
      if (!userId) return send(res, 400, "missing_user");
      const dir = path.join(DATA_DIR, userId);
      await fsp.mkdir(dir, { recursive: true });
      const fp = diskPath(userId, fileId);
      const body = await readBodyLimited(req, MAX_BYTES);
      await fsp.writeFile(fp, body);
      return send(res, 200, JSON.stringify({ ok: true, id: fileId, size: body.length }), "application/json");
    }

    if (req.method === "DELETE") {
      const userId = safeUserId(req.headers["x-user-id"]);
      if (userId) {
        const fp = diskPath(userId, fileId);
        await fsp.unlink(fp).catch(() => {});
        return send(res, 200, JSON.stringify({ ok: true }), "application/json");
      }
      const dirs = await fsp.readdir(DATA_DIR).catch(() => []);
      for (const d of dirs) {
        const fp = diskPath(d, fileId);
        try {
          await fsp.unlink(fp);
          return send(res, 200, JSON.stringify({ ok: true }), "application/json");
        } catch {
          /* continue */
        }
      }
      return send(res, 404, "not_found");
    }

    return send(res, 405, "method_not_allowed");
  } catch (e) {
    if (e.message === "too_large") return send(res, 413, "too_large");
    console.error(e);
    return send(res, 500, "error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`1024 filestore listening on ${HOST}:${PORT} dir=${DATA_DIR}`);
});
