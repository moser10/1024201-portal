export async function ensureOpenRoomSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS open_rooms (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        host_id INTEGER NOT NULL,
        host_name TEXT NOT NULL DEFAULT '',
        max_seats INTEGER NOT NULL DEFAULT 3,
        pin TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        closed_at TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS open_room_seats (
        room_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        last_seen TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (room_id, user_id)
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS open_room_msgs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();
}
