-- 已有旧库时在 D1 Console 逐条执行（报 duplicate column 可跳过该条）
-- 生产环境通常无需手动执行：API 启动时会跑 ensureAppSchema / ensureAdminSchema

-- users
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_plain TEXT;
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN temp_password TEXT;
ALTER TABLE users ADD COLUMN temp_password_expires TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN email_verify_token TEXT;
ALTER TABLE users ADD COLUMN email_verify_expires TEXT;

-- stories
ALTER TABLE stories ADD COLUMN game_id TEXT NOT NULL DEFAULT 'osn';
ALTER TABLE stories ADD COLUMN chapters_json TEXT;

-- story_members（旧表缺列时）
ALTER TABLE story_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE story_members ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE story_members ADD COLUMN joined_at TEXT NOT NULL DEFAULT (datetime('now'));

CREATE TABLE IF NOT EXISTS room_presence (
  story_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (story_id, user_id)
);

CREATE TABLE IF NOT EXISTS pending_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verify_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL DEFAULT 'sa',
  password_hash TEXT,
  password_plain TEXT,
  temp_password TEXT,
  temp_password_used_at TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);

INSERT OR IGNORE INTO admin_auth (id, username, password_plain) VALUES (1, 'sa', '1qaz2wsx');

DELETE FROM users WHERE email_verified = 0;
