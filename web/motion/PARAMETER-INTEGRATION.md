# 参数估计已接入完整重建演示

[完整重建动画](../../sim_motion_demo.html) 现在包含 43 个停点。独立 [参数 Demo](../../sim_parameter_demo.html) 保留，主页面直接复用其参数场景单元与视图；不嵌入 iframe，不打开新页，不加载独立页启动器。

现行维护入口为[分镜目录](SCENES.md)和[治理约定](GOVERNANCE.md)。本文说明数据交接与理论；动作定义以各幕 `storyboard.js` 为准。

## 实际顺序

| 停点 | 场景 ID | 内容 |
|---|---|---|
| 01—08 | sample 至 frequency-probe | 样品、编码、检测、三帧与 FFT |
| 09—10 | mixed-sources、inverse-demix | 定义 A = H·S，系数进入矩阵，符号求逆 |
| 11 | provisional-split | 逐行解释权重；照明参数跳动与偏差原因；标称值重建及伪影；重新抽出实际权重并分成已知与未知；权重归位，展开 A = UD 的逐行乘加，最后得到临时频带（132 秒） |
| 12 | parameters.shared | 真实 k 的推导，频谱重叠、分开、框出公共区，浮现 P、Q、R |
| 13 | parameters.line-shift | 一维移动与逐列乘积和 |
| 14—18 | parameters.shift 至 parameters.refine | 二维频谱、OTF、可靠公共区、相关峰、局部细化 |
| 19—27 | parameters.least-squares-fit 至 parameters.get-peak-read | 最终工作副本、两路逆 FFT、单点与全场校正、共同幅相、共轭乘积、累计、相除与参数读取 |
| 28—30 | adopted-weights、restore-weight、assemble-weights | 解释旁带补偿，补全单个权重，再组成正式解混矩阵 |
| 31 | separate-bands | 正式权重作用于同一组三帧，形成完整频带 |
| 32—33 | relocate-bands、recover-high-frequency | 扩展频率网格，按估计波矢归位，回到高频点 |
| 34—43 | directions 至 frequency-audit | 回看多方向观测、支撑覆盖、融合、逆 FFT、图像与频率评价 |

第 19—27 幕现行定义位于 [getPeak 单元](../parameter-demo/scenes/get-peak/README.md)，九幕均可独立定位。第 28—30 幕接住相同参数，再交给正式解混。早期七拍与 33 停点的设计记录已清理，可从 Git 基线 `e7e412c` 恢复。

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

最终幅相使用 `estimate.finalPeak`：`prepared` 是从原始临时频带重新准备的工作副本，`spatial` 是两路逆 FFT，`shifted` 是旁带乘已知位移斜坡后的场，`product/energy/sums` 提供逐点乘积、参考能量及完整空域前缀和。`estimate.m/phase/phases` 直接取自这个结果，因此第 19 幕读数、第 20 幕矩阵和后续重建一致。旧 `estimate.fit` 仍属于位置搜索的可靠公共区比较，不与最终累计量混用。

缺少方向、失败估计、观测不一致或调制度触发核心回退时，初始化报错，不悄悄改回预设参数。

## 两处衔接的含义

第 10 步在矩阵中按行、逐项给出闭式权重。公式栏只保留 A = UD 与权重索引，避免先列出尚未揭示的所有系数；共同相位拆分也留待参数说明之后。第 11 步使用单一的 132 秒进度：

