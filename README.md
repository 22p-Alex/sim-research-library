# SIM + 深度学习毕业课题资料库

围绕结构光照明显微镜（SIM）的超分辨成像组织。按当前任务选择入口：

| 想做什么 | 入口 |
|---|---|
| 学原理、查公式、理解论文之间的关系 | [知识库目录](SIM知识库.md) |
| 看课题目标、当前状态和实验路线 | [项目总览](SIM项目总览.md) |
| 找论文原文、译文、补充材料与阅读状态 | [文献目录](SIM文献目录.md) |
| 逐步核对 2D-SIM/Wiener-SIM 的参数估计与重建代码 | [知识库专题 03 第 3 节](知识库/03-传统重建与参数估计.md) · [fairSIM 理解笔记](Wiener-SIM/fairSIM-论文/理解笔记.md) |
| 运行当前 3D-MP-SIM 重建代码 | [MP-main 运行说明](3D-MP-SIM/MP-main/README.md) |
| 调参数、注入误差、做单变量 A/B 对照 | [SIM 交互模拟台](sim_interactive_demo.html) |
| 俯瞰每个中间产物、查某个检测点混了哪些频率 | [2D-SIM 全流程图谱](sim_pipeline_atlas.html) |
| 分清同一个探测点的 0、±1 级，理解搬移后谁提供超分辨 | [频带搬移与 fairSIM 融合](SIM频带重叠与fairSIM融合.md) |
| 看真实硬件怎么摆：从 488 nm 激光到样品条纹的 17 个工位 | [2D-SIM 真实光路走查](sim_real_optical_path.html) |

## 资料分区

- `知识库/`：按学习顺序排列的 8 个专题，以及维护说明。
- 各论文目录：保留原文、SI、元数据、译文、笔记与作者代码。具体条目见文献目录。
- `Wiener-SIM/`：2D-SIM/Wiener-SIM 参考实现 fairSIM 的文献条目、源码级理解笔记与克隆源码（`fairSIM-src/`）。
- `原文图示/`：知识库引用的论文图版；示意图与演示资源仍由原路径引用。
- `2025.06/`：早期收集存档；重复副本与待阅读资料的状态见文献目录。
- `归档/`：结构调整前的文档快照和已完成迁移的历史工具。

## 前端代码与工具

JS 按运行位置与页面职责集中存放，页面入口仍在根目录：

```text
web/
├── shared/    # 两个交互页面共用的计算模型
├── lab/       # 交互实验室的 JS、CSS 与模块说明
└── atlas/     # 全流程图谱的 JS 与 CSS
scripts/       # 学习指南截图与频带配图渲染工具
tests/         # 数值、模块边界、资源链接与桌面浏览器验收
vendor/        # 本地第三方依赖
output/        # 截图、测量数据等生成结果
```

具体文件职责见 [前端代码说明](web/README.md) 和 [工具脚本说明](scripts/README.md)。生成阅读页用 `npm run build:preview`，监听文档用 `npm run watch:preview`；完整检查用 `npm test`，覆盖两个交互页面的桌面验收。

## 交互页面分工

两个计算页面职责不重叠，按“先实验、后俯瞰”使用；第三页是纯静态硬件示意，不参与计算。改任何一页前先确认它属于哪一类，不要把另一类的职责搬过来。

| 页面 | 解决什么问题 | 明确不负责 | 页面独占模块 | 验收 |
|---|---|---|---|---|
| [sim_interactive_demo.html](sim_interactive_demo.html) | 参数与误差实验台：四类共 11 项单变量 A/B 对照、调制度 $m$ 的数据估计与可靠性筛查、相机噪声模型、CH1–CH4 截线波形、成像模型的二维卷积 ⇄ OTF 对照（PSF、截止与像差后果） | 不逐个展示重建流水线的频谱中间产物，不做流水线全景俯瞰 | [`web/lab/`](web/lab/README.md)：启动、成像、采集、预设、对照与样式 | `tests/sim-browser.test.cjs` |
| [sim_pipeline_atlas.html](sim_pipeline_atlas.html) | 按固定 fairSIM 二维 Wiener 路径展示中间产物，点开频谱核对相移解混与归位 | 不替代完整的单变量 A/B 实验台 | [`web/atlas/`](web/atlas/)：`sim-atlas-core.js`、`sim-atlas.js`、`sim-atlas.css` | `tests/sim-atlas.test.cjs`、`tests/sim-atlas-fairsim.test.cjs`（JDK）、`tests/sim-atlas-browser.test.cjs` |
| [sim_real_optical_path.html](sim_real_optical_path.html) | 真实 2D-SIM 光路走查：17 个工位从 488 nm 激光到样品条纹，逐站交代光束状态（波前 / 束径 / 偏振）、为什么非有不可、装错会变成哪种伪影；含共轭面链、BFP 正视图、入射角真实比例图与关键量核算表，每条论断带证据标签（S 编号 / H / 量级 / 待核实） | 不做任何数值计算与参数实验（纯静态 SVG，内联脚本只管着色切换、滚动联动与高亮；不依赖共享计算层，页面上每个数字都是预先核算后写死的） | 无（内联脚本与样式） | 离线打开即用；无远程依赖由 `tests/sim-page-boundary.test.cjs` 断言 |

