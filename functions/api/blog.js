import { corsHeaders, requireDb, resolveUserId } from "./_shared.js";
import { requireRegisteredUser, newFileId } from "./r2files.js";

let blogSchemaJob = null;

async function ensureBlogSchemaInner(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS blogs (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        body_md TEXT NOT NULL DEFAULT '',
        images_json TEXT NOT NULL DEFAULT '[]',
        visibility TEXT NOT NULL DEFAULT 'private',
        status TEXT NOT NULL DEFAULT 'draft',
        like_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        published_at TEXT
      )`
    )
    .run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_blogs_user ON blogs(user_id, created_at DESC)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_blogs_public ON blogs(status, visibility, published_at DESC)`).run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS blog_likes (
        blog_id TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (blog_id, ip_hash)
      )`
    )
    .run();
}

/** Memoized — blog reads must stay a single cheap SELECT, not a migration suite. */
export async function ensureBlogSchema(db) {
  if (!blogSchemaJob) {
    blogSchemaJob = ensureBlogSchemaInner(db).catch((err) => {
      blogSchemaJob = null;
      throw err;
    });
  }
  return blogSchemaJob;
}

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("X-Real-IP") ||
    "0.0.0.0"
  );
}

async function hashIp(ip) {
  const data = new TextEncoder().encode(`blog-like:${ip}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

