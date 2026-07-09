# 部署说明 — 1024201 Portal

GitHub：`moser10/1024201-portal`  
Cloudflare Worker：`1024201-portal`  
域名：`1024201.com`（1024201 为回文数 / palindrome number）

## Worker 名称（唯一）

生产环境**只使用** **`1024201-portal`**。

- `wrangler.toml` 的 `name` 必须是 `1024201-portal`
- 旧 Worker `one-sentence-novel` 在迁移确认后可删除（见下方）
- Cloudflare **Workers Builds** 须连接 **`1024201-portal`**

## 域名与 Worker 绑定

| 域名 | Worker | 行为 |
|------|--------|------|
| `www.1024201.com` | **1024201-portal** | 门户首页 `/` |
| `1024201.com` | **1024201-portal** | 门户首页 `/`（与 www 相同） |
| `game.1024201.com` | **1024201-portal** | `/` → 301 → `/game/` 游戏大厅 |

### DNS 与 SSL（子域名打不开时必查）

1. **DNS 记录必须是橙色云（Proxied）**，灰云（DNS only）会导致 `www` / `game` SSL 握手失败。
2. `www`、`game` 建议：`CNAME` → `1024201.com`，Proxy 开启。
3. **SSL/TLS → Edge Certificates**：确认 Universal SSL 为 Active；新增子域名后证书可能要等 15 分钟～几小时。
4. 本机若曾解析失败，清 DNS 缓存：`sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`
5. 验证：`dig www.1024201.com @8.8.8.8` 应有 IP；`curl https://1024201.com/api/health` 应返回 JSON（不依赖 www）。

路由写在 **`wrangler.toml` 的 `[[routes]]`** 中，部署时才会保留；仅控制台配置会被 `wrangler deploy` 覆盖清空。

### 迁移自 one-sentence-novel

Worker 改名会创建新脚本名；**Secret 不会自动迁移**。部署 `1024201-portal` 后若 `/api/health` 中 `hasResendKey` 为 `false`：

```bash
npx wrangler secret put RESEND_API_KEY --name 1024201-portal
```

确认新 Worker 正常后，可删除旧 Worker：

```bash
npx wrangler delete one-sentence-novel
```

D1 数据库仍绑定 `database_id`（控制台名可能仍为 `one-sentence-novel`，无需改名）。

## 分支

| 分支 | 用途 |
|------|------|
| `main` | 主开发线 |
| `production` | 生产快照，便于回滚 |

## 邮件密钥 RESEND_API_KEY

**必须用 Secret**，不要用普通 Variable。

```bash
npx wrangler secret put RESEND_API_KEY --name 1024201-portal
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

部署后请用 **Cmd+Shift+R** 强刷 `www.1024201.com`，确认 `/api/health` 中 `"worker":"1024201-portal"`。

## PWA（添加到主屏幕）

| 文件 | 作用 |
|------|------|
| `manifest.webmanifest` | 应用名、图标、主题色、全屏模式 |
| `sw.js` | Service Worker（门户壳缓存；`/api/` 始终走网络） |
| `pwa.js` | 注册 Service Worker |
| `icons/` | 192 / 512 / apple-touch-icon |

**iPhone 安装：** Safari 打开 `https://1024201.com/` → 分享 → **添加到主屏幕** → 主屏幕图标名「1042」。