**共用计算层**：[`sim-core.js`](web/shared/sim-core.js)（理想教学模型：OTF、前向成像、相移解混、Wiener 融合）与 [`sim-experiment.js`](web/shared/sim-experiment.js)（有效参数实验层：瞳面截光、可见度、相机噪声、$m$ 估计）被两个页面共同依赖，**改动会同时影响两页**，提交前必须跑全部单测。页面独占模块不得被其他页面引用，共享层不得反向依赖页面，删除页面时必须一并清理其独占模块——这三条由 `tests/sim-page-boundary.test.cjs` 断言，不靠约定。

```sh
node --test tests/sim-core.test.cjs tests/sim-experiment.test.cjs tests/sim-atlas.test.cjs tests/sim-page-boundary.test.cjs
for f in tests/sim-browser.test.cjs tests/sim-atlas-browser.test.cjs; do node "$f"; done
```

模拟台的模型边界、每个参数改变的对象与 A/B 操作次序见 [SIM 模拟台核对与操作说明](SIM模拟台核对与操作说明.md)；图谱页的适用边界写在其页内说明；固定 fairSIM 配置、输出标度和 Java 对照方法见 [图谱实现对照](Wiener-SIM/fairSIM-论文/图谱实现对照.md)。

## 演示开发记录

- 2026-10-08：移除预览生成子系统（38 个 `*预览.html`、`index.html`、build/watch 脚本与预览测试），Markdown 成为唯一文档载体；文档与交互页中的预览链接全部改指 `.md` 源。同步清理 `output/` 历史会话产物（保留学习指南引用的 `sim-single-direction-guide/`）。详见[维护说明](知识库/维护说明.md)当日记录。
- 2026-10-06：前端模块统一归入 `web/shared/`、`web/lab/`、`web/atlas/`，工具归入 `scripts/`；同步 HTML、CommonJS、文档链接和构建路径，模块边界检查递归覆盖 `web/`。数值算法与页面入口保持原有行为。
- 2026-10-06：将实验室独占代码集中到 `web/lab/`，统一启动与状态订阅，修复保存页面首次打开时 A/B 旧数值和空 Canvas 不一致的问题；方向改用原生开关，相位使用静态标题。维护入口见 [代码结构说明](web/lab/README.md)，常用命令为 `npm run check`、`npm run test:ui`、`npm run preview`。
- 2026-10-06：移植 WorkBuddy 交互实验室修改版，简化光路控件、固定三相位帧，A/B 对照移到采集控制台之后并按四类分组；计算核心沿用原实现。

- [SIM 模拟台：模型核对与对照操作](SIM模拟台核对与操作说明.md)：现有仿真模型的适用边界、每个参数改变的对象和单变量 A/B 操作，2026-09-27 核对。
- 真实采集改造计划、修改和验证说明、2026-09-24 原版审查记录已不在工作目录，仅存于[整理前快照](<归档/知识库整理前-2026-09-26.zip>)，不再更新。

## 资料状态约定

- **已阅读**：已根据主文、Methods、图注或 SI 整理译文/笔记；不代表本地复现完成。
- **仅存档**：已有文件，尚未形成可靠的独立结论。
- **待复现**：已有论文理解或代码入口，尚未完成本地实验验证。

维护方式见 [知识库维护说明](知识库/维护说明.md)。论文与代码分别遵循其许可条件；本地中文译文用于学习和课题研究。
