# 参数估计已接入完整重建演示

[完整重建动画](../../sim_motion_demo.html) 现在包含 36 个停点。独立 [参数 Demo](../../sim_parameter_demo.html) 保留，主页面直接复用其十一幕模型与视图；不嵌入 iframe，不打开新页，不加载独立页启动器。

## 实际顺序

| 停点 | 场景 ID | 内容 |
|---|---|---|
| 01—08 | sample 至 frequency-probe | 样品、编码、检测、三帧与 FFT |
| 09—10 | mixed-sources、inverse-demix | 定义 A = H·S，系数进入矩阵，符号求逆 |
| 11 | provisional-split | A = UD 后浮现照明公式，框出三个参数，从理想已知条件转到实际待估计量 |
| 12 | parameters.shared | 真实 k 的推导，频谱重叠、分开、框出公共区，浮现 P、Q、R |
| 13 | parameters.line-shift | 一维移动与逐列乘积和 |
| 14—22 | parameters.shift 至 parameters.read | 返回原二维频谱、OTF 同移、可靠交集、候选匹配、二维峰、小数细化、实际复数的旋转缩放与共轭、全部点拟合、条纹 |
| 23 | adopted-weights | 汇合三个方向的估计，回填 M 并计算实际 U |
| 24 | separate-bands | 三行实际权重作用于同一组三帧，形成正式频带 |
| 25—26 | relocate-bands、recover-high-frequency | 按估计波矢归位，回到高频点 |
| 27—36 | directions 至 frequency-audit | 三方向覆盖、OTF 融合、逆 FFT、图像与频率评价 |

## 数据连接

初始化只采集一次，计算结果缓存供时间轴反复读取：

```js
const capture = SIMAtlas.capture({
  sample: 'star-points', directions: 3, m: 0.8, noise: 'none'
});
const chapter = SIMMotionParameterChapter.create({
  raw: capture.raw,
  config: { n: capture.raw.n, cutoff: SIMAtlas.KC },
  direction: 0
});
const reconstruction = chapter.reconstructAll();
const lesson = SIMMotion.createLesson({ capture, pipeline: reconstruction.pipeline });
```

估计器只接收观测像素、名义相对相移和 OTF 配置；不读生成图像时的波矢、调制度、相位元数据或样品真值。各方向估计的相位、调制度和波矢实际进入 `SIMAtlas.pipeline`。归位动画、覆盖圆及参数表读取这份 pipeline。物理成像说明可以使用模拟采集真值；样品真值不进入估计或融合，只用于最终评价。

主线详细解释方向 1，计算全部三个方向。章节的临时频带来自 `chapter.lesson.estimate.context.separated.bands`；正式频带来自 `reconstruction.pipeline`。`pipeline.raw` 中仍引用原相机像素；校准层可以产生自己的计算数组。

缺少方向、失败估计、观测不一致或调制度触发核心回退时，初始化报错，不悄悄改回预设参数。

## 两处衔接的含义

第 10 步给出逆矩阵的闭式表达式，三行同等显示。第 11 步用 18 秒收拢为 A = U·D，先在中央接住分离式，再将它缩小、上移。照明模型 Iⱼ(r) 随之进入中央，k、m、φⱼ 原位框出。条件说明在同一位置由“假定已知”换为“从图像中确定”，结尾用短连线引出三项待估计参数。舞台不再重复页面标题，公式栏和主舞台共用带显式乘号的分离式。

本例保持帧间相对相移已知且准确的假设。主舞台不再展开权重补偿、临时矩阵、逐行求和或三带展示。计算层仍先按名义相位完成临时分离，为后续公共频率比较提供数据；对应数学关系保留作依据：

$$
\phi_j=\phi'_j+\phi_\Delta,\qquad\phi'_j=\frac{2\pi j}{3},
$$

$$
\widetilde A_0(\mathbf f)=\frac13\sum_jD_j(\mathbf f)=H(\mathbf f)S(\mathbf f),
$$

