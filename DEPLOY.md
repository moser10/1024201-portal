# 部署说明

## Worker 名称（唯一）

生产环境只使用 **`one-sentence-novel`**（带连字符）。

- `wrangler.toml` 的 `name` 必须是 `one-sentence-novel`
- Cloudflare **Workers Builds** 请连接同一个 Worker，不要连接 `onesentencenovel`
- 若控制台里有多余的 `onesentencenovel` Worker，可在确认域名已绑在 `one-sentence-novel` 后删除

## 分支

| 分支 | 用途 |
|------|------|
| `main` | 主开发线，Worker 名 `one-sentence-novel` |
| `production` | 当前生产可用版本快照，便于回滚 |

## 邮件密钥 RESEND_API_KEY（必做，且只需做一次）

**必须用 Secret，不要用普通 Variable。**  
普通 Variable 在 `npx wrangler deploy` 或 Git Builds 部署时会被清掉，导致注册报「邮件服务未配置」。

### 方式一：命令行（推荐）

```bash
cd /Users/moser/CodeProjects/OneSentenceNovel
npx wrangler secret put RESEND_API_KEY
```

粘贴 Resend 的 `re_...` 密钥后回车。Secret 会持久保存，后续 deploy 不会删除。

### 方式二：控制台

Workers → **one-sentence-novel** → Settings → **Variables and Secrets** → Add → 类型选 **Secret**（加密）→ 名称 `RESEND_API_KEY`

### 验证

打开 `https://www.1024201.com/api/health`，应看到：

```json
"hasResendKey": true,
"worker": "one-sentence-novel",
"registerFlow": "pending_v2"
```

`hasResendKey` 为 `false` 时注册无法发验证邮件。

```bash
npx wrangler secret list
```

应列出 `RESEND_API_KEY`。

## 部署

```bash
npx wrangler deploy
```

自定义域名：Workers → one-sentence-novel → Domains & Routes。

**不要把 API 密钥写进 `wrangler.toml` 或提交到 Git。**
