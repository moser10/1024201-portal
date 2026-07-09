# 1024 CLI 测试用例

前置：Node.js ≥ 18。在项目根目录执行 `npm link ./cli` 或 `node cli/bin/1024.js`（下文用 `1024` 代指）。

可选环境变量：`1024_API_BASE=https://1024201.com`（默认即此）。

---

## 0. 安装与帮助

| # | 命令 | 预期 |
|---|------|------|
| 0.1 | `1024 --version` | 输出 `1.0.0` |
| 0.2 | `1024 help` | 打印命令列表，退出码 0 |
| 0.3 | `1024 nope` | 报错 `Unknown command`，退出码非 0 |

---

## 1. 通用（无需登录）

| # | 命令 | 预期 |
|---|------|------|
| 1.1 | `1024 geo` | 显示城市/国家、IP、网络类型、纯净度 |
| 1.2 | `1024 geo --json` | 合法 JSON，含 `ip`、`label` |
| 1.3 | `1024 quota` | 两行：`lyrics` 与 `pdf` 配额 |
| 1.4 | `1024 quota --json` | JSON 含 `lyrics`、`pdf` 对象 |

---

## 2. 汇率

| # | 命令 | 预期 |
|---|------|------|
| 2.1 | `1024 fx rates` | 列出 USD 基准多币种汇率 |
| 2.2 | `1024 fx rates --base CNY` | 基准为 CNY |
| 2.3 | `1024 fx rates --json` | JSON 含 `base`、`rates` |

---

## 3. 音乐

| # | 命令 | 预期 |
|---|------|------|
| 3.1 | `1024 music chart` | 至少 1 条 `id	歌手 — 歌名` |
| 3.2 | `1024 music chart --json` | JSON 含 `tracks` 数组 |

---

## 4. 歌词（游客配额 1 次/日）

| # | 命令 | 预期 |
|---|------|------|
| 4.1 | `1024 lyrics quota` | 显示剩余次数 |
| 4.2 | `1024 lyrics search "稻香"` | 有结果列表 + Quota 行 |
| 4.3 | `1024 lyrics search "稻香" --artist "周杰伦"` | 结果更精确 |
| 4.4 | 记下 4.2 一条 `id`，执行 `1024 lyrics get <id>` | 输出歌词正文 |
| 4.5 | 同一 IP 再次搜索直至超额 | 报错含 `Daily quota` 或 `login` |

---

## 5. PDF

| # | 命令 | 预期 |
|---|------|------|
| 5.1 | `1024 pdf quota` | 显示 pdf 配额 |
| 5.2 | `1024 pdf convert test.docx` | 明确提示需在浏览器转换（非崩溃） |

---

## 6. 注册与鉴权（须邮箱）

| # | 命令 | 预期 |
|---|------|------|
| 6.0 | `1024 auth register`（交互式 TTY） | 分步：邮箱可用 → 昵称可用 → 两次密码一致 → 邮件 6 位码 → 注册成功并提示 `whoami` |
| 6.0a | 注册时输入已占用邮箱/昵称 | 分别提示不可用；昵称占用时显示推荐 |
| 6.0b | 注册时两次密码不一致 | 提示剩余重试次数（最多 5 次） |
| 6.0c | `1024 auth register --email new@example.com --username nick --password 'secret12'` | 非交互：校验后提示邮件已发 |
| 6.0d | 查收邮件，`1024 auth verify --email ... --code 123456` | 注册成功并 **自动登录**（写入 config） |
| 6.1 | `1024 auth whoami`（未登录） | 提示须 login |
| 6.2 | `1024 auth login --email ... --password ...` | 已有账号登录成功 |
| 6.3 | `1024 auth token` | 脱敏 token + 配置路径 |
| 6.4 | `1024 auth passwd`（已登录、TTY） | 输入当前密码 → 新密码两次确认 → 成功提示 |
| 6.5 | 用新密码 `1024 auth login` | 登录成功；旧密码失败 |

CLI 注册码规则：纯 6 位数字；排除豹子号（111111）、顺子（123456）、重复模式（121212）、常见吉利号等。网页注册仍为 4 位字母数字码。

---

## 7. 文本中转站（须登录）

| # | 命令 | 预期 |
|---|------|------|
| 7.1 | `1024 syncnote set "hello-cli" --slot 0` | `Slot 0 saved.` |
| 7.2 | `1024 syncnote get --slot 0` | 输出 `hello-cli` |
| 7.3 | `1024 syncnote get --slot 0 --json` | JSON 含三个 slots |
| 7.4 | 网页打开文本中转站同账号 | slot 0 内容一致 |
| 7.5 | `1024 syncnote clear --slot 0` | 清空成功 |
| 7.6 | `1024 syncnote get --slot 0` | 空行 |

---

## 8. 登出

| # | 命令 | 预期 |
|---|------|------|
| 8.1 | `1024 auth logout` | `Logged out.` |
| 8.2 | `1024 auth whoami` | 再次要求登录 |
| 8.3 | `1024 syncnote get --slot 0` | 须登录错误 |

---

## 9. 完整度检查清单

- [ ] 所有 **1.x–3.x** 无需登录即可通过  
- [ ] **4.x** 搜索计次与 `get` 不限次符合配额表  
- [ ] **6.x** token 写入且 `Authorization: Bearer` 生效  
- [ ] **7.x** 与网页 syncnote 数据一致  
- [ ] 错误信息可读（配额、登录、未知命令）  
- [ ] `--json` 输出可被 `jq` 解析  

---

## 10. 一键冒烟（复制执行）

```bash
1024 --version
1024 geo --json | head -c 80
1024 fx rates --base USD --json | head -c 80
1024 music chart --json | head -c 120
1024 lyrics quota
1024 pdf quota
# 登录后：
# 1024 auth login --email YOUR_EMAIL --password 'YOUR_PASS'
# 1024 syncnote set "smoke-$(date +%s)" --slot 1
# 1024 syncnote get --slot 1
```

---

## 11. API 对照（调试 curl）

```bash
curl -s "https://1024201.com/api/portal?action=geo" | jq .label
curl -s -X POST "https://1024201.com/api/auth?action=cli_login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOU","password":"PASS"}' | jq .token
# 将 TOKEN 代入：
curl -s "https://1024201.com/api/auth?action=cli_whoami" \
  -H "Authorization: Bearer TOKEN" | jq .user.username
```
