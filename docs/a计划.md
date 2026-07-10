# A计划

> 你说「**a计划**」时，按本文档逐步执行即可。  
> 状态：待办（VPS 清空后部署 + 给 Cloud Agent 部署权限）

---

## 一、VPS 文件存储部署

目标：图片/附件二进制存 VPS，D1 只留元数据。代码已在 `main`，配好 Secret 后**新上传**自动走 VPS。

### 1. VPS 安装 filestore 服务

SSH 登录 VPS（root）：

```bash
FILE_STORE_SECRET="$(openssl rand -hex 32)"
echo "请保存此 SECRET: $FILE_STORE_SECRET"

curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/main/vps/filestore/install.sh | bash -s --
```

安装后本地自检：

```bash
curl -s http://127.0.0.1:3921/health
# 期望: {"ok":true,"store":"1024-vps-filestore"}
```

### 2. Nginx + TLS 反代

参考仓库 `vps/filestore/nginx-snippet.conf`，在站点配置中加入（示例域名 `files.你的域名.com`）：

```nginx
location /files/ {
    proxy_pass http://127.0.0.1:3921/files/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    client_max_body_size 6m;
    proxy_read_timeout 120s;
}

location = /health {
    proxy_pass http://127.0.0.1:3921/health;
}
```

配置 HTTPS 证书后，确认：

```bash
curl -s https://files.你的域名.com/health
```

### 3. Worker Secret（Mac 本机）

```bash
cd ~/CodeProjects/1024
git pull

npx wrangler secret put FILE_STORE_URL --name 1024201-portal
# 输入: https://files.你的域名.com

npx wrangler secret put FILE_STORE_SECRET --name 1024201-portal
# 输入: 步骤 1 生成的 SECRET（与 VPS systemd 环境变量一致）

npm run deploy
```

### 4. 验证

```bash
curl -s https://1024201.com/api/health
```

期望 JSON 含：

```json
"fileStore": { "enabled": true, "url": "https://files.你的域名.com" }
```

重新上传一张作品展示图片，确认缩略图与分享页正常。

---

## 二、给 Cloud Agent 自动部署权限

目标：Agent 在云端改完代码后可直接 `npm run deploy`，无需你每次在 Mac 上手跑。

### 1. 创建 Cloudflare API Token

Cloudflare 控制台 → **My Profile → API Tokens → Create Custom Token**

| 权限 | 级别 |
|------|------|
| Account → Workers Scripts | Edit |
| Account → D1 | Edit |
| Zone → Workers Routes | Edit（zone: `1024201.com`） |

**不要**勾选 R2（本项目不用）。

### 2. 写入 Cursor Cloud Agent Environment Secret

Cursor → **Cloud Agents → Environment（或当前 Agent 运行环境）→ Secrets**

| 变量名 | 值 |
|--------|-----|
| `CLOUDFLARE_API_TOKEN` | 上一步生成的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | `d491b3cd3a9b579a90dd6dededac5537` |

保存后，新开一次 Cloud Agent 运行即可。

### 3. Agent 侧自检

Agent 应能执行：

```bash
npx wrangler whoami          # 已认证
npm run deploy               # 部署成功
curl -s https://1024201.com/api/health
```

### 4. 注意

- `RESEND_API_KEY`、`FILE_STORE_*` 等业务 Secret 仍用 `wrangler secret put`，**不会**被 deploy 删除。
- 未配 `CLOUDFLARE_API_TOKEN` 时，Agent 只能 **push 代码**，部署仍需你在 Mac 执行 `git pull && npm run deploy`。

---

## 三、相关文件

| 文件 | 说明 |
|------|------|
| `STORAGE.md` | 存储架构说明 |
| `DEPLOY.md` | 部署与 Secret 总则 |
| `vps/filestore/install.sh` | VPS 一键安装 |
| `vps/filestore/server.mjs` | 文件服务本体 |
| `functions/api/vpsStore.js` | Worker 调用 VPS 的客户端 |

---

*最后更新：与 commit `0a0fd91`（VPS 存储后端）同期建立。*