function parseImages(raw) {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function normalizeToMarkdown(input) {
  let text = String(input || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return "";
  const hasMd = /(?:^|\n)(#{1,3}\s|[-*+]\s|\d+\.\s|>\s|```)/.test(text);
  if (hasMd) {
    return text
      .split(/\n{3,}/)
      .map((b) => b.trim())
      .filter(Boolean)
      .join("\n\n");
  }
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.replace(/[ \t]+\n/g, "\n").replace(/\n+/g, "\n").trim())
    .filter(Boolean);
  return blocks
    .map((b) => {
      if (!b.includes("\n")) return b;
      return b
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("  \n");
    })
    .join("\n\n");
}

function publicBlog(row, { includeBody = true, liked = false } = {}) {
  if (!row) return null;
  const created = row.created_at;
  const updated = row.updated_at && row.updated_at !== row.created_at ? row.updated_at : null;
  const out = {
    id: row.id,
    title: row.title || "",
    visibility: row.visibility === "public" ? "public" : "private",
    status: row.status === "published" ? "published" : "draft",
    like_count: Number(row.like_count) || 0,
    liked: !!liked,
    created_at: created,
    updated_at: updated,
    published_at: row.published_at || null,
    author: row.username || undefined,
    images: parseImages(row.images_json),
  };
  if (includeBody) out.body_md = row.body_md || "";
  return out;
}

async function loadBlog(db, id) {
  return db
    .prepare(
      `SELECT b.*, u.username
       FROM blogs b
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.id = ?`
    )
    .bind(id)
    .first();
}

function fastJson(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = requireDb(env);
    // Hot path: ONLY blog tables. Never run full app/files migrations here.
    await ensureBlogSchema(db);

    if (request.method === "GET" && action === "mine") {
      const userId = await resolveUserId(request, env, url);
      const auth = await requireRegisteredUser(db, userId);
      if (!auth.ok) return fastJson(auth.body, auth.status);

      // Index-friendly order — no datetime()/COALESCE wrapping
      const { results } = await db
        .prepare(
          `SELECT id, title, visibility, status, like_count, created_at, updated_at, published_at
           FROM blogs WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 200`
        )
        .bind(userId)
        .all();

      return fastJson({
        blogs: (results || []).map((r) => publicBlog(r, { includeBody: false })),
      });
    }

    if (request.method === "GET" && action === "get") {
      const id = (url.searchParams.get("id") || "").trim();
      if (!id) return fastJson({ error: "missing_id" }, 400);
      const row = await loadBlog(db, id);
      if (!row) return fastJson({ error: "not_found" }, 404);

      const userId = await resolveUserId(request, env, url);
      const isOwner = userId && Number(userId) === Number(row.user_id);
      const isPublicLive = row.status === "published" && row.visibility === "public";

      if (!isOwner && !isPublicLive) {
        return fastJson({ error: "not_found" }, 404);
      }

      let liked = false;
      if (isPublicLive) {
        const ipHash = await hashIp(clientIp(request));
        const like = await db
          .prepare("SELECT 1 AS ok FROM blog_likes WHERE blog_id = ? AND ip_hash = ?")
          .bind(id, ipHash)
          .first();
        liked = !!like;
      }

      const payload = publicBlog(row, { includeBody: true, liked });
      payload.is_owner = !!isOwner;
      const headers = {};
      if (!isPublicLive) headers["X-Robots-Tag"] = "noindex, nofollow";
      return fastJson(payload, 200, headers);
    }

    if (request.method === "POST" && action === "save") {
      const body = await request.json();
      const userId = await resolveUserId(request, env, url, body);
      const auth = await requireRegisteredUser(db, userId);
      if (!auth.ok) return fastJson(auth.body, auth.status);

      const title = String(body?.title || "").trim().slice(0, 200);
      const visibility = body?.visibility === "public" ? "public" : "private";
      const mode = body?.mode === "publish" ? "publish" : "draft";
      let bodyMd = String(body?.body_md ?? "");
      const images = Array.isArray(body?.images)
        ? body.images.map(String).filter(Boolean).slice(0, 12)
        : [];
      const idIn = body?.id ? String(body.id).trim() : "";

      if (mode === "publish") {
        if (!title) return fastJson({ error: "title_required" }, 400);
        bodyMd = normalizeToMarkdown(bodyMd);
        if (!bodyMd.trim()) return fastJson({ error: "body_required" }, 400);
      } else {
        bodyMd = normalizeToMarkdown(bodyMd);
      }

      const imagesJson = JSON.stringify(images);
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);

      if (idIn) {
        const existing = await db.prepare("SELECT id, user_id, published_at, created_at, like_count FROM blogs WHERE id = ?").bind(idIn).first();
        if (!existing || Number(existing.user_id) !== Number(userId)) {
          return fastJson({ error: "not_found" }, 404);
        }

        const status = mode === "publish" ? "published" : "draft";
        const publishedAt =
          mode === "publish" ? existing.published_at || now : existing.published_at || null;

        await db
          .prepare(
            `UPDATE blogs SET
               title = ?, body_md = ?, images_json = ?, visibility = ?, status = ?,
               updated_at = ?, published_at = ?
             WHERE id = ? AND user_id = ?`
          )
          .bind(title, bodyMd, imagesJson, visibility, status, now, publishedAt, idIn, userId)
          .run();

        return fastJson({
          ok: true,
          blog: publicBlog({
            id: idIn,
            title,
            body_md: bodyMd,
            images_json: imagesJson,
            visibility,
            status,
            like_count: existing.like_count || 0,
            created_at: existing.created_at,
            updated_at: now,
            published_at: publishedAt,
            username: auth.user?.username,
          }),
        });
      }

      const id = newFileId();
      const status = mode === "publish" ? "published" : "draft";
      const publishedAt = mode === "publish" ? now : null;

      await db
        .prepare(
          `INSERT INTO blogs
             (id, user_id, title, body_md, images_json, visibility, status, like_count, created_at, updated_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)`
        )
        .bind(id, userId, title, bodyMd, imagesJson, visibility, status, now, publishedAt)
        .run();

      return fastJson({
        ok: true,
        blog: publicBlog({
          id,
          title,
          body_md: bodyMd,
          images_json: imagesJson,
          visibility,
          status,
          like_count: 0,
          created_at: now,
          updated_at: null,
          published_at: publishedAt,
          username: auth.user?.username,
        }),
      });
    }

    if (request.method === "POST" && action === "delete") {
      const body = await request.json();
      const userId = await resolveUserId(request, env, url, body);
      const auth = await requireRegisteredUser(db, userId);
      if (!auth.ok) return fastJson(auth.body, auth.status);

      const id = String(body?.id || "").trim();
      if (!id) return fastJson({ error: "missing_id" }, 400);
      const existing = await db.prepare("SELECT id FROM blogs WHERE id = ? AND user_id = ?").bind(id, userId).first();
      if (!existing) return fastJson({ error: "not_found" }, 404);

      await db.prepare("DELETE FROM blog_likes WHERE blog_id = ?").bind(id).run();
      await db.prepare("DELETE FROM blogs WHERE id = ?").bind(id).run();
      return fastJson({ ok: true });
    }

    if (request.method === "POST" && action === "like") {
      const body = await request.json().catch(() => ({}));
      const id = String(body?.id || url.searchParams.get("id") || "").trim();
      if (!id) return fastJson({ error: "missing_id" }, 400);

      const row = await db
        .prepare("SELECT id, status, visibility, like_count FROM blogs WHERE id = ?")
        .bind(id)
        .first();
      if (!row || row.status !== "published" || row.visibility !== "public") {
        return fastJson({ error: "not_found" }, 404);
      }

      const ipHash = await hashIp(clientIp(request));
      const existed = await db
        .prepare("SELECT 1 AS ok FROM blog_likes WHERE blog_id = ? AND ip_hash = ?")
        .bind(id, ipHash)
        .first();
      if (existed) {
        return fastJson({ ok: true, liked: true, like_count: Number(row.like_count) || 0, already: true });
      }

      await db.prepare("INSERT INTO blog_likes (blog_id, ip_hash) VALUES (?, ?)").bind(id, ipHash).run();
      await db.prepare("UPDATE blogs SET like_count = like_count + 1 WHERE id = ?").bind(id).run();
      return fastJson({ ok: true, liked: true, like_count: (Number(row.like_count) || 0) + 1 });
    }

    return fastJson({ error: "unknown_action" }, 404);
  } catch (err) {
    return fastJson({ error: err.message || "server_error" }, 500);
  }
}
