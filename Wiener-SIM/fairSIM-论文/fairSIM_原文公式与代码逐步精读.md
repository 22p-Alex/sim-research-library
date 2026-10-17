# fairSIM：沿原文公式与步骤逐步精读

核对日期：2026-10-12。对象：Müller 等，*Nature Communications* 7, 10980 (2016)，以及本地 fairSIM 提交 `711afd12cb8c4fd4207bbca7ee7610c5aed4f732`。

这份文档按“原文公式或步骤 → 必要的补充推导 → fairSIM 代码 → 本步产物”展开。代码对照只使用 fairSIM。每节围绕一个问题，阅读时可以分次进行。

## 阅读入口与原文定位

本次重新清点了项目目录与两份“知识库整理前”归档：原先保存了 SIM 综述等论文，但 fairSIM 目录只有题录、笔记和源码，没有这篇主文或补充材料的 PDF。本次已补齐：

- [主文，6 页](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016.pdf)。Introduction 从 PDF 第 2 页开始；自动参数估计与技术实现主要在第 4 页。
- [补充材料，12 页](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016-SI.pdf)。第 1—8 页为补充图；**Supplementary Note 1 位于第 9—11 页**，这是本文的公式主线。
- [主文原始 XML](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016.xml)，来自 Europe PMC，便于核对段落。

