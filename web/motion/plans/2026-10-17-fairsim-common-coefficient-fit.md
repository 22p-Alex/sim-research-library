> 当前实现以[最终 getPeak 七拍分镜](2026-10-17-fairsim-getpeak-storyboard.md)为准。下文旧 P 点旋转与最小二乘主线仅作历史记录；本轮已替换为实际 commonRegion/getPeak 数组与全场累计。

# fairSIM 参数估计审阅与第 19—20 幕实现

2026-10-17。入口为 `sim_motion_demo.html`。从第 18 幕“位置已锁定，回到两张完整频谱”的终点接续；前面的采集、临时分离、公共区、整数搜索与局部细化沿用现有实现。原来的 geometry / conjugate / fit / read 四个停点合并成 `least-squares-fit`，移除回看照明条纹；第 20 幕为 `adopted-weights`，第 21 幕正式分离，第 22 幕归位。完整页 33 个停点，独立参数页 13 个。

## 审阅结论与适用范围

当前教学链路成立：相对相移已知 → 临时分离 → 在可靠公共区校正各自 OTF → 估计波矢 → 锁定位置后拟合共同复系数 → 读出幅相 → 填回矩阵 → 正式分离及归位。

它解释 fairSIM 的二维、三相、共同相位偏移路径。三帧相对步进假设准确；任意逐帧相位误差一般不能吸收到同一个系数中。没有将本页的估计器说成 fairSIM 的完整移植，也没有把非整数搜索步长当成参数精度。

审阅使用项目内固定提交 `711afd12cb8c4fd4207bbca7ee7610c5aed4f732` 的源码（版本记录见[原版估计器实操](../../../scripts/fairsim-parameter-estimation/README.md)），与 Müller 等 2016 年论文补充材料的成像模型对照。具体依据：

- [Correlation.java](../../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java)：`fitPeak` 第 46 行起；`getPeak` 第 194 行起；`commonRegion` 第 242 行起。
- [SimAlgorithm.java](../../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java)：第 181—190 行临时分离；第 290—308 行二维路径在最终位移调用 `getPeak`，再读取相角和模长；第 601—603 行正式分离。
- [BandSeparation.java](../../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/BandSeparation.java)：混合矩阵、求逆与按权重累加频带。
- [项目逐步推导](../../../Wiener-SIM/fairSIM-论文/fairSIM_参数估计逐步推导与代码实操.md)：第 7 节复数比例与最小二乘，第 9 节源码核对。原文：[fairSIM 2016 补充材料](../../../Wiener-SIM/fairSIM-论文/fairSIM-2016-SI.pdf)。

源码差异需保留：本页粗搜最大化双边能量归一化相关，使用 OTF 阈值公共区，局部搜索为三轮 5×5。固定 fairSIM 的 `fitPeak` 按零级能量归一化，并采用三轮 10×10；`commonRegion` 还包含中心附近排除与自己的掩膜操作。最终 `getPeak` 在最终位移重新准备区域，除各自 OTF，逆 FFT，旁带乘位移指数，与零级共轭相乘后求和，除以零级能量。通过 Parseval 关系，归一化因子在分子分母中抵消；这对应下面的复比例计算结构。不能把不同掩膜下的具体数值声称为逐项相等。本页沿用负号正向 DFT、数组 y 向下及 +1 级的约定，源码的位移符号按它自身的频带与坐标约定解释。

## 第 15→19 幕：校正已完成，后面沿用 U、V

针对两幕的除 H 记号，本次直接核对本地 Java 实现，没有查询 GitHub。核对范围为这份固定代码的二维共同幅相路径：

| 本地位置 | 实际操作 | 对动画的约束 |
|---|---|---|
| `Correlation.java:61–65` | 每轮 `fitPeak` 从输入临时频带建立副本，调用 `commonRegion(..., true)` | 校正作用于本轮副本，不覆盖输入临时频带 |
| `Correlation.java:272–286` | 低于 OTF 阈值的点置零；保留点分别执行 `band0/weight0`、`band1/weight1` | 这里确实执行自身 OTF 除法；不能改写为只乘 H* |
| `Cplx.java:378–386` | `div(a,b)` 返回 `mult(a,reciproc(b))`，倒数为共轭除以模平方 | 第 15 幕两拍是一次复数除法的代数展开 |
| `Correlation.java:199–203` | 最终 `getPeak` 重新复制输入临时频带，按最终位移调用 `commonRegion(..., true)` | 重新准备最终比较数据，不是在已经校正的 U、V 上叠加一次除法 |
| `Correlation.java:205–217` | 逆 FFT、旁带乘位移指数、乘零级共轭、求和，再除以零级能量 | OTF 校正之后进入相关比例计算 |
| `SimAlgorithm.java:290–308` | 给 `getPeak` 传入 `separate[0]`、`separate[1]`，再取 `phase()` 与 `hypot()` | 幅相来自最终相关复数；不是 OTF 本身的相角和模长 |

