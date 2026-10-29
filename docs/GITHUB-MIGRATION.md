# GitHub 独立部署与完整迁移

本迁移分支保留原有全部 Git 历史。迁移基线为 `74ce053caadc9c07b77f8dd03d8e0fd9791bf7c5`，此前有 26 个提交。原 Sites 项目不删除、不更改访问权限；GitHub 成为新增独立入口。

## 保留范围

完整 dist 游戏文件、Three.js/加载器、GLB/贴图/许可、晴日山谷、早期世界、云岫山境、地图工作台、1597 定稿与之前地图快照、八张概念图、制作规范、脚本与文档全部保留。原 index.html 在 GitHub 部署产物中原样另存为 classic-world.html，GitHub 首页使用独立入口页。源仓库中的原 index.html 不被替换。

Git 历史可通过正常 clone 完整获取；独立迁移 ZIP 还包含 `snowvalley-history.bundle`，即使以后源仓库不可访问也能恢复提交。MIGRATION-MANIFEST.json 逐文件记录 SHA-256；发布网页的 release-manifest.json 记录对应提交、全部版本和静态资源校验。

## GitHub 授权与可见性

已有 ChatGPT GitHub 连接不能代替本机 GitHub CLI 的登录，也没有本任务需要的新建仓库/配置 Pages 的全部接口。部署工具使用 GitHub 官方网页登录，不要求把密码、验证器验证码或令牌发到对话。若登录账号与 mb-best 不一致，会停止写入。

免费 GitHub Pages 使用公开仓库；源码、地图、手绘参考图、资源和历史会公开。私有仓库可保留完整项目，但 GitHub Pages 需要支持私有 Pages 的套餐。部署脚本要求明确选择 public/private，不会自动把私有项目改成公开。

## 发布

在本目录运行（已安装官方 GitHub CLI）：

```sh
python3 scripts/migration/deploy-github.py --visibility public
```

若选择私有，把 public 改为 private。Mac 可打开 deploy-github.command，明确选择可见性后继续。源码提交必须干净且经过检查；工具不会强推、覆盖不相关 main 或修改已有仓库可见性。

默认目标是新仓库 mb-best/snowvalley-retreat；可通过 --repository 指定另一个属于已登录账号的空仓库。发布顺序：认证、核对账号/仓库、推送完整历史、启用 Pages 的 GitHub Actions 来源、启动部署，等待匹配提交的工作流成功后才报告实际 Pages 地址。

GitHub Pages 使用 .github/workflows/github-pages.yml：验证基础地图和功能规则，生成 .pages，上传全部静态文件并部署。网站不依赖 Sites 登录或运行时 API；所有关键游戏资源在仓库内，早期界面字体可选依赖 Google Fonts，失败时回退系统字体。

上线后可在 GitHub Actions 手动运行 “Archive source assets and full Git history”，将源码/资源和 Git bundle 一起保存到 GitHub Release。源提交与资源校验表可用于逐版本回退。

## 存档迁移

浏览器 localStorage/IndexedDB 属于域名，不能随 Git 自动搬走：

1. 在旧域名 save-transfer.html 导出，再在新域名 save-transfer.html 导入。
2. 旧版本尚无该页面时，打开原域名页面，在开发者工具 Console 执行 dist/migration/export-console.js 的完整代码。该代码只读取 snowvalley-/yunxiu- 前缀及 snowvalley-terrain-backups 数据库，并下载 JSON；没有网络上传，也不读取登录信息。
3. 新入口选择导出 JSON。默认保留已有同名存档；若需覆盖，先导出新入口备份，再勾选覆盖。
4. 关闭其他游戏/地图标签后导出或导入，避免旧页面自动保存覆盖搬迁结果。导入后重新加载游戏，选择继续漫游。

文件包括背包/伙伴/探索记录、当前世界的位置与设置、自建道路与填挖记录、美术倾向记录、地形草稿与历史备份。若旧域名完全不可访问且此前从未导出，仓库无法凭空恢复该浏览器私有数据；项目的全部默认地图与版本历史仍完整保留。

## 独立备份与恢复

```sh
python3 scripts/migration/package-migration.py --output /absolute/path/snowvalley-migration.zip
```

解压后可从 snowvalley/ 目录直接运行本地服务器：

```sh
python3 -m http.server 5187 --directory dist
```

打开 http://127.0.0.1:5187/yunxiu-world.html。恢复完整 Git 历史：

```sh
git clone snowvalley-history.bundle restored-snowvalley
```

浏览器中的自建道路不写回公开 Git 仓库；其隐私随个人存档保留。新域名没有自动继承旧域名的存储。
