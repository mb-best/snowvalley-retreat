# 雪隐山居：换设备继续开发

备份日期：2026-10-23（北京时间）

## 云端入口

- 体验：https://snowvalley-retreat.docilegoose18.chatgpt.site
- 项目下载：https://snowvalley-retreat.docilegoose18.chatgpt.site/project-backup.html
- 原有 Sites 项目 ID：`appgprj_6ad5cb63071c8191889cc362b2a066c6`
- 地图第二版的基础源码提交：`6d405985864e02aa031ff1b0c624ee6f46bb61e5`

此备份保持现有私有访问权限。在另一台设备使用同一有权访问的账号打开下载入口。压缩包包含完整静态源码、本地依赖、许可、说明、预览及重新打包脚本，不包含 Git 认证信息。

## 在另一台电脑继续

1. 下载 ZIP，解压 `snowvalley` 文件夹。
2. 用代码编辑器打开该文件夹。先读 `README.md`、本文件和 `docs/SECOND-VERSION.md`。
3. 已安装 Python 3 时，在项目文件夹运行 `python -m http.server 5186 --directory dist`，访问 `http://127.0.0.1:5186`。不需要安装前端依赖，不需要 AI API Key。请通过 HTTP 访问，避免直接双击 HTML。
4. 继续维护同一个云端项目时，保留 `.openai/hosting.json` 中的原项目 ID，通过 Sites 的现有项目源码流程取得最新版本和短期仓库凭据，再同步修改。不要新建站点，不要把凭据写入项目文件。

若在新的助手对话里继续，可以发送：

> 继续开发我的“雪隐山居 · 翻山听澜”。项目地址是 https://snowvalley-retreat.docilegoose18.chatgpt.site ，请读取这个现有 Sites 项目的云端源码，保留原项目 ID 与私有权限。迁移说明在项目 docs/CONTINUE.md。下一步先精修映雪海子周围约 500 米，提升材质、植被、水体和光照，保留 WebGL 兼容模式。

## 当前状态

- 连续程序地形约 16.4 × 20.5 公里；2000 米雪隐村、3800 米望雪垭口、5000 米照雪峰、山后听澜村及云落瀑布。
- 五重海拔地貌；3200 米映雪海子位于疏松林/花甸交界。
- 小地图/大地图缩放、位置与朝向、13 个地标、连续古道和翻山记录。
- 骑马、狗伙伴、牦牛喂养、植物采集、四季、昼夜、天气。
- 目前是可玩原型，尚未达到 Tidewater 的写实程度；详细路线见 `docs/SECOND-VERSION.md`。

## 关键文件

| 文件 | 内容 |
| --- | --- |
| `dist/math-v2.js` | 高程、地貌带、路线、湖泊/溪流、地标 |
| `dist/alpine-world.js` | 分块地形、植物、岩石、村庄、瀑布 |
| `dist/alpine-map.js` | 地形底图、实时位置、缩放 |
| `dist/world.js` | 共享基础场景、房屋、动物、四季、天空 |
| `dist/app.js` | 行走、互动、手记、声音、浏览器存档 |
| `dist/vendor/` | 已打包的 Three.js 和 Tidewater 辅助函数及许可 |
| `.openai/hosting.json` | 原云端站点身份与静态发布配置 |
| `scripts/package-backup.py` | 使用 Python 标准库生成新的源码 ZIP |

## 游戏进度边界

本包备份项目代码和素材。背包、狗伙伴、喂养与发现记录仍是当前浏览器的 `localStorage` 存档，键名为 `snowvalley-world-v1`。它们不在源码仓库中，也不会自动跨设备同步。此轮没有增加游戏存档同步功能。

## 再次打包

在项目文件夹运行：

`python scripts/package-backup.py --output ../snowvalley-project.zip`

脚本排除 `.git`、已有下载包、缓存和认证信息。静态下载包是生成日期的快照；以后代码有更新时，应重新生成并发布下载包。云端源码仓库才是继续维护时应先读取的最新来源。
