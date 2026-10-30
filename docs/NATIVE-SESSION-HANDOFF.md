# 新会话交接：UE5 桌面实时世界 + Blender 资产制作

更新：2026-10-30。用户已明确要求将本方向放在新会话推进，原会话继续网页应用。先阅读本文及同目录 [开发分工](DEVELOPMENT-LANES.md)，不要重新进行已经完成的授权或安装步骤。

## 本轮续作检查点（2026-10-30）

详见 [原生进度 03](../production/native/PROGRESS-03.md)。本会话已迁移至独立目录 `/Volumes/Ti600/wps 云文档/错题集/snowvalley-native`，原目录和网页目录保留不动。远端原生分支不变。

v04b 已生成细茎尖叶＋UV 苔毯 GLB，以及真实 CPU 中景/近景离线预览，通过网格与原资源字节身份检查。近景仍需改善，300,000 个苔藓三角需要优化，未通过最终美术验收。默认 Blender 输入继续保留 v02；本轮未生成新的 `.blend`、UE5 场景或可玩包。下一步优先改善细密苔毯结构和 LOD。

## 用户目标与已有决定

制作《雪隐山居 · 云岫山境》的桌面实时版本，采用 UE5 + Blender，接近用户在网页美术提案中选择的明媚多彩、梦幻写实方向。使用互联网许可清楚的免费资源，找不到匹配资源再自建。保持瑞士木石建筑意向、真实尺度、丰富且符合海拔/坡向的植被；样品先验收，再扩展世界。

- 美术提案：<https://mb-best.github.io/snowvalley-retreat/yunxiu-art.html>。
- 用户选择板号 01、02、03、04、05、07、08。建筑板 06 未勾选；原有瑞士风格要求保留，但不能当作所有建筑已通过图审。
- 本方向 GitHub：<https://github.com/mb-best/snowvalley-retreat/tree/production/native-art-path-20261029/production/native>。
- 上次原生制作实质成果提交：`7a2e455fe56f13f709dd6e5bbfa08e66311c80aa`。
- 不得把离线渲染、技术地形网格或成功生成文件描述成已完成 UE5 可玩世界。

## 目录与并行边界

共同工作区下 `snowvalley-github/` 保留原生制作代码、下载资源和生成结果。`snowvalley-web/` 是另一个会话的独立网页目录，不在其中修改文件或切换分支。远端原生分支 `production/native-art-path-20261029` 与网页分支 `development/web-app-20261030` 分开维护。

原生本地 Git HEAD 仍可能是迁移时的 `main`，制作文件显示未提交；这些源码已通过 GitHub 连接器保存在原生远端分支。先核实远端和本地状态，不要 `reset --hard`、`clean`，也不要将这些状态误判为工作丢失。保留已经生成的 `.blend`、贴图及工程备份。原生目录的 `origin` 曾指向本地 Sites checkout，更新前核实远端，不盲目 `git push origin`。

## 已完成且实测成功

### 本机 Blender

共同工作区的 `production-tools/blender-4.5.15/Blender/Blender.app/Contents/MacOS/Blender` 为官方 Apple Silicon Blender 4.5.15 LTS，官方 SHA256 及签名已验证。无需重装或重复下载。

用户已在普通 macOS 终端成功运行 `snowvalley-github/production/native/run-blender-locally.command`。产生：

| 文件（相对原生 checkout） | 状态 |
| --- | --- |
| `production/native/generated/local-20261030-003551/yunxiu-geography.blend` | 21,314,774 bytes，真实可编辑地形技术工程 |
| `production/native/generated/local-20261030-003551/rock-study/yunxiu-rock-moss.blend` | 21,338,913 bytes，岩石及独立苔藓网格，四张图片已打包 |
| `production/native/generated/local-20261030-003551/rock-study/blender-rock-moss.png` | 1400 × 980，Cycles CPU 96 采样，终端报告 19.71 秒 |

文件头、SHA256、实际图片均已核验，四张纹理原始字节均可在岩石 `.blend` 中找到。证据：`production/native/evidence/local-blender-success.json`。

两份工程和本机渲染备份位于共同工作区 `native-deliverables/yunxiu-blender-projects-v02.zip`；原始资源/GLB 备份 `native-deliverables/yunxiu-native-assets-v01.zip` 继续保留。它们已独立持久保存，不需重新打包同一文件。

### 地形与模型数据

- `scripts/export-native-terrain.mjs`：导出定稿地图、水系、生态及地形数据。
- `scripts/check-native-terrain.mjs`：检查坐标、源数据及地形编码误差。
- `scripts/export-native-study-glb.mjs`：输出全图精确源网格与局部技术样板 GLB。
- `production/native/blender/import_geography.py`：导入地形并保存工程。
- `production/native/blender/build_rock_asset.py`：导入 GLB、打包图片、保存并可选渲染。
- `scripts/check-native-assets.py`：二进制、网格、法线、纹理身份与边界检查；不是完整 Khronos 验证器、LOD、碰撞或游戏性能验收。

生成数据位于 `production/native/generated/revision-1597/`。整图、1 km 环境块、200 m 细节块三个 GLB 已核对高度，不存在额外浮点编码偏差。1 m/5 m 网格只是原数据的插值，不代表新增真实山体细节。

### 资产与实际质量

Poly Haven Boulder 01，Rico Cilliers，CC0-1.0。已取得 2K glTF、网格及原始底色/法线/ARM，位于 `production/native/assets/boulder-01/`。实际下载网格 66,122 三角，67,042 顶点，保持原始 UV。来源和哈希见 `production/native/asset-sources/boulder-01.json`。

