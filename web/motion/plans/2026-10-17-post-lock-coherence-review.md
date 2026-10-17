# 从位置锁定到重建结束：分镜连贯性审查

审查日期：2026-10-17。项目版本：6df8b1f。范围：完整 33 幕目录，重点是用户标注的第 19 幕入口，直到第 33 幕。依据现行分镜、生产 HTML 的“原理与数值”、实际数值路径，以及本地 fairSIM 固定提交 711afd12cb8c4fd4207bbca7ee7610c5aed4f732。历史计划只用于理解背景，不作为本次修改授权。

**结论：计算链条连贯，理论区基本完整；单独顺着主动画学习，仍有几处解释跳跃。** 最需要补的是第 19 幕的复比例因果链和第 28→29 幕从基础分母转到固定源码分母的区别。没有发现需要推翻现有计算核心的证据。本次仅新增这份审查记录，未修改动画、数据生成器或算法。

**逐幕检查**

| 幕 | 教学单元 | 判断及建议 |
|---|---|---|
| 19 | 共同幅相估计 | 七拍计算顺序符合最终 getPeak；入口仍承诺保持频谱位置比较公共点，与随后切换工作副本和空域计算的叙述不一致。需补“比例关系为何导出乘积和/能量和”。 |
| 20 | 填回参数 | 衔接正确：共同偏移加回已知相对相移，相位和调制度进入矩阵，波矢进入归位。可明确工作副本仅估计参数，正式重建重新使用完整观测。 |
| 21 | 逐点解混 | 同一批三帧、同一组采用参数，逐频点复数乘加；仍含 OTF、尚未归位，定义一致。 |
| 22 | 搬回原处 | 移频符号与后续代码一致；计算实际先扩展频谱数组，主分镜没有介绍这一动作。 |
| 23 | 找回高频 | “位置归位但 OTF 衰减仍在”正确，能自然引出融合。 |
| 24 | 三个方向 | 是对已分别估计的三个方向进行汇合回看；不是新一轮曝光或用一个方向的参数替代另外两组。 |
| 25 | 一个方向 | 归位 OTF 支撑的定义正确，已区分几何范围和稳定恢复质量。 |
| 26 | 多方向覆盖 | 同一个样品频率经不同检测地址获得不同 H 的解释成立。无噪声恒等式应继续限定为参数准确的理想模型。 |
| 27 | OTF 加权 | 乘 H* 后得到模平方正确；“为什么选择这个乘数”主要留在理论区，主线可补一条正规方程。 |
| 28 | 九项相加 | 累计结果正确，但 U 又被用作累计频谱，与前面的逆矩阵及校正频谱重名。建议明确基础传递系数 R₀。 |
| 29 | Wiener 滤波 | 与固定 Java 源码一致；实际 R 与前一步 R₀ 不同，不能只作为约掉上一系数来讲。 |
| 30 | 乘切趾窗 | 运算正确；补一句减少截断振铃与牺牲边缘幅度的取舍，会比仅陈述压低边缘更完整。 |
| 31 | 逆 FFT | 256² 输出及因子 4 一致；“此时才回到空域”应改为“此时得到最终样品图像”，前面已经使用过空域计算场。 |
| 32 | 图像对照 | RMSE、同尺度比较及真值隔离正确；本例 RMSE 更大已在理论区解释，建议把关键原因带入本幕。 |
| 33 | 核对高频 | 恢复量与相位误差来自真实数组；已正确限定单频点不能代表完整分辨率评价。 |

目录与现行入口：[SCENES.md](/Users/22p/Documents/ChatGPT/毕业设计/web/motion/SCENES.md)、[生产 HTML](/Users/22p/Documents/ChatGPT/毕业设计/sim_motion_demo.html)。

**1．第 19 幕：从频谱对应关系走到 getPeak，缺少一次明确的交接**

入口文案说“保持这些位置，比较公共点的相位与长度”，而 finalPrepare 随后收起概览，从原始临时频带建立两份处于各自检测坐标的副本，再逆 FFT。这些运算正确，但学习者可能以为要继续在原来的 P/Q/R 上读相位，或者误以为旁带被归位了两次。

建议入口改成：

> 波矢已经锁定，两路记录的对应地址已经确定。接下来从原始临时频带准备最终工作副本，用已知位移计算它们的共同幅相。

这里锁定的是位移参数和对应关系，不是承诺后续画面坐标、数组及筛选点集都不改变。主线第一个方向的位置搜索公共区有 63 点，最终幅相工作频带各保留 67 点；随后求和是全部 128² 个空域位置。三种计数应保持区别。

