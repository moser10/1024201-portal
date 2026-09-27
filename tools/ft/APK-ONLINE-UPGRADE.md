# APK 在线升级（可复用）

给其它项目套同一套：网页发官方包，客户端比 `versionCode`，绿色可更新 / 灰色已是最新。系统安装器经常“启动成功”却不露面，所以失败必须落到「卸载后从门户再装」，并且只有在「有更新」这条路上才把登录写到卸载后还能读的地方。

## 角色

| 角色 | 作用 |
| --- | --- |
| 门户静态目录 | 放官方 APK 和 `*-tv.json`，不占用户容量 |
| JSON 清单 | `version`、`versionCode`、`file`、`download`、`notes` |
| 客户端壳 | 暴露当前 `versionCode`、下载安装、卸载残留登录 |
| 列表页按钮 | 远程 `versionCode` > 本地 → 绿色可点；否则灰色不可点 |

官方包路径示例：`/tools/<app>/dist/<file>`。用户自己传的文件走另一套存储，不要和官方包混在一个配额里。

## 版本

- `versionName`：给人看（1.9）
- `versionCode`：整数，只增不减，用来比新旧
- 编译脚本从 `app/build.gradle` 读这两个值，写出 APK 和 JSON
- 网页按钮文案跟 JSON，不要手写死版本号后忘记改

```json
{
  "version": "1.9",
  "versionCode": 10,
  "file": "ft-tv-debug.apk",
  "download": "ft-tv-1.9.apk",
  "notes": "给绿色按钮下面那行看的一句话",
  "builtAt": "ISO-8601"
}
```

`notes` 只写这次安装包修了什么。遥控器怎么选框不要写进去。

## 绿色 / 灰色

1. 打开已登录页时拉 JSON（`cache: no-store` 或 `?v=时间戳`）。
2. `remoteVersionCode > FtShell.versionCode()` → 绿色「有更新可用」，可点。
3. 否则灰色「暂无更新」，不可点。
4. 装上新包后本地 code 追上远程，同一按钮变灰。

旧壳如果没有 `versionCode()`，当成 0，按钮会一直绿，方便把人升级上来。

## 点绿色之后

按这个顺序，不要指望系统安装界面一定出现：

1. **先**把当前登录写入卸载残留（账号 JSON + 帐号 + 密码）。没写完再去下包。
2. 显示「更新中…」。
3. 壳把官方 APK 下到应用目录，有权限再抄一份到公共 `Download/`。
4. 先 `ACTION_INSTALL_PACKAGE`，失败再 `ACTION_VIEW`。
5. 安装界面没把本页盖住（大约 1 秒后还在前台），或下包/打开失败：**弹出「请卸载后重新安装」**。不要静默结束。
6. 人卸掉当前包，从门户把同一官方 APK 装上。残留文件还在，新包读到即可自动登录，不必再输密码。
7. 新包装好，按钮变灰。

点绿色时就要写残留。不要等安装成功再写：很多电视上安装根本不会成功。

## 卸载残留（只在「有更新」时活着）

应用 `SharedPreferences` 会随卸载删掉。要跨卸载，写到公共存储里多处，读的时候逐个试：

- `/sdcard/.1024201-ft/session.json`
- `/sdcard/Download/.1024201-ft-session.json`

Android 9 需要 `READ/WRITE_EXTERNAL_STORAGE`，`targetSdk 28`，`requestLegacyExternalStorage=true`。启动时申请权限；权限回调里再读一次残留并灌回 WebView。文件尽量 `setReadable(true, false)`，换 UID 之后还能读。

写入内容：`user`（门户登录 JSON）、`ident`、`pass`。新包先灌 `localStorage`，不够再用帐号密码静默登录。

## 灰色 + 卸载 = 丢掉登录

这是刻意的：

- 绿色（或人已经点了更新）：`keep`，卸载再装还能登录。
- 灰色（已经最新）：`drop`，删掉残留。再卸载就是干净的，要重新登录。

不要在「已是最新」时还把密码留在公共目录。

## 网页侧注意

- 电视 WebView 用经典脚本，不要 `type=module`，不要 `?.` / `??`。
- 壳接口用 JSON 字符串一次传齐（例如 `pull('{"url","name"}')`），不要依赖多参数 `JavascriptInterface`。
- 点更新失败时，没有壳也要 `alert('请卸载后重新安装')`。
- 门户下载链到 `/dist/` 官方文件，不要链到用户 `file_get`。

## 壳接口（最小集）

| 方法 | 方向 | 含义 |
| --- | --- | --- |
| `versionCode()` | JS←原生 | 当前安装包整数版本 |
| `pull(json)` | JS→原生 | 下载并尝试安装 |
| `keepLogin(ident, pass, userJson)` / `keepAcrossUninstall()` | JS→原生 | 写入卸载残留 |
| `dropAcrossUninstall()` | JS→原生 | 灰色时删残留 |
| `needManual()` | JS→原生 | 弹出「请卸载后重新安装」 |
| `saveSession` / `saveLogin` / `getSession` / `getLoginIdent` / `getLoginPass` / `clearSession` | 双向 | 应用内登录 |

## 本仓库怎么出包

```bash
npm run apk:ft
```

读 `tools/ft/android/app/build.gradle` 的 `versionName` / `versionCode`，编译后写入：

- `tools/ft/dist/ft-tv-debug.apk`
- `tools/ft/dist/ft-tv.json`（`notes` 来自 `tools/ft/android/update-notes.txt`）

改版本：只加 `versionCode`，改 `versionName`，写一句 `update-notes.txt`，再跑上面这条。部署门户后，旧包打开就会看到绿色按钮。

## 不要做的事

- 不要把官方 APK 算进用户配额。
- 不要把未确认的聊天解释写到按钮文案或更新说明。
- 不要只依赖「安装 Intent 没有抛错」当成升级成功。
- 不要在灰色状态下保留卸载残留。