当前 v02 苔藓边缘硬、绿片偏平，尚未达到美术要求。v03 垫状苔藓已有真实离线全景/近景检查，但圆团感像绿色颗粒，已否决，不可自动用于世界，也不是本机 runner 的默认输入。见 `production/native/evidence/moss-v03-review.json`。

下一轮应尝试细叶茎簇、苔毯贴图和破碎渐退边缘的结合，避免继续把绿色平片换成绿色小球。先做近景与中景样品并诚实复查，再扩展植物或批量放置。

## 工具边界与尚未完成

- 用户普通终端已经证明 Blender 能运行。受限执行进程中 Blender 在 Metal 检测阶段崩溃，不代表用户电脑不兼容；不要反复运行同一失败命令，不用后台服务或其他入口规避限制。
- 可准备具体的 Blender 制作任务；真的需要用户终端执行时再交付一次完整命令。原来的成功任务无需重跑。`run-blender-locally.command --rock-only` 已准备，仅岩石迭代可跳过地形重建；此参数尚未由用户实测。
- 工作区 Python 环境 `production-tools/material-renderer/bin/python` 有 Mitsuba 3.9.1 + drjit 1.5.0 + numpy + Pillow，可用 `scalar_rgb` 离线 CPU 渲染。先将 `DRJIT_CACHE_DIR` 设为工作区路径，再导入 mitsuba；不修改 HOME。
- `production/native/rendering/rock_study.py` 与 `natural_moss.py` 可复现离线试验。这些图片不是游戏截图。
- UE 编辑器和完整 Xcode 尚未配置；当前没有 native 可玩包。系统盘此前仅约 13 GiB 可用，外置盘有更大空间；安装前重新检查。不得把 CommandLineTools 等同完整 Xcode，也不要假定外置盘可由受限进程写入。
- 未读取到确切芯片型号/内存，不猜测。浏览器及电脑控制工具此前不可用，不以不受支持的 UI 自动化作为补救。

## 地图与坐标：不可丢失

定稿 revision 1597，331 features，401 × 321 F32，高度样本间隔 50 m，世界 20 × 16 km。源 SHA256：

`cf6959526d1ce86c1acaed4ac1743f38ba697a26260ce82396389c90b4c5f757`

数据：`dist/yunxiu/world-data.json`、`terrain-1597.f32`、`FINAL-MAP.json`。保留原地图全部数据；46 条原预设步道只归档，不带入活动世界。地形四边形采用 B–C 对角线，与网页 `Geography.baseHeight` 一致。

| 系统 | 坐标关系 |
| --- | --- |
| 原设计 | x 向东 0–20 km，y 向南 0–16 km，西北原点 |
| 米制基准 | east=(x−10)×1000；south=(y−8)×1000；aboveBase=绝对海拔−1700 |
| 网页 / glTF | X east，Y aboveBase，Z south |
| Blender | X east，Y −south，Z aboveBase |
| Unreal（厘米） | X east×100，Y south×100，Z aboveBase×100 |

UE Landscape 2521 × 2017 重采样方案会在原采样点引入最大约 35.025 m 的曲面差异，虽然 R16 量化误差只有约 6.25 cm。因此它只是预览，不能当作等价定稿地形。另有保留样本间距的 505 × 379 补边方案，但仍须验证三角线朝向。精确 F32 / 相同对角线网格始终为权威参考。

保留：栖云村、松烟村、溪隐村；栖月、听松、晴岚山庄；20 湖、7 河；106 m / 85 m 两瀑布；湖岸贴合、渐深湖床（最大 8.75 m）、河流与瀑布的地形衔接。树木最高 3500 m、草甸最高 4000 m，并按北纬 32° 的坡向、日照、湿度、土层渐变，不画整齐高度色带。

首个局部样板：晴岚山庄—风镜湖西岸，1 km 环境块中心 east=1150 m、south=−3200 m。山庄实位约 [1017.2768, −3107.3004]，地面绝对海拔 2867.25 m；最近岸点约 [1256.7629, −3254.5367]，平面距离 281.13 m，湖面 2780 m。不能为了好看把山庄挪到水边。

## 后续顺序

1. 从现有真实工程开始检查，不重做安装或重复成功任务。确认许可、尺寸、贴图、编辑性和近景画面。
2. 改善一组岩石/苔藓样品，随后做有枝叶层次的树、草花与一栋待审的木石屋。未通过近景的样品不批量铺世界。
3. 解决 UE5 / Xcode 的安装位置与可用环境，再做保持源地形的可运行小范围实时样板。光照、水岸、阴影、材质、行走视角与性能一起验收。
4. 达标后扩展区域，逐项移植网页已有生活玩法，不重写地图意图。

网页已有：三村随机出生、一/三人称、马与飞行操控样机、8000 m 飞行上限、1–20 速度、约 2.89 m 跳跃、实体石头、游泳、玩家道路及水平横断面填挖/桥梁/地图反馈/保存撤销、昼夜与随机天气、手选四季。原生尚未移植这些玩法，不能因网页存在而报告 UE5 已实现。

中文沟通，少做重复确认；持续明确“图片方向”“真实资产”“离线渲染”“实时场景”“可玩包”的不同完成状态。更新原生远端分支前读取最新 SHA，不覆盖网页或另一会话的工作。