其中复数除法恒等式为：

$$
\frac{H^*A}{|H|^2}=\frac{A}{H},\qquad H\ne0.
$$

代入无噪声成像值 A=HS 才得到 S；带噪值 A=HS+n 校正后为 S+n/H。阈值筛选限制校正区域，并不令噪声消失。第 15 幕完成这次校正后命名 U、V；候选变化时使用相应的旁带地址、OTF 与掩膜。第 19 幕只取最终候选对应的校正值：

$$
U_P=U(\mathbf q_P),\qquad V_P=V_{\widehat{\mathbf k}}(\mathbf q_P),\qquad
V_P\simeq\alpha U_P.
$$

界面删除了第 19 幕重复列出的 A/H 定义，改为“沿用已校正的复数值”；第 15 幕保留完整恒等式并注明这两步合成一次除法。底部说明、舞台提示和两个入口共用同一套衔接。估计器本次没有改动，仍以最终候选的 `rawX/rawY` 产生一次校正值 `x/y`，再做全公共区拟合。

另需区分正式 Wiener 重建：`SimAlgorithm.java:601–608` 重新用采用的幅相分离频带，再调用 `applyOtf`；`OtfProvider.java:519` 在该操作中乘 OTF 的共轭。这与参数估计 `commonRegion` 的逐频带除法属于不同计算阶段。

## 为什么模长直接等于调制度

三帧相位为：

$$
\phi_j=\phi'_j+\phi_\Delta,\qquad\phi'_j=2\pi j/3,\qquad j=0,1,2.
$$

本页临时旁带权重已经包含余弦展开和三次累加的归一化：

