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

## 文件存储 Secret（VPS）

配置 VPS 文件服务后（见 `STORAGE.md`）：

```bash
npx wrangler secret put FILE_STORE_URL --name 1024201-portal
npx wrangler secret put FILE_STORE_SECRET --name 1024201-portal
```

验证：`/api/health` → `"fileStore": { "enabled": true, ... }`

## Cloud Agent 自动部署

Cursor **Cloud Agent** 在本仓库里可以 `git pull` / `git push`（已配置 GitHub 凭据），但 **`wrangler deploy` 需要 Cloudflare API Token**。

在 Cursor → **Cloud Agents → Environment**（或该 Agent 运行设置）添加 Secret：

| 变量 | 说明 |
|------|------|
| `CLOUDFLARE_API_TOKEN` | Custom Token：Workers Scripts Edit + D1 Edit + Workers Routes Edit |
| `CLOUDFLARE_ACCOUNT_ID` | `d491b3cd3a9b579a90dd6dededac5537`（可选，账号固定时可省略） |

添加后 Agent 即可在云端执行 `npm run deploy`。Worker 业务 Secret（`RESEND_API_KEY`、`FILE_STORE_*`）仍在 Cloudflare 控制台 / `wrangler secret put` 配置，**不会**随 deploy 丢失。

未配置 Token 时：Agent 只改代码并 push，部署仍需你在 Mac 上 `git pull && npm run deploy`。

## 部署时切勿删除密钥

- **禁止**在 `wrangler.toml` 添加 `[vars]` 或明文 `RESEND_API_KEY`
- **Worker Secret** 不会被 `wrangler deploy` 删除
- 删除密钥**只能**由站主在控制台手动操作

## 部署

```bash
npm run deploy
```

**Wrangler 参数说明（已在 wrangler 4.107 本机 `wrangler deploy --help` / `d1 execute --help` 核对）：**

| 命令 | 自动确认 |
|------|----------|
| `wrangler deploy` | **无** `--yes` 参数；已有 `wrangler.toml` 时直接部署，不需交互 |
| `wrangler d1 execute ...` | 用 **`-y`**（`--yes` 别名）跳过 D1 执行确认 |

部署时若 D1 仍提示 yes/no，是 post-deploy 里的 `d1 execute -y`，不是 `deploy --yes`。

### 新电脑一键安装（macOS：无需 sudo，官方 Node + wrangler + 1024 CLI）

```bash
cd ~
curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/main/install.sh | bash -s -- ~/CodeProjects/1024
```

macOS 顺序：下载官方 Node 到 `~/.local/node`（**无需 Homebrew / sudo**）→ 项目依赖 → `1024` 命令。

仅当系统没有 `git` 时，需一次性安装 Xcode Command Line Tools（`xcode-select --install`），然后重跑同一条 install 命令。

```bash
git clone https://github.com/moser10/1024201-portal.git ~/CodeProjects/1024
bash ~/CodeProjects/1024/scripts/setup-dev.sh
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
