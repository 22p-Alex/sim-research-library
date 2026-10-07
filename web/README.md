# SIM 前端代码

页面入口放在项目根目录，JS 与配套 CSS 按职责放在本目录。普通 `<script>` 的加载方式保留，可直接双击 HTML 离线使用，也可运行 `npm run preview` 通过本地 HTTP 访问。

| 目录 / 文件 | 职责 | 使用页面 |
|---|---|---|
| [shared/sim-core.js](shared/sim-core.js) | FFT、OTF、前向成像、相移解混与教学版 Wiener 融合 | 实验室、图谱 |
| [shared/sim-experiment.js](shared/sim-experiment.js) | 瞳面截光、有效调制度、相机噪声与调制度估计 | 实验室、图谱 |
| [lab/](lab/README.md) | 启动、成像、采集、预设、A/B 对照与页面样式 | [交互实验室](../sim_interactive_demo.html) |
| [atlas/sim-atlas-core.js](atlas/sim-atlas-core.js) | 固定 fairSIM Wiener 路径、各阶段中间产物 | [全流程图谱](../sim_pipeline_atlas.html) |
| [atlas/sim-atlas.js](atlas/sim-atlas.js) | 图谱渲染、频谱探针与交互 | 全流程图谱 |
| [atlas/sim-atlas.css](atlas/sim-atlas.css) | 图谱样式 | 全流程图谱 |

依赖方向是 `lab → shared`、`atlas → shared`；两个页面的独占模块不互相引用，共享计算层不读取 DOM。新增前端 JS/CSS 时放入对应目录，并更新 [模块归属清单](../tests/sim-page-boundary.test.cjs)。

脚本 URL 按 HTML 入口的位置填写；CommonJS 的 `require()` 按所在 JS 文件的位置填写。实验室的 `app.js` 必须最后加载，图谱的 `sim-atlas.js` 在共享层与 `sim-atlas-core.js` 之后加载。

在项目根目录运行：

```sh
npm run check    # 数值、模块依赖与文档链接
npm run test:ui  # 实验室和图谱的桌面 Chromium 验收
npm test         # 依次执行以上两项
```

本地 fairSIM 源码与 JDK 已就绪时，还可执行 `node --test tests/sim-atlas-fairsim.test.cjs`，与固定版本的 Java 实现核对数值。工具脚本见 [scripts/](../scripts/README.md)，第三方资源位于根目录 `vendor/`。
