import { corsHeaders, json, requireDb } from "./_shared.js";
import { ensureOpenRoomSchema } from "./openroomSchema.js";
import { parseCreate, canJoin, canReady, canStart, canCall, publicRoom, sanitizeMsg, makeRoomCode, callingActive } from "./openroomLogic.js";

function liveJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

async function listOpenRooms(db, kind) {
  const k = String(kind || "").toLowerCase();
  const { results } = await db
    .prepare(
      `SELECT id, kind, title, host_id, host_name, max_seats, pin, created_at, started_at, called_at
       FROM open_rooms
       WHERE closed_at IS NULL AND (? = '' OR kind = ?)
       ORDER BY created_at DESC LIMIT 40`
    )
    .bind(k, k)
    .all();
  return (results || []).map((row) => publicRoom(row, 0));
}

async function requireUser(db, userId) {
  const id = Number(userId);
  if (!id) return null;
  return db.prepare("SELECT id, username FROM users WHERE id = ?").bind(id).first();
}

function gone() {
  return json({ error: "account_gone" }, 401);
}

async function pruneSeats(db, roomId) {
  await db
    .prepare("DELETE FROM open_room_seats WHERE room_id = ? AND last_seen < datetime('now', '-180 seconds')")
    .bind(roomId)
    .run();
}

async function loadSeats(db, roomId) {
  const { results } = await db
    .prepare(
      `SELECT user_id, username, last_seen, ready, practice
       FROM open_room_seats WHERE room_id = ? ORDER BY last_seen ASC`
    )
    .bind(roomId)
    .all();
  return results || [];
}

async function loadRoom(db, roomId) {
  return db.prepare("SELECT * FROM open_rooms WHERE id = ?").bind(String(roomId || "").toUpperCase()).first();
}

function missingRoomsSchema(err) {
  return /no such table|no such column/i.test(String(err?.message || err));
}