$$
\widetilde u_{+1,j}=\frac23e^{-i\phi'_j},\qquad
\widetilde A_{+1}(\mathbf f)=m e^{i\phi_\Delta}H(\mathbf f)S(\mathbf f-\mathbf k).
$$

因而理想对齐且无噪声时，在同一可靠公共区：

$$
U(\mathbf q)=\frac{\widetilde A_0(\mathbf q)}{H(\mathbf q)}=S(\mathbf q),\qquad
V(\mathbf q)=\frac{\widetilde A_{+1}(\mathbf q+\mathbf k)}{H(\mathbf q+\mathbf k)}
=m e^{i\phi_\Delta}U(\mathbf q).
$$

乘单位模复数给所有值加同一角度，再乘非负实数给所有值乘同一长度比例。频率地址不动。实际估计使用锁定的估计波矢；观测噪声和位置误差以残差保留。分镜中的频点索引与帧索引分别属于当前复平面对比和三帧相位公式，不能将样品相位与照明相位混同。

## 最小二乘推导

动画公式下方按式中顺序解释：αU 是统一旋转、伸缩后的预测；单点距离平方累加成 J(α)；arg min 返回使 J 最小的复系数；右侧 C/E_U 直接算出同一个系数。配平方及归一化残差恒等式保留在本节与页面展开说明中，不占用主线公式注释。

定义同一集合上的三项累计量：

$$
C=\sum_{\Omega}U^*V,\quad E_U=\sum_{\Omega}|U|^2>0,\quad E_V=\sum_{\Omega}|V|^2>0.
$$

将目标函数展开并配平方：

$$
\begin{aligned}
J(\alpha)&=\sum_{\Omega}|V-\alpha U|^2\\
&=E_V-2\operatorname{Re}(\alpha^*C)+E_U|\alpha|^2\\
&=E_U\left|\alpha-\frac C{E_U}\right|^2+E_V-\frac{|C|^2}{E_U}.
\end{aligned}
$$

第一项非负，且仅在下式处为零。因此唯一复数最小二乘解及读数是：

$$
\widehat\alpha=\frac C{E_U},\qquad
\widehat m=|\widehat\alpha|,\qquad
\widehat\phi_\Delta=\arg\widehat\alpha=\arg C.
$$

最后的相角关系要求复比例非零。本页估计器已检查能量、点数和调制度有效性。因临时旁带补偿了余弦的 1/2，此处不再乘 2。

对于使用同一集合、同一权重的双边归一化相关：

$$
\rho=\frac{|C|}{\sqrt{E_UE_V}},\qquad
\frac{J(\widehat\alpha)}{E_V}=1-\rho^2.
$$

这解释位置对齐后比例匹配的残差。它不意味着 fairSIM 原版对所有候选都搜索同一个评分函数。画面上的残差通过实际复数差逐点平方后求和，避免在近乎完美拟合时用两个接近的能量相减造成数值误差；有噪声时不会强制清零，也不把最小二乘说成自动消除全部噪声。

## 第 19 幕：64 秒、一个停点

| 进度 | 动作 | 数据约束 |
|---|---|---|
| 0—0.25 | 接住第 18 幕的原频谱、OTF 与 P/Q/R；Q、R 原位淡出，只放大 P 的一对实际 U/V；频谱保留左侧 | 入口节点与数值连续；公式下标 P 对应所选频点；无新曝光 |
| 0.25—0.43 | 在放大的 P 点复平面中，橙色预测副本试探角度，再回到拟合方向；白虚线连接预测与观测 | 旋转阶段模长不变；试探角度明确标注，仅解释复乘，不是求解器的迭代轨迹 |
| 0.43—0.60 | 保持角度，将 P 的橙色副本长度乘以 m | 主线真实拟合相位接近零；不将试探值冒充测量结果 |
| 0.60—0.85 | 从 P 的几何讲解推广到全部可靠点云；累计 C 和 E_U；全部点累计后才显示相除；显示归一化残差 | 单个示例点不替代全公共区；点云、统计量、最小二乘共用同一批点 |
| 0.85—1 | 点云收起，单位圆中显示最终复系数；拆出波矢、调制度与共同相位卡片 | 直接使用估计结果；不回放条纹，不重采样观测 |

## 第 20 幕：28 秒、一个停点

0—0.12 汇总三个方向各自的估计。0.12—0.48 逐行将方向 1 的相位与调制度填入混合矩阵，符号系数淡出、实际复数值显现。0.48—0.88 点亮求逆箭头，逐行显示九个正式逆矩阵权重，并提示补回的共同因子。0.88—1 显示“同一组三帧，形成三份正式频带”，接给已有正式分离与归位。

$$
\widehat\phi_j=\phi'_j+\widehat\phi_\Delta,\qquad
M_{j,:}=\begin{bmatrix}1&\frac{\widehat m}{2}e^{i\widehat\phi_j}&\frac{\widehat m}{2}e^{-i\widehat\phi_j}\end{bmatrix},\qquad U=M^{-1},
$$

$$
u_{\pm1,j}=\frac1{\widehat m}e^{\mp i\widehat\phi_\Delta}\widetilde u_{\pm1,j}.
$$

此处矩阵 U 与此前复平面中的零级校正值 U(q) 通过自变量和上下文区分；矩阵列对应三帧、行对应 0/+1/−1 级。估计波矢不进入相位解混矩阵，留给后续频带归位。

## 实现与校验

- `sim-parameter-two-stage.js`：八幕清单、四段动态文案、共同复系数纯状态、全公共区真实残差。
- `sim-parameter-fit-view.js`：从原概览聚焦 P 点的旋转伸缩，再展开全部点云、残差、累计量和参数卡片。所有状态只读主播放器进度；倒放恢复原来的 P/Q/R 概览。
- `sim-motion-parameter-chapter.js` 与 `sim-motion-parameter-view.js`：33 步映射、回填时序、实际矩阵与权重。
- 两个 HTML 入口共用相同组件；独立参数页同样删除照明条纹回看。
- `npm run check` 包含无噪声及带噪负相位数据的闭式解、配平方恒等式、实际残差、单位模旋转、共同伸缩、全部点累计、矩阵权重及单播放器正反运行。

初版 `npm run check`：208 项通过，0 项失败；包含两个入口的代码运行、单播放器往返、实际频谱与全公共点拟合。初版未做视觉验收。

本次本地源码核对与 OTF 衔接调整：参数拟合、局部细化与两阶段讲解共 27 项相关检查通过、0 项失败。检查了第 19 幕沿用校正值的公式、实际箭头等于原始频带值除一次 H、单点讲解到全公共区拟合、两个入口的第 18→19 幕衔接及倒放恢复。依据用户提供的两张截图调整文案与公式；未启动浏览器，不据此声称完成像素布局验收。