定位：[入口文案](/Users/22p/Documents/ChatGPT/毕业设计/web/parameter-demo/scenes/get-peak/storyboard.js:132)、[工作副本](/Users/22p/Documents/ChatGPT/毕业设计/web/parameter-demo/scenes/get-peak/storyboard.js:10)、[实际筛选与计算](/Users/22p/Documents/ChatGPT/毕业设计/web/shared/sim-parameter-estimation.js:173)。

**2．第 19 幕：补的是除法的原因，不是重新加入试探旋转**

现行七拍解释了怎样计算每一个量，但需要再次把第 11—15 幕的物理比例带回来。对于正确波矢、匹配 OTF、准确相对相移及无噪声模型：

$$
\widetilde A_0(\mathbf f)=H(\mathbf f)S(\mathbf f),\qquad
\widetilde A_{+1}(\mathbf f)=m e^{i\phi_\Delta}H(\mathbf f)S(\mathbf f-\mathbf k).
$$

最终工作频带分别完成自身 OTF 校正；在对齐后相匹配的掩膜上，令共同复比例为：

$$
\alpha=m e^{i\phi_\Delta},\qquad
B_1(\mathbf q+\mathbf k)=\alpha B_0(\mathbf q).
$$

频移对应空域相位斜坡，逆变换具有线性性，因此：

$$
v_{\mathbf k}(\mathbf r)
=v(\mathbf r)e^{-2\pi i\mathbf k\cdot\mathbf r/N}
=\alpha u(\mathbf r).
$$

接着只需一条短推导，就能解释后面的全部运算：

$$
u^*v_{\mathbf k}=\alpha |u|^2
\quad\Longrightarrow\quad
C=\alpha E_0
\quad\Longrightarrow\quad
\alpha=\frac{C}{E_0},\qquad E_0>0.
$$

这样乘共轭、积累参考能量和最后相除都有原因；模长及相角的读出也自然接上：

$$
\widehat m=|\widehat\alpha|,\qquad
\widehat\phi_\Delta=\arg\widehat\alpha.
$$

临时旁带权重已经含有 2/3，因此不再乘 2。实际误差存在时，精确比例应改写为近似关系；这个比值仍是对给定两份计算场求单个复数比例的最小二乘解：

$$
\widehat\alpha
=\operatorname*{arg\,min}_{a\in\mathbb C}
\sum_{\mathbf r}|v_{\widehat{\mathbf k}}(\mathbf r)-a u(\mathbf r)|^2
=\frac{\sum_{\mathbf r}u^*(\mathbf r)v_{\widehat{\mathbf k}}(\mathbf r)}
{\sum_{\mathbf r}|u(\mathbf r)|^2}.
$$

最后这段最小二乘配平方已经在理论展开区，无须恢复旧的试探旋转或残差优化动画。建议主线在 finalShift → finalProduct 之间提示比例模型，在 finalDivide 补 C=αE₀；完整最小二乘继续留在理论区。上述精确频带关系要求正确对齐、相匹配掩膜；不能把固定源码对非整数位移的掩膜近似解释成任意数据下的恒等式。

依据：[前面的比例模型与现有解释](/Users/22p/Documents/ChatGPT/毕业设计/sim_motion_demo.html:368)、[已有最小二乘补充](/Users/22p/Documents/ChatGPT/毕业设计/sim_motion_demo.html:438)、[fairSIM getPeak](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java:194)、[2016 补充材料的参数估计部分](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016-SI-原文提取.txt:580)。这里的推导使用本页符号和共轭约定。

**3．主线相位为零，削弱了幅相估计的教学效果**

当前主线使用整数波矢、无噪声、准确 OTF，三个方向的共同相位偏移都是 0。复算得到：

| 方向 | 估计波矢 | 估计调制度 | 共同相位 / rad |
|---|---|---|---|
| 1 | (8, 0) | 0.800000 | 约 0 |
| 2 | (4, 7) | 0.800000 | 约 0 |
| 3 | (−4, 7) | 0.800000 | 约 0 |

因此第 19 幕最后的复系数几乎落在正实轴，第 20 幕的共同相位回填几乎不改变原来的相对相移。这不是错误，生产 HTML 也明确选择了如实显示 0；只是初学者不容易看见“估计共同相位”的实际作用。

可选改进是采用非零共同偏移重新生成完整采集数据，并同步更新前面的曝光标签、编码权重与所有依赖相位的说明。不能只旋转结果箭头或改参数卡片。本次额外用独立数值生成器验证了 0.35、0.55、−0.40 rad 的案例，估计能分别返回这些偏移；该实验没有替换主线数据，也不代表现有全部前端状态已经支持直接换数据。

