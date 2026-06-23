# 部署说明

## Worker 名称（唯一）

生产环境**只使用** **`one-sentence-novel`**（带连字符）。

- `wrangler.toml` 的 `name` 必须是 `one-sentence-novel`
- **删除**多余的 `onesentencenovel` Worker（见下方）
- Cloudflare **Workers Builds** 必须连接 **`one-sentence-novel`**

## 域名与 Worker 绑定

| 域名 | Worker | 行为 |
|------|--------|------|
| `www.1024201.com` | **one-sentence-novel** | 门户首页 `/` |
| `1024201.com` | **one-sentence-novel** | 门户首页 `/`（与 www 相同） |
| `game.1024201.com` | **one-sentence-novel** | `/` → 301 → `/game/` 游戏大厅 |

### DNS 与 SSL（子域名打不开时必查）

1. **DNS 记录必须是橙色云（Proxied）**，灰云（DNS only）会导致 `www` / `game` SSL 握手失败。
2. `www`、`game` 建议：`CNAME` → `1024201.com`，Proxy 开启。
3. **SSL/TLS → Edge Certificates**：确认 Universal SSL 为 Active；新增子域名后证书可能要等 15 分钟～几小时。
4. 本机若曾解析失败，清 DNS 缓存：`sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`
5. 验证：`dig www.1024201.com @8.8.8.8` 应有 IP；`curl https://1024201.com/api/health` 应返回 JSON（不依赖 www）。

路由写在 **`wrangler.toml` 的 `[[routes]]`** 中，部署时才会保留；仅控制台配置会被 `wrangler deploy` 覆盖清空。

### 删除 onesentencenovel

确认域名已全部迁到 `one-sentence-novel` 后：

```bash
npx wrangler delete onesentencenovel
```

或在控制台：Workers → `onesentencenovel` → Settings → Delete。

## 分支

| 分支 | 用途 |
|------|------|
| `main` | 主开发线 |
| `production` | 生产快照，便于回滚 |

## 邮件密钥 RESEND_API_KEY

**必须用 Secret**，不要用普通 Variable。

```bash
npx wrangler secret put RESEND_API_KEY
```

验证：`https://www.1024201.com/api/health` → `"hasResendKey": true`

## 部署时切勿删除密钥

- **禁止**在 `wrangler.toml` 添加 `[vars]` 或明文 `RESEND_API_KEY`
- **Worker Secret** 不会被 `wrangler deploy` 删除
- 删除密钥**只能**由站主在控制台手动操作

## 部署

```bash
npx wrangler deploy
```

部署后请用 **Cmd+Shift+R** 强刷 `www.1024201.com`，确认 `/api/health` 中 `"worker":"one-sentence-novel"`。

## 本地 wrangler 日志与密钥

Wrangler 在对比本地/远程配置时，可能把**明文 Variable** 的值写进本地日志（路径见下）。**绝不要把 API 密钥配成普通 Variable**，只用 Secret。

- macOS 日志目录：`~/Library/Preferences/.wrangler/logs/`
- 含密钥的日志应手动删除；若密钥曾出现在日志或 deploy 输出中，请在 Resend 控制台**轮换**该 API Key
- Wrangler **没有**对本地日志做自动脱敏；避免泄露的做法是：Secret 存 `wrangler secret put`、不写进 `wrangler.toml`、定期清空上述 logs 目录
