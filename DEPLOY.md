# 部署说明

## Worker 名称（唯一）

生产环境**只使用** **`one-sentence-novel`**（带连字符）。

- `wrangler.toml` 的 `name` 必须是 `one-sentence-novel`
- **删除**多余的 `onesentencenovel` Worker（见下方）
- Cloudflare **Workers Builds** 必须连接 **`one-sentence-novel`**

## 域名与 Worker 绑定（控制台手动配置）

| 域名 | Worker | 行为 |
|------|--------|------|
| `www.1024201.com` | **one-sentence-novel** | 门户首页 `/` |
| `1024201.com` | **one-sentence-novel** | 301 → www |
| `game.1024201.com` | **one-sentence-novel** | `/` → 301 → `/game/` 游戏大厅 |

**Workers → one-sentence-novel → Settings → Domains & Routes** 中添加上述三个域名。  
若 `game.1024201.com` 仍绑在 `onesentencenovel` 上，请改绑到 `one-sentence-novel` 后再删旧 Worker。

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

**注意：** 域名绑定只在控制台维护时，`wrangler deploy` 可能会把远程 Routes 清空（日志出现 `No targets deployed`）。若站点无法访问，请到 **Domains & Routes** 重新添加 `www.1024201.com`、`1024201.com`、`game.1024201.com`。

部署后请用 **Cmd+Shift+R** 强刷 `www.1024201.com`，确认 `/api/health` 中 `"worker":"one-sentence-novel"`。
