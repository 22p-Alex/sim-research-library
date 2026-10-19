# 共同幅相：四幕主线

完整页第 19—22 幕、独立参数页第 10—13 幕共用本单元。完整页 38 幕，独立页 16 幕。修改前源码检查点 `19c33d6`；执行设计见[四幕简化计划](../../../motion/plans/2026-10-19-coefficient-mainline-simplification.md)。

## 当前主线

| ID | 时长 | 要回答的问题 |
|---|---|---|
| `least-squares-fit` | 16 秒 | 对应频点各除自身 OTF 后，为何只差一个共同复比例？ |
| `coefficient-point` | 20 秒 | 一个非零点怎样移项、乘共轭并消去样品相位？ |
| `coefficient-sum` | 22 秒 | 为什么用全部对应点分别累计分子、分母？ |
| `coefficient-read` | 12 秒 | 复比例怎样读成调制度与共同相位？ |

总计 70 秒。对应内容幕在下方公式区完成 OTF 化简与 α 代入，右侧关系同步。随后三幕改为同一条居中公式的连续推导：频谱与辅助图淡出，不再切入工作频谱、伸缩旋转示意或另一张复平面。原舞台 V、U 从右侧交接到中央 `(720,240)`，再移入同一分式；字幕、下方公式区和舞台共用归一化推导进度，支持倒放与任意定位。计算仍来自实际最终工作数组，估计器未改。

| 推导进度 subProgress | 导航停点及局部进度 | 动作 |
|---|---|---|
| 0—0.25 | `singleRatio` 的 0—0.520833 | 淡出背景、公式居中并放大；补入 q₁；U 移入分母；上下同乘 U*，分母合为模平方 |
| 0.25—0.48 | `singleRatio` 的 0.520833—1 | V 展开成 m exp(iφΔ)U；高亮 U*、U 合成非负实数，再恢复 U*V 的观测写法 |
| 0.48—0.75 | `pooledRatio` 的 0—1 | q₁ 的下标消失；两路求和号加入；参数戴估计帽号；显示 C、E_U 及同组数据累计 |
| 0.75—1 | `readParameters` 的 0—1 | 上移并保留总式，分叉生成橙色调制度、紫色共同相位两张结果卡片；恢复三步各帧相位 |

三幕边界的公式状态相同。每个变量、地址和分式横线只创建一次，局部扩展而非整式交叉淡入。帽号的旧、新系数先后出现。原右侧关系的字形位置只测量一次作交接；播放时不重复编译或测量。调制度和相位卡片使用实际最终估计，随后补偿、矩阵回填和正式重建继续使用同一数据。

`scene=parameters.refine&beat=returnSpectrum&p=0.694000` 时频谱已完成归位。第 19 幕完整保留这一频谱状态：原图、OTF、坐标轴、显示位置和透明度保持不变，锁定波矢继续显示；右侧仅渐显“回看：共轭与模平方归一”和已完成的校正关系，随后出现可靠公共区说明。不切回第 15 幕、不恢复 P/Q/R 和旧掩膜、不展开双图。下方公式区仍复用 `otf/storyboard.js` 的 `correct` 公式：分子保留自身 H*，分母保留 |H|²。回看公式中 5 处 k′ 在本拍 22%—33% 同步轻跳、原位换成 k̂；两行公式持续显示，分式、基线和真实 k 项保持固定。35%—39% 在正确对齐的无噪声模型下消去样品项的 −k+k̂，40%—44.5% 用 H*/|H|²=1/H（H≠0）将原分式化成除以自身 H，同时将固定波矢的 Vₖ̂ 简记为 V。消去的符号先淡出、所占宽度再收拢；原两行节点一直保留，46%—51% 只在系数槽展开 α，其余项保留；53% 按原字形位置交接到后续演员，避免整式叠印。随后继续 α 与 U 的代入。第 19 幕保持 16 秒；只有进入下一幕单点比例时，才淡出概览并将原关系移到中央。所有状态按同一进度支持定位和倒放，不重新采集或估计。

