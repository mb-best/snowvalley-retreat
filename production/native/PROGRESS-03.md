# 原生制作进度 03：岩石苔藓 v04 技术样品

2026-10-30。继续 UE5＋Blender 制作，网页会话保持独立。

## 独立目录与基线

本会话工作目录：`/Volumes/Ti600/wps 云文档/错题集/snowvalley-native`。
远端分支仍为 `production/native-art-path-20261029`，读取基线为 `980f5d93236860e1bc6fba33c7e36117078bc8ba`。

旧原生目录 `/Users/mbbest/Documents/Codex/2026-10-24/new-chat/snowvalley-github` 在本会话中只能读取，因此新建独立 checkout。通过 GitHub 连接器读取完整树，逐文件核对旧目录内容，恢复了与远端 SHA 完全一致的浅克隆基线；原工程、原资源和已有生成结果均复制保留。旧原生目录和 `snowvalley-web` 未改动，不切换其分支。新 checkout 的 origin 已改为真正的 GitHub 仓库。

## 实际完成

- 保留 v02、v03，新增 `leaf_moss.py`：毫米级细茎和折面尖叶，按岩面法线附着，边缘用连续概率渐退，不生成球团或整片绿色面。
- 新增 `moss_carpet.py`：沿扫描件原 UV 烘焙苔毯底色和遮罩；保留岩面明暗、裸露区域和破碎边缘，原贴图不改写。
- `rock_study.py --moss-style leaf` 生成两层样品，GLB 保留原网格缓冲和原始三张贴图字节，额外嵌入派生苔毯贴图及苔藓微法线。
- 已完成 CPU 离线中景、近景渲染。无底层苔毯的 v04 与组合后的 v04b 分目录保留，后者为本轮候选。
- Blender runner 增加可选的 `--model` 参数，默认仍为已实测的 v02。未自动替换默认样品。

本轮结果：`production/native/generated/material-study-v04b/`。

| 文件 | 状态 |
| --- | --- |
| `yunxiu-rock-moss-v04.glb` | 65,177,904 bytes；岩石与苔藓两个独立网格；5 张嵌入图像 |
| `rock-moss-study-v04.png` | 1100 × 770，中景离线预览 |
| `rock-moss-study-v04-macro.png` | 1400 × 980，近景离线预览 |
| `moss-carpet-basecolor.png` / `moss-carpet-mask.png` | 派生底色与覆盖遮罩，原 UV |
| `study-report.json` / `study-report-macro.json` | 两次实际渲染报告 |

## 验证与审查

已通过 GLB 文件头、缓冲边界、有限坐标、单位法线、索引、包围盒及原扫描缓冲/贴图字节身份检查；Python 编译检查和 zsh 语法检查通过。证据和 SHA256：`evidence/moss-v04-review.json`。这些检查不替代 Khronos 完整验证或 UE5 实测。

本轮消除了圆团感，加入连续覆盖层；近景仍偏“染绿岩石＋稀疏小苗”，尚未形成细密自然苔毯。新增苔藓有 300,000 三角，连同岩石共 366,122 三角，不能直接批量布景。下一轮重点是提高细部结构与局部丛生感、优化面数、制作 LOD，并检验 UV 边界及 mip 过滤。**本轮不标记为美术验收通过。**

未执行 v04 Blender 导入；没有新 `.blend`。已验证的 v02 两份 Blender 工程继续保留。未启动 UE5，也没有新的实时场景或可玩包。

## 可复现入口

使用已有 CPU Python 环境，先指定 `YUNXIU_CPU_PYTHON` 后执行：

```sh
"$YUNXIU_CPU_PYTHON" production/native/rendering/rock_study.py --asset production/native/assets/boulder-01 --output production/native/generated/material-study-v04b --moss --moss-style leaf --width 1100 --spp 48
"$YUNXIU_CPU_PYTHON" production/native/rendering/rock_study.py --asset production/native/assets/boulder-01 --output production/native/generated/material-study-v04b --moss --moss-style leaf --view macro --width 1400 --spp 64
python3 scripts/check-native-assets.py
```

需要导入 Blender 时，指定现有安装的 `YUNXIU_BLENDER`，在普通终端运行：

```sh
production/native/run-blender-locally.command --rock-only --model "$PWD/production/native/generated/material-study-v04b/yunxiu-rock-moss-v04.glb"
```

这是待执行入口，不是已经完成的 Blender 工程。无需重跑地形生成。

## 环境现状

本次只读检查：系统卷约 28 GiB 可用，Ti600 约 663 GiB 可用；Xcode 活跃路径为 `/Library/Developer/CommandLineTools`，常规位置未发现完整 Xcode 或 UE 编辑器。芯片/内存查询受限，仍不猜测配置。不在当前阶段下载大型安装包。
