# UE5 原生工程起点

目标暂按UE5.8。已有真实`.uproject`、C++模块、Editor/Game Target、配置、地形参考读取/碰撞、第一人称诊断角色、GLB导入和三轴比例校准脚本。**C++/UHT编译、编辑器导入、地图保存、Play和打包均未执行，没有可玩包。**

地形为定稿1597的201×201、5m水系处理后1km局部采样，B–C对角线，80,000三角。它没有新增真实地形细节，也不等同全图50m原始网格的精确替代。局部零点east=1150m、south=-3200m；Z=绝对海拔−1700m，UE采用厘米。原地图位置不改动。

4km/h角色是技术检查基线，正式速度、坐骑和生活玩法尚未移植。默认软件Lumen方向、关闭硬件光追和虚拟阴影；16GB M4性能待实测。

## 安装实况：2026-10-30

M4 Mac mini、16GB内存、macOS26.6.2已实测确认。系统盘28–29GiB、Ti600约662GiB可用。工程在外置盘，引擎也建议安装到外置盘。准确所需空间仍须看安装器组件选择。

- UE官方下载页能打开，但EpicInstaller-20.3.3.dmg官方跳转被Chrome拦截：ERR_BLOCKED_BY_CLIENT。未下载/安装启动器，未改变拦截设置。
- 指定Xcode版本入口转到Apple登录页面，停在加载画面，未取得安装包。原Command Line Tools保留。
- UE5.8官方要求最低Xcode26.0，推荐26.1.1，明确26.4不兼容。因此不能直接用App Store最新版替代兼容性核对。

官方依据：
- https://www.unrealengine.com/download
- https://dev.epicgames.com/documentation/unreal-engine/macos-development-requirements-for-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/install-unreal-engine
- https://developer.apple.com/download/all/?q=Xcode%2026.1.1

安装过程中如有EULA、支付或身份验证，留给用户在具体界面完成。当前未接受新协议、未支付费用。

## 安装后的入口

变量应指向真实安装位置，示例路径不是已有安装：

```sh
export YUNXIU_UNREAL_ENGINE_ROOT='/实际安装目录/UE_5.8'
export YUNXIU_XCODE_APP='/实际安装目录/Xcode.app'
production/native/unreal/run-unreal-study.command
```

runner检查引擎、完整Xcode及Metal编译器，核对源文件，调用官方Build.sh编译Editor，再执行编辑器导入脚本。不修改全局xcode-select，不替换已有地图/导入资产。缺少引擎时退出码2已实测。

成功执行后才会生成`Content/Maps/YunxiuStudy.umap`及`Saved/yunxiu-editor-bootstrap.json`。导入报告也不能代替PIE行走、碰撞、光照、材质和性能验收。

已通过Python编译检查、zsh语法检查、JSON解析、源数据哈希、GLB数学结构检查。启动器未安装，尚无实际组件占用或引擎帧率可报告。

## 植被样品02

`stage_sources.py`在检测到`generated/vegetation-v02/manifest.json`时额外校验并复制6个GLB。导入脚本先复查全部暂存文件的SHA256，再导入独立的`/Game/Imported/VegetationReview02/`目录，生成`/Game/Maps/YunxiuStudy_Vegetation02`，不改旧地图。树的三个精度版本并排放置供轮廓检查；蕨类两档、新草花和旧木石屋也进入待审场景。**这些是独立模型，不是已经绑定的UE自动LOD。**

本轮仅完成脚本、结构与源文件准备，尚无编辑器执行结果。首次成功后请打开新地图再检查PIE；项目默认地图配置仍保留旧样板入口。若导入中途失败，已创建的导入目录会被保护而拒绝覆盖，需要在编辑器中核查残留并选用新目录后再试，不能直接宣称导入成功。
