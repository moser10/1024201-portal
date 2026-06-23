-- D1 Console 执行：在线状态 + 章节元数据

CREATE TABLE IF NOT EXISTS room_presence (
  story_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (story_id, user_id)
);

ALTER TABLE stories ADD COLUMN chapters_json TEXT;
