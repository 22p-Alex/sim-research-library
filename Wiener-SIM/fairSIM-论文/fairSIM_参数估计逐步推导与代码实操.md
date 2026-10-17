# fairSIM 参数估计：逐步推导与代码实操

核对日期：2026-10-13。源码固定为 `711afd12cb8c4fd4207bbca7ee7610c5aed4f732`，本地 `pom.xml` 版本 1.5.1。

**先读下面这一页概览即可。后面的第 0—14 节是详细参考，不需要现在顺序读完。** 当前讨论限定为一个方向、三个相位、两束照明的二维 SIM；多个方向分别处理。

## 一页概览：估什么，怎么估

### 要估计哪些参数

每个条纹方向估计三类参数：

| 参数 | 物理含义 | fairSIM 怎么估计 |
|---|---|---|
| 波矢 p = (pₓ, pᵧ) | 条纹的间距，以及明暗变化方向；该方向垂直于条纹线 | 移动旁带，与零级的重叠信息做相关；由最佳匹配位置确定波矢 |
| 共同相位偏移 φΔ | 这一组三帧从条纹的哪个位置开始 | 对齐后，取旁带与零级之间复数比例的辐角 |
| 调制度 μ | 条纹的明暗对比度，决定旁带信号的相对强度 | 对齐后，取同一个复数比例的模长 |

波矢有两个分量，所以这里是三类参数、每方向四个实数。默认相位步进按 0°、120°、240°已知，只估计该方向的共同起点；不是在这个步骤里独立估计三个任意相位。

### 核心流程只有三步

**第一步：临时分离。** 对同一方向的三帧先做 FFT，再按已知的等间隔相位做加权组合，得到零级和两个旁带。此时不需要先知道波矢；未知的相位偏移和调制度仍留在旁带的复数系数中。这里只需记住它是后续匹配的准备步骤，具体加权公式放在第 4 节。

**第二步：估计波矢——寻找旁带的正确搬移位置。** 零级和旁带中包含一部分相同的样品频率。移动旁带，在可信的重叠区域内校正各自的 OTF，再比较它与零级是否匹配。fairSIM 先用相关峰粗定位，再搜索亚像素位置；由最佳匹配位置按旁带的正负号约定得到波矢。代码对应 `Correlation.locatePeak()` 和 `Correlation.fitPeak()`。

**第三步：估计相位和调制度——读取对齐后的复数比例。** 把 OTF 校正后的零级记为 U，正确搬移并校正后的正一级旁带记为 V。理想模型下，在重叠区域中：

$$
V(\mathbf k)=\alpha U(\mathbf k),
\qquad
\alpha=\mu e^{i\phi_\Delta}.
$$

两份数据描述相同的样品频率，所以样品本身的未知结构可以通过比较消去。利用整个重叠区域估计比例，而不是对某一个频点直接相除：

$$
\hat\alpha=
\frac{\sum_{\mathbf k\in\Omega}V(\mathbf k)U^*(\mathbf k)}
     {\sum_{\mathbf k\in\Omega}|U(\mathbf k)|^2}.
$$

Ω 是保留的可信重叠区域，星号表示复共轭。得到这个复数后，同时读出：

$$
\boxed{
\hat\phi_\Delta=\arg(\hat\alpha),
\qquad
\hat\mu=|\hat\alpha|.
}
$$

例如，若算出 α̂ = 0.4 + 0.3i，则调制度为 0.5，相位偏移约为 36.87°。不是再为这两个参数分别搜索一次，而是从同一个复数中读取角度和长度。

源码 `Correlation.getPeak()` 返回这个比例，对应写回代码为：

```java
dir.setPxPy(-peak[0], -peak[1]); // 波矢；负号来自旁带搬移约定
dir.setPhaOff(p1.phase());       // 相位偏移：复数的辐角
dir.setModulation(1, p1.hypot());// 调制度：复数的模长
```

**只记这一条主线：三帧临时分离 → 匹配旁带位置得到波矢 → 对齐后的复数比例同时给出相位和调制度。** 每个方向重复这套计算，API 的一次调用会在内部处理所有方向。

方法依据：[fairSIM 补充材料第 10—11 页](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016-SI.pdf)；实现依据：[波矢搜索与参数写回](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java:235)、[复数比例计算](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java:194)。

---

以下为详细参考：遇到具体疑问时再查对应小节。

