// functions/api/room.js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  
  // 1. 创建房间与书名查重
  if (request.method === "POST" && action === "create_room") {
    const { title, owner_id } = await request.json();
    // 书名唯一性校验
    const exist = await env.DB.prepare("SELECT id FROM stories WHERE title = ?").bind(title).first();
    if (exist) {
      // 同样生成一个随机推荐书名
      const rand = Math.floor(100 + Math.random() * 900);
      return new Response(JSON.stringify({ error: "书名已被占用", recommend: `${title}_${rand}` }), { status: 400 });
    }
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // 自动生成6位邀请码
    await env.DB.prepare("INSERT INTO stories (title, owner_id, invite_code) VALUES (?, ?, ?)")
      .bind(title, owner_id, inviteCode).run();
    return new Response(JSON.stringify({ success: true, invite_code: inviteCode }));
  }

  // 2. 用户发表：写书（Book）与发言（Chat）双通道流转
  if (request.method === "POST" && action === "publish") {
    const { story_id, user_id, type, text } = await request.json();

    // 🔴 惩罚机制校验：检查该用户当前是否处于“写书禁言状态”
    if (type === 'book') {
      const penalty = await env.DB.prepare(`
        SELECT COUNT(id) as count FROM recall_logs 
        WHERE user_id = ? AND recalled_at > datetime('now', '-30 minutes', 'localtime')
      `).bind(user_id).first();

      if (penalty && penalty.count >= 10) {
        return new Response(JSON.stringify({ error: "因半小时内撤回超过10次，写书功能已被冻结30分钟，但你仍可以聊天。" }), { status: 403 });
      }
    }

    await env.DB.prepare("INSERT INTO content_stream (story_id, user_id, type, text) VALUES (?, ?, ?, ?)")
      .bind(story_id, user_id, type, text).run();
    return new Response(JSON.stringify({ success: true }));
  }

  // 3. 高精撤回控制
  if (request.method === "POST" && action === "recall") {
    const { content_id, user_id } = await request.json();

    // 检查是否在半小时内
    const msg = await env.DB.prepare("SELECT created_at FROM content_stream WHERE id = ? AND user_id = ?")
      .bind(content_id, user_id).first();
    
    if (!msg) return new Response(JSON.stringify({ error: "未找到该条记录" }), { status: 404 });
    
    const timeDiff = (new Date() - new Date(msg.created_at)) / 1000 / 60; // 分钟差
    if (timeDiff > 30) {
      return new Response(JSON.stringify({ error: "已超过30分钟，无法撤回" }), { status: 400 });
    }

    // 执行撤回状态标记
    await env.DB.prepare("UPDATE content_stream SET status = 'recalled' WHERE id = ?").bind(content_id).run();
    // 写入审计日志，用于触发禁言限流
    await env.DB.prepare("INSERT INTO recall_logs (user_id) VALUES (?)").bind(user_id).run();

    return new Response(JSON.stringify({ success: true }));
  }
}
