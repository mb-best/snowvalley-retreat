# 网页会话起点

2026-10-30。用户将 UE5 + Blender 制作移到新会话，本会话继续 Three.js 网页应用。分工见 [开发分流](DEVELOPMENT-LANES.md)。

## 已建立的独立工作副本

- 本机：共同工作区的 `snowvalley-web/`。
- 远端分支：`development/web-app-20261030`。
- 代码基线：线上 `main` 的 `0995ce5dfc2880099cfdae32c98a51a4d7d7b4c6`，保留 28 次历史提交及完整网页资源。原生生成文件没有混入。
- 在线体验：<https://mb-best.github.io/snowvalley-retreat/yunxiu-world.html?v=life-2>。
- 美术方向：<https://mb-best.github.io/snowvalley-retreat/yunxiu-art.html>。

本次工作只做工程分流、交接与基线复核；未修改 `dist/`，未替换线上游戏，也未改变已有浏览器存档。

## 本次实际检查

| 命令 | 结果和覆盖范围 |
| --- | --- |
| `node scripts/check-yunxiu-world.mjs` | 通过；revision 1597、源文件哈希、三村出生、模型文件/动画、地形三角面及植被海拔上限 |
| `node scripts/check-yunxiu-life.mjs` | 通过；活动世界无预设步道、20 湖岸高程/8.75 m 湖床、顺坡河流、85/106 m 瀑布地形、道路水平横断面/路肩、保存/撤销、跨水桥、跳跃、飞行边界、时光/天气规则 |
| `node scripts/check-yunxiu-scene.mjs` | 通过；真实模型解析及场景几何组装、村庄/山庄、到达点、倒影几何、shader 源码挂钩、道路横断面与地形恢复 |
| `node scripts/check-yunxiu-controls.mjs` | 通过；模拟 DOM/renderer 下的真实主程序初始化、视角/移动/飞行/游泳/修路/撤销/保存/设置事件 |
| `node scripts/migration/prepare-pages.mjs` 后 `node scripts/migration/check-migration.mjs` | 通过；可移植部署包、28 次历史记录、230 个本地资源引用、GitHub 子路径兼容、存档导入导出/冲突策略/额度失败回滚、排除登录数据 |

这些检查不是实际浏览器 GPU 绘制、画面质量或设备帧率验收。场景检查在一组固定位置统计可见约 214.8 万三角；这只是几何计数，不能据此宣称实际 FPS。

## 网页下一批工作的顺序

1. **局部美术样板**：沿用已选方向，先改善独立小范围的岩石/地表/水岸及日光层次；使用与实际网页相同的 Three.js 渲染路径，近/中/远距离对照。未达标的 v02/v03 苔藓试验不直接批量上图。
2. **资源与性能**：针对实测瓶颈调整树草实例数量、LOD、透明过绘、阴影及倒影更新，保持可选画质。不得把高面数或离线高采样当作实时美术成果。
3. **生活与建造体验**：保留并逐项完善已有移动、视角、骑乘、飞行、道路填挖/架桥/地图反馈及存档迁移，不擅自恢复预设步道。
4. **发布可体验成果**：按批次通过相关检查，再整合网页改进至 `main` 触发 Pages。保留上一版入口与历史，不合入原生制作目录来发布网页。

未经用户决定，不移动峰、村庄、山庄或改变定稿地形大形，不用美术升级改写地图。网页与原生版可共享经检验的资产来源和数据，但两端运行表现分别验证。
