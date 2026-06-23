-- 在 D1 Console 执行本文件（已有旧表时补列）
-- 若报错 "duplicate column" 说明该列已存在，可忽略那条继续执行下一条

ALTER TABLE story_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE story_members ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE story_members ADD COLUMN joined_at TEXT NOT NULL DEFAULT (datetime('now'));

-- 若上面 ALTER 报错太多，且 story_members 里还没有重要数据，可改用下面整段重建：
-- DROP TABLE IF EXISTS story_members;
-- CREATE TABLE story_members (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   story_id INTEGER NOT NULL,
--   user_id INTEGER NOT NULL,
--   role TEXT NOT NULL DEFAULT 'member',
--   status TEXT NOT NULL DEFAULT 'active',
--   joined_at TEXT NOT NULL DEFAULT (datetime('now')),
--   UNIQUE(story_id, user_id)
-- );