定位：[生产数据入口](/Users/22p/Documents/ChatGPT/毕业设计/web/motion/sim-motion.js:575)、[采集生成器](/Users/22p/Documents/ChatGPT/毕业设计/web/atlas/sim-atlas-core.js:105)、[参数实验生成器](/Users/22p/Documents/ChatGPT/毕业设计/web/shared/sim-parameter-estimation.js:34)。

**4．第 20—26 幕：数据回填与归位成立，需交代计算副本和扩展网格**

正式重建接收的是估计后的逐方向相位、调制度及波矢，并重新使用原来的完整三帧进行分离。第 19 幕为了可靠估计而筛选、除 H 的工作副本，没有流入正式融合。因此后面重新看到带 H 的完整频带是正确的。

$$
U=M^{-1},\qquad
A_\ell(\mathbf f)=\sum_j u_{\ell,j}D_j(\mathbf f),
\qquad
C_\ell(\mathbf q)=A_\ell(\mathbf q+\ell\mathbf k).
$$

建议第 20 幕加一句“工作副本只提供参数；现在回到完整观测正式解混”。此外，代码在归位前把 128² 的频谱嵌入 256² 的数组，第 22 幕应简短介绍，而不是到第 31 幕才突然出现 256 和因子 4。

按本页二维逆 DFT 归一化，输出同一视野、每轴加倍采样，固定强度换算因子为：

$$
\frac{(2N)^2}{N^2}=4.
$$

频谱嵌入保持原有 DFT 格间隔；新增高频信息来自被照明搬入检测通带的观测，零填充本身不会提供这些信息。第 31 幕“此时才从频率坐标回到空间位置”宜改为“此时把融合后的频谱变成最终样品图像”，与第 19 幕空域复数计算场区分。

定位：[完整观测回填](/Users/22p/Documents/ChatGPT/毕业设计/web/shared/sim-parameter-estimation.js:310)、[频谱嵌入](/Users/22p/Documents/ChatGPT/毕业设计/web/atlas/sim-atlas-core.js:55)、[归位前调用](/Users/22p/Documents/ChatGPT/毕业设计/web/atlas/sim-atlas-core.js:214)、[逆 FFT 分镜](/Users/22p/Documents/ChatGPT/毕业设计/web/motion/scenes/inverse-fft/storyboard.js:7)。

**5．第 27—29 幕：应把基础推导与固定 fairSIM 分母接清楚**

第 27 幕的“已有 H，再乘 H*”成立。但“为什么选 H*”的完整解释主要在理论区：固定一个频率，把各频带视为对同一个复数样品系数的观测，采用二次正则化的等权最小二乘：

$$
J(z)=\sum_b|C_b-H_bz|^2+w^2|z|^2,
\qquad
\left(\sum_b|H_b|^2+w^2\right)\widehat S
=\sum_bH_b^*C_b.
$$

该式解释共轭和模平方如何一起出现；不能据此无条件宣称解混后的各带噪声独立、等方差或当前权重统计最优。页面理论区已经注明这些限制。

第 28 幕对理想数据得到：

$$
U_{\rm sum}=\sum_{d,\ell}H_{d,\ell}^*C_{d,\ell}=R_0S,
\qquad
R_0=\sum_{d,\ell}|H_{d,\ell}|^2.
$$

这里 U_sum 是本报告为避免混淆给累计频谱加的下标，当前页面仍写 U。随后固定 Java 源码实际使用：

$$
R=R_0+\sum_d|H_{d,0}|^2.
$$

每方向零级在分子计一次，在分母计两次。因此本页实际结果为：

$$
\widehat S_{\mathrm W}
=\frac{U_{\rm sum}}{R+w^2}
=\frac{R_0}{R+w^2}S,
\qquad
\widehat S
=P_{\mathrm{apo}}\frac{R_0}{R+w^2}S.
$$

所以第 29 幕不能只表现为“约掉第 28 幕留下的同一个系数”。现行 note 已提醒额外计数，理论区也已写出 R₀ 与 R 的区别；建议将这两行关系提升为本幕可定位的连续两拍。不要未经依据把分母中的 2 删除，也不要把源码中的额外项包装成前面等权最小二乘自然推出的结果。

这还是一个记号问题：同一条主线的 U 先表示逆矩阵，后表示 OTF 校正参考频谱，再表示融合累计量。至少将累计频谱改成明确的新记号，例如 F_sum；已有 u、B、C 的不同用途也应通过下标或上下文说明，避免误读为同一对象。

