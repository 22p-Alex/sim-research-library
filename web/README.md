# SIM 前端代码

页面入口放在项目根目录，JS 与配套 CSS 按职责放在本目录。普通 `<script>` 的加载方式保留，可直接双击 HTML 离线使用，也可运行 `npm run preview` 通过本地 HTTP 访问。

| 目录 / 文件 | 职责 | 使用页面 |
|---|---|---|
| [shared/sim-core.js](shared/sim-core.js) | FFT、OTF、前向成像、相移解混与教学版 Wiener 融合 | 实验室、图谱、动画 |
| [shared/sim-experiment.js](shared/sim-experiment.js) | 瞳面截光、有效调制度、相机噪声与调制度估计 | 实验室、图谱、动画 |
| [shared/sim-band-formulas.js](shared/sim-band-formulas.js) | 共用的 A 级次、观测式、解混权重与临时结果记号 | 完整动画、参数估计 Demo |
| [lab/](lab/README.md) | 启动、成像、采集、预设、A/B 对照与页面样式 | [交互实验室](../sim_interactive_demo.html) |
| [atlas/sim-atlas-core.js](atlas/sim-atlas-core.js) | 无 DOM 的可复用重建核心；固定 fairSIM Wiener 路径、各阶段中间产物 | [全流程图谱](../sim_pipeline_atlas.html)、动画 |
| [atlas/sim-atlas.js](atlas/sim-atlas.js) | 图谱渲染、频谱探针与交互 | 全流程图谱 |
| [atlas/sim-atlas-demix-coefficients.js](atlas/sim-atlas-demix-coefficients.js) | 无 DOM 的可复用系数计算；读取实际逆矩阵权重，计算逐帧复系数及其和 | 全流程图谱、解混数值校验 |
| [atlas/sim-atlas.css](atlas/sim-atlas.css) | 图谱样式 | 全流程图谱 |
| [motion/](motion/README.md) | 十章、35 停点的完整重建动画，矩阵解混、可逆时间轴与复数融合 | [完整重建动画](../sim_motion_demo.html) |
| [shared/sim-parameter-estimation.js](shared/sim-parameter-estimation.js) | 无 DOM 的教学参数估计；临时分离、公共区相关、复数比例与正式解混接口 | 参数估计 Demo，供后续主线复用 |
| [parameter-demo/](parameter-demo/README.md) | 十幕两阶段参数估计章节；承接临时频带并交回估计参数，本地进度可由主时间轴接管 | [参数估计 Demo](../sim_parameter_demo.html) |
| [motion/sim-motion-parameter-chapter.js](motion/sim-motion-parameter-chapter.js) | 已启用参数估计章节：共享观测、35 步组合、全方向估计与重建出口 | [并轨方案与去重规则](motion/PARAMETER-INTEGRATION.md) |

依赖方向是 `lab → shared`、`atlas → shared`、`motion → atlas/sim-atlas-core → shared`。`sim-atlas-demix-coefficients.js` 同样是无 DOM 的可复用计算模块，供图谱使用，并用于主动画的数值校验，保留既有路径。参数章节的 model、view 与 chapter 适配器单独列为可复用的展示组件，位于计算层之上；独立 app、全局事件与页面样式仍由各页面持有。共享计算层不读取 DOM、不反向依赖章节。动画 demo 从图谱进入，并返回图谱；两个主要学习页面保持原有导航关系。新增前端 JS/CSS 时放入对应目录，并更新 [模块归属清单](../tests/sim-page-boundary.test.cjs)。

脚本 URL 按 HTML 入口的位置填写；CommonJS 的 `require()` 按所在 JS 文件的位置填写。实验室的 `app.js` 必须最后加载，图谱的 `sim-atlas.js` 在共享层与 `sim-atlas-core.js` 之后加载。

在项目根目录运行：

```sh
npm run check    # 数值、模块依赖与文档链接
npm run test:ui  # 实验室和图谱的桌面 Chromium 验收
npm test         # 依次执行以上两项
```

本地 fairSIM 源码与 JDK 已就绪时，还可执行 `node --test tests/sim-atlas-fairsim.test.cjs`，与固定版本的 Java 实现核对数值。工具脚本见 [scripts/](../scripts/README.md)，第三方资源位于根目录 `vendor/`。

参数章节由 `parameter-demo/sim-parameter-two-stage.js`、`sim-parameter-two-stage-view.js` 和配套 CSS 共用；独立页只保留自己的入口、出口与播放器外壳。旧视图存放在 `tests/fixtures/parameter-legacy-*.js` 中供回归校验，不由页面加载。