| 秒数 | 分镜 | 内容 |
|---|---|---|
| 0—7.8 | knownHighlight → knownMessage → knownRestore | 第一行整行框亮；三个 1/3 退去，再显示“已知常数，直接可算”；文字退去、系数恢复 |
| 7.8—16 | sideHighlight → sideMessage → sideRestore | 第二、三行框亮；六个旁带系数退去，再在各自行内显示“需要知道 φⱼ 和 m”；恢复系数 |
| 16—19.5 | gather | 来源定义、说明及缩略图淡出；来源列、权重、观测列分别移动、缩小为 A(f)、U、D(f) |
| 19.5—25.3 | whyEstimate → wavevectorReason | 照明公式进入，k 跳动；说明实际波矢可能偏离设定，文字随后淡出 |
| 25.3—32.5 | amplitudePhaseReason | m 与 φⱼ 一起跳动；说明光强、偏振与光程变化的影响，文字淡出 |
| 32.5—35.5 | nominalPlug | 直接代回硬件标称值；明确受控输入与匹配对照 |
| 35.5—42.5 | vectorFailure | 按标称波矢归位，显示 0.3 格错位及局部纹理放大，比较实际重建 |
| 42.5—49.5 | phaseFailure | 漏校正共同相位；复数方向转向相反，再显示相消式和负值剖面 |
| 49.5—54.5 | nominalResidual | 标称重建减匹配重建；带符号误差图、最强误差行及实际 DFT 主频 |
| 54.5—57 | actualWeights | 问“那么实际的权重应该是什么呢？”，U 的九个符号权重重新浮现 |
| 57—60.6 | extractWeight | 选中的 u₊₁,₁ 节点本身向左移动并放大，矩阵退去，写成旁带通式 u±₁,ⱼ |
| 60.6—63 | showWeight | 左侧符号保持不动，右侧才浮现等号和原有的 2/(3m) exp(∓iφⱼ) |
| 63—67 | expandWeight | 原 φⱼ 退去，指数逐项扩展为 φ′ⱼ+φΔ，等待展开完成再更新公式栏 |
| 67—74 | splitWeight | 分拆幅度与指数因子，沿上下弧线移开，再排成橙色未知 × 青色已知；颜色与文字标签一一对应 |
| 74—78 | returnWeight | 展开式收回 u，恢复具体下标，同一节点缩小并回到 U 的原单元格 |
| 78—82 | matrixApply | 补回 A 与 D 两列，框出 +1 权重行、观测列和对应输出 |
| 82—86 | rowProduct | 同一批 u、D、A 节点飞入组成三项乘加，整行停在原位 |
| 86—90 | nameKnown | 框出中间的 u，命名已知 ũ，并在原系数位置改写为 ũ/(m exp(iφΔ)) |
| 90—94 | coefficientScale | 在原式内同样展开另外两个 u，显示三个系数共用同一幅相比例 |
| 94—99.5 | outputScale | 原位改用三个 ũ，左侧同步变为 Ã；观测、加号、等号与整行位置保持不动 |
| 99.5—104.5 | matrixNotation | 完成的临时乘加式回到三行矩阵；+1 行使用原节点，补齐 0、−1 级的临时权重与输出；下方公式将 +1 推广为 ℓ |
| 104.5—110 | vectorNotation | 来源列、九个权重与观测列在舞台中央收成 Ã=ŨD；用较大的字号停留，索引定义随之进入 |
| 110—116 | observationModel | 原式横向展开，D 在原位置打开为 H、原混合矩阵 M 和三份移频样品频谱；公式栏同步解释条纹照明 |
| 116—118.5 | substituteObservation | 标量 H 与 Ũ 沿上下弧线换位，得到 H(ŨM) 乘样品频谱列 |
| 118.5—122 | temporaryResponse | ŨM 在相邻位置化为对角矩阵；三个级次保留 1、m exp(iφΔ)、m exp(−iφΔ) |
| 122—127 | expandBands | 同一批 S 与对角系数移入三行；H 分配到各行，Ã 同步展开；完成后原向量式缩小移到顶部 |
| 127—132 | ready | 保留逐项演变得到的三份频带，与第 12 步的向量式保持同一位置、字号和缩放 |

系数退去和文字进入之间、文字退去和系数恢复之间都留有空隙。高亮框复用系数行的精确范围；顶部不再增加与原来源定义重叠的小字和公式。收拢时复用公式描述创建的演员，在路径汇合前退出，交给紧凑式。暂停、反向与拖动全部读取同一进度，没有另设计时器。

“实际权重”分镜紧接标称重建、错位、反相、负值剖面和残余条纹误差图。抽出权重时只显示 U；双色拆分结束后，同一个权重返回原位，再补回 A、D 两列，建立逐行乘加关系。九个条目的坐标和公式来自 `actualWeightCells`；`actualWeightState` 只采样统一时间轴，不修改参数或数据。选中项由矩阵中的同一个节点继续移动；其专门帧号/级次记号在矩阵退去后才换成通式。右侧的原幅度、e、相位、括号、已知/未知幅度与相位均为一次编译的持久演员，展开、拆分和倒放只改变姿态、颜色与透明度。

橙色未知因子是 1/m·exp(∓iφΔ)，青色已知因子是 2/3·exp(∓iφ′ⱼ)。推导保留 m ≠ 0 与准确等间隔相对相移的前提；这里给出实际参数对应的表达式，尚未声称这些参数已经获得数值。拆分完成后先归位，再让矩阵项飞入组成乘加式。组装后的原节点继续留在公式中；后续仅对三个系数作原位替换，最后同步更换输出记号。没有另开一张系数特写或上移整个求和式。

