# getPeak 分镜单元

主线第 19—27 幕、独立参数页第 10—18 幕共用此单元。规范名称 `get-peak`；宿主兼容 ID 是 `least-squares-fit`。按本地 fairSIM 最终幅相路径，从锁定位置的临时频带得到一个共同复系数，先解释旁带补偿，再交给正式权重。

当前修改按[第 18 幕后连贯性修订计划](../../../motion/plans/2026-10-19-scene18-continuity.md)执行。旧设计与交付计划已清理，可从 Git 基线 `e7e412c` 恢复；现行动作、理论和数据约定集中维护在本目录。

| 文件 | 职责 |
|---|---|
| `storyboard.js` | 九幕时长、动作、标题、说明、公式拆项、强调顺序、拍内 cues 和可见性 |
| `state.js` | 纯展示状态，读取最终数组、示例位置和完整前缀和；不重新计算估计 |
| `layout.js` | 固定桌面 SVG 槽位 |
| `view.js` | 持久画面演员及更新 |
| `inverse-view.js` | 紧凑原定义、单条 MathML 主等式、局部变形与最后的额外转角 |
| `formula-view.js` | 按本拍定义构建和强调公式节点；复用 α 伸缩、旋转及合并的同一组符号 |

## 九幕与交接

| key | 时长 | 运算 |
|---|---|---|
| `finalPrepare` | 21 秒 | 对应地址 → 重新筛选与各自 OTF → 定义 B₀、B₁ → 共同关系与复数着色 |
| `finalInverse` | 60 秒 | 原定义固定在紧凑参考区；中央一条等式依次换地址、代入、提出 α、拆指数、提出因子、识别 u，最后演示转角 |
| `finalShift` | 7 秒 | 放大实际位置，反向撤掉已知额外转角 |
| `finalShiftScan` | 5 秒 | 输入、输出两图同步扫描，将单点动作推广到全场 |
| `finalCompare` | 15 秒 | 对齐后解释 α 的伸缩与转角，再回到实际位置比较 |
| `finalProduct` | 44.3648 秒 | 保留原 12.3648 秒入口；A1—A5 展开相位抵消与参考能量 |
| `finalSum` | 40 秒 | B1—B5：三项提取公因子，再回到实际全场累计 |
| `finalDivide` | 36 秒 | C1—C4：两边同除、约去能量、数值比值、预测观测 |
| `finalRead` | 24 秒 | D1—D3：读取模长与相角，再加到三次已知步进 |

总时长由拍定义求和，当前 252.3648 秒，前五幕合计 108 秒。第 20 幕为 60 秒，各个操作后留有静止阅读时间。修改本拍 `duration` 即可改变节奏；动作区间使用本拍 0—1 进度，自动测试核对改时长后公式、动作及揭示顺序不变。`steps` 定义幕内标题、说明与公式切换，和动作共用同一时钟。新增公式 token 时，同时给出强调节点名称；布局修改集中在 `layout.js`。

入口声明为 `locked-spectrum`，来自 `refine(1)`。原频谱和波矢标记置于 `legacyBody` 之外：第 19 幕展开同一频谱演员的原生检测坐标，在同槽位交给工作频谱；波矢标记保留到第 24 幕输入就位后。单点和全场校正时参考场暂退：第 21 幕由放大复平面讲清反向旋转，第 22 幕只显示输入 v 与输出 vₖ。下一幕恢复原参考场，比较与共轭复用同一组向量节点、样本和标尺。输出为 `estimated-parameter-cards`，依次交给 `adopted-weights`、`restore-weight`、`assemble-weights`。`stops` 给出九个独立导航定义；`stopProgress` 将局部进度映射到同一计算时钟。旧 `least-squares-fit + beat` 定位码仍兼容。整个场景读取宿主进度，不维护播放器。

第 19 幕说明最终幅相估计从原始临时频带重新筛选，而非复用位置搜索的旧选区。筛选后各除自身 H，在 9.5 秒先定义 B₀、B₁，11 秒才写两路对应地址的共同关系；α 仍是未知量。随后建立模长→对数亮度、相角→色相的显示标尺。标尺最终回到实际 B₀(q)，使用与频谱相同的 `displayColor` 函数。α 的伸缩与共同相位演示放在第 23 幕，明确标为几何示意；实际主线相位接近零时，不给真实箭头添加示意转角。

第 20 幕按[公式教学设计](../../../motion/plans/2026-10-19-inverse-formula-teaching-design.md)实现。0—3 秒提出问题；3—6.1 秒原位逆变换并让整图退场，完整定义出现。6—9.5 秒移动的是青色 u、紫色 v 两条变换公式，它们向左归位；图像中心不随公式左移，p=0.108 时已退场。10—11.5 秒 v 的副本从左侧移到视野中央，字号由 21 放大为 36；12—12.8 秒下方换元式浮现，13—14 秒高亮框描出 f，15.5—18.2 秒 f 在原有括号和指数中展开成 q+k̂，高亮框与地址槽连续变宽，周围项平滑让位，同时更换求和指标。19—24 秒只替换频谱值，24—27 秒单独提出 α；27—34 秒拆指数；34—40 秒说明固定 r 后额外因子与 q 无关，并提出求和；40—45 秒将剩余完整求和与左侧青色定义对照，收成 u；45—49 秒先定义 δ，再将指数写成 exp(iδ)。49—57 秒保持主式与原定义，用同长示意箭头展示额外转角；57—60 秒停住结论，交给下一幕反向校正。

