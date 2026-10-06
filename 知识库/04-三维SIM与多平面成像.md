# 三维 SIM 与多平面成像

[知识库目录](../SIM知识库.md) · [项目总览](../SIM项目总览.md) · [文献目录](../SIM文献目录.md)

> 阅读目标：从轴向频率和论文原图出发，理解 missing cone、Open-3DSIM、3D-MP-SIM 与提速代价。
> 依据：S1（3D-SIM 基础）、S9（Open-3DSIM）、S10（3D-MP-SIM）、S2（实现）；H（解释与提速建议）。详见[来源编号与证据约定](08-术语与参考来源.md)。
> 整理：2026-09-26；文中实验数字保留原有文献条件，工程建议不视为已验证结论。

## 本页目录

- [1. 从 2D-SIM 到 3D-SIM：增加了轴向频率](#s1)
  - [1.1. 原文图对照：3D-SIM 的频谱模型](#s1-1)
  - [1.2. 原文图对照：什么是 missing cone](#s1-2)
  - [1.3. 图中信息与 3D-MP-SIM 的关系](#s1-3)
- [2. Open-3DSIM：多层 3D-SIM 的开放式频谱重建基线](#s2)
- [3. 3D-MP-SIM：当前课题的核心物理模型](#s3)
- [4. 3D-MP-SIM 与提速思路](#s4)

<a id="s1"></a>

## 1. 从 2D-SIM 到 3D-SIM：增加了轴向频率

2D-SIM 的条纹主要在 $x,y$ 平面变化，目标是扩展横向频谱：

$$
\mathbf k=(k_x,k_y).
$$

3D-SIM 的三束相干光同时产生横向和轴向调制，样品频谱变为三维：

$$
\mathbf k=(k_x,k_y,k_z).
$$

因此 3D-SIM 不仅要分离横向的 $\pm1$ 级，还要处理轴向频率耦合和 OTF 的 missing cone。传统 3D-SIM 常见每个方向 5 个相位、多个 $z$ 层；

$$
3\text{ 个方向}\times5\text{ 个相位}=15\text{ 幅/层}.
$$

2D 到 3D 的本质变化不是“图像多了一层”，而是未知量和前向模型增加了一个轴向维度：需要恢复 $S(k_x,k_y,k_z)$，并使用真实三维 OTF。

<a id="s1-1"></a>

### 1.1. 原文图对照：3D-SIM 的频谱模型

下面使用 Chen 等人在 *Nature Photonics* 2025 年 3D-MP-SIM 论文 Fig. 1 中的原始图版。图片从本地论文 PDF 第 3 页裁出，保留了原图的 (a)-(e) 面板和标注。

![3D-MP-SIM 论文 Fig. 1 原图](../原文图示/3D-MP-SIM-Fig1-original.png)

为了便于逐行阅读，下面是同一张原图中 (b)、(c) 面板的局部裁切：

![3D-MP-SIM 论文 Fig. 1 的 b、c 面板原图局部](../原文图示/3D-MP-SIM-Fig1-bc-original.png)

阅读这张图时，先看上方的 (b) 和 (c) 面板：

- 论文图注把 (b)、(c) 的四行定义得很清楚：第一行是 raw data 的三维频谱，第二行是对应的轴向截面，第三行是结构光的 pattern vectors，第四行是把频谱搬移后组装出的超分辨频谱。彩色部分表示不同的混叠频率分量。
- (b) 是 **3D-MP-SIM model**。它的第一、二行仍以宽场检测带宽 $k_{z0}$ 为基础：多个深度同时成像，轴向照明产生的高频分量先被检测 OTF 截取，并重叠到这个宽场频谱区域。因此 (b) 的第二行看起来像一个轴向宽度有限的“腰部”或哑铃截面。
- (c) 是 **3D-SIM model**。传统 3D-SIM 逐层移动样品，使轴向照明图案相对于样品坐标发生变化；在频域中，这等效于把轴向频谱带宽扩展到
  $$
  k_{z0}+p_z.
  $$
  所以 (c) 的第二行沿 $k_z$ 方向更长，表示传统 3D-SIM 的轴向检测范围已经包含了结构光提供的轴向位移。
- 第三行的箭头不是样品结构的方向，而是频域中的“搬运向量”。在 3D-SIM 中，$\pm1$ 级包含非零轴向分量 $p_z$，能够沿 $k_z$ 移动；$\pm2$ 级主要把频谱边界继续推向更大的 $k_{xy}$。
- 第四行才是最终的频谱拼接结果。(b) 和 (c) 都得到横向、轴向扩展的三维频谱，但 (b) 依赖多平面检测、轴向相移和 7 级分离，(c) 依赖传统的逐层轴向扫描和 5 级分离。

再看 (e) 面板，它把算法流程画成了从左到右、再从右到左的闭环：

$$
\text{image registration}
\rightarrow
\text{FFT}
\rightarrow
\text{spectrum separation}
\rightarrow
\text{parameter estimation}
\rightarrow
\text{spectrum shifting}
\rightarrow
\text{Wiener filtering}
\rightarrow
\text{IFFT}.
$$

在频谱分离区域，传统 3D-SIM 需要处理

$$
0,\quad +1,\quad -1,\quad +2,\quad -2
$$

五个级次，所以每个方向使用 5 个相位。图中不是把 15 张图简单相加，而是先用相位差改变这五个级次的系数，再解线性方程把它们分开。

<a id="s1-2"></a>

### 1.2. 原文图对照：什么是 missing cone

下面使用 Cao 等人在 *Nature Methods* 2023 年 Open-3DSIM 论文 Fig. 1 的原始图版。图片从本地论文 PDF 第 2 页裁出，图中 (a) 是低 SNR 下的频谱分离，(b) 是 OTF 和频域滤波，(c) 是 3D 重建结果对照。

![Open-3DSIM 论文 Fig. 1 原图](../原文图示/Open-3DSIM-Fig1-original.png)

“缺失锥”可以从三维频域的几何形状理解。把频域坐标写成

$$
(k_x,k_y,k_z),
$$

其中横向频率半径为

$$
k_{xy}=\sqrt{k_x^2+k_y^2}.
$$

普通宽场 3D 显微镜的 OTF 不是一个完整的球，而是一个在轴向方向有明显缺口的双锥状或哑铃状区域。这个缺口位于接近 $k_z$ 轴的高轴向频率区域，形状像从三维频谱球中挖掉的一只“锥体”，因此称为 missing cone。

其成因是照明和检测光路都受到有限数值孔径限制：横向传播方向的频率差容易被收集，而纯轴向变化对应的散射角度更难同时满足照明和检测的几何条件。因此宽场系统对某些轴向频率的传递函数很小：

$$
H_{\mathrm{WF}}(k_x,k_y,k_z)\approx0
\quad\text{in the missing-cone region}.
$$

在空间域，缺失锥意味着轴向细节和光学切片能力较弱：不同 $z$ 位置的信号更容易互相叠加，点扩散函数在轴向拉长，重建物体会出现轴向模糊。它不是“某个 z 层少拍了一张”的问题，而是三维频域中一整片方向性的频率没有被有效观测。

3D-SIM 的 $\pm1$ 级正好提供轴向频率搬移。若宽场轴向截止频率为 $k_{z0}$，结构光轴向波矢为 $p_z$，则频谱副本可以从原位置搬到

$$
k_z\mapsto k_z\pm p_z.
$$

其中一部分原本位于 missing cone 的样品频率，经搬移后落入检测 OTF 的通带；再经过多相位分离和频谱拼接，缺失区域被部分填补。Open-3DSIM 笔记中所说的“$\pm1$ 级填补 missing cone，$\pm2$ 级扩展 $xoy$ 频谱”，就是这件事：

$$
\text{0 级：中心频谱}
\quad+
\text{$\pm1$ 级：补轴向缺口}
\quad+
\text{$\pm2$ 级：继续扩展横向边界}.
$$

这也解释了为什么 2D-SIM 与 3D-SIM 的效果不同：2D 条纹的频率向量主要满足 $q_z=0$，它能扩展 $k_x,k_y$，却不能系统地搬移缺失锥中的轴向频率；3D-SIM 的三束干涉产生 $q_z\ne0$，所以可以改善 $z$ 方向分辨率和光学切片。

需要区分“填补”与“完全恢复”。实际 OTF 在边界处逐渐衰减而非理想硬截止，噪声、像差、相位误差和频带接缝都会限制恢复质量。因此 missing cone 是由 3D-SIM 部分填充的频率缺口，而不是通过后处理凭空创造信息。

<a id="s1-3"></a>

### 1.3. 图中信息与 3D-MP-SIM 的关系

3D-MP-SIM 论文 Fig. 1 的 (b)、(c) 面板还揭示了一个容易混淆的区别：3D-MP-SIM 与传统 3D-SIM 使用相同的三束结构光，区别主要在检测和坐标关系。传统 3D-SIM 逐层移动样品；多平面方案同时取得多个深度。由于多平面检测会让不同轴向分量在宽场 OTF 内重叠，3D-MP-SIM 又引入额外轴向相移，将 $\pm1$ 级拆成上、下两部分：

$$
\{0,+2,-2,+1_U,+1_L,-1_U,-1_L\}.
$$

因此当前代码的 $Norders=7$ 不是 7 个 z 平面，而是多平面物理模型中的 7 类频谱分量。论文原图 (e) 中“First/Second”两步分离正是为了解决这个耦合。

<a id="s2"></a>

## 2. Open-3DSIM：多层 3D-SIM 的开放式频谱重建基线

Cao 等（S9，*Nature Methods*, 2023）提出 Open-3DSIM，目标是把通用多层 3D-SIM 做成跨平台、可检查中间结果、参数自动估计且低 SNR 稳健的开放工具。它支持 MATLAB、Fiji 插件和 Exe，并可处理 OMX、N-SIM 和自建系统的不同 raw 数据格式。

其物理流程仍是 3 个方向 × 5 个相位的 15 帧/层采集、相位分离和频谱搬移：$\pm1$ 级频谱用于填补 0 级 OTF 的 missing cone，$\pm2$ 级扩展横向频谱。参数估计通过 cross-correlation 从数据中估计频率、角度、相位和调制度。低 SNR 时 $+2$ 级峰可能不可辨，因此方法在可靠性判据失败时回退到对比度更高的 $+1$ 级峰，以减少频率错估引起的伪影。

Open-3DSIM 的关键频谱优化是两步滤波。可将其抽象写成

$$
W(\mathbf k)=W_{\mathrm{Wiener}}(\mathbf k)
N(\mathbf k;\mathbf k_0,w_1)A(\mathbf k;w_2),
$$

其中 Notch 抑制估计频率附近的异常谱峰，Apo 和 OTF notch 平滑频谱边界、降低噪声放大并补偿高频模糊。该思想与 HiFi-SIM 的 PSF/OTF engineering 相近，但 Open-3DSIM 聚焦多层 3D-SIM 的通用平台和自动参数估计。

论文还把偏振维度加入 $xoy$ 平面，用于估计荧光偶极取向 $\theta$。方向光强不均匀必须用微球校准，否则取向会有系统偏差。对当前 3D-MP-SIM 项目，Open-3DSIM 可作为传统 3D 频域重建和滤波基线；但 MP-SIM 的 7 级频带、多平面序列和 OTF 结构不能直接套用 Open-3DSIM 参数，应先统一维度顺序、采样间隔和级次定义。

对 SIM+深度学习，推荐以 Open-3DSIM 结果作为物理初值或额外输入：

$$
x_0=R_{\mathrm{Open3DSIM}}(y),\qquad
\hat x=x_0+f_\psi(y,x_0,H,\hat\vartheta),
$$

网络学习残差，$H$ 为 OTF，$\hat\vartheta$ 为估计的照明参数，并用 $\sum_j\|A_j\hat x-y_j\|_2^2$ 检查数据一致性。这样可以把 Open-3DSIM 的可解释频谱重建与 SSR-SIM 的自监督采样、BayesDL-SIM 的不确定性量化结合起来。

<a id="s3"></a>

## 3. 3D-MP-SIM：当前课题的核心物理模型

Chen 等（S10，*Nature Photonics*, 2025）提出 3D-MP-SIM，将三束 3D-SIM 照明、ISP 八平面并行探测和新的频谱分离模型结合。单个 ISP 单元同时覆盖约 $1.55\,\mu\mathrm m$，层间距约 193.8 nm；系统在特定条件下达到约 120 nm 横向、300 nm 轴向分辨率，并把体积成像速度提升到传统 3D-SIM 的约 8 倍，1 ms 曝光下最高约 11 volumes/s。

多平面检测会使传统 3D-SIM 中的轴向高频分量在宽场 OTF 内重叠。$\pm1$ 级频谱必须进一步拆成上下部分，因此待恢复的频带为

$$
\{0,+2,-2,+1_{\mathrm U},+1_{\mathrm L},-1_{\mathrm U},-1_{\mathrm L}\}.
$$

仅用横向相移的 7×7 分离矩阵条件数为 5.2，容易放大噪声。3D-MP-SIM 引入约 $0.52\pi$ 的轴向相移，用“两组 5 相位 + 2×2 二次分离”的两步方案把等效条件数降到 1.4。这里的 `Norders=7` 表示七类频谱级次，不表示七张原始图或七个轴向平面。

重建流程是：8 平面亚像素配准 $
ightarrow$ 3D FFT $
ightarrow$ 5 相位初步分离 $
ightarrow$ 轴向相移下的 $\pm1$ 上下部分二次分离 $
ightarrow$ 估计 $\mathbf p_{xy},p_z,\phi,m$ $
ightarrow$ 三维频谱搬移 $
ightarrow$ 广义 Wiener 融合。为抑制 roll-over 伪影，raw 体数据两端各零填充 4 个平面，重建后提取中心平面。

对当前项目，论文和代码的对应关系是：`Para_Estimate.py` 负责横向/轴向波矢、相位和调制度估计；`Seperate_CK.py` 负责 5 相位和 7 级频谱分离；`Wiener_Reconstruction.py` 负责频谱搬移与 OTF/Wiener 融合；`Main_recon_MP.py` 负责总流程。建议将 raw、分离后的 $C_m$、$\mathbf p_{xy}$、$p_z$、相位、调制深度、OTF、Wiener 参数和结果一并保存。

3D-MP-SIM 是 SIM+深度学习的首选物理基线。推荐网络采用残差形式：

$$
x_0=R_{\mathrm{MP}}(y),
\qquad
\hat x=x_0+f_\psi(y,x_0,H,\hat\vartheta),
$$

并加入原始数据一致性约束

$$
\mathcal L_{\mathrm{DC}}
=\sum_j\left\|A_j(\hat\vartheta)\hat x-y_j\right\|_2^2.
$$

这样网络只学习低 SNR 伪影、配准残差、背景和 OTF 失配，不必从零学习 3D 频谱搬移。厚样品扩展还必须满足轴向移动距离同时是层间距和照明周期的整数倍：

$$
z_0=kL_{\mathrm{space}}=qP,
\qquad k,q\in\mathbb Z.
$$

<a id="s4"></a>

## 4. 3D-MP-SIM 与提速思路

3D-MP-SIM 用多平面探测器同时获取多个 $z$ 位置，减少逐层扫描时间。理想化地，串行采集时间近似为

$$
T_{serial}\approx N_zT_{exposure},
$$

并行多平面采集更接近

$$
T_{parallel}\approx T_{exposure}+T_{readout}.
$$

但代价是多平面之间的频谱重叠和串扰。当前项目需要分离 7 类分量：

$$
\{0,+2,-2,+1_U,+1_L,-1_U,-1_L\}.
$$

其中 $U/L$ 表示轴向上、下相关的分量。多平面方案的提速来自并行获取轴向信息，而不是简单丢弃频带。

SIM 提速可以按风险从低到高分为三层：

1. **计算提速**：FFT 批处理、GPU、预计算 OTF/Wiener 权重、减少 CPU-GPU 拷贝。固定 OTF 时可预计算
   $$
   G_j(\mathbf k)=\frac{H_j^*(\mathbf k)}{\sum_l|H_l(\mathbf k)|^2+w^2},
   $$
   运行时只做频谱乘加。
2. **参数提速**：用轻量网络预测 $\hat{\mathbf k},\hat\phi,\hat m$，再送入传统物理重建：
   $$
   \hat\vartheta=f_\psi(y),\qquad \hat x=R_{SIM}(y;\hat\vartheta).
   $$
3. **采集提速**：减少相位/方向，或使用多平面、空间复用照明。减少相位会降低观测方程数量，使矩阵条件数变差：
   $$
   \|\delta\mathbf x\|\lesssim\kappa(M)\|\delta\mathbf d\|.
   $$
   因此应先建立完整相位和方向的物理基线，再评估少相位或少方向方案。

 对本项目最稳妥的研究路线是：

$$
y\xrightarrow{\text{参数预测}}\hat\vartheta
\xrightarrow{\text{GPU 7 级频谱重建}}x_0
\xrightarrow{\text{物理残差网络}}\hat x,
$$

并同时检查 FRC/解相关分辨率、数据一致性、伪影、跨样品泛化和总运行时间。

---

上一专题：[传统重建与参数估计](03-传统重建与参数估计.md) · [返回知识库目录](../SIM知识库.md) · 下一专题：[误差、噪声与质量评价](05-误差噪声与质量评价.md)
