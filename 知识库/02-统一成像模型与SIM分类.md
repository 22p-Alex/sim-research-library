# 统一成像模型与 SIM 分类

[知识库目录](../SIM知识库.md) · [项目总览](../SIM项目总览.md) · [文献目录](../SIM文献目录.md)

> 阅读目标：统一空间域、傅里叶域和相移矩阵的符号，区分 2D、3D、多平面及非线性 SIM。
> 依据：S1（SIM 综述）、S2（代码配置）；H（统一符号与线性代数解释）。详见[来源编号与证据约定](08-术语与参考来源.md)。
> 整理：2026-09-26；文中实验数字保留原有文献条件，工程建议不视为已验证结论。

## 本页目录

- [1. 统一成像模型](#s1)
  - [1.1. 空间域模型](#s1-1)
  - [1.2. 傅里叶域的频谱搬移](#s1-2)
  - [1.3. 2D-SIM 的相移矩阵](#s1-3)
- [2. SIM 家族与任务边界](#s2)
  - [2.1. OS-SIM 与 SR-SIM](#s2-1)
  - [2.2. 2D-SIM、3D-SIM、3D-MP-SIM](#s2-2)
  - [2.3. 线性与非线性 SIM](#s2-3)

<a id="s1"></a>

## 1. 统一成像模型

<a id="s1-1"></a>

### 1.1. 空间域模型

设样品荧光分布为 $s(\mathbf r)$，照明强度为 $I_{\theta,\phi}(\mathbf r)$，系统点扩散函数为 $h(\mathbf r)$，则单幅观测为

$$
 d_{\theta,\phi}(\mathbf r)
 = \big[s(\mathbf r) I_{\theta,\phi}(\mathbf r)\big]*h(\mathbf r)+n(\mathbf r),
$$

其中 $*$ 表示卷积，$n$ 表示噪声和未建模误差。

对线性正弦结构光，常用照明模型为

$$
 I_{\theta,\phi}(\mathbf r)
 = I_0\left[1+m\cos\left(2\pi\mathbf k_\theta\cdot\mathbf r+\phi\right)\right],
$$

其中：

- $I_0$：平均照明强度；
- $m\in[0,1]$：调制深度；
- $\mathbf k_\theta$：照明空间频率向量；
- $\theta$：条纹方向；
- $\phi$：相位。

令 $m=1$ 仅用于理想推导时，实际系统通常需要估计 $m$。

<a id="s1-2"></a>

### 1.2. 傅里叶域的频谱搬移

利用乘积-卷积对偶关系，照明中的余弦项会产生两个频移副本：

本知识库统一采用前向傅里叶变换 $S(\mathbf k)=\int s(\mathbf r)e^{-i2\pi\mathbf k\cdot\mathbf r}\,d\mathbf r$，并令 $I_0$ 为平均照明强度。以下符号与[频移项的推导](01-SIM基础与频谱直觉.md#s5)及交互演示的 FFT 一致。

$$
 D_{\theta,\phi}(\mathbf k)
 = I_0\left[
 S(\mathbf k)H(\mathbf k)
 + \frac{m}{2}e^{i\phi}S(\mathbf k-\mathbf k_\theta)H(\mathbf k)
 + \frac{m}{2}e^{-i\phi}S(\mathbf k+\mathbf k_\theta)H(\mathbf k)
 \right]+N(\mathbf k).
$$

这三个未知量是：

$$
 S(\mathbf k)H(\mathbf k),\quad
 S(\mathbf k-\mathbf k_\theta)H(\mathbf k),\quad
 S(\mathbf k+\mathbf k_\theta)H(\mathbf k).
$$

当采集至少 3 个相位时，可以在每个频率位置建立线性方程并解混。解混后，$\pm1$ 级频谱被平移回实际样品频率位置，多个方向的频带在频域拼接，最后再进行 OTF 加权和逆傅里叶变换。

<a id="s1-3"></a>

### 1.3. 2D-SIM 的相移矩阵

对一个方向的三相位采集，令相位为 $\phi_1,\phi_2,\phi_3$，则

$$
 \begin{bmatrix}
 D_{\phi_1}\\D_{\phi_2}\\D_{\phi_3}
 \end{bmatrix}
 = I_0
 \underbrace{\begin{bmatrix}
 1 & me^{i\phi_1}/2 & me^{-i\phi_1}/2\\
 1 & me^{i\phi_2}/2 & me^{-i\phi_2}/2\\
 1 & me^{i\phi_3}/2 & me^{-i\phi_3}/2
 \end{bmatrix}}_{M}
 \begin{bmatrix}
 S(\mathbf k)H(\mathbf k)\\
 S(\mathbf k-\mathbf k_\theta)H(\mathbf k)\\
 S(\mathbf k+\mathbf k_\theta)H(\mathbf k)
 \end{bmatrix}.
$$

理想等间隔三相位时，$M$ 条件较好；相位误差会造成频带泄漏，表现为条纹、重影和方向性伪影。

这里要求 $m>0$ 且相位矩阵满秩；重复相位（包括相差 $2\pi$）不提供独立方程。三个相位整体平移且重建采用同一组已知相位，不会破坏可逆性。S1 原文式 (1) 采用 $I=I_0[1+\cos(\cdots)]/2$，因此其式 (7) 外有 $I_0/2$；本节已按平均强度定义统一，不直接沿用该系数。

---

<a id="s2"></a>

## 2. SIM 家族与任务边界

<a id="s2-1"></a>

### 2.1. OS-SIM 与 SR-SIM

| 类型 | 主要目标 | 典型输入 | 是否以横向超分辨为主 |
|---|---|---|---|
| OS-SIM | 去除离焦、提高光学切片能力 | 粗周期/散斑/网格照明 | 否，主要增加轴向选择性 |
| SR-SIM | 扩展可观测频谱、获得超分辨 | 接近衍射截止频率的周期照明 | 是 |

OS-SIM 常见 RMS、HiLo、单帧光学切片等方法；SR-SIM 常见 2D-SIM、3D-SIM、非线性 SIM 和 blind-SIM。

<a id="s2-2"></a>

### 2.2. 2D-SIM、3D-SIM、3D-MP-SIM

- **2D-SIM**：横向条纹，通常 3 个方向 × 3 个相位 = 9 幅原始图，主要扩展 $x,y$ 频谱。
- **3D-SIM**：三束相干光形成横向和轴向调制，常用 3 个方向 × 5 个相位，并采集 $z$ 堆栈，同时改善横向和轴向分辨率。
- **3D-MP-SIM**：多平面/多时间点联合编码。当前代码以两个 15 帧数据栈（`sequence=55`）得到 7 个频带级次，进一步分离一阶轴向分量。

当前项目配置摘录自 [S2 运行配置](../3D-MP-SIM/MP-main/core/run1_488.py)：

| 参数 | 当前值 | 物理/算法含义 |
|---|---:|---|
| `flag_N` | `"MP"` | 多平面模式 |
| `Nangles` | 3 | 条纹方向数 |
| `Nshifts` | 5 | 每方向相移数 |
| `Norders` | 7 | 0、$\pm2$、轴向一阶相关级次 |
| `sequence` | 55 | 两组 15 帧序列 |
| `dx` | 60 nm | 横向采样像素尺寸 |
| `dz` | 193.8 nm | 轴向采样间隔 |
| `W` | $10^{-4}$ | Wiener 正则参数初值 |

注意：代码中的 `Norders=7` 不是“7 幅原始图”，而是频带分离后的 7 类级次；原始帧数由 `Nangles × Nshifts` 和多栈序列决定。

<a id="s2-3"></a>

### 2.3. 线性与非线性 SIM

线性 SIM 的照明频率受光学 NA 限制，理想扩展约 2 倍。非线性 SIM 通过饱和、光开关、STED 或其他非线性响应产生高次谐波：

$$
 F(I)=\sum_{q=-Q}^{Q} c_q e^{iq\mathbf k\cdot\mathbf r}.
$$

$Q$ 增大可扩展理论频谱，但高阶谐波的信号通常更弱，对光漂白、光毒性和 SNR 更敏感。

---

上一专题：[SIM 基础与频谱直觉](01-SIM基础与频谱直觉.md) · [返回知识库目录](../SIM知识库.md) · 下一专题：[传统重建与参数估计](03-传统重建与参数估计.md)
