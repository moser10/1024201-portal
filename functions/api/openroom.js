import { corsHeaders, json, requireDb, ensureAppSchema } from "./_shared.js";
import { ensureOpenRoomSchema } from "./openroomSchema.js";
import { parseCreate, canJoin, canReady, canStart, publicRoom, sanitizeMsg, makeRoomCode, isFreshSeat } from "./openroomLogic.js";

async function requireUser(db, userId) {
  const id = Number(userId);
  if (!id) return null;
  return db.prepare("SELECT id, username FROM users WHERE id = ?").bind(id).first();
}

async function pruneSeats(db, roomId) {
  const { results } = await db
    .prepare("SELECT user_id, last_seen FROM open_room_seats WHERE room_id = ?")
    .bind(roomId)
    .all();
  for (const row of results || []) {
    if (!isFreshSeat(row.last_seen)) {
      await db.prepare("DELETE FROM open_room_seats WHERE room_id = ? AND user_id = ?").bind(roomId, row.user_id).run();
    }
  }
}

async function loadSeats(db, roomId) {
  const { results } = await db
    .prepare("SELECT user_id, username, last_seen, ready FROM open_room_seats WHERE room_id = ? ORDER BY last_seen ASC")
    .bind(roomId)
    .all();
  return (results || []).filter((row) => isFreshSeat(row.last_seen));
}

async function loadRoom(db, roomId) {
  return db.prepare("SELECT * FROM open_rooms WHERE id = ?").bind(String(roomId || "").toUpperCase()).first();
}

async function sit(db, roomId, user) {
  await db
    .prepare(
      `INSERT INTO open_room_seats (room_id, user_id, username, last_seen, ready)
       VALUES (?, ?, ?, datetime('now'), 0)
       ON CONFLICT(room_id, user_id) DO UPDATE SET username = excluded.username, last_seen = datetime('now')`
    )
    .bind(roomId, user.id, user.username)
    .run();
}

async function uniqueCode(db) {
  for (let i = 0; i < 12; i++) {
    const id = makeRoomCode();
    const exist = await db.prepare("SELECT id FROM open_rooms WHERE id = ?").bind(id).first();
    if (!exist) return id;
  }
  return `${makeRoomCode()}${makeRoomCode()}`.slice(0, 4);
}

async function roomPayload(db, room, userId) {
  await pruneSeats(db, room.id);
  const seats = await loadSeats(db, room.id);
  const member = seats.some((s) => Number(s.user_id) === Number(userId));
  let messages = [];
  if (member) {
    const { results } = await db
      .prepare(
        "SELECT id, user_id, username, text, created_at FROM open_room_msgs WHERE room_id = ? ORDER BY id DESC LIMIT 40"
      )
      .bind(room.id)
      .all();
    messages = (results || []).reverse();
  }
  return {
    room: {
      ...publicRoom(room, seats.length),
      host: Number(room.host_id) === Number(userId),
      member,
    },
    seats: seats.map((s) => ({
      user_id: s.user_id,
      username: s.username,
      ready: Boolean(Number(s.ready)),
    })),
    messages,
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "list";

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = requireDb(env);
    await ensureAppSchema(db);
    await ensureOpenRoomSchema(db);

    if (request.method === "GET" && action === "list") {
      const kind = String(url.searchParams.get("kind") || "").toLowerCase();
      const { results } = await db
        .prepare(
          `SELECT * FROM open_rooms WHERE closed_at IS NULL
           ORDER BY created_at DESC LIMIT 40`
        )
        .all();
      const rooms = [];
      for (const row of results || []) {
        if (kind && row.kind !== kind) continue;
        await pruneSeats(db, row.id);
        const seats = await loadSeats(db, row.id);
        rooms.push(publicRoom(row, seats.length));
      }
      return json({ rooms });
    }

    if (request.method !== "POST") return json({ error: "method" }, 405);

    const body = await request.json().catch(() => ({}));
    const user = await requireUser(db, body.user_id);
    if (!user) return json({ error: "login_required" }, 401);

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
      await sit(db, id, user);
      const room = await loadRoom(db, id);
      return json(await roomPayload(db, room, user.id));
    }

    const room = await loadRoom(db, body.room_id);
    if (!room || room.closed_at) return json({ error: "closed" }, 404);

    if (action === "join") {
      await pruneSeats(db, room.id);
      const seats = await loadSeats(db, room.id);
      const gate = canJoin({ room, seats, pin: body.pin, userId: user.id });
      if (!gate.ok) return json({ error: gate.error }, gate.error === "pin" ? 403 : 409);
      await sit(db, room.id, user);
      return json(await roomPayload(db, room, user.id));
    }

    if (action === "leave") {
      await db.prepare("DELETE FROM open_room_seats WHERE room_id = ? AND user_id = ?").bind(room.id, user.id).run();
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
      return json(await roomPayload(db, room, user.id));
    }

    if (action === "start") {
      const gate = canStart({ room, userId: user.id });
      if (!gate.ok) return json({ error: gate.error }, gate.error === "host" ? 403 : 400);
      await db.prepare("UPDATE open_rooms SET started_at = datetime('now') WHERE id = ?").bind(room.id).run();
      room.started_at = room.started_at || "now";
      return json(await roomPayload(db, room, user.id));
    }

    if (action === "get") {
      return json(await roomPayload(db, room, user.id));
    }

    if (action === "heartbeat") {
      await pruneSeats(db, room.id);
      const seated = (await loadSeats(db, room.id)).some((s) => Number(s.user_id) === Number(user.id));
      if (!seated) return json({ error: "member" }, 403);
      await sit(db, room.id, user);
      return json(await roomPayload(db, room, user.id));
    }

    if (action === "say") {
      await sit(db, room.id, user);
      const seats = await loadSeats(db, room.id);
      if (!seats.some((s) => Number(s.user_id) === Number(user.id))) return json({ error: "member" }, 403);
      const text = sanitizeMsg(body.text);
      if (!text) return json({ error: "bad_text" }, 400);
      await db
        .prepare("INSERT INTO open_room_msgs (room_id, user_id, username, text) VALUES (?, ?, ?, ?)")
        .bind(room.id, user.id, user.username, text)
        .run();
      return json(await roomPayload(db, room, user.id));
    }

    return json({ error: "action" }, 400);
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
}
