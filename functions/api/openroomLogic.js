export const ROOM_KINDS = Object.freeze(["dua", "chat"]);
export const ONLINE_GAMES = Object.freeze({
  dua: Object.freeze({ maxSeats: 3 }),
});
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SEAT_TTL_MS = 180_000;
export const MSG_MAX = 280;
export const TITLE_MAX = 24;
export const UNLIMITED_SEATS = 0;

export function makeRoomCode(rng = Math.random) {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeKind(kind) {
  const k = String(kind || "").trim().toLowerCase();
  return ROOM_KINDS.includes(k) ? k : null;
}

export function normalizePin(pin) {
  const raw = String(pin || "").trim();
  if (!raw) return "";
  if (!/^\d{4}$/.test(raw)) return null;
  return raw;
}

export function normalizeTitle(title) {
  const name = String(title || "").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > TITLE_MAX) return null;
  return name;
}

export function seatsForKind(kind) {
  if (kind === "chat") return UNLIMITED_SEATS;
  return ONLINE_GAMES[kind]?.maxSeats ?? 3;
}

export function isUnlimited(maxSeats) {
  return !Number(maxSeats);
}

export function parseCreate(body = {}) {
  const kind = normalizeKind(body.kind);
  const title = normalizeTitle(body.title);
  const pin = normalizePin(body.pin);
  if (!kind) return { error: "bad_kind" };
  if (!title) return { error: "bad_title" };
  if (pin === null) return { error: "bad_pin" };
  return { kind, title, pin, maxSeats: seatsForKind(kind) };
}

export function canJoin({ room, seats, pin, userId }) {
  if (!room || room.closed_at) return { ok: false, error: "closed" };
  const already = seats.some((s) => Number(s.user_id) === Number(userId));
  if (already) return { ok: true, already: true };
  if (!isUnlimited(room.max_seats) && seats.length >= room.max_seats) return { ok: false, error: "full" };
  if (room.pin && String(pin || "") !== String(room.pin)) return { ok: false, error: "pin" };
  return { ok: true };
}

export function publicRoom(row, seatCount) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    host_id: row.host_id,
    host_name: row.host_name || "",
    max_seats: row.max_seats,
    seats: seatCount,
    has_pin: Boolean(row.pin),
    created_at: row.created_at,
  };
}

export function sanitizeMsg(text) {
  const msg = String(text || "").replace(/\s+/g, " ").trim();
  if (!msg || msg.length > MSG_MAX) return null;
  return msg;
}

export function isFreshSeat(lastSeen, now = Date.now(), ttl = SEAT_TTL_MS) {
  const t = Date.parse(lastSeen);
  if (!Number.isFinite(t)) return false;
  return now - t <= ttl;
}
