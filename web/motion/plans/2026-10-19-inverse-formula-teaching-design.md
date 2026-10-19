# 第 20 幕：从逆变换定义理解额外转角

状态：已实现带色公式左移、主式居中放大、f 槽原位展开与末帧区域隔离，完整自动检查 250 项通过。适用于主线 `parameters.get-peak-inverse` 与独立参数页 `get-peak-inverse` 的共用单元。视觉效果仍由用户检查。

## 1. 本幕要教会什么

主问题：同一份信息的频率地址相差一个已知波矢，为什么到了空域，会多出一个随位置变化的转角？

观众离开本幕时应当能够回答：

1. 频谱的值与读取它的频率地址是两件事；地址同时出现在逆变换的指数里。
2. 换地址时，求和指标、频谱自变量、指数中的频率必须一致变化。
3. 对一个固定空间位置，额外指数与求和指标无关，所以可以提出求和。
4. 剩余部分就是原来的参考场；额外指数模长为 1，只增加相角。

设计判断：现在的难点包括公式空间分散、画面与底部重复显示、符号运动多于数学操作提示。新方案让一条主等式承担全部推导，原定义作为固定参考，转角图最后出现。

## 2. 从成像关系核对前提

以下推导沿用动画命名：临时频带用波浪号 A，筛选并除以各自 OTF 后才叫 B。局部推导文档的 B 有时指临时分离结果，不能直接混用这两个阶段的名字。

单方向、三帧相对步进已知且等间隔，照明平均强度归一化为 1。离散坐标下：