async function sit(db, roomId, user, { practice } = {}) {
  const flag = practice === 1 ? 1 : practice === 0 ? 0 : null;
  if (flag == null) {
    await db
      .prepare(
        `INSERT INTO open_room_seats (room_id, user_id, username, last_seen, ready, practice)
         VALUES (?, ?, ?, datetime('now'), 0, 0)
         ON CONFLICT(room_id, user_id) DO UPDATE SET username = excluded.username, last_seen = datetime('now')`
      )
      .bind(roomId, user.id, user.username)
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO open_room_seats (room_id, user_id, username, last_seen, ready, practice)
       VALUES (?, ?, ?, datetime('now'), 0, ?)
       ON CONFLICT(room_id, user_id) DO UPDATE SET
         username = excluded.username,
         last_seen = datetime('now'),
         practice = excluded.practice`
    )
    .bind(roomId, user.id, user.username, flag)
    .run();
}

async function maybeClearCall(db, room, seats) {
  if (!room?.called_at) return room;
  if (callingActive(room.called_at, seats)) return room;
  await db.prepare("UPDATE open_rooms SET called_at = NULL WHERE id = ?").bind(room.id).run();
  return { ...room, called_at: null };
}

async function uniqueCode(db) {
  for (let i = 0; i < 12; i++) {
    const id = makeRoomCode();
    const exist = await db.prepare("SELECT id FROM open_rooms WHERE id = ?").bind(id).first();
    if (!exist) return id;
  }
  return `${makeRoomCode()}${makeRoomCode()}`.slice(0, 4);
}

async function roomPayload(db, room, userId, { prune = true, since = 0, chat = true } = {}) {
  if (prune) await pruneSeats(db, room.id);
  const seats = await loadSeats(db, room.id);
  room = await maybeClearCall(db, room, seats);
  const member = seats.some((s) => Number(s.user_id) === Number(userId));
  let messages = [];
  if (chat && member) {
    const after = Number(since) || 0;
    const { results } = after
      ? await db
          .prepare(
            "SELECT id, user_id, username, text, created_at FROM open_room_msgs WHERE room_id = ? AND id > ? ORDER BY id ASC LIMIT 80"
          )
          .bind(room.id, after)
          .all()
      : await db
          .prepare(
            "SELECT id, user_id, username, text, created_at FROM open_room_msgs WHERE room_id = ? ORDER BY id DESC LIMIT 40"
          )
          .bind(room.id)
          .all();
    messages = after ? results || [] : (results || []).reverse();
  }
  const out = {
    room: {
      ...publicRoom(room, seats.length, Date.now(), seats),
      host: Number(room.host_id) === Number(userId),
      member,
    },
    seats: seats.map((s) => ({
      user_id: s.user_id,
      username: s.username,
      ready: Boolean(Number(s.ready)),
      practice: Number(s.practice) === 1 ? 1 : 0,
    })),
  };
  if (chat) out.messages = messages;
  return out;
}

async function readBodyUser(request, url) {
  if (request.method === "GET") {
    return { user_id: url.searchParams.get("user_id"), room_id: url.searchParams.get("room_id"), since: url.searchParams.get("since") };
  }
  return request.json().catch(() => ({}));
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "list";

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = requireDb(env);

    if (request.method === "GET" && action === "list") {
      const kind = String(url.searchParams.get("kind") || "").toLowerCase();
      try {
        return liveJson({ rooms: await listOpenRooms(db, kind) });
      } catch (err) {
        if (!missingRoomsSchema(err)) throw err;
        await ensureOpenRoomSchema(db);
        return liveJson({ rooms: await listOpenRooms(db, kind) });
      }
    }

    const body = await readBodyUser(request, url);
    if (action === "create") await ensureOpenRoomSchema(db);

    const user = await requireUser(db, body.user_id);
    if (!user) return gone();

    const hotGet = request.method === "GET" && (action === "get" || action === "sync");
    if (request.method !== "POST" && !hotGet) return json({ error: "method" }, 405);

    try {
      return await handleRoomAction({ db, action, body, user, request, url });
    } catch (err) {
      if (!missingRoomsSchema(err)) throw err;
      await ensureOpenRoomSchema(db);
      return await handleRoomAction({ db, action, body, user, request, url });
    }
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}

async function handleRoomAction({ db, action, body, user, url }) {
    if (action === "create") {
      const parsed = parseCreate(body);
      if (parsed.error) return json({ error: parsed.error }, 400);
      const id = await uniqueCode(db);
      await db
        .prepare(
          `INSERT INTO open_rooms (id, kind, title, host_id, host_name, max_seats, pin)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, parsed.kind, parsed.title, user.id, user.username, parsed.maxSeats, parsed.pin || null)
        .run();
      await sit(db, id, user, { practice: 0 });
      const room = await loadRoom(db, id);
      return liveJson(await roomPayload(db, room, user.id));
    }

    const room = await loadRoom(db, body.room_id);
    if (!room || room.closed_at) return json({ error: "closed" }, 404);

    if (action === "join") {
      let seats = await loadSeats(db, room.id);
      const already = seats.some((s) => Number(s.user_id) === Number(user.id));
      if (!already) {
        await pruneSeats(db, room.id);
        seats = await loadSeats(db, room.id);
        const gate = canJoin({ room, seats, pin: body.pin, userId: user.id });
        if (!gate.ok) return json({ error: gate.error }, gate.error === "pin" ? 403 : 409);
      }
      await sit(db, room.id, user, { practice: 0 });
      return liveJson(await roomPayload(db, room, user.id, { prune: false }));
    }

    if (action === "leave") {
      await db.prepare("DELETE FROM open_room_seats WHERE room_id = ? AND user_id = ?").bind(room.id, user.id).run();
      const seats = await loadSeats(db, room.id);
      await maybeClearCall(db, room, seats);
      return json({ ok: true });
    }

    if (action === "close") {
      if (Number(room.host_id) !== Number(user.id)) return json({ error: "host" }, 403);
      await db.prepare("UPDATE open_rooms SET closed_at = datetime('now') WHERE id = ?").bind(room.id).run();
      await db.prepare("DELETE FROM open_room_msgs WHERE room_id = ?").bind(room.id).run();
      return json({ ok: true, wiped: true });
    }

    if (action === "ready") {
      const gate = canReady(room);
      if (!gate.ok) return json({ error: gate.error }, 400);
      const seated = (await loadSeats(db, room.id)).some((s) => Number(s.user_id) === Number(user.id));
      if (!seated) return json({ error: "member" }, 403);
      const on = body.ready === false || body.ready === 0 || body.ready === "0" ? 0 : 1;
      await db
        .prepare("UPDATE open_room_seats SET ready = ?, last_seen = datetime('now') WHERE room_id = ? AND user_id = ?")
        .bind(on, room.id, user.id)
        .run();
      return liveJson(await roomPayload(db, room, user.id));
    }

    if (action === "presence") {
      const seated = (await loadSeats(db, room.id)).some((s) => Number(s.user_id) === Number(user.id));
      if (!seated) return json({ error: "member" }, 403);
      const practice = body.practice === 1 || body.practice === true || body.practice === "1" ? 1 : 0;
      await sit(db, room.id, user, { practice });
      return liveJson(await roomPayload(db, await loadRoom(db, room.id), user.id, { prune: false, chat: false }));
    }

    if (action === "call") {
      const gate = canCall(room);
      if (!gate.ok) return json({ error: gate.error }, 400);
      const seated = (await loadSeats(db, room.id)).some((s) => Number(s.user_id) === Number(user.id));
      if (!seated) return json({ error: "member" }, 403);
      await db.prepare("UPDATE open_rooms SET called_at = datetime('now') WHERE id = ?").bind(room.id).run();
      return liveJson(await roomPayload(db, await loadRoom(db, room.id), user.id, { prune: false, chat: false }));
    }

    if (action === "start") {
      const gate = canStart({ room, userId: user.id });
      if (!gate.ok) return json({ error: gate.error }, gate.error === "host" ? 403 : 400);
      await db.prepare("UPDATE open_rooms SET started_at = datetime('now') WHERE id = ?").bind(room.id).run();
      room.started_at = room.started_at || "now";
      return liveJson(await roomPayload(db, room, user.id));
    }

    if (action === "get" || action === "sync") {
      const since = Number(body.since || url.searchParams.get("since") || 0);
      return liveJson(await roomPayload(db, room, user.id, { prune: action === "get", since: action === "sync" ? since : 0 }));
    }

    if (action === "heartbeat") {
      const practice = body.practice === 1 || body.practice === true || body.practice === "1" ? 1 : 0;
      await sit(db, room.id, user, { practice });
      const fresh = await loadRoom(db, room.id);
      return liveJson(await roomPayload(db, fresh, user.id, { prune: practice === 0, chat: false }));
    }

    if (action === "say") {
      await sit(db, room.id, user, { practice: 0 });
      const seats = await loadSeats(db, room.id);
      if (!seats.some((s) => Number(s.user_id) === Number(user.id))) return json({ error: "member" }, 403);
      const text = sanitizeMsg(body.text);
      if (!text) return json({ error: "bad_text" }, 400);
      await db
        .prepare("INSERT INTO open_room_msgs (room_id, user_id, username, text) VALUES (?, ?, ?, ?)")
        .bind(room.id, user.id, user.username, text)
        .run();
      return liveJson(await roomPayload(db, room, user.id, { prune: false }));
    }

    return json({ error: "action" }, 400);
}
