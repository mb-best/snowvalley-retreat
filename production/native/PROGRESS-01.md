# 第一批可编辑地形与岩石样品

2026-10-29。此批交付完成从图片方案到**真实网格、贴图、独立资产与实际 CPU 渲染**的首轮转换。仍是样品，尚未通过最终美术验收，也没有替换网页游戏或生成新的原生可玩版本。

## 已执行的工作

- 安装官方 Blender 4.5.15 LTS Apple Silicon 便携版，核对官方 SHA256 和应用代码签名，版本命令运行成功。
- 导出全境原始地形、1km样板区和200m湖岸细节三份独立 GLB。全境基准保留128721顶点/256000三角及原始三角对角线；输出文件的顶点高程与相应输入完全一致。1m/5m样板来自现有含湖床水岸修正的地面函数，新增采样点不意味着新增地质细节。
- 下载 Poly Haven 的 Boulder 01（Rico Cilliers，CC0），取得实际 glTF 网格和2K底色、OpenGL法线、ARM贴图；逐文件校验后记录固定下载地址、大小和SHA256。下载模型实际66122三角，不沿用网页上另一规格的数量。
- 将岩石打包为自包含 GLB，保持原始扫描网格缓冲与三张贴图字节不变。另生成一份具有独立附着苔藓网格的样品，包含1282簇小型叶丛、薄层附着表面和微法线贴图，额外19203三角；可以分别修改岩体与苔藓。
- 使用 Mitsuba 3.9.1 的 CPU 路径追踪完成1400×980材质样品渲染。贴图与表面的UV配准已检查、修正；未用生成图片充当模型渲染。苔藓边缘、湿润分区、近景LOD与碰撞仍需后续打磨。

## 环境检查的实际结论

Blender并未完成场景导入：当前受限执行环境在启动时检测不到可用Metal设备，程序在 `supports_barycentric_whitelist` / `metal_is_supported` 处崩溃，尚未进入Python建模脚本。该Mac二进制只提供Metal后端，OpenGL选项不可用。CPU渲染改由不依赖GPU设备的Mitsuba完成；这不是Blender或Unreal游戏画面。

只检测到Xcode命令行工具，完整Xcode和Unreal编辑器尚未安装。开始检查时系统盘可用约13GB，Ti600约517.5GB。完整UE开发环境应另行安排足够空间；本轮没有向外接盘安装或下载大型UE工程。

已准备 [`run-blender-locally.command`](run-blender-locally.command)。在普通Mac终端运行它，可尝试调用已下载的Blender，生成独立地形 `.blend`，并将现有岩石/苔藓GLB导入保存为打包贴图的 `.blend` 和Cycles预览。该脚本已检查语法，实际本机执行结果仍待记录，不预报成功。

## 复现与校验

```sh
node scripts/export-native-terrain.mjs
node scripts/check-native-terrain.mjs
node scripts/export-native-study-glb.mjs
python3 scripts/fetch-native-assets.py
```

CPU材质渲染需Python环境安装 [`rendering/requirements.txt`](rendering/requirements.txt)：

```sh
python production/native/rendering/rock_study.py \
  --asset production/native/assets/boulder-01 \
  --output production/native/generated/material-study-v02 \
  --moss --width 1400 --spp 256
python3 scripts/check-native-assets.py
```

实际数据证据见 [`evidence/`](evidence/)。资产检查覆盖GLB布局、缓冲区范围、索引、有限数值、单位法线、位置边界和原始纹理字节一致性；Khronos官方验证器未运行，npm源返回403，未绕过该访问限制。这些检查不替代引擎碰撞、材质兼容、LOD、风动与帧率验收。

原始下载文件、可编辑GLB、实际渲染图和校验记录作为独立样品包保存。代码仓库保留源地址、固定校验值、生成脚本和制作记录；不将缓存、工具安装包或不存在的 `.blend` 当成交付资产。

资源来源：[Boulder 01](https://polyhaven.com/a/boulder_01)、[Poly Haven资产许可](https://polyhaven.com/license)。元数据获取使用Poly Haven API，保留 `Powered by Poly Haven`。