$$
I_j(\mathbf r)=1+m\cos\left(\frac{2\pi}{N}\mathbf k\cdot\mathbf r+\phi'_j+\phi_\Delta\right),\qquad
\phi'_j=\frac{2\pi j}{3},\quad j=0,1,2.
$$

由余弦展开和频域乘积关系，理想观测为：

$$
D_j(\mathbf f)=H(\mathbf f)\left[S(\mathbf f)+\frac m2e^{i(\phi'_j+\phi_\Delta)}S(\mathbf f-\mathbf k)+\frac m2e^{-i(\phi'_j+\phi_\Delta)}S(\mathbf f+\mathbf k)\right].
$$

三相指数和与双倍相位指数和均为零，因而按当前临时分离归一化：

$$
\begin{aligned}
\widetilde A_0(\mathbf f)&=\frac13\sum_{j=0}^2D_j(\mathbf f)=H(\mathbf f)S(\mathbf f),\\
\widetilde A_{+1}(\mathbf f)&=\frac23\sum_{j=0}^2D_j(\mathbf f)e^{-i\phi'_j}
=\alpha H(\mathbf f)S(\mathbf f-\mathbf k),\\
\alpha&=m e^{i\phi_\Delta}.
\end{aligned}
$$

在正确整数波矢、准确 OTF、无噪声且两路筛选区域严格对应的理想模型中，以同一个公共掩膜 M 表示保留的信息：

$$
B_0(\mathbf q)=M(\mathbf q)S(\mathbf q),\qquad
B_1(\mathbf q+\mathbf k)=\alpha M(\mathbf q)S(\mathbf q)=\alpha B_0(\mathbf q).
$$

这解释了上一幕的输入关系，而不是把共同系数凭空假定出来。实际使用估计波矢，且掩膜、OTF、观测可能有误差，主线继续写：

$$
B_1(\mathbf q+\widehat{\mathbf k})\approx\alpha B_0(\mathbf q).
$$

上述成像与临时分离仅用于核对理论，不在本幕重新播放。未知共同相位包含在 α 中，本幕不揭示其估计数值。

## 3. 完整代数链

采用正 DFT 为负指数、逆 DFT 为正指数的约定；两轴大小均为 N。空间位置与求和地址均为二维整数向量，地址按 N 周期取模。两条原定义为：

$$
u(\mathbf r)=\frac1{N^2}\sum_{\mathbf q}B_0(\mathbf q)e^{2\pi i\mathbf q\cdot\mathbf r/N},\qquad
v(\mathbf r)=\frac1{N^2}\sum_{\mathbf f}B_1(\mathbf f)e^{2\pi i\mathbf f\cdot\mathbf r/N}.
$$

先按整数估计波矢推导；此时下面的换元是一一对应的周期重编号。实际比例关系的误差用近似号保留：

$$
\begin{aligned}
v(\mathbf r)
&=\frac1{N^2}\sum_{\mathbf f}B_1(\mathbf f)e^{2\pi i\mathbf f\cdot\mathbf r/N}\\
&=\frac1{N^2}\sum_{\mathbf q}B_1(\mathbf q+\widehat{\mathbf k})e^{2\pi i(\mathbf q+\widehat{\mathbf k})\cdot\mathbf r/N}\\
&\approx\frac1{N^2}\sum_{\mathbf q}\alpha B_0(\mathbf q)e^{2\pi i(\mathbf q+\widehat{\mathbf k})\cdot\mathbf r/N}\\
&\approx\frac\alpha{N^2}\sum_{\mathbf q}B_0(\mathbf q)e^{2\pi i(\mathbf q+\widehat{\mathbf k})\cdot\mathbf r/N}\\
&\approx\frac\alpha{N^2}\sum_{\mathbf q}B_0(\mathbf q)e^{2\pi i\mathbf q\cdot\mathbf r/N}e^{2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}\\
&\approx\alpha e^{2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}
\underbrace{\frac1{N^2}\sum_{\mathbf q}B_0(\mathbf q)e^{2\pi i\mathbf q\cdot\mathbf r/N}}_{u(\mathbf r)}\\
&\approx\alpha e^{i\delta(\mathbf r)}u(\mathbf r),\qquad
\delta(\mathbf r)=\frac{2\pi}{N}\widehat{\mathbf k}\cdot\mathbf r.
\end{aligned}
$$

换地址后的第二行仍为等号；首次使用观测比例关系时才变成近似号。此后变形均为对近似模型右端的精确代数操作，左端仍保留近似号。

额外因子能提出求和的原因是：计算一个指定位置的值时，空间位置已经固定；求和遍历的是频率地址。已知波矢和空间位置都不随该求和变化。这个因子可以随空间位置变化，并不要求它在整张图上相同。

如把观测差写成残差，可使近似关系更明确：

$$
\begin{aligned}
E(\mathbf f)&=B_1(\mathbf f)-\alpha B_0(\mathbf f-\widehat{\mathbf k}),\\
\varepsilon(\mathbf r)&=\mathcal F_N^{-1}\{E\}(\mathbf r),\\
v(\mathbf r)&=\alpha e^{i\delta(\mathbf r)}u(\mathbf r)+\varepsilon(\mathbf r).
\end{aligned}
$$

残差只在理论说明中出现，不给初学者的主画面增加符号。

## 4. 为什么这确实是转角

由欧拉公式：

$$
e^{i\delta}=\cos\delta+i\sin\delta,\qquad |e^{i\delta}|=1.
$$

对任意复数 z，乘法等价于二维旋转：

$$
\begin{pmatrix}\Re(ze^{i\delta})\\\Im(ze^{i\delta})\end{pmatrix}
=\begin{pmatrix}\cos\delta&-\sin\delta\\\sin\delta&\cos\delta\end{pmatrix}
\begin{pmatrix}\Re z\\\Im z\end{pmatrix}.
$$

所以模长保持；非零复数的相角增加 δ，按模 2π 理解。此处令 z 表示已经包含共同系数的参考值，几何图只演示额外因子的作用，不演示或拟合 α。

$$
z=\alpha u(\mathbf r),\qquad z\longmapsto ze^{i\delta(\mathbf r)}.
$$

例子采用已知波矢和整数坐标。默认数据可用：

$$
N=128,\quad\widehat{\mathbf k}=(8,0),\quad\mathbf r=(4,0)
\quad\Longrightarrow\quad\delta=\frac{2\pi}{128}(8\times4)=\frac\pi2.
$$

两根示意箭头共用长度标尺；保留原箭头轮廓，副本绕原点逆时针转 90°。标明这是复乘示意；不能把单位长度或起始方向伪装成实际估计值。零值无可定义相角，但单位复数乘法仍成立。

最后的结论留给下一幕执行：

$$
v_{\widehat{\mathbf k}}(\mathbf r)=v(\mathbf r)e^{-i\delta(\mathbf r)}\approx\alpha u(\mathbf r).
$$

主线因果必须是先推出额外正向相位，再反向撤掉，随后才比较共同 α。

## 5. 画面结构与文字分工

以下为待实现的桌面布局约束，不是已完成的视觉验收。

- 保留当前页面外框和播放器。本幕主标题稳定为“频率地址的差，怎样变成额外转角？”。每步的一句话解释使用现有说明区，不同时更换多处长文。
- 两张图完成逆变换后，让整张图淡出，完整定义出现在固定参考区。不得把单个频点直接变成单个空间像素。
- 参考区使用一个居中的紧凑块，内部两行左对齐，定义的等号对齐；两行距离约为自身行高的 1.4 倍。参考字号约为主式的 70%。两条原定义从出现起始终保留。
- 主推导只用一行，位于舞台中部。左端函数、等号列和基线固定；右侧采用真实数学排版间距。较长状态使用同一字号预先校验可容纳宽度，避免手工给每个字形分配很大的空白槽。
- 原定义与主等式之间留出清楚的层次。辅助恒等式仅在对应步骤出现一条，完成后退场。
- 本幕底部公式区不再重复中央完整公式。其公式内容由同一数据源交给中央主式呈现，底部只承载当前说明与原有控件，避免出现第三套完整公式。
- 推导完成后，主等式保持原位，复平面占用其下方空闲区域。圆弧颜色与额外因子一致，示意与公式按上下关系阅读。

配色：常规公式为浅灰白；已知波矢及其额外因子为橙色；识别参考场时，完整匹配的求和块与原定义短暂同为青色。α 保持中性，不给它附加新的强调动画。颜色只辅助对应关系，每步仍有文字说明。

## 6. 分镜与初学者解释

建议先按约 60 秒实现，之后由用户依据真实阅读体验调整。下列时长是设计建议，不是已验证的教学效果。每段都包含动作后的静止阅读时间，不能将整段时间用于连续运动。

| 时间 | 数学动作 | 画面动作 | 只讲这一句话 |
|---|---|---|---|
| 0—3 秒 | 接住上一幕的对应关系 | 原有工作频谱与锁定波矢保持；明确本幕问题 | 同一份信息记在两个不同的频率地址。 |
| 3—8 秒 | 分别逆变换并定义两场 | 整图完成变换，再淡出；两条完整定义在参考区出现并固定 | 每个空域位置，都由整张频谱求和得到。 |
| 8—12 秒 | 从旁带定义开始 | 中央主行显出完整旁带定义；此后左端与等号列不动 | 接下来只展开旁带的这一条式子。 |
| 12—19 秒 | 换求和地址 | 先显出一个换元规则，再依次标出指标、频谱自变量、指数中的三个位置；统一完成替换后停住 | 换地址时，频谱的读取地址和指数里的地址都要一起换。 |
| 19—24 秒 | 代入同源比例 | 只强调频谱值这一块；先短暂展示已知对应关系，再原位换成含 α 的参考频谱 | 对应地址中的频谱值，可以用参考频谱乘 α 表示。 |
| 24—27 秒 | 提出共同 α | 只处理 α，在求和外的紧邻位置出现；主式其他部分不强调 | α 对所有求和项都一样，先提出去。 |
| 27—34 秒 | 拆指数 | 放大注意力到同一个指数；两项点积的和先得到标示，再在原位变成两个指数因子的乘积 | 指数里的相加，变成两个因子的相乘。 |
| 34—40 秒 | 提出额外指数 | 先标出求和遍历的地址，再突出橙色因子中没有它；同一个因子沿主式上方移动到求和外，其余项同步让位 | 固定一个空间位置后，每一项都多乘同一个因子，所以可以提出。 |
| 40—45 秒 | 识别完整参考场 | 剩余求和块与上方参考定义同时青色强调；用整块括号标示，再就地收为参考场符号 | 留下的这一整块，正是一直保留的参考场定义。 |
| 45—49 秒 | 为额外相位命名 | 橙色指数里的实数角度被标示，其定义在主式下方出现；随后主式才使用 δ | 把这个已知角度记为 δ，它由波矢和当前空间位置决定。 |
| 49—57 秒 | 解释复数几何 | 先显示单位模长，再使同长箭头绕原点转过示例角；最终主式全程保持 | 这个因子长度为 1，只让复数多转一个角度。 |
| 57—60 秒 | 结论与交接 | 停住最终关系、δ 定义和转角结果，不提前做负向旋转 | 下一步，用相反的角度把它转回去。 |

动画分组按数学结构组织：频谱值、完整指数、完整求和块。除了识别整块参考场和重排公共因子，不做逐字飞行。替换先后应留出辨认时间；相邻状态的未变内容保持位置和字形连续。运动只负责说明“哪里变了”，每步停稳后必须能读出独立成立的完整等式。

拆指数时短暂显示的唯一辅助恒等式：

$$
e^{i(a+b)}=e^{ia}e^{ib}.
$$

此处的两个实数角度分别对应原频率点积与额外波矢点积。辅助式完成作用后退出，不持续占据定义区或底部。

## 7. 小数波矢与实际数据的边界

不能对非整数波矢直接宣称“离散求和地址重编号”。严格的有限 Fourier 求值关系是：

$$
\begin{aligned}
\widetilde B_1(\boldsymbol\xi)&=\sum_{\mathbf r}v(\mathbf r)e^{-2\pi i\boldsymbol\xi\cdot\mathbf r/N},\\
\mathcal F_N\{v(\mathbf r)e^{-2\pi i\widehat{\mathbf k}\cdot\mathbf r/N}\}(\mathbf q)
&=\widetilde B_1(\mathbf q+\widehat{\mathbf k}).
\end{aligned}
$$

第一行把频谱延拓到实数频率地址，在整数地址处与原 DFT 一致。第二行通过合并负指数直接成立，不需要把非整数平移当作整数数组重排。

默认整数案例用于主线代数；简短注明该前提。若加载小数波矢数据，不能让整数重编号动画作为该组数据的严格等式证明，应注明当前为整数情形示例，并将实际小数校正连接到原理区的有限 Fourier 求值说明。

## 8. 实现落点和完成标准

- `get-peak/storyboard.js`：各步的完整公式、单句解释、语义名称、阅读停顿与拍内时间；下一幕的负号校正不提前进入本幕。
- `get-peak/layout.js`：将分散的双侧定义改为紧凑的两行参考区，设置主式固定等号列、辅助说明位置及末段复平面位置。
- `get-peak/inverse-view.js`：保留两条定义；以结构分组实现主式的局部替换、因子重排、整块识别与最后的旋转。复用缓存公式，不逐帧编译 KaTeX。
- `get-peak/state.js`：仍只读取最终工作数组与锁定波矢；增加必要的教学子步状态。数值估计引擎不需要因排版变化而改动。
- `get-peak/formula-view.js` 与宿主公式接线：使本幕的完整公式只有中央一份可见来源，复用现有说明与播放器；场景退出时还原其他幕的正常公式区。
- 样式与两页入口清单：同步共享单元的加载与字号约束；不操作发布副本。

验证重点：每个停稳状态的等式正确；三个地址同步替换；近似号出现时机；因子是否确实与求和指标无关；完整求和块与原定义一致；正向旋转及下一幕负向补偿符号一致；不提前展示估计 α；两页正反定位和改变时长仍确定一致。

第一轮先完成静止关键状态并核验数学顺序，再加入局部动画，避免先做运动再修补公式。可继续使用两页原有“分镜排练”查看各步，不创建第二个时钟。代码实现后的完整检查沿用 `npm run scenes:sync`、`npm run check` 与 `git diff --check`；视觉由用户检查。

## 9. 来源与本次核对

- [NumPy DFT 定义、正逆号与归一化](https://numpy.org/doc/stable/reference/routines.fft.html#implementation-details)：本方案的移频因子、二维归一化由这些定义直接展开推得。
- [本地三帧分离与参数推导](../../../Wiener-SIM/fairSIM-论文/fairSIM_参数估计逐步推导与代码实操.md)，第 3—5 节和第 10 节：共同相位、临时分离归一化、OTF 校正与最终复比例。
- [本地 Correlation.java](../../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java)，固定源码 `711afd12cb8c4fd4207bbca7ee7610c5aed4f732`，`getPeak` 第 194 行起：准备工作频谱、逆 FFT、旁带移频、共轭乘积、能量归一的真实顺序。
- [教学计算的坐标与符号转换](../../shared/sim-parameter-estimation.js)，`fairSimGetPeak` 第 165 行起：源码坐标变换后，实际旁带补偿指数为负号。

本次另用 Python 标准库独立执行 8×8 二维逆 DFT，覆盖三组正负整数波矢和一般复数参考频谱，同时检查残差关系。额外正号因子、反向负号补偿及残差恒等式最大绝对误差约为 4.1×10⁻¹⁶。默认 90° 示例也已核对。这验证理论符号和数值关系，不代表视觉或初学者理解效果已经通过。

## 10. 连续动画修订记录

用户指出从 `scene=parameters.get-peak-inverse&beat=finalInverse&p=0.111000` 到下一幕 `finalShift&p=0.009000` 看起来仍为公式跳变，因此替换了最初的局部淡出方案。公式演员现在由同一拍内进度驱动真实的位置和缩放：整图收拢到定义、v 副本进入主行、三个地址位置让位、α 提出、指数展开、额外指数沿主式上方提出、完整求和块缩小为 u、δ 定义的副本进入指数。

实际字宽由 MathML 在首次展开前测量并缓存，此后只更新 SVG 变换和透明度，不每帧测量，不使用 CSS 自动过渡或第二个时钟。符号宽度控制自然间距，公式左端与等号列在推导期间固定。`inverseMotion` 是接受字宽的纯函数；状态测试覆盖每个动作的中间位置变化、端点连续性、改变时长后路径一致、整块求和缩放，以及两页的正反定位。

用户已停止另一个风格 Agent 并授权接手，本次追加了本段专属 CSS，更新两个入口的资产版本。既有全局风格修改不整体回退。最新专项检查 13 项通过；最终 `npm run check` 共 249 项通过、0 失败，用时约 69.1 秒；`npm run scenes:check` 和 `git diff --check` 通过。完整检查包括两页模拟 DOM、实际中间位置变化、端点连续性、改变时长后相同路径、数值基线及本地 fairSIM 源码对照。未启动浏览器、截图或进行视觉验收。

一次完整回归中，未修改的图谱页旧用例 `all six stages keep frame contributions and coefficient addition on the main flow` 失败；该文件单独重跑 11 项均通过，最终整套 249 项也全部通过。本轮未修改该图谱模块或放宽其断言。

## 11. 公式左移、地址原位展开与末帧区域划分

按用户澄清，左移对象是两条逆变换公式。原图在原坐标退场，p=0.108 时两条公式已完整出现：青色 u、紫色 v 从对应位置向左归位。v 副本从左侧移动到中央放大，原定义保留。下方换元关系先浮现，再描出 f 的高亮框，随后在 B₁ 的原括号与原指数中展开 q+k̂，保留外侧子式并连续推开邻项。

新增持久地址子式与纯函数 `inverseAddressExpansion`，只替换 f/q 这个位置，+k̂ 的宽度和高亮框宽度同步连续增加。字宽依然只在首次展开前缓存。两页状态验证新增检查：图像中心不向左移动、公式颜色区分、原 v 式居中放大、规则先出现再框选、外围 B₁ 锚点稳定、+k̂ 水平展开、边框连续增长，以及正反定位。

末帧使用上下独立区域：公式层 y≤350、复平面层 y≥366，两层各自裁剪；主式与 δ 定义分别上移到 y=180 和 y=280，复平面与性质说明在下方独立排布。14 项专项检查通过；最终 `npm run check` 250 项全部通过、0 失败，用时约 60.1 秒。`npm run scenes:sync`、`npm run scenes:check` 与 `git diff --check` 通过；两个入口更新为 `inverse-address-expand-20261019-v4`。未启动浏览器或进行视觉验收。
