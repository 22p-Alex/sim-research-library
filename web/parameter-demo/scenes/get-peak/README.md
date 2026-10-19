# getPeak 分镜单元

主线第 19—27 幕、独立参数页第 10—18 幕共用此单元。规范名称 `get-peak`；宿主兼容 ID 是 `least-squares-fit`。按本地 fairSIM 最终幅相路径，从锁定位置的临时频带得到一个共同复系数，先解释旁带补偿，再交给正式权重。

当前修改按[第 18 幕后连贯性修订计划](../../../motion/plans/2026-10-19-scene18-continuity.md)执行。旧设计与交付计划已清理，可从 Git 基线 `e7e412c` 恢复；现行动作、理论和数据约定集中维护在本目录。

| 文件 | 职责 |
|---|---|
| `storyboard.js` | 九幕时长、动作、标题、说明、公式拆项、强调顺序、拍内 cues 和可见性 |
| `state.js` | 纯展示状态，读取最终数组、示例位置和完整前缀和；不重新计算估计 |
| `layout.js` | 固定桌面 SVG 槽位 |
| `view.js` | 持久画面演员及更新 |
| `formula-view.js` | 按本拍定义构建和强调公式节点；复用 α 伸缩、旋转及合并的同一组符号 |

## 九幕与交接

| key | 时长 | 运算 |
|---|---|---|
| `finalPrepare` | 21 秒 | 对应地址 → 各自 OTF → 保留未知 α → 工作频谱与复数着色 |
| `finalInverse` | 12 秒 | 先建立 u、v，再由 q+k̂ 拆出正号的额外转角 |
| `finalShift` | 7 秒 | 放大实际位置，反向撤掉已知额外转角 |
| `finalShiftScan` | 5 秒 | 输入、输出两图同步扫描，将单点动作推广到全场 |
| `finalCompare` | 15 秒 | 对齐后解释 α 的伸缩与转角，再回到实际位置比较 |
| `finalProduct` | 12.8 秒 | 原输入与向量先就位，再做共轭乘积与参考能量 |
| `finalSum` | 17.6 秒 | 全部 N² 位置累计 |
| `finalDivide` | 8 秒 | 复数和除以参考能量 |
| `finalRead` | 8 秒 | 读取模长、相角及参数卡片 |

总时长由拍定义求和，当前 106.4 秒，前五幕合计 60 秒。修改本拍 `duration` 即可改变节奏；动作区间使用本拍 0—1 进度，自动测试核对改时长后公式、动作及揭示顺序不变。`steps` 定义幕内标题、说明与公式切换，和动作共用同一时钟。新增公式 token 时，同时给出强调节点名称；布局修改集中在 `layout.js`。

入口声明为 `locked-spectrum`，来自 `refine(1)`。原频谱和波矢标记置于 `legacyBody` 之外：第 19 幕展开同一频谱演员的原生检测坐标，在同槽位交给工作频谱；波矢标记保留到第 24 幕输入就位后。单点和全场校正时参考场暂退：第 21 幕由放大复平面讲清反向旋转，第 22 幕只显示输入 v 与输出 vₖ。下一幕恢复原参考场，比较与共轭复用同一组向量节点、样本和标尺。输出为 `estimated-parameter-cards`，依次交给 `adopted-weights`、`restore-weight`、`assemble-weights`。`stops` 给出九个独立导航定义；`stopProgress` 将局部进度映射到同一计算时钟。旧 `least-squares-fit + beat` 定位码仍兼容。整个场景读取宿主进度，不维护播放器。

第 19 幕只保留对应频率地址的未知 α，模长→对数亮度、相角→色相的显示标尺仍先建立。标尺最终回到实际 B₀(q)，使用与频谱相同的 `displayColor` 函数。α 的伸缩与共同相位演示移到第 23 幕，明确标为几何示意；实际主线相位接近零时，不给真实箭头添加示意转角。

第 20 幕先分别逆 FFT，再将 f=q+k̂ 代入逆变换核。核中的 q、k̂ 两项沿独立路径拆开，含 k̂ 的正号因子完成后才标记为额外转角 δ。第 21 幕才引入负号的反向因子。主画面从单点旋转进入第 22 幕的两图扫描，不再放置第三张彩条图、微型复平面和多列复数读数。

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

这说明额外正号因子来自原有频率地址差；逆变换只是将该差别写成空域形式。实际估计存在误差时，动画与公式使用近似关系。先推导 δ，再引入反向因子，最后解释剩余的共同 α。

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

共同复比例的因果链与九幕同步：入口先建立同源频率关系，逆变换后推出额外正号相位，再反向补偿；对齐后才讲 α 的伸缩与转角。随后说明 u*vₖ≈α|u|²，再分别累计；除法拍先说明 C≈αE₀，再读取 α̂。精确比例限于匹配的理想模型；最小二乘推导继续留在理论区。

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
