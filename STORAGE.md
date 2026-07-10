# 存储架构

二进制文件（作品展示图片、中转站附件）可存 **VPS**；元数据（用户、作品记录、配额）仍在 **D1**。

## 模式对比

| 模式 | 条件 | 二进制 | 元数据 |
|------|------|--------|--------|
| D1 分块（默认） | 未配置 VPS Secret | `user_file_chunks` 表 | `user_files` 表 |
| VPS（推荐） | 已配置 `FILE_STORE_URL` + `FILE_STORE_SECRET` | VPS 磁盘 | `user_files.backend = 'vps'` |

**新上传**在 VPS 配置好后自动走 VPS；**旧文件**仍从 D1 分块读取，无需迁移即可共存。

## D1 5GB 与多域名

5 GB 按 **D1 数据库实例** 计算。本项目所有子域共用 Worker + 同一 `database_id`，因此 **共享 5 GB**，不是每个域名各 5 GB。

## VPS 安装（一次性）

在 VPS 上（root）：

```bash
FILE_STORE_SECRET="$(openssl rand -hex 32)"
curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/main/vps/filestore/install.sh | bash -s --
# 记下输出的 SECRET
```

用 Nginx 反代并配 TLS（见 `vps/filestore/nginx-snippet.conf`），例如：

- `https://files.你的域名.com` → `127.0.0.1:3921`

## Worker Secret（Mac 本机）

```bash
cd ~/CodeProjects/1024
npx wrangler secret put FILE_STORE_URL --name 1024201-portal
# 输入: https://files.你的域名.com

npx wrangler secret put FILE_STORE_SECRET --name 1024201-portal
# 输入: 与 VPS install 时相同的 SECRET

npm run deploy
```

验证：

```bash
curl -s https://1024201.com/api/health
# 应含 "fileStore": { "enabled": true, "url": "https://..." }
```

## 限制（当前）

| 项目 | 限制 |
|------|------|
| 单文件 | **5 MB** |
| 中转站附件 | 每用户最多 **3** 张图片 |
| VPS 目录 | 默认 `/var/lib/1024-files` |

## API Token（Cloudflare）

| 权限 | 需要 |
|------|------|
| D1 → Edit | ✅ |
| Workers Scripts → Edit | ✅ |
| Workers Routes → Edit | ✅ |
| R2 | ❌ 不需要 |

## 个人云盘扩展（后续）

VPS 60 GB 可按账号 `上传时间+7天` 滚动清理，人均 100–200 MB；实现时在 VPS 侧加 cron 即可，D1 仍只存索引。