主式由 `storyboard.js` 的 `inverseTokens/inverseStages` 提供唯一数学内容；`state.js` 的 `inverseMotion` 连续计算每个数学演员的位置、缩放与透明度。MathML 符号组以一次缓存的真实字宽组成主行，固定左端与关系符号列。地址变形由 `inverseAddressParts/inverseAddressExpansion` 单独管理：B₁、括号、指数前后项保留为持久子式，f 原位变为 q，再沿水平方向展开 +k̂；外围槽位按相同增长量让位。不得用完整 B₁ 或完整指数的切换代替槽内扩展。后续 α 提出、指数拆分、因子移出求和、求和块收拢、δ 副本进入指数继续使用同一时钟。完整参考定义左移后固定保留，底部隐藏重复公式。所有公式只编译一次，运动过程不重复测量布局，可正反定位。

末段区域：公式层限定在 SVG y≤350，复平面层从 y=366 开始，两层有独立裁剪边界。主行位于 y=180，δ 定义位于 y=280；复平面中心为 (565,453)，几何性质和坐标读数在右侧。代数区域与复平面区域不共用行高或槽位，末帧两条公式不会继续占据几何区。

风格接口：用户停止并行风格修改后，本段的样式由 `sim-parameter-two-stage.css` 中独立的 `formula-teaching` 规则管理。新公式容器为 `.pe-inverse-math`，所属根标记为 `[data-inverse-style-scope="formula-teaching"]`；旧的 `.pe-peak-math` 字号规则不控制新行。可通过继承变量 `--sim-inverse-main-size`、`--sim-inverse-reference-size`、`--sim-inverse-rule-size`、`--sim-inverse-angle-size`、`--sim-inverse-unit-size` 与 `--sim-inverse-ink/accent/reference/side` 调整字号及颜色。真实浏览器在首次展开前缓存 MathML 字宽；无字体布局的状态测试采用 `layout.js` 的紧凑 em 宽度。MathML 结构、基线及场景槽位由本目录 JS 管理。资产版本 `inverse-address-expand-20261019-v4` 同步两个入口，确保刷新后加载新的动画和样式。

正向旋转使用明确标记的复乘示意，基准 z=αu 的单位长度和初始方向只用于几何讲解，不代表估计值。整数位置 r 从本组网格选取，δ=2πk̂·r/N 由已锁定波矢计算；显示模 2π 的主值转角。几何箭头满足 z→z exp(iδ)，保持模长。第 21 幕才对实际旁带值引入负号反向因子。主画面随后进入第 22 幕的两图扫描。

α 公式在第 23 幕的 `alphaStretch → alphaRotate → commonAcross` 三步共用 `alphaProduct` 缓存节点。上行保留 z→mz，再展开旋转一段；复制的 m、z 先就位，相位因子从运算标签进入预留位置，最后由 α 接替两个因子，末尾 z 不移动。下行依次显示模长、相角与对齐后的空域关系，不带行首逗号。第 23 幕的 5.4—6.0 秒展开公式，8.1—9.0 秒合并系数，10.8—11.4 秒退出示意、返回真实箭头；末段回到最初位置，交给下一幕共轭相乘。减少动态效果时，公式直接显示当前子步结果。

## 数据与来源

在整数 DFT 波矢与公共信息匹配的理想模型中，由对应地址的关系直接展开逆变换：

$$
\begin{aligned}
v(\mathbf r)
&=\frac1{N^2}\sum_{\mathbf f}B_1(\mathbf f)e^{2\pi i\mathbf f\cdot\mathbf r/N}\\
&=\frac\alpha{N^2}\sum_{\mathbf q}B_0(\mathbf q)e^{2\pi i(\mathbf q+\widehat{\mathbf k})\cdot\mathbf r/N}\\
&=\alpha u(\mathbf r)e^{i\delta(\mathbf r)},\qquad
\delta(\mathbf r)=\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r.
\end{aligned}
$$