三个参数方块已移除，照明公式中的 k、m、φⱼ 本身是持久演员；跳动、两行说明、对照图和公式都读取同一进度。两行说明互斥，跳动结束后才显示对应原因，不提前讲参数估计方法。重复余弦展开与三相相消仍保持移除。

标称值对照位于参数偏差原因之后、粗分离推导之前。`createNominalFailure` 用同批正式频带重混受控三帧，实际 m=1、共同相位 π，并保留准确的相对相移。匹配结果采用真实 k 和 π；错位结果只改为 k+(0.3,0)；标称结果再采用共同相位 0。三种重建共用这些三帧、同一数值管线、相同滤波与强度标尺。没有改动原始观测、估计器或主线正式重建。π 仅为反相特例，不能据此宣称任意相位误差都会完全抵消。

左侧反相特写先使用正确对齐、OTF 校正的同一 q，再比较单位化复数方向；右侧继续保留标称波矢误差。负值来自实际逆 FFT。误差图逐像素取标称结果减匹配结果，剖面选择误差能量最大的一行，直接测量其 DFT 主峰。本例该行主峰为 8 格、标称结果最小值约 −0.04785；匹配结果也可能有滤波振铃，应比较同一标尺上的实际差异。

参数错误与规则伪影的依据为 [Fan et al. 2019，Artifact analysis](https://link.springer.com/article/10.1007/s41048-019-0081-7)，其中区分波矢、相位和调制度错误对伪影的影响。0.3 格与 π 是本页教学输入，不是该文实验数据。

本例保持帧间相对相移已知且准确的假设。直接对第 10 步的权重因式分解：

$$
u_{\pm1,j}=\frac1m e^{\mp i\phi_\Delta}\widetilde u_{\pm1,j},\qquad
\widetilde u_{0,j}=\frac13,\quad \widetilde u_{\pm1,j}=\frac23e^{\mp i\phi'_j}.
$$

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

中央公式的后续展开直接代回已有观测模型（`SIMBandFormulas.source` 与 `observation`，理论来源同下方 fairSIM Supplementary Note 1）。本页的 S 是样品频谱，因此条纹照明下应写为：

$$
D_j(\mathbf f)=H(\mathbf f)\mathcal F\{s(\mathbf r)I_j(\mathbf r)\}(\mathbf f),\qquad
\mathbf D(\mathbf f)=H(\mathbf f)M
\begin{bmatrix}S(\mathbf f)\\S(\mathbf f-\mathbf k)\\S(\mathbf f+\mathbf k)\end{bmatrix}.
$$

同一检测频率上的 H 对三帧是同一个标量。提出 H 后，准确三步相对相移的正交性给出：

$$
\widetilde U M=\operatorname{diag}\bigl(1,m e^{i\phi_\Delta},m e^{-i\phi_\Delta}\bigr),\qquad
\widetilde{\mathbf A}=H(\widetilde U M)
\begin{bmatrix}S(\mathbf f)\\S(\mathbf f-\mathbf k)\\S(\mathbf f+\mathbf k)\end{bmatrix}.
$$

动画先在舞台中央合写向量式，再在同一公式中展开 D、提出 H、展示对角响应，最后让各行系数与 S 的原节点组成三个临时频带。原向量式在这之后才缩小移到上方。零级满足 Ã₀=HS；三帧混合观测 Dⱼ 不能直接替换为样品的 HS。数值检查覆盖多组 m、共同相位和 H，逐项验证非对角项为零以及代入前后的复数输出相等。


主线的高频点 q=(14,0) 在零级通带外，不适合作零级与旁带的相关匹配。参数估计先转看公共区，估计完成后再回到高频点。参数估计选择 0 级与正一级，求逆结束及交接时不单独强调负一级；负一级仍参与正式解混与重建。照明波矢及相位沿用同一约定，归位符号由级次决定。内部独立证明仍以负一级验证抵消。

第 20 步显示三个方向的估计结果，并展开方向 1：将估计相位和调制度填回混合矩阵 M，再计算 U = M⁻¹。两个数值矩阵来自同一份采用参数；波矢保留给后续归位。第 21 步直接用 U 的三行对三帧频谱乘加。生产时间轴省去重复的 0 / 0 / 1 系数证明，内部数学测试仍独立核对逆矩阵恒等式。

波浪号由共享的 `SIMBandFormulas.notation` 统一解释为临时分离阶段：ũ 为可直接计算的权重，Ũ 为这些权重组成的矩阵，Ã 为观测经该矩阵得到的临时输出。零级 Ã₀=A₀；旁带相对于真实来源仍有未知幅相比例，不能把波浪号解释成“该数值未知”。频谱使用 S(f)、Dⱼ(f)，变换使用 ℱ；参考推导文档中的 S̃、D̃ 则是另一套傅里叶记号，其 B 对应本页 Ã。

参数章用帽号标记估计值。交回主线时明确：后文 m、φⱼ、k 指采用的估计值，频带继续记为 A，减少符号切换。逆矩阵与采用的 M 相乘为 I，并不单独证明采用的参数等于真实参数。

## 单一时间轴

- `SIMMotion.scenes` 保留原 24 个物理场景，供原几何模型使用。
- `SIMMotionParameterChapter.plan(SIMMotion)` 是生产页面使用的 33 步清单，`active: true`。
- 在 `inverse-demix` 后插入两个衔接场景和八个估计场景，之后直接接 `separate-bands`；基础模型中的 `verify-demix` 不进入生产停点清单。
- `flow.frame(position)` 为原场景返回 `baseTime`，为估计场景返回 `sceneId` 与完整 0—1 进度；每个新增停点对应该幕终点，不漏掉第一幕动画。
- `SIMMotion.createPlayer({durations: flow.durations})` 控制唯一播放进度；原模型默认时长保留，方便独立校验原几何。
- `SIMParameterLesson.createView` 持续使用同一对频谱、公共区、复平面和拟合画面，不创建时钟或全局事件；`createFormulaView` 的持久部件跟随同一进度。主线负责导航、暂停、回退、重播和减少动态效果。
- 主舞台有临时分离、参数章节、采用参数三个兄弟 SVG 容器，另用公共频谱图层承接第 11→12 步；过渡由同一进度控制，参数图形使用作用域样式，下方公式仍使用主页面固定公式栏。

独立页继续加载 `sim-parameter-app.js`；完整主页面只加载其可复用 model/view、共享估计器、主线章节适配器及两个衔接画面的视图。

## 依据与验证

理论依据：[fairSIM 2016 Supplementary Note 1](https://doi.org/10.1038/ncomms10980)。源码顺序见 [SimAlgorithm.java](../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java) 181—190 行的临时分离、601—603 行的正式分离及后续归位；[BandSeparation.java](../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/BandSeparation.java) 构建矩阵并累加加权观测。

位置搜索仍采用教学实现：公共区自身 OTF 校正、FFT 批量归一化相关、整数峰定位和 5×5 局部细化。最终幅相则按本地 `commonRegion/getPeak` 实现，包括二维两束分支的 0.05 OTF 阈值、0.15 径向排除及整数旁带索引规则。页面沿用自己的圆形 OTF 和双精度 FFT；不能把整套估计器声称为原版逐行复刻。详见[getPeak 源码约定与数值核验](../parameter-demo/scenes/get-peak/README.md)。

`npm run check` 包含生产 HTML 全部脚本的模拟 DOM 接线测试：33 步往返、完整估计动画、暂停与重播、减少动态效果、同一批原始像素及估计参数进入重建、相关分数与图坐标、连续比例箭头、实际逆矩阵权重、逐行高亮、系数与说明互斥、恢复与收拢、临时旁带的正负相位和符号跳动与说明互斥、标称值对照的真实重建、负值和误差主频、矩阵重现与单个权重抽出、系数分步展开及双色因子路径、同一权重归位、矩阵项飞入与观测配对、飞入节点保留、局部系数原位替换及临时输出同步、三行临时矩阵重组与向量收拢、主舞台与公式栏同步、中央公式的观测代入及对角响应、同一批 H/S/系数展开为频带、单一 132 秒分镜，以及独立 Demo 的既有测试。原 24 场景的详细几何测试通过测试替身隔离时间轴；生产时间轴直接跳过证明段，进入正式解混面板后再淡入，避免跳过的证明闪现。按项目约定不启动浏览器、不截图、不做视觉或布局验收。

## 连动表现

第 10 步显示来源列 = U × 观测列；第 11 步的原位说明始终留在对应系数行内，原矩阵的括号、行背景、帧标签及来源定义保持可读。两轮说明结束后，先撤去外围内容，再让公式条目移动、缩小，汇成 A = U·D。临时分离推导在照明参数来源之后继续。第 12 步沿用相同位置的临时向量，展开三份频带，再让负一级退出比较。用于估计的两份频谱继续复用相同节点、纹理、复数数组与频率/亮度标尺：27 格频率范围、218 单位图宽，分别使用零级青色与正一级紫色。

第 12 步先用 k 说明模型中的真实位置差，公式移项与抵消同步；两谱叠合后分开，框出两个检测坐标中的公共区，最后才浮现三个点。公共区轮廓为两边 OTF 非零的交集；第 15 步收紧为可靠阈值交集，再保留两行原式，各自在等式两边乘自身 H*，把 H*H 合成 |H|²。停留后再引入分母，约去相同模平方，收成 U、V，衔接候选比较。补偿幅条已移除。数值估计也执行同样两步，等价于固定 fairSIM `commonRegion` 的各除自身 OTF；本页用动画展开除法，不声称源码中分为两次函数调用。固定 q 的 U 不随候选改变，旁带取值、旁带 OTF 与公共区随候选更新。详见[参数章节说明](../parameter-demo/README.md)。

第 13 步的一维实数例子只解释移动与逐列乘积和，不再加入人为相位。第 14 步先保留一维终点、收起表格，再接回同一对实际频谱及公共区、P、Q、R；二维图出现后才开始移动。第 14—18 步解释旁带与 OTF 同移、自身共轭与模平方归一、逐候选乘加和填格、完整扫描成本、FFT 一次成图与小数细化。教学数与教学位移不带入原图，评分来自完整可靠公共区。

第 16 步移除 J、arg min、α̂ 预测与残差推导。已累计频点变色，完整累计后分数飞入原格；填完图后，左侧换成 N²×N² 的工作量。第 17 步先让原有元素变暗，横向展开两张完整固定预处理频谱，各自在原位逆变换为空域复数场；三个光标同步遍历同一位置，直接逐点扫出共轭乘积图，取消连线汇入。乘积图原位做正 FFT 和归一化，再整张归位到同一评分图，交回原有评分节点；每个结果格的坐标、大小、色标与直接算法一致。中间图采用独立对数模长色阶，避免零级中心压暗实际纹理。能量和掩膜交集计数也由 FFT 批量计算；最后的整数峰保持到第 18 步。两幕分别 36 秒和 44 秒，持续使用同一可回退时钟。

第 18 步为 68 秒的 gridLimit / phaseRamp / zoomCascade / returnSpectrum 四段，边界为 0.22、0.56、0.935。整数格放大后的等高线来自同一观测的 21×21 局部实际分数，不读取真值或绘制人为偏移靶心。三栏用同一候选驱动空域相位斜坡、FFT 后复数频谱、同移 OTF、可靠公共区与第一轮评分。后半段局部网格移到中央，按实际三轮 5×5 数据与赢家继续缩进；第二、三轮边界为 0.70、0.85，第三轮在 0.915 完成。最终 0.01 格标注为搜索步长。锁定后局部网格退场，复用原 `frequency`、`sharedRoot`、OTF、公共点及复数箭头展开完整图像，结束时与第 19 步 least-squares-fit(0) 的位置和数值一致；全过程 k̂ 固定，不重新估计或替换纹理。顶部标题、说明、公式、画面和独立参数页共用相同状态；第 17 步的共轭乘积与第 18 步的旁带相位调制在公式及注文中明确区分。专用视图为 `scenes/refine/view.js`，复数调制和有限 Fourier 求和经过独立数值对照。

第 19 步从第 18 步的完整概览开始，旧概览退出后显示两份最终工作频带，分别逆 FFT，再按锁定波矢对旁带应用空间相位斜坡。取同一个实际空域位置解释共轭乘积和参考能量，然后累计全部 N² 个位置；全部累加完成才显示相除结果，再读取模长和相角。公式和讲解跟随同一七拍状态。P/Q/R、试探旋转、残差点云、arg min 和归一化残差恒等式均退出主线。第 20 步直接回填矩阵。

主线原有采集的共同相位约为 0，独立页为 0.35 rad；两个入口保持各自原观测。相位斜坡中的示例位置和复数箭头来自实际空域数组，不为制造转动而修改观测相位。

各幕生产定义、公式和纯状态位于 `../parameter-demo/scenes/<id>/`，由 `sim-parameter-two-stage.js` 组合。共享频谱几何与持久公式模板位于 `sim-parameter-two-stage-view.js`；最终 getPeak 另有独立的 `storyboard/state/layout/view/formula-view`。一维教学视图位于 `scenes/line-shift/view.js`，细化视图位于 `scenes/refine/view.js`，桌面样式继续使用 `sim-parameter-two-stage.css`。完整页「原理与数值」保留手算表。准确路径见[分镜目录](SCENES.md)，维护规则见[治理约定](GOVERNANCE.md)。