**Supplementary Note 1 的公式没有印刷编号。** 下文 F1—F8 是本稿按出现顺序设置的定位标签，不是论文原来的公式号。标为“补充推导”的内容由原式逐步展开；标为“代码具体行为”的内容以固定提交为准。向量点乘、列向量转置等排版记号写全；原文的几处记号问题集中放在[核对说明](#audit)，不悄悄改写成所谓原式。

原文先假设照明参数已知，说明重建；随后再解释如何估计这些参数。本文沿用这个讲解次序。实际程序先估参数、再正式重建，二者的区别在[第 7 节](#s7)对照。

| 本稿 | 原文位置 | 只解决的问题 |
|---|---|---|
| [1. 前向成像](#s1) | SI 第 9 页，F1 | 相机每一帧由什么形成？ |
| [2. 频率混合](#s2) | SI 第 9 页，F2 | 高频信息怎样进入检测通带？ |
| [3. 频带分离](#s3) | SI 第 9 页，F3—F4 | 多个相位怎样分开混合分量？ |
| [4. 归位与 Wiener](#s4) | SI 第 10 页，F5 | 分开的频带怎样组成一个估计？ |
| [5. 切趾与输出](#s5) | SI 第 10 页，F5 中的 A | 切趾窗具体怎样计算、作用在哪里？ |
| [6. 参数估计](#s6) | SI 第 10—11 页，F6—F8 | 未知的照明参数怎样从数据得到？ |
| [7. 回到执行顺序](#s7) | 主文第 4 页；作者示例 | 各段代码怎样接成一次重建？ |

先分清原文符号，后面就不反复换名字：

| 原文写法 | 含义 | 与此前讨论的符号对应 |
|---|---|---|
| S(r) | 样品在空间中的荧光响应 | 之前的小写 s |
| S 上方加波浪号 | 样品频谱 | 之前的频谱 S |
| Dₙ(r)、Dₙ 上方加波浪号 | 第 n 帧及其频谱 | 相机观测 |
| h 上方加波浪号、h(k) | 检测 PSF、检测 OTF | 之前的 h、H |
| p | 照明条纹的频率向量 | 之前的照明 k |
| k | 当前频率坐标 | 未归位时对应之前的检测 f |
| m、M | 有符号级次、最高级次 | 这里 m **不是**明暗调制度 |
| aₘ | 照明中第 m 个谐波的系数 | 两束模型的旁带系数为调制度的一半 |
| A(k) | 最后使用的切趾窗 | 之前的 Pₐₚₒ；不是分离频带 |

## 1. 从原文 F1 读懂一帧图像

**原文位置：SI 第 9 页，第一条公式。**

$$
D_n(\mathbf r)
=\sum_{m=-M}^{M}
\left[S(\mathbf r)\,a_m
\exp\!\left\{im\left(2\pi\mathbf p\cdot\mathbf r+\phi_n\right)\right\}\right]
\otimes\tilde h(\mathbf r).
\tag{F1}
$$

先只看结构：方括号里是“样品 × 照明的一项”，求和合成完整照明，最后经过 PSF 卷积。原文以谐波展开来写照明，所以看起来比“样品乘条纹”更长。

这里 S 是要研究的样品，D 是相机数据；PSF 描述检测系统怎样把一个发光点摊成光斑。下标 n 区分相移帧。原文规定两束照明的最高级次为 1，三束照明为 2。

**补充推导：先把两束照明的三个项写出来。** 为了把“级次”和“明暗反差”分开，用 μ 表示照明的明暗调制度，并把平均照明强度归一化为 1：

$$
M=1,\qquad a_0=1,\qquad a_{+1}=a_{-1}=\frac{\mu}{2}.
$$

记条纹相位为 θ，利用余弦恒等式：

$$
\cos\theta=\frac{e^{i\theta}+e^{-i\theta}}2,
\qquad \theta=2\pi\mathbf p\cdot\mathbf r+\phi_n.
$$

于是 F1 中的照明项就是：

$$
\sum_{m=-1}^{1}a_me^{im\theta}
=1+\frac{\mu}{2}e^{i\theta}+\frac{\mu}{2}e^{-i\theta}
=1+\mu\cos\theta.
$$

因此，F1 可以读成熟悉的形式：

$$
D_n=\big[S\,I_n\big]\otimes\tilde h,
\qquad I_n=1+\mu\cos\left(2\pi\mathbf p\cdot\mathbf r+\phi_n\right).
$$

这只使用线性荧光响应和移不变检测模型。补充说明的这条原式没有显式噪声项，本节先按其无噪声形式理解。

**fairSIM 对照。** fairSIM 接收已经采集的相机帧；`StepByStep` 从像素数组读入数据，不需要先生成样品真值。F1 的谐波系数稍后体现在 `BandSeparation` 的矩阵中：传入的旁带调制度先乘 0.5，得到上面的 μ/2。[数据读入 C1](#code-c1)；[矩阵系数 C2](#code-c2)。

**本步产物：**明确每帧数据先经过“样品乘照明”，再经过检测模糊。算法收到的是 D，不是样品 S。

<a id="s2"></a>
## 2. 从 F1 到 F2：频率为什么会平移

**原文位置：SI 第 9 页，切换到 Fourier space 后的公式。**

$$
\tilde D_n(\mathbf k)
=\sum_{m=-M}^{M}
e^{im\phi_n}a_m
\tilde S(\mathbf k-m\mathbf p)\,h(\mathbf k).
\tag{F2}
$$

与 F1 相比，样品频谱的坐标变成了“当前频率减去级次乘照明频率”。检测 OTF 仍然取在当前检测坐标。

**补充推导：只推频谱平移这一步。** 在一维下，傅里叶变换定义为：

$$
\tilde S(k)=\int S(x)e^{-i2\pi kx}\,\mathrm dx.
$$

把样品乘以照明的一项之后：

$$
\begin{aligned}
\mathcal F\{S(x)e^{i2\pi mpx}\}
&=\int S(x)e^{i2\pi mpx}e^{-i2\pi kx}\,\mathrm dx\\
&=\int S(x)e^{-i2\pi(k-mp)x}\,\mathrm dx\\
&=\tilde S(k-mp).
\end{aligned}
$$

第一行代入定义，第二行合并指数，第三行识别为样品在新频率位置的傅里叶变换。二维只是把乘积换成向量点乘。再利用“空间卷积对应频域相乘”，便得到 F2 中的 OTF 因子。

对两束照明，F2 展开为：

$$
\tilde D_n(\mathbf k)
=h(\mathbf k)\left[
\tilde S(\mathbf k)
+\frac\mu2e^{i\phi_n}\tilde S(\mathbf k-\mathbf p)
+\frac\mu2e^{-i\phi_n}\tilde S(\mathbf k+\mathbf p)
\right].
$$

**三个来源都乘同一个检测 OTF，因为它们混合后位于相机的同一个频率位置。**

沿用一个例子，所有频率均以同一 DFT 网格的格数表示：

$$
\mathbf k=(6,0),\qquad\mathbf p=(8,0).
$$

相机的这个位置混合了：

$$
\tilde S(6,0),\qquad\tilde S(-2,0),\qquad\tilde S(14,0).
$$

如果检测截止为 10 格，样品第 14 格不能直接通过宽场检测，却可以经照明调制出现在检测第 6 格。这里证明的是“能够进入通带”；信号仍然受第 6 格的 OTF 衰减。

**fairSIM 对照。** 作者示例调用 `fft2d(false)`，把每帧数据转成频谱；混合矩阵随后作用在这些频谱上。此处 FFT 只是换一种表示，不会自行把三个来源分开。[C1](#code-c1)

**本步产物：**知道相机的一个频率值混合了哪些样品频率，以及每个来源前面的相位系数。

<a id="s3"></a>
## 3. F3—F4：把多帧写成方程，再分离频带

**原文位置：SI 第 9 页，matrix form 和 band separation 两段。**

$$
\tilde{\mathbf D}(\mathbf k)=\mathbf M\,\mathbf C(\mathbf k),
\qquad \mathbf M_{nm}=a_me^{im\phi_n}.
\tag{F3}
$$

原文的向量按级次从 −M 排到 +M。为保证与 F2 一致，本稿明确使用：

$$
C_m(\mathbf k)=h(\mathbf k)\tilde S(\mathbf k-m\mathbf p).
$$

这里不再包含照明系数，因为照明系数已经放入矩阵 M。原文关于 C 的另一种简写容易把 OTF 一起平移，见[核对说明 A2](#audit-a2)。

**补充推导：矩阵就是几条联立方程的紧凑写法。** fairSIM 的数组列序为“0、+1、−1”；以下同步按这个顺序排列未知量。换列序只改变存储顺序，不改变观测方程：

$$
\begin{bmatrix}\tilde D_0\\\tilde D_1\\\tilde D_2\end{bmatrix}
=
\begin{bmatrix}
1&\frac\mu2e^{i\phi_0}&\frac\mu2e^{-i\phi_0}\\
1&\frac\mu2e^{i\phi_1}&\frac\mu2e^{-i\phi_1}\\
1&\frac\mu2e^{i\phi_2}&\frac\mu2e^{-i\phi_2}
\end{bmatrix}
\begin{bmatrix}C_0\\C_{+1}\\C_{-1}\end{bmatrix}.
$$

每行对应一帧，每列对应一个来源。各帧测量同一组三个未知量，改变的是相位权重。

原文接着写：

$$
\mathbf C=\mathbf M^{-1}\tilde{\mathbf D}.
\tag{F4}
$$

先不要求熟练计算矩阵逆。对三步等间隔相移，可以直接看出怎样消去其余分量：

$$
\phi_n=\frac{2\pi n}{3},\qquad n=0,1,2.
$$

这三个相位满足：

$$
\sum_{n=0}^{2}e^{i\phi_n}
=1+\left(-\frac12+i\frac{\sqrt3}2\right)
+\left(-\frac12-i\frac{\sqrt3}2\right)=0.
$$

负相位的和、双倍相位的和也为零。于是三帧直接相加时，两个旁带抵消：

$$
C_0=\frac13\sum_{n=0}^{2}\tilde D_n.
$$

如果先给第 n 帧乘负相位，再相加，正一级自己的系数变成常数，另两项的相位和为零：

$$
\begin{aligned}
\sum_ne^{-i\phi_n}\tilde D_n
&=C_0\sum_ne^{-i\phi_n}
+\frac\mu2C_{+1}\sum_n1
+\frac\mu2C_{-1}\sum_ne^{-2i\phi_n}\\
&=\frac{3\mu}{2}C_{+1}.
\end{aligned}
$$

因此：

$$
C_{+1}=\frac{2}{3\mu}\sum_ne^{-i\phi_n}\tilde D_n,
\qquad
C_{-1}=\frac{2}{3\mu}\sum_ne^{i\phi_n}\tilde D_n.
$$

这就是三步等间隔情形下矩阵求逆的具体含义：选择权重，让目标分量留下，其余分量抵消。

**数值核对。** 取 μ=0.8，并为检查代数设三个待求分量分别为 1、2、3。它们不是某张实际图像的测量值。相机频谱为：

$$
(C_0,C_{+1},C_{-1})=(1,2,3)
\quad\Longrightarrow\quad
(\tilde D_0,\tilde D_1,\tilde D_2)
=\left(3,-i\frac{\sqrt3}{5},i\frac{\sqrt3}{5}\right).
$$

代入上面的三个加权和，分别得到 1、2、3。相机图像虽然是实数，其傅里叶系数可以是复数。

**fairSIM 对照。** 构造矩阵时，下面的实部、虚部组成一个相位系数：

```java
M.set(i, 2 * j + 1, new Cplx.Double(
    fac[j + 1] * Math.cos(phases[j][i]),
    fac[j + 1] * Math.sin(phases[j][i])));
```

也就是“系数乘 cos，相同系数乘 sin”，合在一起表示复指数。负一级的代码把相位取负。这里 `i` 是帧索引，`j` 是正阶旁带的循环索引。[C2](#code-c2)

```java
if (nrPhases == (bands * 2) - 1)
    invM = M.inverse();
else
    invM = M.pseudoInverse();
```

注意 Java 的 `bands` 等于原文最高级次 M 加 1。因此分量数是 2M+1；足够的独立相位至少需要同样多的帧。三步只是两束模型的最小配置；相位重复即使帧数够，也可能无法分离。原文帧数条件的印刷写法见[核对说明 A1](#audit-a1)。

真正执行加权相加的代码是：

```java
out[b].axpy(SpM.get(b, p).toFlt(), in[p]);
```

把 `axpy` 读成“输出 += 系数 × 当前输入帧”即可。代码先把输出清零，再遍历全部输入帧。[C3](#code-c3)

**本步产物：**得到每个独立频带 Cₘ。照明系数已在求逆时补偿，检测 OTF 仍然包含在频带中；下一步需要归位和融合。

<a id="s4"></a>
## 4. 原文 F5：归位后怎样进行 Wiener 融合

**原文位置：SI 第 10 页，第一段及其 Wiener 公式。** 作者先把各频带移回正确位置，再组合频谱。原式写为：

$$
\tilde S_{\mathrm{SR}}(\mathbf k)
=
\frac{\displaystyle\sum_{m=-M}^{M}
h^*(\mathbf k+m\mathbf p)\,C_m(\mathbf k+m\mathbf p)}
{\displaystyle\omega^2+\sum_{m=-M}^{M}h^2(\mathbf k+m\mathbf p)}
\,A(\mathbf k).
\tag{F5}
$$

原文分母印作 h²。对本文先采用的实数 OTF，它与模平方相同；推广到复数 OTF 时应写模平方，fairSIM 代码也使用 `absSq()`。式中 A 是切趾窗，留到下一节处理。

### 4.1 先把“归位”这件事算清楚

**补充推导。** 分离频带在检测坐标下是：

$$
C_m(\mathbf k)=h(\mathbf k)\tilde S(\mathbf k-m\mathbf p).
$$

现在引入 q 表示其来源的样品频率，便于区分归位前后：

$$
\mathbf q=\mathbf k-m\mathbf p
\quad\Longleftrightarrow\quad
\mathbf k=\mathbf q+m\mathbf p.
$$

定义归位后的频带与同步归位的 OTF：

$$
\begin{aligned}
B_m(\mathbf q)&=C_m(\mathbf q+m\mathbf p),\\
h_m(\mathbf q)&=h(\mathbf q+m\mathbf p).
\end{aligned}
$$

代入即可得到：

$$
\boxed{B_m(\mathbf q)=h_m(\mathbf q)\tilde S(\mathbf q).}
$$

这一式解释了为什么能够融合：**固定一个样品频率，各归位频带都在测量同一个样品系数，只是 OTF 衰减不同。**

接上第 2 节的例子，检测位置是第 6 格、照明频率为 8 格，负一级的来源为：

$$
\mathbf q=(6,0)-(-1)(8,0)=(14,0).
$$

归位后，这个分量放在样品第 14 格，但它所经历的检测 OTF 仍是第 6 格的值。

**fairSIM 对照。** `SimAlgorithm` 先用 `placeFreq` 把频谱放入两倍边长的网格，再给正负频带施加相反位移。[C4](#code-c4)

```java
SimUtils.placeFreq(separate[pos], shifted[pos]);
SimUtils.placeFreq(separate[neg], shifted[neg]);
SimUtils.fourierShift(shifted[pos], par.px(b), par.py(b));
SimUtils.fourierShift(shifted[neg], -par.px(b), -par.py(b));
```

`fourierShift` 的三个操作是逆 FFT、乘空间相位因子、正 FFT；第 2 节的平移定理就是依据。[C5](#code-c5)

```java
Transforms.fft2d(inV, true);
Transforms.timesShiftVector(inV, kx, -ky);
Transforms.fft2d(inV, false);
```

源码的 y 坐标方向与图像行号相反，因此出现 `-ky`。此外这里的 `pos/neg` 是搬移阶段的局部命名，应结合数组下标与位移一起读，不能只凭变量名判断原文的级次。

### 4.2 分子的共轭和分母的平方从哪里来

**补充推导，先取实数 OTF。** 把“方向＋级次”统一记为 b，在一个固定样品频率处写成：

$$
B_b=h_b\tilde S+\eta_b.
$$

噪声用 η 表示。如果逐份相除，就得到：

$$
\frac{B_b}{h_b}=\tilde S+\frac{\eta_b}{h_b}.
$$

当传递系数很小时，噪声被放大。于是我们同时利用各通道，寻找一个既能解释观测、又不会在弱约束下变得过大的估计 z。

先按各频带有效噪声等权的简化模型，写目标函数：

$$
J(z)=\sum_b|B_b-h_bz|^2+\omega^2|z|^2.
$$

第一项是观测误差平方和，第二项对过大的频谱估计施加惩罚。这是帮助理解 F5 的正则化最小二乘推导，**不是 Supplementary Note 1 中另外一条原式**。

复数可以拆成两个普通实数。令：

$$
z=x+iy,\qquad B_b=u_b+iv_b.
$$

因为这里 h 是实数，目标函数就是：

$$
J(x,y)=\sum_b\left[(u_b-h_bx)^2+(v_b-h_by)^2\right]
+\omega^2(x^2+y^2).
$$

对 x 求导，再令其为零：

$$
-2\sum_bh_b(u_b-h_bx)+2\omega^2x=0
\quad\Longrightarrow\quad
x=\frac{\sum_bh_bu_b}{\sum_bh_b^2+\omega^2}.
$$

对 y 完全相同：

$$
y=\frac{\sum_bh_bv_b}{\sum_bh_b^2+\omega^2}.
$$

把实部和虚部合回一个复数：

$$
\hat z=\frac{\sum_bh_bB_b}{\sum_bh_b^2+\omega^2}.
$$

所以分子多出的一个传递系数来自求导中的链式法则，分母的平方来自再乘上预测模型中的传递系数。若 OTF 本身也有相位，同样展开实部、虚部会得到：

$$
\boxed{\hat z=\frac{\sum_bh_b^*B_b}{\sum_b|h_b|^2+\omega^2}.}
$$

共轭的含义可以直接从无噪声信号看出：

$$
h_b^*B_b=h_b^*h_b\tilde S=|h_b|^2\tilde S.
$$

先按传递强度加权，再由分母归一化。单独乘共轭 OTF 并没有完成反衰减；分子与分母共同构成估计。

为了理解正则项，记所有通道的平方和为 Q。在标准等权模型、参数匹配且无噪声时：

$$
Q=\sum_b|h_b|^2,\qquad
\hat z=\frac{Q}{Q+\omega^2}\tilde S.
$$

Q 大时，观测能较强地约束该频率；Q 小时，正则项会压低输出，减轻弱传递位置的噪声放大。照明调制度补偿会改变旁带噪声，所以这里的等权模型用于解释公式，并不证明实际数据上的统计最优性。ω 也不能直接解释成相机噪声的标准差。

### 4.3 对照代码的实际计算

`applyOtf` 内部执行的是共轭乘法：[C6](#code-c6)

```java
vec.set(x, y, vec.get(x, y).mult(val.conj()));
```

各分量加到 `fullResult` 后，代码乘上 `getDenominator` 返回的数组。该函数返回的是倒数：[C7](#code-c7)

```java
ret.set(x, y, 1 / (ret.get(x, y) + (float) (wParam * wParam)));
```

固定提交中有一处需要与 F5 分开记：分母对每个方向、每个非负 band 同时累加正负偏移，零级偏移也算了两次，而分子每方向的零级只加一次。因此，关闭额外 OTF attenuation 时，两束模型实际使用：

$$
D_{\mathrm{code}}(\mathbf q)
=\sum_d\left[2|h_{d,0}|^2+|h_{d,+1}|^2+|h_{d,-1}|^2\right],
$$

$$
F_{\mathrm{pre}}(\mathbf q)
=\frac{\sum_{d,m}h_{d,m}^*(\mathbf q)B_{d,m}(\mathbf q)}
{D_{\mathrm{code}}(\mathbf q)+\omega^2}.
$$

这处计数是当前源码行为，不能从 F5 的标准平方和推导出来。记额外的一份零级平方和为 Q₀，无噪声匹配情况下，实际切趾前幅度响应为：

$$
G_{\mathrm{pre}}=\frac{Q}{Q+Q_0+\omega^2}.
$$

因此将 ω 设为零，也不能直接认定当前代码所有受支持频率的响应都等于 1。额外 OTF attenuation 的权重关系放在[核对说明 A4](#audit-a4)。

**本步产物：**得到切趾前的复数频谱；每个位置已经合并了对同一个样品频率的观测。

<a id="s5"></a>
## 5. F5 中的 A：切趾实际怎样做

**原文位置：SI 第 10 页，紧接 F5 的解释。** 作者称 A 为 apodization，用于减轻振铃。补充说明没有给出 A 的具体形状公式；以下形状来自所核对的 fairSIM 代码。

先将 F5 分成两个操作：

$$
F_{\mathrm{pre}}=\frac{\text{OTF 匹配累加的分子}}{\text{分母}+\omega^2},
\qquad
F_{\mathrm{out}}(\mathbf q)=A(\mathbf q)F_{\mathrm{pre}}(\mathbf q).
$$

### 5.1 每个频率点的窗值怎样产生

**代码具体行为：圆对称切趾。** 记检测截止为 k_c，切趾截止倍数为 c，指数为 β。对每个频率点，依次计算：[C8](#code-c8)

$$
r=\sqrt{q_x^2+q_y^2},\qquad
\rho=\frac{r}{c\,k_c},\qquad
A(\mathbf q)=\left[h_{\mathrm{ideal}}(\rho)\right]^\beta.
$$

代码使用的形状函数为：

$$
h_{\mathrm{ideal}}(\rho)=
\begin{cases}
\dfrac2\pi\left[\arccos\rho-\rho\sqrt{1-\rho^2}\right],&0\le\rho\le1,\\
0,&\rho>1.
\end{cases}
$$

`valIdealOTF` 源码将其标为无像差圆瞳的理想 OTF，并注明 Goodman《Introduction to Fourier Optics》第三版第 145 页。这里按源码说明引用其来源，不另外展开圆瞳衍射推导。

```java
double frac = apoFrac(xh, yh, shape, angle, cutOff, cutOffMinor);
double val = Math.pow(valIdealOTF(frac), bend);
vec.set(x, y, new Cplx.Float((float) val));
```

`frac` 是归一化半径，`bend` 是指数，`val` 是该频率点的实数窗值。此处以频率坐标计算窗，作用对象是频谱。

`StepByStep` 示例设置 c=1.9、β=0.8。若为了易读把检测截止设为 10 格，切趾截止就是 19 格。在样品频率第 14 格：

$$
\rho=\frac{14}{19},\qquad
A(14,0)=\left[h_{\mathrm{ideal}}\left(\frac{14}{19}\right)\right]^{0.8}
\approx0.22562.
$$

所以该频率的复数系数乘以约 0.226。若切趾前是 u+iv，切趾后就是：

$$
A(u+iv)=Au+iAv.
$$

正的实数窗保持该频点的相位，并缩小幅度；功率乘以窗值的平方。这个窗在中间频率也会衰减，不只处理最外侧一圈。例如归一化半径为 0.5 时，默认指数下窗值约为 0.47178。

| 改变参数 | 对固定频率的影响 |
|---|---|
| 增大切趾截止倍数 c | 归一化半径变小，通常保留更多幅度 |
| 减小 c | 衰减更强，更早降到零 |
| 增大正指数 β | 对 0—1 之间的形状函数压低更多 |
| 减小正指数 β | 保留更多幅度 |

切趾不会扩大实际信息支撑。所有归位 OTF 都为零的位置，没有可用观测；即使窗值为正，也不能在那里生成样品信息。

### 5.2 为什么会减轻振铃

**补充推导，只用一个傅里叶关系。** 若一维频谱在截止位置突然截断，矩形窗的逆变换为：

$$
p_{\mathrm{hard}}(x)=\int_{-q_c}^{q_c}e^{i2\pi qx}\,\mathrm dq
=\frac{\sin(2\pi q_cx)}{\pi x}.
$$

它带有振荡旁瓣。强点或锐边经过这样的响应，周围可能出现波纹。让频谱平缓收尾，可以缓和这种突然截断带来的振铃，同时也会压低细节对比度。

卷积定理把切趾与空间图像联系起来：

$$
\mathcal F^{-1}\{A F_{\mathrm{pre}}\}
=\mathcal F^{-1}\{A\}*\mathcal F^{-1}\{F_{\mathrm{pre}}\}.
$$

切趾降低高频噪声的绝对幅度，也会同时降低同频率的信号。它调整最终响应，不会仅靠乘同一个系数就提高该频点的信噪比。

**fairSIM 对照。** 代码依次进行 Wiener、切趾和逆 FFT：[C9](#code-c9)

```java
Vec2d.Real denom = wFilter.getDenominator(wienParam);
fullResult.times(denom);
otfPr.writeApoVector(apo, apoB, apoF, apoShape, apoAngle, apoFMinor);
fullResult.times(apo);
fullResultImage = SimUtils.spatial(fullResult, imgClipScale);
```

逆 FFT 的输入始终是完整复数频谱；用于观察的对数幅度图只是显示方式。

**本步产物：**得到切趾后的频谱与空间图像。整个输出的有效响应同时包含 Wiener 与切趾，两者共同影响细节幅度和点扩散形状。

<a id="s6"></a>
## 6. F6—F8：照明参数怎样从未知样品中估计

如果需要把本节逐项展开，阅读[参数估计逐步推导与代码实操](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM_参数估计逐步推导与代码实操.md)：它补全三相位消项、2/3 系数、相机与样品频率坐标、复数相关及其 FFT 实现，并提供数字核对和代码调用。

**原文位置：SI 第 10 页下半部 “Parameter estimation”，延续至第 11 页。** 原文到这里才处理前面假设已知的条纹频率、方向、相位等参数。

### 6.1 先做一次临时分离

原文假设相位等间隔，但与真实相位之间差一个全局偏移：

$$
\phi_n=\phi'_n+\phi_\Delta.
$$

用暂定相位做分离，可以先得到待匹配的频带。两束情形下，若真实旁带系数为 μ/2，而临时分离按 1/2 处理，那么正一级临时分量会留下一个因子：

$$
C^{\mathrm{temp}}_{+1}(\mathbf k)
=\mu e^{i\phi_\Delta}h(\mathbf k)\tilde S(\mathbf k-\mathbf p).
$$

这是[第 3 节](#s3)加权和的直接结果：等间隔的相对相位仍能消去其他项，暂时未知的全局相位与幅度系数留在结果中。

**fairSIM 对照。** 常规入口在 `keepPhases=false` 时重置为等间隔相位，再以 `fac=null` 临时分离；`fac=null` 对应零级系数 1、旁带系数 0.5。[C10](#code-c10)

```java
dir.resetPhases();
BandSeparation.separateBands(inputCpy, separate,
    0, dir.nrBand(), null);
```

这一步依赖相位模型，不能理解成“任何未知相位都可以随意分离”。如果各帧相位误差并非同一个全局偏移，上面的简化关系不再严格成立。

### 6.2 用重叠区找到正确位移

**原文 F6，SI 第 10 页最后一式。** 对已经进行 OTF 校正、并正确归位的公共频率，作者写出：

$$
\tilde S_m(\mathbf k'+m\mathbf p)
=a'_m\,\tilde S_0(\mathbf k').
\tag{F6}
$$

这里带撇的频率只遍历两个频带的公共区域；这段中的频带已经去除了用于比较的 OTF 衰减。它与未经 OTF 校正的 Cₘ 不同。

这条式子的意思是：把旁带移到正确位置后，它与零级在重叠区域描述的是同一批样品结构，只差一个固定的复数比例。位移错误时，不同位置的结构对不上，通常不能用一个固定比例解释。

**原文 F7，SI 第 11 页第一式。** 用互相关衡量两个频带是否对齐：

$$
\mathcal C_{\mathrm{paper}}(\mathbf p)
=\sum_{\mathbf k'\in\Omega}
\tilde S_m^*(\mathbf k'+m\mathbf p)
\tilde S_0(\mathbf k').
\tag{F7}
$$

Ω 表示公共区域。共轭相乘让两份数据的相对相位参与比较；若很多位置都对得上，求和后的幅度较强。对于复数相关量，搜索时比较的是模长。充足的重叠信号与正确模型是前提，重复结构和噪声可能造成多个候选峰。

**fairSIM 的实际搜索分两步。**

第一步是粗定位：给临时频带压低中心区域的影响，通过“逆 FFT → 共轭相乘 → 正 FFT”得到相关图，在排除中心区域后寻找峰值。[C10](#code-c10)

```java
Transforms.fft2d(c0, true);
Transforms.fft2d(c1, true);
c1.timesConj(c0);
Transforms.fft2d(c1, false);
```

第二步是亚像素精调：`Correlation.fitPeak` 在初值周围试多个小位移，比较相关幅度，再缩小搜索范围。当前代码进行三轮，每轮为 10×10 个候选位置，下一轮搜索范围除以 5。[C11](#code-c11)

```java
commonRegion(b0, b1, bn0, bn1, otf,
    kx, ky, 0.15, weightLimit, true);
...
b1s.fourierShift(xpos, -ypos);
b1s.timesConj(b0);
corr[xi][yi] = Cplx.mult(b1s.sumElements(), scal);
```

`commonRegion` 会排除 OTF 过弱的位置，并对保留的数据除以相应 OTF，使两条通道更适合比较。它还排除部分靠近中心的区域。由调用者给出的 `weightLimit=0.05` 是当前实现选择，不是从互相关定义必然推导出的常数。

代码的乘法方向是“旁带乘零级的共轭”，与 F7 的共轭方向相反：两个相关量互为共轭，模长相同，相位符号相反。下面解释相位与调制度时统一跟随**代码方向**；原文记号的一致性问题放在[核对说明 A3](#audit-a3)。

### 6.3 在正确位移处读出相位与调制度

**原文 F8，SI 第 11 页第二式。** 作者用零级能量归一化相关量，并将结果记为一个复数比例：

$$
a'_m=\frac{\mathcal C_{\mathrm{paper}}(\mathbf p)}{E_0},
\qquad E_0=\sum_{\mathbf k'\in\Omega}|\tilde S_0(\mathbf k')|^2.
\tag{F8}
$$

这里将分母明确写成零级的能量。由于 F6 与 F7 的共轭方向问题，F8 得到的量与 F6 中的比例存在共轭差别；不能直接忽略它来解释相位符号。先按代码方向把比例关系推一遍，就容易对齐。

**补充推导。** 在公共区域，把零级数据记为 U，正确归位并校正 OTF 的旁带数据记为 V。假设它们只差一个固定比例 α：

$$
V_j=\alpha U_j.
$$

每个位置都乘上零级的共轭，再求和：

$$
\sum_jV_jU_j^*
=\sum_j\alpha U_jU_j^*
=\alpha\sum_j|U_j|^2.
$$

所以，只要公共区域有非零能量：

$$
\boxed{\alpha=\frac{\sum_jV_jU_j^*}{\sum_j|U_j|^2}.}
$$

分子测量两组数据的复数关联，分母去除样品整体亮度尺度。两束、一阶、上述临时归一化下：

$$
\alpha=\mu e^{i\phi_\Delta},\qquad
\mu=|\alpha|,\qquad
\phi_\Delta=\arg\alpha.
$$

模长给幅度比例，辐角给相位偏移。原文的谐波系数 a₁ 是 μ/2，而这个临时分离归一化下的比例模长是 μ；两者不能不经换算就直接当成同一个数。

**fairSIM 对照。** `Correlation.getPeak` 使用的正是上述方向：[C11](#code-c11)

```java
b1.timesConj(b0);
Cplx.Double scal = new Cplx.Double(1. / b0.norm2());
Cplx.Double ret = Cplx.mult(b1.sumElements(), scal);
```

这里 `norm2()` 是各复数模平方的和。代码在空间域完成这个内积；对两组采用同样 FFT 归一化的数据，Parseval 关系使分子与分母的共同尺度抵消，得到相同的比例。

两束分支随后写回参数：

```java
param.dir(angIdx).setPxPy(-peak[0], -peak[1]);
param.dir(angIdx).setPhaOff(p1.phase());
param.dir(angIdx).setModulation(1, p1.hypot());
```

位移前的负号来自相关与搬移约定，不能只看变量名删掉。`phase()` 取辐角，`hypot()` 取模长。对三束数据，代码也通过一阶比例 `p1` 获取基础相位，再按阶数生成高阶相位。[C10](#code-c10)

正式重建时，`getPhases()` 把这个偏移加回相位序列，`getModulations()` 提供采用的调制度，然后重新构造分离矩阵。当前代码还对超出默认有效范围的调制度使用回退值，这属于实现保护，见[核对说明 A5](#audit-a5)。

**本步产物：**得到每个方向的照明频率向量、全局相位偏移和采用的调制度。现在可以用这些参数执行第 3—5 节的正式重建。

<a id="s7"></a>
## 7. 回到论文主文与 fairSIM 的执行顺序

**原文位置：主文 PDF 第 4 页，Automated reconstruction parameter estimation。** 主文把操作分成输入设置、参数估计、实际重建。Supplementary Note 1 则先解释重建方程，再解释参数来源。

`StepByStep.stepByStepReconstruction` 是一个可读的高层调用示例。它的默认设置是三束、三方向、每方向五相位，共十五帧；本稿为解释公式使用的两束模型对应三方向九帧。两种配置都由 fairSIM 的同一组通用函数处理。[C1](#code-c1)

| 执行阶段 | 输入与输出 | fairSIM 位置 |
|---|---|---|
| 准备 OTF 与参数容器 | 光学参数或测得 OTF、采集配置 → `SimParam` | `OtfProvider.fromEstimate`、`SimParam.create` |
| 读入与预处理 | 原始相机帧 → 扣背景、边界淡出后的帧 | `setFrom16bitPixels`、`subtractBackground`、`fadeBorderCos` |
| FFT | 预处理帧 → 复数频谱 | `fft2d(false)` |
| 参数估计 | 临时分离、相关峰 → 照明参数 | `estimateParameters`，对应第 6 节 |
| 正式分离 | 数据与采用参数 → 分离频带 | `separateBands`，对应第 3 节 |
| 归位与匹配 | 分离频带 → 归位频带与 OTF 匹配分子 | `placeFreq`、`fourierShift`、`applyOtf` |
| 融合、切趾与逆 FFT | 分子 → 最终图像 | `WienerFilter`、`writeApoVector`、`spatial` |

### 7.1 输入端有两个容易混淆的处理

`subtractBackground` 在作者示例中减去固定背景，并把负值截为零。`fadeBorderCos` 则在图像边缘进行余弦淡出，减轻 FFT 周期边界不连续造成的频谱泄漏。[C1](#code-c1)

输入端的边界窗与最后的切趾窗作用域不同：前者乘在空间图像的边缘，后者乘在频谱的位置。它们不能因为都叫“窗”就互相代替。

### 7.2 作者示例的参数与本文解释路径

| 设置 | `StepByStep` 实际示例 | 阅读时注意 |
|---|---|---|
| `nrBands/nrDirs/nrPhases` | 3 / 3 / 5 | 对应最高级次 2、15 帧 |
| OTF | NA=1.4，发射波长 560 nm，曲率修正 0.31 | 不是完全理想圆瞳 OTF |
| `otfBeforeShift` | `true` | 先在未归位频带上乘 OTF，再归位、支撑掩膜 |
| Wiener / 切趾 | 0.05 / 截止倍数 1.9 / 指数 0.8 | 是示例设置，不是任意实验的最优参数 |
| OTF attenuation | 开启，强度 0.995，宽度 1.2 cycles/μm | 与第 4 节先关闭该项的原理推导区分 |
| 输出 | `CLIPSCALE.NONE` | 此示例保留负值，不对输出做截断 |

第 4 节按“归位后乘 OTF”的分支讲解，更便于与 F5 的坐标对应；源码也支持“先乘 OTF，再归位”的分支。实际代码需要一起读取 `otfBeforeShift` 与其掩膜处理，不把一种顺序说成唯一顺序。

`OtfProvider.fromEstimate` 的默认指数型 OTF 修正可以写为：

$$
h_{\mathrm{est}}(\rho)=h_{\mathrm{ideal}}(\rho)\,a_{\mathrm{OTF}}^\rho,
\qquad \rho=\frac{|\mathbf k|}{k_c}.
$$

这里 a_OTF 是 OTF 曲率参数，与照明谐波系数 aₘ 无关。它改变通带内曲线，不改变截止位置。源码中的检测截止为：

$$
k_c=\frac{2\mathrm{NA}}{\lambda_{\mathrm{em}}}.
$$

代码接收波长 nm、输出频率 cycles/μm，所以公式中还会出现 1000 的单位换算。[C12](#code-c12)

### 7.3 读实验图时对应哪一步

主文图 1 展示相关峰拟合与重建频谱，可对应第 6 节的参数估计和第 4 节的归位融合。图 2、3 用荧光微球和强度截线检查横向细节是否分开；第 4 图再观察细胞样品结构。读这些图时，把“峰的位置、相邻峰之间的谷、背景与波纹”同算法处理联系起来，不把画面更锐利单独当作准确性的证明。

主文明确将当时的 fairSIM 描述为单层重建：横向分辨率改善与轴向分辨率改善是不同问题。不能从输出更大的二维图像，推断已经完成完整的三维超分辨重建。

<a id="audit"></a>
## 核对说明：原文简写与固定源码的区别

这部分用于防止抄公式或读代码时产生歧义，初读时可以按正文链接逐条查看。

<a id="audit-a1"></a>
### A1. 相位数条件

SI 第 9 页将充分相位数写为 N≥M，脚注将过定情况写为 N>M。但同页规定最高级次为 M，未知分量从 −M 到 +M，共 2M+1 个。对这里使用的一般逐频点分离矩阵，应满足：

$$
N\ge2M+1,
\qquad\operatorname{rank}(\mathbf M)=2M+1.
$$

前者只是计数条件，后者要求相位提供独立信息。`BandSeparation` 明确检查 `nrPhases >= 2*bands-1`，而 `bands=M+1`，与上述计数一致。这是据矩阵维数与代码补全的条件，不照抄原文的简写。

<a id="audit-a2"></a>
### A2. Cₘ 与 C(k−mp) 不能无条件混写

SI 第 9 页一面把 C 写为样品频谱乘 OTF，一面用平移后的 C 简写各频带。若严格将两处定义直接代入，会把 OTF 一起平移，与其前向成像式 F2 不一致。本文从 F2 明确定义：

$$
C_m(\mathbf k)=h(\mathbf k)\tilde S(\mathbf k-m\mathbf p).
$$

在归位前，OTF 固定在检测坐标；归位时，样品来源与 OTF 再一同换到新坐标。这也解释了为什么解混矩阵只包含照明系数，而后续仍然需要 OTF 匹配。

<a id="audit-a3"></a>
### A3. 互相关的共轭方向与相位

原文 F6 写旁带等于 a′ 乘零级；F7 却对旁带取共轭。因此按 F6 直接代入，F7 除以零级能量应得到 a′ 的共轭，而不是 a′ 本身。二者的模长一致，辐角相反。

当前代码使用旁带乘零级共轭，对应本文第 6.3 节的 α。本文用这套自洽约定解释 `phase()` 与 `hypot()`，并保留原文 F7 的方向供核对。

此外第 m 级的相位因子是 m 倍全局偏移。若单独从高阶的复数比例估计基础相位，还需要考虑阶数与相位周期。当前代码通过一阶 `p1` 取基础相位，再为更高阶生成倍数相位。

<a id="audit-a4"></a>
### A4. Wiener 零级计数与 OTF attenuation

`WienerFilter.addWienerDenominator` 同时累加正负偏移项；`updateCache` 包含 band=0，故零级平方被重复计入。第 4.3 节给出的实际分母遵循这一固定实现。[C7](#code-c7)

若打开 OTF attenuation，记其非负实权重为 t，则共轭匹配实际使用 t·h*，分母使用 t·|h|²。**分母没有简单地把衰减后 OTF 整体再平方。** 对两束模型可写为：

$$
U=\sum_{d,m}t_{d,m}h_{d,m}^*B_{d,m},
$$

$$
D_{\mathrm{code}}
=\sum_d\left[2t_{d,0}|h_{d,0}|^2
+t_{d,+1}|h_{d,+1}|^2+t_{d,-1}|h_{d,-1}|^2\right].
$$

这里的 t 表示各位置实际查询到的 attenuation 值；理想连续表达反映代码的权重次数，查表插值还会带来浮点与插值差异。

单个高斯型衰减项在源码中是：

$$
t(r)=1-s\exp\left[-\frac{r^2}{2(\mathrm{FWHM}/2.355)^2}\right].
$$

这是各频带附近的额外衰减，与最终全局切趾窗分开使用。主文与 SI 第 1 页的 Supplementary Figure 1 讨论其减轻离焦背景伪影的用途。本稿不将它展开成另一个算法专题。[C13](#code-c13)

<a id="audit-a5"></a>
### A5. 估计值与正式重建采用值

当前 `SimParam` 默认把低于 0.4 或高于 1.1 的调制度替换为 0.65。`setModulation` 保存的估计与 `getModulations` 返回的采用值因此可能不同。讲解正式分离时，矩阵使用的是后者。[C14](#code-c14)

### A6. 原文年代与源码版本

论文发表于 2016 年；本稿核对的是项目现有的后续维护提交，`pom.xml` 标注 1.5.1。源文件中的所有当前设置都不能自动归因于 2016 年版本。本文的零级计数、默认调制度回退、可选切趾形状等结论，仅针对列明提交；没有声称它们在论文发表时已经完全相同。

<a id="code-index"></a>
## fairSIM 源码定位

下列链接均指本地 fairSIM。正文 C1—C14 只是引用标签。

<a id="code-c1"></a>

- **C1：作者高层示例。** [StepByStep.java，第 55 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/fiji/StepByStep.java:55)：OTF、配置、预处理、FFT、参数估计、重建与示例滤波参数。

<a id="code-c2"></a>

- **C2：混合矩阵与求逆。** [BandSeparation.java，第 55 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/BandSeparation.java:55)：帧数检查；第 80 行起系数处理；第 94 行起逐行填矩阵；第 114 行起求逆。

<a id="code-c3"></a>

- **C3：分离输出。** [BandSeparation.java，第 167 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/BandSeparation.java:167)：生成高阶相位、构造逆矩阵、按逆矩阵行累加输入帧。

<a id="code-c4"></a>

- **C4：正式分离、归位与累加。** [SimAlgorithm.java，第 601 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java:601)：相位与调制度输入；频谱填充；正负位移；OTF 匹配；分子累加。

<a id="code-c5"></a>

- **C5：频谱搬移。** [SimUtils.java，第 48 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimUtils.java:48)：IFFT、空间相位乘法、FFT。

<a id="code-c6"></a>

- **C6：共轭 OTF。** [OtfProvider.java，第 486 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/OtfProvider.java:486)：频率坐标、OTF 查询与第 519 行的 `val.conj()`。

<a id="code-c7"></a>

- **C7：Wiener 分母。** [WienerFilter.java，第 49 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/WienerFilter.java:49)：正负项与零级计数、attenuation 权重；第 120 行起返回正则化分母倒数。

<a id="code-c8"></a>

- **C8：切趾形状。** [OtfProvider.java，第 628 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/OtfProvider.java:628)：窗值计算；第 659 行起圆对称半径。理想 OTF 形状函数在同文件第 134 行。

<a id="code-c9"></a>

- **C9：最终频域处理。** [SimAlgorithm.java，第 749 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java:749)：Wiener、切趾与逆 FFT。

<a id="code-c10"></a>

- **C10：参数估计总流程。** [SimAlgorithm.java，第 156 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java:156)：临时分离、粗相关、精调与参数写回。两束写回位于第 287 行起。

<a id="code-c11"></a>

- **C11：相关与公共区域。** [Correlation.java，第 46 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java:46)：`fitPeak`；第 194 行起 `getPeak`；第 242 行起 `commonRegion`。

<a id="code-c12"></a>

- **C12：OTF 估计。** [OtfProvider.java，第 147 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/OtfProvider.java:147)：估计器、截止和曲率修正。

<a id="code-c13"></a>

- **C13：OTF attenuation。** [OtfProvider.java，第 303 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/OtfProvider.java:303)：高斯型衰减；第 413 行将衰减权重乘入 OTF。

<a id="code-c14"></a>

- **C14：相位与调制度采用值。** [SimParam.java，第 429 行起](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/SimParam.java:429)：相位偏移相加；第 539 行起调制度回退；默认范围在第 81 行。

## 资料来源与校验范围

原文：Müller, M., Mönkemöller, V., Hennig, S., Hübner, W. & Huser, T. *Open-source image reconstruction of super-resolution structured illumination microscopy data in ImageJ*. Nature Communications 7, 10980 (2016). [DOI](https://doi.org/10.1038/ncomms10980)。论文及补充材料采用 CC BY 4.0；代码按 fairSIM 的 GPL 许可使用。

本地副本来源、文件 SHA-256 与数值核对记录见[资料核对记录](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM_资料核对记录.md)。本次核对主文的算法相关段落、SI 第 9—11 页、相关图注与源代码；另保存两份 PDF 的完整文字提取供定位。遵照项目约定，没有启动浏览器或进行截图、视觉验收。文中的公式和小数例子进行独立代数/数值校验，未把此文档工作表述为重新完成整套 Java 图像重建实验。