上述展开直接使用 [NumPy 正逆 DFT 定义](https://numpy.org/doc/stable/reference/routines.fft.html#implementation-details) 与指数恒等式；归一化为二维逆变换的 1/N²。固定 r 后，exp(2πik̂·r/N) 与求和指标 q 无关，所以可提出。这说明额外正号因子来自原有频率地址差；逆变换只是将该差别写成空域形式。实际估计存在误差时，动画与公式使用近似关系。先推导 δ，再引入反向因子，最后解释剩余的共同 α。

反向旋转因子仅由锁定波矢和数组坐标决定，原理如下；它不再作为第三张图占据主舞台：

$$
\theta(\mathbf r)=-\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r,\qquad
p_{\widehat{\mathbf k}}(\mathbf r)=e^{i\theta(\mathbf r)},\qquad
v_{\widehat{\mathbf k}}(\mathbf r)=v(\mathbf r)p_{\widehat{\mathbf k}}(\mathbf r).
$$

第 21 幕使用实际位置的 v 放大演示，旋转动画选取模 2π 的主值角，保持长度；第 22 幕输入和输出在相同坐标取值，按行生成完整输出。旋转因子处处为单位模，v 与 vₖ 共用原来的亮度标尺。逐点乘法改变复数相角，空域坐标不变；负号正向 DFT 下有：

$$
\begin{aligned}
\mathcal F_N\{v\,p_{\widehat{\mathbf k}}\}(\mathbf f)
&=\sum_{\mathbf r}v(\mathbf r)e^{-2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}
e^{-2\pi i\mathbf f\cdot\mathbf r/N}\\
&=\sum_{\mathbf r}v(\mathbf r)e^{-2\pi i(\mathbf f+\widehat{\mathbf k})\cdot\mathbf r/N}
=B_1(\mathbf f+\widehat{\mathbf k}).
\end{aligned}
$$

即旁带频谱整体移动 −k̂。整数波矢是 DFT 格上的循环移频；非整数波矢时，上式右侧按有限 DFT 的三角插值延拓取值。输入场与最终估计沿用原计算。计算来源是下方 Correlation.java 的 `getPeak`：先逆变换，再 `fourierShift`，然后才共轭相乘。坐标符号转换见[本地计算实现](../../../shared/sim-parameter-estimation.js)的 `fairSimGetPeak` 注释与逐点公式。

### 换域为什么保留共同复比例

固定同一组最终工作频谱，定义对齐旁带：

$$
u=\mathcal F_N^{-1}\{B_0\},\qquad
v=\mathcal F_N^{-1}\{B_1\},\qquad
B_{1,\widehat{\mathbf k}}=\mathcal F_N\{v_{\widehat{\mathbf k}}\}.
$$

把负指数正 DFT 代入频域内积，展开两路空域求和。不同位置的指数交叉项求和为零，同一位置留下 N²，由此得到：

$$
\begin{aligned}
\sum_{\mathbf q}B_0^*(\mathbf q)B_{1,\widehat{\mathbf k}}(\mathbf q)
&=N^2\sum_{\mathbf r}u^*(\mathbf r)v_{\widehat{\mathbf k}}(\mathbf r),\\
\sum_{\mathbf q}|B_0(\mathbf q)|^2
&=N^2\sum_{\mathbf r}|u(\mathbf r)|^2.
\end{aligned}
$$

参考能量非零时，相同的 N² 在比值中抵消。这个内积等价由 [DFT 定义与二维归一化](https://numpy.org/doc/stable/reference/routines.fft.html#implementation-details)直接推出，对任意已准备数组和上述频移都成立，包括按有限傅里叶求值定义的小数位移；它并不保证估计系数就是真实照明参数。最终工作数组和搜索工作数组使用不同掩膜，不能将它们的累计量直接等同。

共同复比例的因果链与九幕同步：入口先重新准备工作数组、建立同源频率关系，再说明换域目的；逆变换后推出额外正号相位，再反向补偿；对齐后才讲 α 的伸缩与转角。随后说明 u*vₖ≈α|u|²，再分别累计；除法拍先说明 C≈αE₀，再读取 α̂。精确比例限于匹配的理想模型；最小二乘推导继续留在完整页理论区。

唯一最终计算入口是 `lesson.estimate.finalPeak`。`prepared`、`spatial`、`shifted`、`product`、`energy` 和 `sums` 分别对应各拍。`sums` 包含 N²+1 项，首项为零；屏幕累计计数指完整空域位置。`supportCounts` 仅说明最终频域掩膜保留点数，不能作为空域累计次数。

$$
\widehat\alpha=
\frac{\sum_{\mathbf r}u^*(\mathbf r)v_{\widehat{\mathbf k}}(\mathbf r)}
{\sum_{\mathbf r}|u(\mathbf r)|^2},\qquad
\widehat m=|\widehat\alpha|,\qquad
\widehat\phi_\Delta=\arg\widehat\alpha.
$$

来源：[本地 Correlation.java](../../../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java) 的 `commonRegion/getPeak`，固定提交 `711afd12cb8c4fd4207bbca7ee7610c5aed4f732`。`getPeak` 第 199—217 行依次复制、准备、逆变换、移频、共轭相乘并除以参考能量；`commonRegion` 第 242—297 行定义 OTF 筛选和径向排除。[Java 与独立 DFT 对照测试](../../../../tests/sim-fairsim-get-peak.test.cjs)核验掩膜、频带、复系数、归一化和小数位移。入口选点来自最终双路掩膜，在原始临时频带中读取数值；不参与最终计算或累计。

修改后执行 `npm run check`；使用两页的“分镜排练”定位拍内状态。数值和公式状态通过不代表实际字体及布局已验收。通用规则见[治理约定](../../../motion/GOVERNANCE.md)。