定位：[第 28 幕](/Users/22p/Documents/ChatGPT/毕业设计/web/motion/scenes/sum-contributions/storyboard.js:7)、[第 29 幕](/Users/22p/Documents/ChatGPT/毕业设计/web/motion/scenes/wiener/storyboard.js:7)、[已存在的正规方程推导](/Users/22p/Documents/ChatGPT/毕业设计/sim_motion_demo.html:524)、[已存在的 R₀/R 区别](/Users/22p/Documents/ChatGPT/毕业设计/sim_motion_demo.html:539)、[Java 分母累加](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/WienerFilter.java:49)。

**6．第 30—33 幕：结论正确，可用实测传递率把前后接起来**

当前数组复算结果：

| 核对量 | 数值 |
|---|---|
| 宽场全图 RMSE | 0.2059196762 |
| SIM 全图 RMSE | 0.2642519403 |
| 直流的最终幅度传递率 | 0.5048372613 |
| 高频 (14, 0) 的宽场传递 | 0 |
| 高频 (14, 0) 的切趾前幅度传递率 | 0.9700909338 |
| 高频 (14, 0) 的切趾窗值 | 0.2256213016 |
| 高频 (14, 0) 的最终幅度保留率 | 0.2188731792 |

最后三项直接满足：

$$
0.9700909338\times0.2256213016\approx0.2188731792.
$$

这能把第 29、30、33 幕连成同一个实际频率的故事：Wiener 后保留约 97.01%，切趾后保留约 21.89%。低频幅度同时受到抑制，所以不能从恢复非零高频推出全图 RMSE 必然更小。现有“原理与数值”已经说明，本轮建议是让主分镜及时显示这个原因，而不是再建立一套相同理论。

切趾用于让有限频谱支持的边缘平缓，减少相应的振铃；其代价包括高频幅度与锐度的损失，参数不是普适常数。本页给定的 1.9、0.8 应继续作为这一固定模拟的设置。

依据：[现有 RMSE 解释与有效传递函数](/Users/22p/Documents/ChatGPT/毕业设计/sim_motion_demo.html:548)、[实际传递数组](/Users/22p/Documents/ChatGPT/毕业设计/web/atlas/sim-atlas-core.js:237)、[最终评价计算](/Users/22p/Documents/ChatGPT/毕业设计/web/motion/sim-motion-model.js:96)、[fairSIM 补充材料的 Wiener/切趾说明](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016-SI-原文提取.txt:559)。

**节奏与边界**

第 19 幕为 80 秒、7 拍，第 20 幕 28 秒，第 21 幕 9.5 秒；第 22—33 幕的动作时长合计 27.55 秒。其中第 28 幕在 2.3 秒内处理九条贡献，平均每条约 0.26 秒。播放器每幕结束会停住，因此这不是连续 27.55 秒自动播完十二幕的结论；不过停在最终画面也不能重现每条贡献的推导过程。建议优先将第 27—29 幕拆成可定位的内部拍，保留第一次复数乘加的慢过程，其余同类项再合并演示。

前面的波矢搜索仍是教学评分和三轮 5×5，最终 getPeak 才按固定源码路径计算；不能称为整个 fairSIM 参数估计器的完整移植。相对相移准确的假设必须保留，共同偏移不能修正任意逐帧相位误差。

**本次验证**

- npm run check：221 项通过，0 失败，0 跳过。包含分镜注册、公式编译、实际数组、状态衔接和回退检查；最终 commonRegion/getPeak 与本地未修改 Java 源码的对照也实际执行。
- 单独运行 tests/sim-atlas-fairsim.test.cjs：6 项通过，0 失败，0 跳过。覆盖无噪声、低光子、单方向、非整数移频及参数失配、调制度回退、另一组切趾设置。原生输出的最大逐像素 Java/JS 误差约 4.08×10⁻⁸。
- 复算主线三组最终计算场，比例残差相对于目标场能量开方后约为 8.31×10⁻¹⁵、1.18×10⁻¹⁴、1.39×10⁻¹⁴，与当前理想整数模型相符。
- 独立非零共同相位案例返回约 0.35、0.55、−0.40 rad；只是数值核对，未更换页面。
- 未启动浏览器、未截图、未做字体或布局验收；本报告不对真实画面流畅性作已通过的判断。

优先顺序建议：先补第 19 幕入口及比例原因，再补第 28→29 幕分母差别；随后处理主线相位案例、频谱扩展与符号重名。现有 33 幕总体顺序可以保留。
