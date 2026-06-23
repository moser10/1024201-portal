-- D1 Console 执行：修复缺 id 列的旧表 + 清理孤立房间
-- 会清空 story_members、recall_logs、content_stream 的数据（users/stories 保留）

-- 1. 删除「有书名但没有活跃房主」的孤立房间
DELETE FROM stories
WHERE id NOT IN (
  SELECT story_id FROM story_members WHERE role = 'owner' AND status = 'active'
);

-- 2. 重建成员表（含 id、role、UNIQUE 约束）
DROP TABLE IF EXISTS story_members;
CREATE TABLE story_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(story_id, user_id)
);

-- 3. 为仍存在的 stories 补回房主记录
INSERT INTO story_members (story_id, user_id, role, status)
SELECT id, owner_id, 'owner', 'active' FROM stories;

-- 4. 重建撤回日志表
DROP TABLE IF EXISTS recall_logs;
CREATE TABLE recall_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  recalled_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. 重建内容流表
DROP TABLE IF EXISTS content_stream;
CREATE TABLE content_stream (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