来源分三类：**论文方法**来自 fairSIM 2016 主文和 Supplementary Note 1；**补充推导**是本文从成像模型、复指数恒等式及傅里叶变换定义展开的代数；**实现细节**以列明的固定源码为准。教学数字是明确设置的代数例子，不是实验测量。来源入口见[第 14 节](#sources)。本文的节号、字母符号和推导编号不是原文公式号。

## 0. 阅读路线与符号

上面的一页概览已经给出完整主线。后面的内容按疑问查阅即可：

1. 想知道三帧为什么能分出频带：查第 1—4 节。
2. 想知道比较哪些频率、复数比例为什么能给出参数：查第 5—7 节。
3. 想看搜索细节和运行代码：查第 8—12 节。

### 0.1 先区分两个频率坐标

前面的讨论曾用 k 同时表示相机频率和归位后的样品频率。为了避免把“相同的数组位置”误认成“相同的样品信息”，这里分开记：

| 记号 | 含义 | 阅读时怎么理解 |
|---|---|---|
| d、j | 条纹方向编号、该方向内的相位帧编号 | 换方向改变 d，同一方向内相移改变 j |
| r | 样品面空间位置，单位 μm | 图像中哪里 |
| f | 相机图像的频率坐标，单位 cycle/μm | 原始频谱数组在检测哪种频率 |
| k | 比较时使用的样品频率坐标 | 归位后希望两份数据都描述哪种样品频率 |
| p | 真实照明波矢 | 条纹的频率和法线方向 |
| q | 候选照明波矢 | 搜索中正在试的频率和方向 |
| s | 旁带的归位位移 | 对本文正一级而言，正确值为 −p |
| μ | 照明的明暗调制度 | 旁带信息的强弱；不拿它表示级次 |
| φ′ⱼ | 暂定的等间隔相位 | 用于临时分离的已知权重 |
| φΔ | 同一方向的一组相移帧共有的相位偏移 | 不同方向各有一个；完整记作 φΔ, d |
| S(r)、S̃(k) | 样品及其傅里叶变换 | 算法不知道的真实样品 |
| Dⱼ(r)、D̃ⱼ(f) | 第 j 帧相机数据及其频谱 | 算法真正收到的数据 |
| h(r)、H(f) | PSF 及其傅里叶变换 OTF | 检测系统的模糊与频率传递 |
| B₀、B₊、B₋ | 临时分离的三个分量 | 能从原始帧计算出来，但旁带尚未完全校准 |
| U、V | 用于匹配的零级和候选归位旁带 | 已进行相应的 OTF 校正与区域选择 |
| α | 两份对齐数据之间的复数比例 | 模给调制度，辐角给共同相位偏移 |

“正一级”在本文指照明展开中的正复指数，不意味着它只提供样品的正频率。正负频带的命名必须与公式和代码索引一起读。

### 0.2 本文使用的傅里叶变换定义

$$
\tilde S(\mathbf k)
=\mathcal F\{S\}(\mathbf k)
=\int S(\mathbf r)e^{-i2\pi\mathbf k\cdot\mathbf r}\,\mathrm d\mathbf r.
$$

变换时固定一个频率 k，对所有空间位置 r 积分。积分完成后 r 消失，结果仍依赖 k。不是把一个空间点搬到一个频谱点。复指数的符号决定后面频谱平移的正负号。

### 0.3 当前推导成立的前提

先按无噪声模型推导，并假设：

- 荧光响应线性，检测系统可用同一个移不变 PSF 描述。
- 同一方向的三帧中，样品、条纹波矢和调制度保持稳定。
- 同一方向内三帧的相对步进准确为 2π/3，未知相位只体现为该方向的一个共同偏移；不同方向不要求共用偏移。
- 帧间照明强度已一致或已校正，OTF 已提供且足够匹配。

真实数据中的噪声、漂白、运动、非等间隔相位和 OTF 误差会破坏某些等式。它们不是在推导末尾凭一个公式就能自动消除的。

## 1. 为什么要估计参数，以及算法事先知道什么

每帧使用条纹照明：

$$
I_j(\mathbf r)=1+\mu\cos\left(2\pi\mathbf p\cdot\mathbf r+\phi_j\right).
$$

相机拍到：

$$
D_j(\mathbf r)=\left[S(\mathbf r)I_j(\mathbf r)\right]*h(\mathbf r).
$$

波矢决定频带搬移位置，相位决定解混权重，调制度决定幅度补偿。它们参与了数据形成，所以也必须进入反演。

如果把逐频点成像写成矩阵：

$$
\mathbf d=M_{\mathrm{true}}\mathbf c,
$$

而解混使用另一套参数，则：

$$
\hat{\mathbf c}=M_{\mathrm{used}}^{-1}M_{\mathrm{true}}\mathbf c.
$$

多出来的矩阵可能改变分量幅度、相位，甚至使不同频带串扰。后面会证明：仅有共同相位偏移时，它特别简单，是一个对角矩阵；各帧相位分别出错时，就通常不再是对角矩阵。

fairSIM 的这个估计入口接收**原始帧频谱和成像配置**，并不接收样品真值。OTF、像素尺寸、帧顺序和方向/相位数量需要事先提供。`estimateParameters` 主要写回每个方向的波矢、共同相位偏移和调制度，不会在同一次调用中自动识别相机像素尺寸或完整 OTF。

条纹周期与波矢的关系为：

$$
T=\frac1{\|\mathbf p\|},\qquad
\theta_{\mathbf p}=\operatorname{atan2}(p_y,p_x).
$$

波矢角度描述明暗变化方向，条纹线的方向与它相差 90°。来源：主文的自动参数估计部分，以及源码[参数估计入口 C1](#c1)。

## 2. 从相机成像式得到三个混合分量

### 2.1 余弦怎么展开

欧拉公式给出：

$$
\cos\theta=\frac12\left(e^{i\theta}+e^{-i\theta}\right).
$$

代入照明式，并拆开指数：

$$
I_j(\mathbf r)
=1+\frac\mu2e^{i\phi_j}e^{i2\pi\mathbf p\cdot\mathbf r}
  +\frac\mu2e^{-i\phi_j}e^{-i2\pi\mathbf p\cdot\mathbf r}.
$$

乘到样品后有三项：原样品、乘正复指数的样品、乘负复指数的样品。二分之一来自余弦的两个指数分量。

### 2.2 频谱平移怎么得到

直接代入傅里叶变换定义：

$$
\begin{aligned}
\mathcal F\{S(\mathbf r)e^{i2\pi\mathbf p\cdot\mathbf r}\}(\mathbf f)
&=\int S(\mathbf r)e^{i2\pi\mathbf p\cdot\mathbf r}
                       e^{-i2\pi\mathbf f\cdot\mathbf r}\,\mathrm d\mathbf r\\
&=\int S(\mathbf r)e^{-i2\pi(\mathbf f-\mathbf p)\cdot\mathbf r}\,\mathrm d\mathbf r\\
&=\tilde S(\mathbf f-\mathbf p).
\end{aligned}
$$

同理：

$$
\mathcal F\{S(\mathbf r)e^{-i2\pi\mathbf p\cdot\mathbf r}\}(\mathbf f)
=\tilde S(\mathbf f+\mathbf p).
$$

相位和调制度与 r 无关，可以提到积分外；空间卷积变成频域乘法。于是：

$$
\boxed{
\tilde D_j(\mathbf f)=H(\mathbf f)\left[
\tilde S(\mathbf f)
+\frac\mu2e^{i\phi_j}\tilde S(\mathbf f-\mathbf p)
+\frac\mu2e^{-i\phi_j}\tilde S(\mathbf f+\mathbf p)
\right].
}
$$

三个来源在**同一个相机频率 f**混合，都乘 H(f)，因为检测系统在混合之后起作用。这一步来自 Supplementary Note 1 第 9 页的成像与频率混合模型；积分展开是本文补充推导。

### 2.3 为什么此时不需要先知道波矢

先把成像公式中的三项定义为三个不同的函数，保留完整的频率自变量：

$$
A_0(\mathbf f)=H(\mathbf f)\tilde S(\mathbf f),
$$

$$
A_+(\mathbf f)=H(\mathbf f)\tilde S(\mathbf f-\mathbf p),\qquad
A_-(\mathbf f)=H(\mathbf f)\tilde S(\mathbf f+\mathbf p).
$$

这里需要区分**相机频率**和**样品频率**：A 的自变量表示这一分量落在相机频谱的哪个位置；右侧 S̃ 的自变量表示它来自样品频谱的哪个位置。

| 分量 | 在相机频谱中的位置 | 对应的样品频率 | 检测系统乘上的 OTF |
|---|---|---|---|
| A₀(f) | f | f | H(f) |
| A₊(f) | f | f − p | H(f) |
| A₋(f) | f | f + p | H(f) |

所以，“三个 A 都在同一个相机频率 f 上取值”与“它们来自三个不同的样品频率”可以同时成立。**自变量相同不意味着函数相同，也不意味着三个函数值相等。**A₊、A₋的下标标记照明的正、负一级分量；它们内部的样品频率仍分别是 f − p、f + p。

不省略任何自变量时，三帧的方程是：

$$
\tilde D_j(\mathbf f)=A_0(\mathbf f)
+\frac\mu2e^{i\phi_j}A_+(\mathbf f)
+\frac\mu2e^{-i\phi_j}A_-(\mathbf f).
$$

例如，在一维中，频率单位统一取 cycles/μm，选相机频率 f₀ = 0.5、照明频率 p = 0.2。则：

$$
\begin{aligned}
A_0(0.5)&=H(0.5)\tilde S(0.5),\\
A_+(0.5)&=H(0.5)\tilde S(0.3),\\
A_-(0.5)&=H(0.5)\tilde S(0.7).
\end{aligned}
$$

样品的 0.3、0.5、0.7 三个频率，在照明调制后共同贡献到相机的 0.5 这个频率。检测系统作用于调制后的信号，因此三项都乘 H(0.5)，而不是分别乘 H(0.3)、H(0.5)、H(0.7)。

固定 f = f₀，再比较三帧时，A₀(f₀)、A₊(f₀)、A₋(f₀)就是三帧共享的三个未知复数；它们不随相位帧编号 j 改变，变化的是前面的相位系数。此处定义 A 是为了推导，算法并没有提前计算出它们。

这些复数的数值当然与样品和波矢有关，但把混合项分开时，可以先将它们整体当作未知量，无须先求出它们内部的样品频率。按后文的相位步进假设，分离后再估计波矢、确定搬移位置；未知的调制度和共同相位偏移暂时留在旁带的复数系数中。

## 3. 三个等间隔相位为什么能够消项

“真实相位只差一个共同偏移”依赖正确的相对相位步进，**不是对任意三帧都成立的恒等式**。先把此前省略的方向编号补回来。

### 3.1 每个条纹方向分别估计一组参数

用 d 表示方向编号，j 表示这个方向内的相位帧编号，照明模型为：

$$
I_{d,j}(\mathbf r)
=1+\mu_d\cos\left(2\pi\mathbf p_d\cdot\mathbf r+\phi_{d,j}\right),
\qquad j=0,1,2.
$$

在同一方向的三帧中，波矢 p_d 和调制度 μ_d 保持不变，通过改变相位使条纹平移。换方向后，至少波矢方向改变；相位原点和调制度也不要求与前一个方向相同。因此，默认估计为每个方向分别求一组参数：

$$
\left\{\mathbf p_d,\ \phi_{\Delta,d},\ \mu_d\right\}.
$$

所以，三方向、三相位的九帧数据，按三个方向各自的三帧分别估计。所谓“共同偏移”，只在一个方向内对 j 共同，**不是所有方向共用一个偏移**。

在调用层面，一次 `estimateParameters(param, inFFT, ...)` 就会处理全部方向，无须调用者为三个方向手动调用三次。源码在 `SimAlgorithm.java` 第 162 行开始执行方向循环，并在循环内取 `param.dir(angIdx)`、读取 `inFFT[angIdx][pha]`，最后把估计写入当前方向的 `dir`。波矢、相位偏移和调制度的写回见第 287—308 行。[源码 C1](#c1)

### 3.2 为什么同一方向内可以只差一个共同偏移

假设采集系统对同一方向准确执行等间隔相移，步长为：

$$
\Delta=\frac{2\pi}{3}.
$$

那么，选择一致的展开相位后：

$$
\phi_{d,1}-\phi_{d,0}=\Delta,\qquad
\phi_{d,2}-\phi_{d,1}=\Delta.
$$

逐次代入，三帧真实相位只能具有下面的形式：

$$
\phi_{d,j}=\phi_{d,0}+j\Delta.
$$

相位本身按模 2π 理解；选择展开表示只是为了方便写相位差，不改变照明。

算法选择第一帧的暂定相位为零，建立已知的参考序列：

$$
\phi'_0=0,\qquad\phi'_1=\frac{2\pi}3,\qquad\phi'_2=\frac{4\pi}3.
$$

这个选择没有宣称第一帧真实相位为零。由于参考序列和真实序列具有相同的步长，它们相减后，含 j 的部分抵消：

$$
\phi_{d,j}-\phi'_j
=\left(\phi_{d,0}+j\Delta\right)-j\Delta
=\phi_{d,0}.
$$

定义该方向的未知起始相位为共同偏移，就得到：

$$
\phi_{\Delta,d}:=\phi_{d,0},\qquad
\boxed{\phi_{d,j}=\phi'_j+\phi_{\Delta,d}.}
$$

因此，“一个共同偏移”的来源是：**相对步进已知，未知的只是这组三帧从哪个相位开始。** 好比同一把刻度间隔准确的尺子整体平移，三个刻度与参考位置之间的差相同；如果刻度间距本身出错，就不能只用一次整体平移描述。

下面是人为设置的角度例子，目的是区分两个索引：

| 序列 | j = 0 | j = 1 | j = 2 | 相对参考序列的偏移 |
|---|---:|---:|---:|---|
| 暂定参考相位 | 0° | 120° | 240° | — |
| 方向 d = 0 的真实相位 | 20° | 140° | 260° | 三帧都是 20° |
| 方向 d = 1 的真实相位 | −15° | 105° | 225° | 三帧都是 −15° |

每个方向内部有共同偏移，但两个方向的偏移不相同。后文继续只推导一个固定方向，所以省略 d，写成：

$$
\phi_j=\phi'_j+\phi_\Delta.
$$

fairSIM 补充材料 Supplementary Note 1 第 10 页明确以“等间隔相位与真实相位仅相差一个共同偏移”为前提进行临时分离。代码中，`SimParam.Dir.resetPhases()` 设置等间隔参考序列，`getPhases()` 再为当前方向的每一帧加上其 `phaOff`；`BandSeparation` 的等间隔重载也按“2πj/帧数 + 偏移”构造相位。[补充材料](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016-SI.pdf)、[矩阵代码 C2](#c2)、[参数容器 C4](#c4)。上面的逐项相减是对这个假设的补充代数解释。

### 3.3 共同偏移为什么不破坏消项

共同偏移在对 j 求和时可以作为一个固定复数因子提出：

$$
\sum_{j=0}^{2}e^{i\phi_j}
=e^{i\phi_\Delta}\sum_{j=0}^{2}e^{i\phi'_j}.
$$

所以，参考相位的指数和只要为零，增加任何共同偏移后仍然为零。这正是允许先按暂定相位分离、再估计共同偏移的原因。

引入一个简写：

$$
\omega=e^{i2\pi/3}=-\frac12+i\frac{\sqrt3}2,
\qquad
\omega^2=-\frac12-i\frac{\sqrt3}2,
\qquad\omega^3=1.
$$

把三个数相加，实部和虚部分别为零：

$$
1+\omega+\omega^2
=1-\frac12-\frac12+i\left(\frac{\sqrt3}2-\frac{\sqrt3}2\right)
=0.
$$

因此：

$$
\sum_{j=0}^2e^{i\phi'_j}
=\sum_{j=0}^2e^{-i\phi'_j}=0.
$$

双倍相位也一样，因为：

$$
\sum_{j=0}^2e^{-i2\phi'_j}
=1+\omega^{-2}+\omega^{-4}
=1+\omega+\omega^2=0.
$$

三帧的这些复数权重在复平面上相隔 120°。把它们当作三个长度相同、方向均匀分开的箭头，首尾相接正好闭合。这是“旁带抵消”的代数依据，不是随意假定相加就会消失。

### 3.4 相位步进不准确时，不能继续只用共同偏移

更一般的模型需要增加逐帧相位误差：

$$
\phi_{d,j}=\phi'_j+\phi_{\Delta,d}+\varepsilon_{d,j}.
$$

例如真实相位为 20°、143°、257°时，相对参考序列的差为 20°、23°、17°，三者不相同。若把共同偏移定义为第一帧的 20°，剩余误差就是 0°、3°、−3°。由于这些误差随 j 改变，不能再整体提出求和号，默认的三帧消项通常会有残留；第 4.6 节会展开串扰项。

因此，默认参数估计采用的是“已知相对步进、估计整体起点”的模型。如果各帧相对步进也不确定，就需要逐帧相位估计等额外处理。fairSIM 的 `estimateAbsolutePhases` 是对应的另一条路径，但要求波矢已经足够准确，具体见第 13.1 节。

## 4. 临时分离：逐项推导零级和两个旁带

### 4.1 把未知参数放进一个复数

定义：

$$
\alpha=\mu e^{i\phi_\Delta},\qquad
\alpha^*=\mu e^{-i\phi_\Delta}.
$$

由于 μ 是实数，代入相位分解后，保留完整自变量的观测方程为：

$$
\tilde D_j(\mathbf f)
=A_0(\mathbf f)
+\frac12\alpha e^{i\phi'_j}A_+(\mathbf f)
+\frac12\alpha^*e^{-i\phi'_j}A_-(\mathbf f).
$$

接下来在**固定的相机频率 f₀**上，对相位帧编号 j 求和。为缩短这组代数推导，临时约定：

$$
\begin{aligned}
\tilde D_j&:=\tilde D_j(\mathbf f_0),\\
A_0&:=A_0(\mathbf f_0)=H(\mathbf f_0)\tilde S(\mathbf f_0),\\
A_+&:=A_+(\mathbf f_0)=H(\mathbf f_0)\tilde S(\mathbf f_0-\mathbf p),\\
A_-&:=A_-(\mathbf f_0)=H(\mathbf f_0)\tilde S(\mathbf f_0+\mathbf p).
\end{aligned}
$$

符号“:=”表示在当前推导中定义这个简写。因此，下式是同一个观测方程在固定频点处的简写：

$$
\tilde D_j
=A_0+\frac12\alpha e^{i\phi'_j}A_+
    +\frac12\alpha^* e^{-i\phi'_j}A_-.
$$

**省略的是 A 和 D 外面的共同自变量 f₀；样品频谱内部的 f₀ − p、f₀ + p 已经保留在 A₊、A₋的定义中。** 没有把这些样品频率改成 f₀，也没有令三个 A 相等。后面恢复写 B₀(f)、B₊(f)时，是把每个固定频点上的结果合起来，写成对所有相机频率都成立的函数关系。

### 4.2 三帧相加怎么得到零级

把每一项分别求和：

$$
\begin{aligned}
\sum_{j=0}^2\tilde D_j
&=3A_0
+\frac12\alpha A_+\sum_{j=0}^2e^{i\phi'_j}
+\frac12\alpha^* A_-\sum_{j=0}^2e^{-i\phi'_j}\\
&=3A_0+0+0.
\end{aligned}
$$

除以 3，是因为零级在三帧中重复了三次：

$$
\boxed{B_0(\mathbf f)=\frac13\sum_{j=0}^2\tilde D_j(\mathbf f)
=H(\mathbf f)\tilde S(\mathbf f).}
$$

此时它仍然带着检测 OTF，不是已经恢复的完整样品频谱。

### 4.3 为什么乘负相位权重能留下正一级

先对每帧乘已知权重：

$$
\tilde D_je^{-i\phi'_j}
=A_0e^{-i\phi'_j}
+\frac12\alpha A_+
+\frac12\alpha^*A_-e^{-i2\phi'_j}.
$$

逐项看：零级被乘上一个会求和为零的指数；正一级的两个指数刚好消掉；负一级变成双倍相位，求和也为零。

$$
\begin{aligned}
\sum_{j=0}^2\tilde D_je^{-i\phi'_j}
&=A_0\sum_j e^{-i\phi'_j}
+\frac32\alpha A_+
+\frac12\alpha^*A_-\sum_j e^{-i2\phi'_j}\\
&=\frac32\alpha A_+.
\end{aligned}
$$

所以前面乘 2/3：

$$
\boxed{
B_+(\mathbf f)=\frac23\sum_{j=0}^2\tilde D_j(\mathbf f)e^{-i\phi'_j}
=\mu e^{i\phi_\Delta}H(\mathbf f)\tilde S(\mathbf f-\mathbf p).
}
$$

**2/3 是“三次累加”和“旁带系数为 1/2”一起产生的归一化。** 临时分离使用已知的 φ′，没有使用未知的 φΔ。

同理，乘正相位权重会留下负一级：

$$
\boxed{
B_-(\mathbf f)=\frac23\sum_{j=0}^2\tilde D_j(\mathbf f)e^{i\phi'_j}
=\mu e^{-i\phi_\Delta}H(\mathbf f)\tilde S(\mathbf f+\mathbf p).
}
$$

### 4.4 用一个具体数字核对

这是单个频点的代数例子。设置：

$$
A_0=10,\quad A_+=A_-=3,\quad
\mu=0.8,\quad\phi_\Delta=\frac\pi6.
$$

那么三帧观测为：

$$
\tilde D_j=10+2.4\cos\left(\phi'_j+\frac\pi6\right),
$$

$$
\tilde D_0\approx12.078461,\quad
\tilde D_1\approx7.921539,\quad
\tilde D_2=10.
$$

平均值：

$$
B_0=\frac{12.078461+7.921539+10}{3}=10.
$$

正一级加权和给出：

$$
B_+\approx2.078461+1.2i
=2.4e^{i\pi/6}
=\mu e^{i\phi_\Delta}A_+.
$$

这验证了：分离成功，但调制度和共同偏移保留在结果中。此时直接算 B₊/B₀，并不能得到 μ，因为 A₊和 A₀通常描述不同的样品频率。为什么要归位，在下一节解释。

### 4.5 对应矩阵和 fairSIM 代码

临时分离矩阵为：

$$
M_\mathrm{temp}=
\begin{bmatrix}
1&1/2&1/2\\
1&\omega/2&\omega^2/2\\
1&\omega^2/2&\omega/2
\end{bmatrix}.
$$

它的逆矩阵就是上述三个加权和：

$$
M_\mathrm{temp}^{-1}=
\begin{bmatrix}
1/3&1/3&1/3\\
2/3&2\omega^2/3&2\omega/3\\
2/3&2\omega/3&2\omega^2/3
\end{bmatrix}.
$$

只有共同偏移时，真实矩阵可以分解为：

$$
M_\mathrm{true}=M_\mathrm{temp}\operatorname{diag}(1,\alpha,\alpha^*).
$$

所以：

$$
\begin{bmatrix}B_0\\B_+\\B_-\end{bmatrix}
=M_\mathrm{temp}^{-1}\mathbf d
=\operatorname{diag}(1,\alpha,\alpha^*)
\begin{bmatrix}A_0\\A_+\\A_-\end{bmatrix}.
$$

这证明为什么未知的 μ、φΔ只留下比例，而不导致三者互相混合。

源码常规分支为：

```java
dir.resetPhases();
BandSeparation.separateBands(inputCpy, separate,
    0, dir.nrBand(), null);
```

在[矩阵代码 C2](#c2)中，`fac == null` 会设置零级系数为 1、旁带系数为 0.5。`separateBands` 先构造矩阵，再求逆并按逆矩阵的行加权累加输入。两束数据的输出对应：

```text
separate[0] → B₀
separate[1] → B₊，系数来自 exp(+iφ′)，来源是 S̃(f−p)
separate[2] → B₋，系数来自 exp(−iφ′)，来源是 S̃(f+p)
```

其中 Java 的 `nrBands=2` 实际产生 `2*nrBands-1=3` 个分量。不要把“bands 为 2”理解成只分出两个数组。

### 4.6 各帧相位分别出错时，为什么会串扰

若真实相位是：

$$
\phi_j=\phi'_j+\phi_\Delta+\varepsilon_j,
$$

则三帧平均中的正旁带残留为：

$$
\frac\mu6e^{i\phi_\Delta}A_+
\sum_j e^{i\phi'_j}e^{i\varepsilon_j}.
$$

当 εⱼ各不相同时，这个和通常不为零。对于小误差，用一阶展开：

$$
e^{i\varepsilon_j}\approx1+i\varepsilon_j,
\qquad
\sum_j e^{i\phi'_j}e^{i\varepsilon_j}
\approx i\sum_j\varepsilon_je^{i\phi'_j}.
$$

它显示串扰与各帧相位误差的加权组合有关。如果三个 ε 完全相同，它们可以并入共同偏移，相位和仍然抵消。因此，“默认方法不知道共同相位”与“默认方法可以处理任意未知相位”是两件不同的事。

## 5. 归位与 OTF 校正：到底比较哪两份数据

### 5.1 相同相机频率，不等于相同样品频率

临时分离后：

$$
B_0(\mathbf f)=H(\mathbf f)\tilde S(\mathbf f),
\qquad
B_+(\mathbf f)=\alpha H(\mathbf f)\tilde S(\mathbf f-\mathbf p).
$$

如果在同一个 f 上比较，得到的是样品频率 f 与 f−p。即使样品没有噪声，两者通常也不相等：

$$
\frac{B_+(\mathbf f)}{B_0(\mathbf f)}
=\alpha\frac{\tilde S(\mathbf f-\mathbf p)}{\tilde S(\mathbf f)}.
$$

这个比值混入了未知的样品结构，不能直接当作 α。参数估计的关键，是先让两份数据对应**同一个样品频率**。

### 5.2 固定样品频率 k，零级和旁带分别去哪里取值

零级要描述样品频率 k，直接在相机频率 f=k 取值：

$$
U(\mathbf k)=\frac{B_0(\mathbf k)}{H(\mathbf k)}=\tilde S(\mathbf k).
$$

正一级要描述同一个 k，需要满足：

$$
\mathbf f-\mathbf p=\mathbf k
\quad\Longrightarrow\quad
\mathbf f=\mathbf k+\mathbf p.
$$

所以去旁带的 k+p 位置取值，并除以那里的检测 OTF：

$$
\begin{aligned}
V_{\mathbf p}(\mathbf k)
&=\frac{B_+(\mathbf k+\mathbf p)}{H(\mathbf k+\mathbf p)}\\
&=\frac{\alpha H(\mathbf k+\mathbf p)
\tilde S((\mathbf k+\mathbf p)-\mathbf p)}{H(\mathbf k+\mathbf p)}\\
&=\alpha\tilde S(\mathbf k).
\end{aligned}
$$

这里有两个不同的 OTF 除数：零级用 H(k)，旁带用 H(k+p)。原因是同一个样品频率经过两条混频路径，落在不同的相机频率位置，受到了不同的传递衰减。

由此得到：

$$
\boxed{V_{\mathbf p}(\mathbf k)=\alpha U(\mathbf k).}
$$

**未知样品可以作为自己的参考。** 正确归位后，样品频谱相同，因此在比较比例时可以消去。我们没有事先知道 S，而是通过重复记录的样品信息校准两条通道。

### 5.3 为什么必须限定公共区域

如果某个位置 H=0，就不能除；如果 H 很小，除法会放大噪声。用于校准的频率必须在两条通道中都可靠传递。两束、相同检测 OTF 的理想公共区域可写成：

$$
\Omega_{\mathbf p}
=\left\{\mathbf k:\ |H(\mathbf k)|\ge\tau,
\ |H(\mathbf k+\mathbf p)|\ge\tau\right\}.
$$

这个集合是解释“公共区域”的数学模型。实际 fairSIM 还会额外筛选区域，并使用部分整数索引近似；不能把它等同于完整的几何交集，见[第 9.2 节](#common-region)。

用一个一维例子理解区域：假设理想检测通带为 −5 到 +5 cycle/μm，p=4，暂不考虑边缘 OTF 衰减。零级能描述的样品频率为：

$$
-5\le k\le5.
$$

正一级要满足相机位置 k+4 在通带内：

$$
-5\le k+4\le5
\quad\Longrightarrow\quad
-9\le k\le1.
$$

两者理想交集为 −5 到 +1：

| 样品频率 k | 零级去相机哪里取 | 正一级去相机哪里取 | 能否用这对数据校准 |
|---|---:|---:|---|
| −2 | −2 | +2 | 两条通道都检测得到 |
| +0.5 | +0.5 | +4.5 | 理想通带内；实际还需检查 OTF 强度 |
| +2 | +2 | +6 | 正一级这条路径检测不到，不能比较 |
| −7 | −7 | −3 | 零级检测不到，不能比较；旁带仍可能为重建提供高频信息 |

最后一行解释了一个常见疑问：**用于估参数的是重复记录的重叠区；用于扩展分辨率的还包括零级看不到的旁带区域。** 不要求所有高频都被零级同时看见。

### 5.4 试错位移时，样品项怎样变化

真实波矢 p 未知，所以尝试候选 q：

$$
\begin{aligned}
V_{\mathbf q}(\mathbf k)
&=\frac{B_+(\mathbf k+\mathbf q)}{H(\mathbf k+\mathbf q)}\\
&=\alpha\tilde S(\mathbf k+\mathbf q-\mathbf p).
\end{aligned}
$$

若 q=p，两份数据比较同一个样品频率；若 q≠p，旁带与零级之间还剩一个位移 q−p。因此通常无法在所有公共频点上都找到同一个固定比例。

这相当于两张有重叠内容的地图：先试一个搬移量，再检查多个地标是否一起对上。只有整体结构能对上，才说明候选位移可信。样品重复结构、近乎恒定的频谱或公共区信号太弱，都可能使这种匹配不唯一。

## 6. 复数互相关：为什么取共轭、为什么看模长

### 6.1 共轭让样品自身的相位消掉

对某个公共频率，假设零级为：

$$
U_j=a_je^{i\theta_j},
\qquad
V_j=\alpha a_je^{i\theta_j}.
$$

这里 j **改为公共频点索引**，不是三帧的相位索引。于是：

$$
V_jU_j^*
=\alpha a_je^{i\theta_j}a_je^{-i\theta_j}
=\alpha a_j^2.
$$

相位 θⱼ消失，每一项都沿 α 的方向。把不同频点加起来：

$$
C(\mathbf p)
=\sum_{\mathbf k\in\Omega}V_{\mathbf p}(\mathbf k)U^*(\mathbf k)
=\alpha\sum_{\mathbf k\in\Omega}|U(\mathbf k)|^2.
$$

如果不取共轭，则每项为 αaⱼ²exp(i2θⱼ)，样品自己的相位还在，各项可能相互抵消。这就是复数相关中共轭的作用。

对于候选 q，计算：

$$
C(\mathbf q)
=\sum_{\mathbf k\in\Omega}V_{\mathbf q}(\mathbf k)U^*(\mathbf k).
$$

错位时，各项带有不同样品频率之间的相位差，通常不再同向累加。

### 6.2 为什么不能只比较实部

正确位移处：

$$
C(\mathbf p)=\mu e^{i\phi_\Delta}E_0,
\qquad E_0=\sum_{\mathbf k\in\Omega}|U(\mathbf k)|^2.
$$

如果共同相位偏移恰好为 π/2：

$$
C(\mathbf p)=i\mu E_0,\qquad
\operatorname{Re}C(\mathbf p)=0,\qquad
|C(\mathbf p)|=\mu E_0.
$$

此时匹配完全正确，实部却为零。所以搜索要比较模长，避免被未知共同相位影响。

### 6.3 “对齐时最大”需要哪些条件

对固定公共区中的两个向量，柯西—施瓦茨不等式给出：

$$
\left|\sum_jV_jU_j^*\right|
\le\sqrt{\sum_j|V_j|^2}\sqrt{\sum_j|U_j|^2}.
$$

两者成固定复数比例时取等号。因此用双边能量归一化的相似度：

$$
\rho=\frac{|\sum_jV_jU_j^*|}
{\sqrt{\sum_j|V_j|^2}\sqrt{\sum_j|U_j|^2}}
$$

理想对齐时可以达到 1。这用于解释比例匹配的逻辑；**源码不是按这个双边归一化公式搜索**。`fitPeak` 实际用零级能量归一化，且公共区随搜索轮次更新。不同候选的区域、能量、噪声都可能影响峰高。

所以“相关峰通常在正确位移处最明显”不是无条件唯一性定理。它依赖样品有可辨认的频谱结构、公共区包含信号、初始相位模型足够合理。

## 7. 归一化相关量：怎样读出相位和调制度

### 7.1 从比例关系直接求解

在正确位移处：

$$
V_j=\alpha U_j.
$$

共轭相乘再求和：

$$
C=\sum_jV_jU_j^*=\alpha\sum_j|U_j|^2=\alpha E_0.
$$

公共区能量非零时：

$$
\boxed{\hat\alpha=\frac C{E_0}
=\frac{\sum_jV_jU_j^*}{\sum_j|U_j|^2}.}
$$

分子包含两份数据的关系，也包含样品亮度尺度；分母除去相同尺度。样品整体亮度乘 g 时，分子和分母都乘 |g|²，比例不变。

### 7.2 带误差时，它为什么也是最小二乘比例

这是对原式的补充解释：把 U 当作参考，寻找一个复数比例，使预测 αU 尽量接近 V：

$$
J(\alpha)=\sum_j|V_j-\alpha U_j|^2.
$$

展开模平方：

$$
J=E_V-\alpha^*C-\alpha C^*+|\alpha|^2E_0,
\qquad E_V=\sum_j|V_j|^2.
$$

为了不跳过复数求导，写成实部和虚部：

$$
\alpha=a+ib,\qquad C=c+id.
$$

于是：

$$
J(a,b)=E_V-2(ac+bd)+E_0(a^2+b^2).
$$

分别求偏导并令它们为零：

$$
\frac{\partial J}{\partial a}=-2c+2E_0a=0,
\qquad
\frac{\partial J}{\partial b}=-2d+2E_0b=0.
$$

得到：

$$
a=\frac c{E_0},\quad b=\frac d{E_0},\quad
\hat\alpha=\frac C{E_0}.
$$

当 E₀>0 时，这是该比例拟合的唯一最小值。它说明公式怎样在有残差时使用；并不证明“零级和旁带都有噪声时，该估计必然无偏或统计最优”。

### 7.3 一个复数为什么能给出两个参数

因为临时分离留下：

$$
\alpha=\mu e^{i\phi_\Delta}
=\mu\cos\phi_\Delta+i\mu\sin\phi_\Delta.
$$

所以：

$$
\boxed{\hat\mu=|\hat\alpha|
=\sqrt{(\operatorname{Re}\hat\alpha)^2+(\operatorname{Im}\hat\alpha)^2},}
$$

$$
\boxed{\hat\phi_\Delta=\arg\hat\alpha
=\operatorname{atan2}(\operatorname{Im}\hat\alpha,\operatorname{Re}\hat\alpha).}
$$

相位按 2π 周期理解。若调制度接近零，相关复数接近原点，相位会很不稳定；严格为零时相位没有可辨认的信息。

这里读出的模是 μ，而不是 μ/2，因为分离矩阵已经使用了 1/2 的旁带系数。换一种频带归一化方式，估计出的比例就要相应换算。

### 7.4 用三个公共频点计算一次完整结果

设置零级参考为：

$$
U_1=1+i,\qquad U_2=2-i,\qquad U_3=-1+0.5i,
$$

以及：

$$
\alpha=0.8e^{i\pi/6}=0.692820323+0.4i,
\qquad V_j=\alpha U_j.
$$

零级能量：

$$
E_0=|1+i|^2+|2-i|^2+|-1+0.5i|^2
=2+5+1.25=8.25.
$$

相关量：

$$
C=\alpha E_0\approx5.715767665+3.3i,
\qquad |C|=6.6.
$$

归一化后：

$$
\hat\alpha=\frac{5.715767665+3.3i}{8.25}
\approx0.692820323+0.4i.
$$

最终：

$$
\hat\mu=0.8,\qquad\hat\phi_\Delta=\frac\pi6\approx0.523599\ \mathrm{rad}.
$$

如果人为把三个旁带点循环错配，用 αU₂、αU₃、αU₁依次去比较 U₁、U₂、U₃，相关模约为 3.939543，低于正确配对的 6.6。这个小例子展示错配如何降低相关；不是对所有样品和所有候选位移的保证。

### 7.5 原文与代码的共轭方向

Supplementary Note 1 的比例关系写成“旁带等于比例乘零级”，随后相关式对旁带取共轭。按前一式直接代入，该相关量除以零级能量会得到比例的共轭。模长相同，但相位符号相反。

当前源码使用的是**旁带乘零级共轭**，本文一直沿用这套自洽方向：

$$
C_{\mathrm{code}}=\sum_jV_jU_j^*.
$$

如果交换共轭方向：

$$
C'=\sum_jV_j^*U_j=C_{\mathrm{code}}^*,
\qquad \arg C'=-\arg C_{\mathrm{code}}\pmod{2\pi}.
$$

核对相位时必须一起检查复指数、频带名称、归位方向和共轭方向。不能只照抄一个 `arg` 就认为相位符号必然相同。出处为补充材料第 10—11 页以及[相关核 C3](#c3)。

## 8. 粗定位：为什么逆 FFT、相乘、正 FFT 会得到相关图

### 8.1 先明确代码中每个数组所处的域

参数估计入口先复制临时频带，再乘中心衰减窗：

```java
Vec2d.Cplx c0 = separate[0].duplicate();
Vec2d.Cplx c1 = separate[1].duplicate();
c0.times(otfAtt);
c1.times(otfAtt);
```

这个阶段是在为**粗找峰**准备数据，尚未执行后面 `commonRegion` 的 OTF 除法。衰减中心是为了减少直流、背景和某些低频成分对找峰的影响。

之后：

```java
Transforms.fft2d(c0, true);
Transforms.fft2d(c1, true);
c1.timesConj(c0);
Transforms.fft2d(c1, false);
```

| 执行位置 | c0 的含义 | c1 的含义 |
|---|---|---|
| 逆 FFT 前 | 衰减后的零级频谱 | 衰减后的旁带频谱 |
| 逆 FFT 后 | 上述频谱的空间域表示 | 上述频谱的空间域表示 |
| `timesConj` 后 | 保持不变 | 旁带空间表示 × 零级空间表示的共轭 |
| 最后正 FFT 后 | 保持不变 | 按频率位移索引的复数相关图 |

最后的 c1 用来查“位移多少时匹配最好”。虽然它是 FFT 的输出，但不能把它当作样品的重建频谱。

### 8.2 从离散变换定义推导一次

为简化记号，先用一维长度 N 的数组 A[u]、B[u]。所有频率索引按 N 循环理解。其逆 DFT 是：

$$
a[n]=\frac1N\sum_uA[u]e^{i2\pi un/N},\qquad
b[n]=\frac1N\sum_vB[v]e^{i2\pi vn/N}.
$$

计算空间域共轭乘积的正 DFT：

$$
\begin{aligned}
R[t]
&=\sum_n b[n]a^*[n]e^{-i2\pi tn/N}\\
&=\frac1{N^2}\sum_{u,v}B[v]A^*[u]
\sum_n e^{i2\pi(v-u-t)n/N}.
\end{aligned}
$$

离散复指数正交性告诉我们：

$$
\sum_{n=0}^{N-1}e^{i2\pi\ell n/N}
=\begin{cases}N,&\ell\equiv0\pmod N,\\0,&\text{其他情形。}\end{cases}
$$

因此，只有 v=u+t 的项留下：

$$
\boxed{R[t]=\frac1N\sum_uB[u+t]A^*[u].}
$$

这正是比较 A[u] 与位移后 B[u+t] 的相关。常数 1/N 不改变峰的位置。二维同理，对 N×N 数组会出现共同尺度 1/N²，位移变成二维向量。

所以源码用三次 FFT 和逐点乘法，就能一次得到所有整数位移的相关，而不用对每个候选位移重复遍历两个频谱。

### 8.3 从相关图得到整数初值

源码根据截止频率和频率格点间隔计算排除半径：

```java
minDist = fitExclude[angIdx] * otfPr.getCutoff()
          / param.pxlSizeCyclesMicron();
peak = Correlation.locatePeak(c1, minDist);
```

数学上：

$$
r_{\min}=\eta\frac{f_c}{\Delta f}.
$$

其中 η 是 `fitExclude`，f_c 是 OTF 截止频率，Δf 是每个 FFT 格点对应的物理频率。它们组合后给出频率像素单位的半径。

例如截止半径为 20 个频率像素，`fitExclude=0.3`，就不在距离原点 6 个频率像素以内寻找峰。它改变的是**粗找峰的候选范围**，并不表示把这些相机数据从整个重建流程删除。

`locatePeak` 遍历整数位置，比较复数模长，返回峰坐标；它还把 FFT 的环绕索引和向下的数组 y 轴转换成 fairSIM 的坐标约定。此时得到的是粗初值，不是最终亚像素参数。[源码 C1](#c1)

## 9. 亚像素搜索：每个候选点实际上算什么

### 9.1 区分波矢和归位位移

理论部分使用候选波矢 q，并在旁带的 k+q 处取值。若用“移动旁带数组”的语言描述，同一个操作对应：

$$
\mathbf s=-\mathbf q.
$$

所以，正一级的正确归位位移是 −p。源码把粗峰取负后传入精调：

```java
peak = Correlation.fitPeak(
    separate[0], separate[fb], 0, fitBand, otfPr,
    -peak[0], -peak[1], 0.05, 2.5, cntrl);
```

精调返回归位位移，后面存入条纹波矢时再次取负。理解这两个量的含义，负号就有了依据。

<a id="common-region"></a>
### 9.2 `commonRegion` 怎样准备比较数据

每轮搜索开始时：

```java
Vec2d.Cplx b0 = band0.duplicate();
Vec2d.Cplx b1 = band1.duplicate();
commonRegion(b0, b1, bn0, bn1, otf,
    kx, ky, 0.15, weightLimit, true);
```

其中 `kx, ky` 是本轮的归位位移猜测。函数生成原位置和平移位置的 OTF 向量，按照阈值把不可比较数据置零；对保留部分除以该频带原位置的 OTF。这里讨论的是两束数据、相同检测 OTF，不能未经修改把它解释成所有高阶 OTF 模型的严格公共区公式。

当前固定实现还有额外区域筛选。它计算原点半径与位移长度的比：

$$
\mathrm{ratio}=\frac{\mathrm{rad}}{\|\mathbf s\|},
$$

并对下面的情况置零：

$$
\mathrm{ratio}<0.15
\quad\text{或}\quad
\mathrm{ratio}>0.85.
$$

旁带的对应置零索引使用 `(int) kx`、`(int) ky`，因此带有整数近似。这是源码的实际径向筛选规则，不宜只根据注释概括为“精确挖掉两个中心的小圆”。OTF 阈值、径向筛选、整数近似一起形成真正参加比较的数据。

**每轮只按该轮中心猜测构造一次区域；该轮 100 个候选位置共用这次准备的数据。** 下一轮改变中心后才重新准备区域。源码并没有为每个候选点都重新计算一个精确公共区。

### 9.3 亚像素位移的数学依据

设 v(r) 是某个频谱 V 的逆变换。乘复指数会平移频谱：

$$
\mathcal F\{v(\mathbf r)e^{i2\pi\mathbf s\cdot\mathbf r}\}(\mathbf k)
=V(\mathbf k-\mathbf s).
$$

令 s=−q，就得到用于比较的 V(k+q)。只要复指数中的 s 可以取小数，就可以试非整数的频率位移。

对 N×N 的离散数组，乘数写成：

$$
\exp\left[i\frac{2\pi}{N}(s_xx+s_y^{\mathrm{row}}y)\right].
$$

fairSIM 的 y 轴向上，数组行 y 向下，因此代码中使用：

```java
b1s.fourierShift(xpos, -ypos);
```

这里还有一个容易被方法名误导的细节：`Vec2d.Cplx.fourierShift()` 本身是在当前数组上乘复指数；本段调用前，数组已经经过逆 FFT。完整的“频谱 → 逆 FFT → 乘指数 → 正 FFT”包装则是 `SimUtils.fourierShift()`。[空间乘法 C5](#c5)

有限采样数据的这种操作基于离散傅里叶表示。亚像素搜索提供连续候选位移，但不会凭空增加原始数据的信息量。

### 9.4 为什么候选点不需要再正 FFT

每轮先把筛选与校正后的 b0、b1变到空间域，然后计算候选归位位移处的比例：

```java
Transforms.fft2d(b0, true);
Transforms.fft2d(b1, true);
Cplx.Double scal = new Cplx.Double(1. / b0.norm2());

Vec2d.Cplx b1s = b1.duplicate();
b1s.fourierShift(xpos, -ypos);
b1s.timesConj(b0);
corr[xi][yi] = Cplx.mult(b1s.sumElements(), scal);
```

它计算的就是：

$$
\gamma(\mathbf s)
=\frac{\sum_{x,y}
b_1[x,y]e^{i2\pi(s_xx-s_yy)/N}b_0^*[x,y]}
{\sum_{x,y}|b_0[x,y]|^2}.
$$

因为只需要内积这个标量，利用 Parseval 关系就能直接在空间域计算。在采用正变换不归一化、逆变换除以像素总数 P 的约定下：

$$
\sum_{x,y}v[x,y]u^*[x,y]
=\frac1P\sum_{k_x,k_y}V[k_x,k_y]U^*[k_x,k_y],
$$

$$
\sum_{x,y}|u[x,y]|^2
=\frac1P\sum_{k_x,k_y}|U[k_x,k_y]|^2.
$$

分子和分母里的 1/P 抵消，因此空间域比例与频域比例一致。无需为每个候选再做一次正 FFT。

### 9.5 三轮网格搜索的具体位置

源码设置每轴 10 个点：

```java
double xpos = tkx + ((xi - 4.5) / 4.5) * ts;
double ypos = tky + ((yi - 4.5) / 4.5) * ts;
```

这里 xi、yi取 0 到 9，ts 是搜索半宽。每轮选 `corr[xi][yi].hypot()` 最大的点，作为下一轮中心，再执行 `search /= 5`。

| 轮次 | 每轴半宽 / 频率像素 | 每轴相邻点间隔 | 候选数 |
|---|---:|---:|---:|
| 1 | 2.5 | 5/9≈0.555556 | 100 |
| 2 | 0.5 | 1/9≈0.111111 | 100 |
| 3 | 0.1 | 0.2/9≈0.022222 | 100 |

这是一种逐步缩小范围的候选搜索，没有高斯峰形假设，也没有求导寻找连续极值。10 是偶数，所以每轴没有正好落在本轮中心的点；即使初值恰好正确，最后输出也未必仍然精确等于初值。

网格间隔是实现分辨程度，不是实验数据误差的保证。粗峰错误、相关峰宽、噪声、掩膜和局部多峰都可能使误差更大。

## 10. 最终比例估计与参数写回

### 10.1 为什么还要调用一次 `getPeak`

`fitPeak` 的主要任务是找归位位移。源码随后在该位置重新准备区域并计算复数比例：

```java
Cplx.Double p1 = Correlation.getPeak(
    separate[0], separate[1], 0, 1, otfPr,
    peak[0], peak[1], 0.05);
```

`getPeak` 的流程：复制输入 → `commonRegion` → 逆 FFT → 旁带乘位移指数 → 乘零级共轭 → 求和并除以零级能量。这重新得到最终位移处的比例。它可能与 `fitPeak` 最后一轮某个候选的值略有差别，因为区域是在最终位移处重新准备的。

核心代码：

```java
b1.timesConj(b0);
Cplx.Double scal = new Cplx.Double(1. / b0.norm2());
Cplx.Double ret = Cplx.mult(b1.sumElements(), scal);
```

### 10.2 保存的是波矢、共同相位和估计调制度

两束分支写回：

```java
param.dir(angIdx).setPxPy(-peak[0], -peak[1]);
param.dir(angIdx).setPhaOff(p1.phase());
param.dir(angIdx).setModulation(1, p1.hypot());
```

第一行把归位位移变回条纹波矢。第二行取最终比例的辐角，第三行取模长。对于本文两束情形，读出的 `px(1), py(1)` 就是一阶条纹频率像素坐标。

注意两个函数的数组返回布局不同：

| 函数 | 返回内容，按数组索引顺序 |
|---|---|
| `locatePeak` | 峰 x、峰 y、模长、相位 |
| `fitPeak` | 归位位移 x、归位位移 y、相位、模长 |

高层流程重复使用了变量名 `peak`，但不能因此把两次 `peak[2]` 当成同一个物理量。[相关核 C3](#c3)

### 10.3 正式重建为什么要重新分离

之前的 B₊还带着 α；现在知道相位和调制度，正式重建使用真实相位序列和采用的调制度：

```java
BandSeparation.separateBands(tmpArray, separate,
    par.getPhases(), par.nrBand(), par.getModulations());
```

其中 `getPhases()` 把共同偏移加到相位序列上；矩阵中的旁带系数由临时的 1/2 改为采用的 μ/2。因此解混时就同时补偿了 α。之后再进行频带归位与 Wiener 融合。

当前源码对小于 0.4 或大于 1.1 的调制度采用 0.65 的回退值。因此：

```java
dir.getRawModulations()[1] // 保存的估计值
dir.getModulations()[1]    // 重建采用值，可能发生回退
```

回退是实现保护，不是数据证明了真实调制度为 0.65。若估计异常，应同时记录两个值。[参数容器 C4](#c4)

## 11. 真实数据怎样接入估计器

### 11.1 先组织输入，不要先塞入待估真值

估计入口的结构为：

```java
Vec2d.Cplx[][] inFFT;  // [方向][相位]
SimParam simParam;    // 配置、OTF，以及估计后写回的参数
```

对于三方向、三相位、两束二维模型：

```java
SimParam simParam = SimParam.create(
    2,                  // nrBands，三个分量：0、+1、−1
    3,                  // nrDirs，三个条纹方向
    3,                  // nrPhases，每个方向三帧
    imageSize,
    pixelSizeMicron,
    otf
);
```

其中 `pixelSizeMicron` 是**样品面有效像素尺寸**。OTF 可以来自校准或一个合理估计，但不应把待估的条纹波矢、相位和调制度先当真值写进这个常规估计示例。`fitExclude>0` 会从数据粗找峰；`fitExclude<=0` 则使用容器里的预设波矢作初值，再做精调。

### 11.2 一个可放进 Java 类里的估计函数

下面是按作者 `StepByStep` 适配的参数估计函数。它接收已经读入的九帧 16 位像素数组，背景值和边缘窗宽由调用者根据数据提供；不是直接读取 TIFF 的完整插件。需要导入 `org.fairsim.linalg.Vec2d` 和 `org.fairsim.sim_algorithm.*`。

```java
public static SimParam estimateFromPixels(
        short[][] inputImages,
        int imageSize,
        double pixelSizeMicron,
        OtfProvider otf,
        double background,
        int borderPixels) {

    final int directions = 3;
    final int phases = 3;
    if (inputImages.length != directions * phases) {
        throw new IllegalArgumentException("Expected nine frames");
    }

    SimParam param = SimParam.create(
        2, directions, phases, imageSize, pixelSizeMicron, otf);
    Vec2d.Cplx[][] inFFT = new Vec2d.Cplx[directions][phases];

    for (int d = 0; d < directions; d++) {
        for (int j = 0; j < phases; j++) {
            short[] pixels = inputImages[d * phases + j];
            if (pixels.length != imageSize * imageSize) {
                throw new IllegalArgumentException("Wrong frame size");
            }
            Vec2d.Cplx frame = Vec2d.createCplx(imageSize, imageSize);
            frame.setFrom16bitPixels(pixels);
            SimUtils.subtractBackground(frame, background);
            if (borderPixels > 0) {
                SimUtils.fadeBorderCos(frame, borderPixels);
            }
            frame.fft2d(false);
            inFFT[d][j] = frame;
        }
    }

    SimAlgorithm.estimateParameters(param, inFFT,
        1, 0.3, null, 0, null);
    return param;
}
```

顺序 `inputImages[d*phases+j]` 假设同一方向的三相位帧连续存储。如果实际设备的方向、相位、z 层、时间或通道顺序不同，要先重排。`subtractBackground` 会把扣除后低于零的值截到零；背景值不是随意调节重建外观的旋钮。作者例子中的背景 200、窗口 15 不能直接作为所有数据的常数。

输入帧已经经过显微镜模糊，读取真实图像时无需再乘一次 OTF。此前合成示例的 `capture()` 乘 OTF 是为了**生成**相机数据，不是对真实数据额外做一次成像。

`estimateParameters` 本身返回 `void`，通过修改 `param` 保存结果；上面的包装函数为了方便使用，返回这个已经更新的容器。[输入示例 C6](#c6)

### 11.3 估计调用中的参数不要混在一起

```java
SimAlgorithm.estimateParameters(
    param, inFFT, 1, 0.3, null, 0, null);
```

| 参数或内部设置 | 本例数值 | 含义 |
|---|---:|---|
| `fitBand` | 1 | 用一级旁带匹配波矢 |
| `fitExclude` | 0.3 | 粗定位排除截止半径的前 30% |
| 显示工厂 | `null` | 不生成中间图显示 |
| `visualFeedback` | 0 | 关闭中间图输出 |
| 计时器 | `null` | 不提供调用者计时器 |
| `weightLimit`，内部精调和比例计算 | 0.05 | OTF 模长的区域筛选阈值 |
| `dist`，内部公共区域筛选 | 0.15 | 源码径向筛选中的比例，参见第 9.2 节 |
| 粗定位中心衰减窗 | 强度 0.99、宽度 0.15×截止频率 | 粗找峰准备阶段压低中心；不同于前两种区域阈值 |

`fitExclude=0.3`、`weightLimit=0.05`、`dist=0.15` 有不同的定义，不能互相代替。它们是当前调用或实现选择，不是从互相关定理必然推出的普适常数。

### 11.4 读出结果，并换成物理单位

```java
for (int d = 0; d < param.nrDir(); d++) {
    SimParam.Dir dir = param.dir(d);
    double px = dir.px(1);
    double py = dir.py(1);
    double phaseOffset = dir.getPhaOff();
    double rawM = dir.getRawModulations()[1];
    double adoptedM = dir.getModulations()[1];
    double frequencyPerMicron = Math.hypot(px, py)
        * param.pxlSizeCyclesMicron();
}
```

对于边长 N、等距采样 Δx 的方形图像：

$$
\Delta f=\frac1{N\Delta x},\qquad
\mathbf p_{\mathrm{physical}}=(p_x,p_y)\Delta f,
$$

$$
\|\mathbf p_{\mathrm{physical}}\|
=\frac{\sqrt{p_x^2+p_y^2}}{N\Delta x},
\qquad
T=\frac{N\Delta x}{\sqrt{p_x^2+p_y^2}}.
$$

例如 N=64、Δx=0.3125 μm、频率像素波矢为 (12,−5)：

$$
\Delta f=\frac1{20}=0.05\ \mathrm{cycle}/\mu\mathrm m,
\qquad \|\mathbf p\|=13\times0.05=0.65\ \mathrm{cycle}/\mu\mathrm m,
$$

$$
T\approx1.538462\ \mu\mathrm m.
$$

这是一组教学设置，数值不是推荐给实际显微镜的配置。y 分量还需与采集数组的方向约定一致：fairSIM 的 y 向上，图像行向下。

## 12. 已知真值的最小实操：跑原版估计器核对

项目中已经有一个可运行例子：[运行说明](/Users/22p/Documents/ChatGPT/毕业设计/scripts/fairsim-parameter-estimation/README.md)、[Java 示例](/Users/22p/Documents/ChatGPT/毕业设计/scripts/fairsim-parameter-estimation/ParameterEstimationDemo.java:56)、[运行脚本](/Users/22p/Documents/ChatGPT/毕业设计/scripts/fairsim-parameter-estimation/run.cjs)。

在项目根目录执行：

```sh
node scripts/fairsim-parameter-estimation/run.cjs
```

需要 Node 和 JDK 11+。脚本编译未改写的 fairSIM 参数估计源码，并复用项目已有的 FFT 适配器，不构建或启动整个 ImageJ 插件。

### 12.1 生成数据、估计参数和核对误差是三个阶段

1. `sample()` 生成非负、周期边界的微球样品。
2. `capture()` 用已知条纹照明该样品，经过 OTF，生成三方向九帧数据的频谱。
3. 新建 `SimParam`，只提供配置与 OTF，调用原版 `estimateParameters`。
4. 把读出的参数与生成时的已知值比较。

真值用于造数据和最后比较，没有作为波矢、相位或调制度输入估计器。估计器接收到的仍然只是原始帧频谱。

该合成数据无噪声、OTF 匹配、相位等间隔。整数条纹频率与周期边界相容，所以未额外加边缘窗；这不同于有限视野的真实数据预处理。

### 12.2 2026-10-13 运行结果

| 方向 | 真值波矢，fairSIM 坐标 | 估计波矢 | 真值相位 / rad | 估计相位 / rad | 真值 μ | 估计 μ |
|---|---|---|---:|---:|---:|---:|
| 0 | (12, −5) | (12.011111, −5.011111) | 0.7 | 0.627842 | 0.8 | 0.799809 |
| 1 | (−4, −13) | (−4.011111, −12.988889) | −0.4 | −0.328196 | 0.8 | 0.786412 |
| 2 | (9, 10) | (9.011111, 9.988889) | 1.1 | 1.027845 | 0.8 | 0.781825 |

输出最大误差：

```text
maxKError=0.015713 bins
maxPhaseError=0.072158 rad
maxModulationError=0.018175
```

相位差按模 2π 计算：

$$
\Delta\phi=
\operatorname{atan2}\left(
\sin(\hat\phi-\phi),\cos(\hat\phi-\phi)\right).
$$

### 12.3 为什么无噪声也没有逐项精确恢复

理想比例式要求正确归位、正确校正和一致区域。源码用有限候选网格、近似区域与浮点运算实现这些条件。网格不包含中心、最终区域重新准备等细节，都可能影响结果；本例不把总误差完全归因于某一个细节。

波矢与相位还会共同影响整个视野中的照明角度。按相同坐标原点比较：

$$
\Delta\theta(\mathbf r)
=2\pi(\hat{\mathbf p}-\mathbf p)\cdot\mathbf r
+(\hat\phi-\phi).
$$

因此，小的波矢误差在大视野中仍会形成相位变化。比较相位时，要保持波矢方向、坐标轴和空间原点一致。

这个实操验证了 API、正负号和数量级，不能据此评价真实噪声、运动、像差或低调制度数据上的性能。

## 13. 非等间隔相位、三束数据，以及常见误解

### 13.1 逐帧相位估计是另一条路径

若相位步进不够准确，源码提供：

```java
SimAlgorithm.estimateAbsolutePhases(param, inFFT, null);
```

它要求波矢已经足够准确。每帧的操作是：复制原始频谱 → OTF 加权 → 在已知波矢处计算频谱自相关 → 取辐角 → `setPhases(pha, true)` 保存各帧相位并把共同偏移清零。[源码 C7](#c7)

源码依据的非迭代自相关方法是 Wicker 2013 的 *Non-iterative determination of pattern phase in structured illumination microscopy using auto-correlations in Fourier space*，DOI [10.1364/OE.21.024692](https://doi.org/10.1364/OE.21.024692)。它与同年另一篇 *Phase optimisation for structured illumination microscopy*，DOI [10.1364/OE.21.002032](https://doi.org/10.1364/OE.21.002032)，需要区分。

`estimateAbsolutePhases` 不是一次联合求解所有未知参数，也不会自动重新估计调制度。不能仅凭“自相关”三个字，就把任意单帧的自相关辐角当作没有条件的精确相位恒等式。

如果在逐帧相位估计后需要保留该相位序列再估波矢和调制度，可使用带 `double[] fitExclude` 的入口：

```java
double[] excludes = new double[param.nrDir()];
java.util.Arrays.fill(excludes, 0.3);
SimAlgorithm.estimateParameters(param, inFFT,
    1, excludes, null, 0, null, true, "refit after per-frame phases");
```

这只是明确的可选再拟合调用，GUI 的默认流程不会自动增加这一步。再拟合结果仍依赖初始波矢、逐帧相位质量和数据模型。

固定提交中，带单个 `double fitExclude` 的九参数重载虽然接收 `keepPhases`，却在转发时传入 `false`，忽略该标志；因此上述保留相位的调用特意使用数组重载。此结论来自本地 `SimAlgorithm.java` 第 89—100 行，仅描述列明提交的行为。

### 13.2 三束配置不能照搬三帧推导

作者 `StepByStep` 默认 `nrBands=3`，有 0、±1、±2 五个分量，每方向五个相位，三方向共十五帧。充分、独立的相移测量至少要覆盖分量数：

$$
N_{\mathrm{phase}}\ge2\,\mathrm{nrBands}-1.
$$

计数足够还要求分离矩阵有足够秩。源码在帧数等于分量数时求逆，更多帧时使用伪逆。

三束路径可以用一阶或二阶旁带拟合位移；高层随后从一阶 `p1` 取基础相位，以阶数的倍数表示更高阶相位。`setPxPy` 接收最高阶位移，并除以 `nrBands-1` 保存一阶值。不要把本文的三帧加权系数 2/3、不带阶数的相位比例，直接套到十五帧配置。

### 13.3 对照阅读时可以问自己的六个问题

| 问题 | 应当分清的答案 |
|---|---|
| 临时分离是否知道真实 μ、φΔ？ | 不知道；它们作为 α 留在旁带中 |
| 为什么临时分离不需要 p？ | 在每个相机频点，先解开三个未知复数来源；p 决定来源的样品坐标，稍后再匹配 |
| 为什么不能直接比较 B₊(f) 和 B₀(f)？ | 它们对应样品频率 f−p 和 f |
| 匹配为什么不需要样品真值？ | 正确归位后，同一部分未知样品被记录两次，只差固定比例 |
| `hypot()` 为什么给 μ，而不是 μ/2？ | 临时矩阵已经按旁带 1/2 归一化 |
| “亚像素”是否意味着参数精确无误？ | 不意味着；有限搜索、区域、数据模型和噪声都影响精度 |

<a id="sources"></a>
## 14. 来源与核对记录

### 14.1 论文

- Müller 等，2016，*Open-source image reconstruction of super-resolution structured illumination microscopy data in ImageJ*。[出版页](https://www.nature.com/articles/ncomms10980)；[本地主文](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016.pdf)。主文自动参数估计部分在 PDF 第 4 页。
- [本地补充材料](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016-SI.pdf)。Supplementary Note 1 位于 PDF 第 9—11 页：第 9 页解释成像和频带分离，第 10—11 页解释重叠频带、相关和比例参数估计。
- Gustafsson，2000，*Surpassing the lateral resolution limit by a factor of two using structured illumination microscopy*，DOI [10.1046/j.1365-2818.2000.00710.x](https://doi.org/10.1046/j.1365-2818.2000.00710.x)。fairSIM 补充材料将默认估计方法追溯到此文；本文具体公式以已核对的 fairSIM 补充材料和源码为依据。
- Wicker，2013，非迭代逐帧相位估计，DOI [10.1364/OE.21.024692](https://doi.org/10.1364/OE.21.024692)。仅在第 13.1 节涉及。

### 14.2 固定源码入口

<a id="c1"></a>
- **C1，高层默认估计流程：**[SimAlgorithm.java:156](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java:156)，临时分离、中心衰减、粗相关、精调。两束最终比例与写回从第 287 行开始。

<a id="c2"></a>
- **C2，分离矩阵：**[BandSeparation.java:80](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/BandSeparation.java:80)，默认系数、正负复指数、求逆或伪逆。等间隔相位生成从第 209 行开始。

<a id="c3"></a>
- **C3，相关计算核：**[Correlation.java:46](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java:46)，三轮搜索；第 150 行 `locatePeak`；第 194 行 `getPeak`；第 242 行 `commonRegion`。

<a id="c4"></a>
- **C4，参数容器：**[SimParam.java:429](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimParam.java:429)，相位偏移叠加；第 459 行波矢存储；第 523 行调制度存储与采用值；默认回退范围在第 81 行。

<a id="c5"></a>
- **C5，空间复指数与频谱位移：**[BasicVectors.java:331](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/linalg/BasicVectors.java:331)；完整变换包装在 [SimUtils.java:48](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimUtils.java:48)。

<a id="c6"></a>
- **C6，作者的输入和调用示例：**[StepByStep.java:55](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/fiji/StepByStep.java:55)。本文第 11.2 节改为两束、九帧配置，并把背景与窗宽作为输入。

<a id="c7"></a>
- **C7，逐帧相位路径：**[SimAlgorithm.java:404](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java:404)，`estimateAbsolutePhases`；自相关在 [Correlation.java:309](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java:309)。

### 14.3 本次数值与代码核对

- 用复数运算核对三相位正交消项、默认分离矩阵及单频点数字例子。
- 核对第 7.4 节的公共区能量、复数比例和错配相关模。
- 核对第 8.2 节的“逆 DFT → 共轭乘积 → DFT”与直接频率相关的等价关系。
- 编译第 11.2 节的 Java 包装函数，核对 API 签名。
- 运行第 12 节的原版 fairSIM 参数估计示例，记录误差。

浮点核对结果如下，误差是对应代数恒等式两侧复数差的模：

| 核对内容 | 结果 |
|---|---|
| 临时矩阵的逆与原矩阵相乘 | 最大误差约 4.72×10⁻¹⁶ |
| 100 组复数分量、不同共同相位和调制度的临时分离 | 最大误差约 9.93×10⁻¹⁶ |
| FFT 路径与直接频率相关求和 | 最大误差约 4.17×10⁻¹⁶ |
| 人为设置整数位移 3 的频率相关 | 峰位置为 3 |
| 第 7.4 节的复数比例恢复 | 在该浮点计算中差为 0 |
| 公式语法与文件链接 | 98 个公式块均通过本地 KaTeX 解析；本地文件和显式锚点链接已检查 |
| 第 11.2 节函数 | 编译通过 |

上述校验只涉及公式、代码和数值，没有启动浏览器或进行截图、视觉验收。更完整的论文重建流程可继续阅读[原文公式与代码逐步精读](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM_原文公式与代码逐步精读.md)。