| 文件 | 职责 |
|---|---|
| `mainline-story.js` | 四幕目的、文案、公式、时长、子步与旧定位映射 |
| `mainline-state.js` | 同一最终数组的频域表示、实际频点与前缀和、可逆展示状态 |
| `mainline-view.js` | 居中移项、共轭消相位、公共区求和、同步公式与幅相结果卡片 |
| `mainline-formula-view.js` | 对应内容幕下方公式区的 OTF 校正回看、锁定代入、U/V 定义与 α 代入动画 |
| `theory.html` | 两页同步的简版理论及折叠的最小二乘、fairSIM 实现推导 |

`sim-parameter-two-stage.js` 的导航组合使用四个新停点，内部状态 ID 为 `coefficient`。`scene-registry.js` 将旧逆变换、旋转、比较定位导向单点幕，旧乘积、累计、除法定位导向多点幕，旧读取定位导向参数幕；旧进度保留为新幕的局部进度，不保证历史时间逐秒相等。

## 数学与数值来源

工作副本来自 `estimate.finalPeak`，不是位置搜索的 `estimate.fit`。记原生地址工作频谱为 B₀、B₁：

$$
U=B_0,\quad u=\mathcal F_N^{-1}\{B_0\},\quad
v=\mathcal F_N^{-1}\{B_1\},\quad
v_k=v\exp(-2\pi i\widehat{\mathbf k}\cdot\mathbf r/N),\quad V=\mathcal F_N\{v_k\}.
$$

整数波矢时 V(q)=B₁(q+k̂)；小数波矢时按有限 Fourier 求值解释。视图只对既有 `finalPeak.shifted` 正变换一次以取得 V，不重新估计、不读取生成真值、不使用搜索掩膜下的旧累计量。

$$
\widehat\alpha=\frac{\sum_q U^*V}{\sum_q|U|^2}
=\frac{N^2\sum_r u^*v_k}{N^2\sum_r|u|^2},\qquad
\widehat m=|\widehat\alpha|,\quad\widehat\phi_\Delta=\arg\widehat\alpha.
$$

工作公共区 Ω 按最终工作参考数组的非零支撑定义，动画只累计 U 严格非零的频点；其他位置对分子、分母均贡献零，因此不改变完整数组结果。这个频域计数不是旧动画的 N² 空域位置数。OTF、掩膜、噪声和位移误差仍会影响估计。准确的相对相移是单一共同相位模型的前提。

依据：[fairSIM SI，第 10—11 页](../../../../Wiener-SIM/fairSIM-论文/fairSIM-2016-SI.pdf)，固定源码 `711afd12cb8c4fd4207bbca7ee7610c5aed4f732` 的 [Correlation.getPeak/commonRegion](../../../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java)。getPeak 第 199—217 行保持原空域实现；commonRegion 第 242—297 行筛选并除自身 OTF。临时分离系数沿用 [BandSeparation](../../../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/BandSeparation.java)，模长直接给 m，不再乘 2。

逆变换、已知额外转角 δ、反向校正、Parseval 和最小二乘配方留在两页可展开的说明中。`theory.html` 由 `npm run scenes:sync` 同步到完整页“原理与数值”和独立页“原理与实现”，不是额外的播放时钟。

## 兼容与验证

旧九幕的 `storyboard/state/layout/view/formula-view`、`inverse-view`、`tail-*` 保留原有直接 API，供历史公式与数值回归；它们不在主导航中。旧视图按需创建，主线不会挂载旧的逆变换与长段尾部演员。原分镜可从检查点 `19c33d6` 恢复。

`tests/sim-coefficient-mainline.test.cjs` 核验整数与小数位移的频域/空域一致性、独立有限 Fourier 求值、整体最小二乘、单拍改时长、两页生产入口、连续移项、共轭消相位、同步公式、求和与帽号、前缀和、两张结果卡片、回退、旧定位和说明弹窗。固定频谱检查直接以 `returnSpectrum/.694` 为基准，逐节点比较第 19 幕正反定位的属性、文本、可见性，并核对原图节点未替换。原 Java 与独立 DFT 回归继续保留。执行 `npm run scenes:sync`、`npm run check`、`git diff --check`。视觉由用户验收，不运行浏览器或截图。
