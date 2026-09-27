# 超快传 FT

门户账号之间传 APK / 文件，避免 U 盘往投影仪来回拷。传输走门户 HTTPS（同 Wi‑Fi 和外网同一条路，前端不选手动协议）。

## 网页

- 入口：`/tools/ft/`（工具箱卡片）
- 首次用门户用户名或邮箱 + 密码登录
- 上传 / 列表 / 删除；退出回到 `/tools/`
- 默认容量 **20 MB**；管理后台「加额度」选 `ft` 加 MB

## 投影仪 / 电视 APK

已编好的投影壳：`/tools/ft/dist/ft-tv-debug.apk`（部署后也可从门户下载）。源码在 `android/`；本机可用 Android Studio 或 `gradle assembleDebug` 重编。

锁定主页：`https://1024201.com/tools/ft/?client=tv`（不能上网冲浪）。电视端只登录、列表、点文件下载/安装，没有上传和删除。

首次把这个壳 APK 用 U 盘装到投影上，并允许未知来源。之后编译的业务包走超快传即可。
