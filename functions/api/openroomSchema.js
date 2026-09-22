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
        closed_at TEXT,
        started_at TEXT
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
        ready INTEGER NOT NULL DEFAULT 0,
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
  await addCol(db, "open_rooms", "started_at", "ALTER TABLE open_rooms ADD COLUMN started_at TEXT");
  await addCol(db, "open_room_seats", "ready", "ALTER TABLE open_room_seats ADD COLUMN ready INTEGER NOT NULL DEFAULT 0");
}

async function addCol(db, table, column, sql) {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all();
  if ((results || []).some((row) => row.name === column)) return;
  await db.prepare(sql).run();
}
