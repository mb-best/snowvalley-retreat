# 晴日山谷 · 美术样板

独立入口：`/sunny-valley.html`。沿用当前 Sites 项目与原有访问权限。

## 这一版

- 一座可以走近观看的半木构小屋：陶瓦屋顶、木窗、花箱、门廊、常春藤、石烟囱和炊烟。
- 连续的浅溪、动画水纹、岸边泡沫与圆石，一座可以实际走过的拱形木桥。
- 白色、粉色、黄色与紫色花坡，成组的阔叶树、灌木和风动草地。
- 自由行走、快走、跳跃、房屋/树干/溪流边界碰撞、触屏摇杆。
- 溪畔、小屋、花坡三个观景视角；漫游时也可以快速前往。
- 自然环境合成音、照片下载、实时位置小地图、画质切换。
- 场景为固定的晴朗夏日。浏览器性能和显示器色彩会影响体验。

此样板专注固定区域的美术与行走体验。房屋内部未开放，其他地图与动物玩法在原入口继续保留。

## 文件

| 文件 | 用途 |
| --- | --- |
| `dist/sunny-valley.html` | 独立页面 |
| `dist/sunny/sunny.css` | 自适应界面 |
| `dist/sunny/terrain.js` | 地形、河道、道路、行走边界 |
| `dist/sunny/plants.js` | 树木、花、实例化草地、微风 |
| `dist/sunny/landscape.js` | 小屋、木桥、溪流、山景、云、蝴蝶 |
| `dist/sunny/main.js` | 渲染、灯光、输入、声音、地图与照片 |
| `dist/sunny/assets/` | GitHub 开源材质与授权文件 |

## GitHub 资源与参考

1. **EZ-Tree / Daniel Greenheck**：https://github.com/dgreenheck/ez-tree 。使用其橡树叶片材质 `src/app/public/textures/leaves/oak.png`；白蜡叶材质也随源码保留。项目 MIT 许可，叶片遵循项目许可；完整许可在 `dist/sunny/assets/EZ-TREE-LICENSE.txt`。未引入树木生成库本身，树形、枝干与树冠由本样板生成。
2. **threejs-grass-water-shaders / boona13**：https://github.com/boona13/threejs-grass-water-shaders 。阅读并参考了实例化草叶、根部固定/叶尖风动与色彩梯度的实现思路。当前 shader 为适配本地 Three.js r160 的独立实现。原项目 MIT 许可保留在 `dist/sunny/assets/SHADER-REFERENCE-LICENSE.txt`。
3. **Three.js**：继续使用项目本地 r160.1，MIT 许可在 `dist/vendor/THREE-LICENSE.txt`。
4. 调研了 https://github.com/norio/three-stylized-water 。其 WebGPU/TSL 路线与本项目的 WebGL 兼容目标不同，此样板未引入该实现。

小屋、瓦片、木桥、花朵、山体与云采用程序化建模。运行所需的 JavaScript 与图像依赖均随项目打包，使用系统中文字体，场景无需从外部 CDN 加载资源。

## 本地运行

在仓库目录运行 `python3 -m http.server 5186 --directory dist`，访问 `http://127.0.0.1:5186/sunny-valley.html`。

## 验收重点

确认首次加载、三个观景地点、走过桥面、自由环顾、房屋与河道边界、触屏布局，以及是否存在图形程序报错。独立模块不读取或改写旧世界的游戏存档。
