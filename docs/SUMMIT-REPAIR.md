# 青岚峰、岚渡峰局部修补

发布底稿从修订927升至928。青岚峰保留4200m、岚渡峰保留3980m，峰点位置不变。各限定在峰点650m范围内，按原边界高度连接连续山肩，消除旧峰顶与固定峰点形成的双峰。范围外所有高度网格逐值相同，原等高线外围节点全部保留。

非等高线要素的名称、几何和高程保留；局部40个生态单元仅落实已有植被高程上限。浏览器现有草案先备份，再在副本计算，成功后才替换。导出菜单“双峰修补前”可恢复完整原稿，支持撤销；撤销后刷新不会再次强制修补。若手动布局导致修补与水体、村落、其他峰点或垭口冲突，保留原稿并提示核对。

## 其余问题，仅报告

下表来自发布底稿，不含尚未导出的浏览器私有修改。“地形检查”读取当前浏览器最新草案，支持地图定位和报告导出。50m是此次设计筛查门槛，不是测绘标准。按实际三维三角面计算，共检查108条等高线，长度加权平均偏差4.4m。

|位置|向东/向南（km）|最大垂直偏差（m）|超限线段合计（m）|
|---|---|---:|---:|
|栖霞峰南侧河谷，月汀湖西南|3.873 / 14.277|247.4|369.8|
|青岚峰北侧眠风溪附近|15.124 / 6.276|99.8|171.8|
|青萝潭附近|11.724 / 10.726|85.5|40.2|
|月汀湖西南坡|4.403 / 13.797|79.2|57.3|
|映雪湖西南坡|4.950 / 7.874|70.7|24.9|
|栖霞峰南麓|2.962 / 14.638|61.8|19.8|
|青岚峰东北麓|16.737 / 6.363|54.5|21.1|
|岚渡峰东南麓|17.031 / 9.769|51.1|1.2|
|青岚峰西北侧溪谷|14.308 / 5.942|50.5|0.9|

坐标原点在西北角，X向东，Y向南。超限长度可能来自多条等高线。建议优先复核前两项；最后两项只有约1m的超限线段，可先保留。以上均未修正。

最大偏差处的3400m等高线，三维曲面为3152.6m，二维双线性查询为3310.8m。约158.2m的差别来自两种插值，其余为线形与高度底图的差别，不能把所有偏差都当成山体形态错误。

另有望归峰提示：标高5740m，其东南约206m处存在5877.4m局部高点，高出标高137.4m。此处保持现状，等待用户决定。

## 验证

已通过单峰、外围高度与等高线原节点保留、非等高线几何保留、已有手动修改保留、冲突原子回退、三角面解析误差独立用例、全图排水、7条河流、106/85m瀑布、48个目的地、47条步道及现有坡度和交角限制检查。三维刷新同步回归检查通过。

当前浏览器验证连接不可用，本发布包未重新完成三维画面的目视验收。

## 修补版专用入口

新增 `terrain-summits.html?v=summits-2`。首次载入固定发布底稿 `published-summits-1.json`（修订928、`summitRepairVersion:1`），后续编辑使用独立草案空间。原入口可能优先恢复旧的浏览器草案；不能仅凭 URL 的 v 参数判断实际载入的地图是否已修补。

`draft-scope.js` 隔离 localStorage 名称、IndexedDB 活动记录、迁移标记与备份键，原入口的既有键名保持不变。“返回原草案”可随时切回原工作台。专用入口不合并尚未导出的原草案修改。

浏览器验证：在测试原草案中把青岚峰临时改名，打开专用入口后页顶为“两峰局部修补”、峰名为发布底稿中的“青岚峰”；点击“返回原草案”后临时改名仍在，证明专用入口保存不会覆盖原草案。测试完成后恢复原名。地形文件和模型未变动。

## 在原“步道曲线编辑”地图上修补

入口 `terrain-editor.html?v=current-summits-1&repair=current-summits` 使用原编辑器的 localStorage 和 IndexedDB 活动草案，绝不读取独立发布副本。即使之前已经执行过修补、随后撤销或重新导入原稿，此明确入口仍可对当前未修补原稿执行修补；已经带修补标记的文档不会重复修改。

本入口跳过其他地形迁移和重命名，只允许步道曲线版本作为底稿。原稿不存在时才加载发布的修补前步道曲线底稿，并在地图上明确提示；原稿损坏或 IndexedDB 记录缺失时停止，避免用发布底稿覆盖私有修改。修补成功前用独立时间戳键保存完整原稿，备份写入失败则不应用修补。导出“双峰修补前”优先读取本次备份，旧备份仍保留。

验证：本地和 IndexedDB 读取优先、无原稿和损坏原稿分支、备份失败不应用、幂等性检查通过；双峰几何回归通过，外围网格变化0m，步道及其他要素保留。浏览器通过UI导入带自定义名称的修补前草案，再打开本入口，保留自定义名称并完成修补；导出的修补前备份与导入原稿内容一致（导入自身更新修订号和时间），修补后所有非等高线要素完全一致。截图为预览验证，不是读取用户私有浏览器草案的证明。

## Rounded region boundaries and protected summit patches

Summit repairs can shift and shrink their disks while staying within 650 m of each named peak, preserving nearby passes and water features. The radial shoulder fit uses the actual peak and disk-ray intersection, with a narrow outer transition to avoid retaining ghost summits after manual moves. Unsafe patches are still refused atomically.

The region staircase came from 100 m ecology-mask polygons and straight SVG edges. Closed quadratic rounding retains every source vertex and hole, limits each trim to 60 m and half its adjacent edges, and pins lake vertices next to river/waterfall connection segments. Editing a vertex reshapes the curve; inserted/deleted vertices maintain connection indices, and translating a region translates its holes.

SVG paths, selection hit paths, vegetation inclusion, 3D water meshes, 3D region lines and world exports share one sampler. JSON retains editable source vertices plus the boundary style. World export includes sampledPoints and sampledHoles in metres. Rounding an unchanged baked lake does not alter the height grid.

The explicit smoothing action backs up the active document before applying changes and supports undo. Contours, ridges, rivers and existing trail curves are not refitted by region smoothing.

Checks passed for exterior/hole closure, bounded rounding, river mouth preservation, edit cache invalidation and shared geometry. The original summit and terrain-sync regression suites passed. The current local edited document advanced 1472 to 1474: 125 regions, 59 holes, maximum boundary drift 15 m, unchanged non-contour feature geometry/names/elevations, no height change outside the repair disks, no secondary summit within 650 m except the four-cell peak plateau. Browser control is unavailable in this environment; rendered UI has not been directly inspected.
