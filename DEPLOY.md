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

## 密钥

`RESEND_API_KEY` 配置在 **one-sentence-novel** → Settings → Variables and Secrets（Secret 类型）。

## 部署

```bash
cd /Users/moser/CodeProjects/OneSentenceNovel
npx wrangler deploy
```

自定义域名在控制台配置：Workers → one-sentence-novel → Domains & Routes。