$$
\widetilde A_{\pm1}(\mathbf f)=\frac23\sum_j e^{\mp i\phi'_j}D_j(\mathbf f)
=m e^{\pm i\phi_\Delta}A_{\pm1}(\mathbf f).
$$

这要求等间隔的相对相移准确；没有假装补偿掉未知的 m 和共同相位。临时旁带保留它们，后续用零级与正一级公共信息估计。

主线的高频点 q=(14,0) 在零级通带外，不适合作零级与旁带的相关匹配。参数估计先转看公共区，估计完成后再回到高频点。参数估计选择 0 级与正一级，求逆结束及交接时不单独强调负一级；负一级仍参与正式解混与重建。照明波矢及相位沿用同一约定，归位符号由级次决定。内部独立证明仍以负一级验证抵消。

第 23 步显示三个方向的估计结果，并展开方向 1：将估计相位和调制度填回混合矩阵 M，再计算 U = M⁻¹。两个数值矩阵来自同一份采用参数；波矢保留给后续归位。第 24 步直接用 U 的三行对三帧频谱乘加。生产时间轴省去重复的 0 / 0 / 1 系数证明，内部数学测试仍独立核对逆矩阵恒等式。

参数章用帽号标记估计值。交回主线时明确：后文 m、φⱼ、k 指采用的估计值，频带继续记为 A，减少符号切换。逆矩阵与采用的 M 相乘为 I，并不单独证明采用的参数等于真实参数。

## 单一时间轴

- `SIMMotion.scenes` 保留原 24 个物理场景，供原几何模型使用。
- `SIMMotionParameterChapter.plan(SIMMotion)` 是生产页面使用的 36 步清单，`active: true`。
- 在 `inverse-demix` 后插入两个衔接场景和十一个估计场景，之后直接接 `separate-bands`；基础模型中的 `verify-demix` 不进入生产停点清单。
- `flow.frame(position)` 为原场景返回 `baseTime`，为估计场景返回 `sceneId` 与完整 0—1 进度；每个新增停点对应该幕终点，不漏掉第一幕动画。
- `SIMMotion.createPlayer({durations: flow.durations})` 控制唯一播放进度；原模型默认时长保留，方便独立校验原几何。
- `SIMParameterLesson.createView` 持续使用同一对频谱、公共区、复平面和拟合画面，不创建时钟或全局事件；`createFormulaView` 的持久部件跟随同一进度。主线负责导航、暂停、回退、重播和减少动态效果。
- 主舞台有临时分离、参数章节、采用参数三个兄弟 SVG 容器，另用公共频谱图层承接第 11→12 步；过渡由同一进度控制，参数图形使用作用域样式，下方公式仍使用主页面固定公式栏。

独立页继续加载 `sim-parameter-app.js`；完整主页面只加载其可复用 model/view、共享估计器、主线章节适配器及两个衔接画面的视图。

## 依据与验证

理论依据：[fairSIM 2016 Supplementary Note 1](https://doi.org/10.1038/ncomms10980)。源码顺序见 [SimAlgorithm.java](../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java) 181—190 行的临时分离、601—603 行的正式分离及后续归位；[BandSeparation.java](../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/BandSeparation.java) 构建矩阵并累加加权观测。

当前运行教学估计器：公共区 OTF 校正、归一化复数相关、整数候选搜索和 5×5 局部细化。它不是 fairSIM 原版 FFT 粗相关、掩膜及 fitPeak 的逐行复刻。详见[参数估计推导与源码对照](../../Wiener-SIM/fairSIM-论文/fairSIM_参数估计逐步推导与代码实操.md)。

`npm run check` 包含生产 HTML 全部脚本的模拟 DOM 接线测试：36 步往返、完整估计动画、暂停与重播、减少动态效果、同一批原始像素及估计参数进入重建、相关分数与图坐标、连续比例箭头、实际逆矩阵权重，以及独立 Demo 的既有测试。原 24 场景的详细几何测试通过测试替身隔离时间轴；生产时间轴直接跳过证明段，进入正式解混面板后再淡入，避免跳过的证明闪现。按项目约定不启动浏览器、不截图、不做视觉或布局验收。

## 连动表现

第 10 步显示来源列 = U × 观测列；第 11 步只引入照明模型、理想与实际条件及待估计量，主舞台在这组参数处停住。进入第 12 步时，公共频谱图层随同参数章节淡入，不再从三带展示画面搬移。两份频谱仍复用相同节点、纹理、复数数组与频率/亮度标尺：27 格频率范围、218 单位图宽，分别使用零级青色与正一级紫色。临时分离仍属于估计器内部计算。

第 12 步先用 k 说明模型中的真实位置差，公式移项与抵消同步；两谱叠合后分开，框出两个检测坐标中的公共区，最后才浮现三个点。公共区轮廓为两边 OTF 非零的交集；第 15 步再收紧为可靠阈值交集。

第 13 步的一维实数例子只解释移动与逐列乘积和，不再加入人为相位。第 14 步先保留一维终点、收起表格，再接回同一对实际频谱及公共区、P、Q、R；二维图出现后才开始移动。第 14—18 步解释旁带与 OTF 同移、校正、候选 k′ 的匹配判据、二维评分与小数细化。教学数与教学位移不带入原图，评分来自完整可靠公共区。

第 19—22 步固定波矢与公共区，频谱图缩成参考图，P、Q、R 的取样线连接到 Re/Im 平面。先共同试探旋转，再统一缩放；接着用实际频点解释共轭，累计全部公共点，除参考能量，最后连回条纹。结果单位圆与比例箭头在拟合、读参数两幕保持相同节点和标尺。

主线原有采集的共同相位约为 0，独立页为 0.35 rad；两个入口保持各自原观测。旋转幕明确区分试探角度与实际拟合角度，不为制造转动而伪造观测相位。

生产定义和纯状态位于 `../parameter-demo/sim-parameter-two-stage.js`，图形和持久公式位于 `sim-parameter-two-stage-view.js`，桌面样式位于 `sim-parameter-two-stage.css`。`sim-parameter-line-view.js` 恢复主线中的一维教学，复用已经校验过的教学数值计算；完整页「原理与数值」保留相应手算表。详细依据与分镜见[方案](plans/2026-10-16-parameter-estimation-two-stage-story.md)。
