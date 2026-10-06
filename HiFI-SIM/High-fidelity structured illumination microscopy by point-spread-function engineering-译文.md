# 基于点扩散函数工程的高保真结构光照明显微镜

> 工作译文，供 SIM 课题学习和检索使用。译文依据 Wen et al. 的开放获取论文整理，公式和实验数值尽量按原文保留；正式引用请以英文原文为准。

## 论文信息

- 英文题目：*High-fidelity structured illumination microscopy by point-spread-function engineering*
- 作者：Gang Wen, Simin Li, Linbo Wang, Xiaohu Chen, Zhenglong Sun, Yong Liang, Xin Jin, Yifan Xing, Yaming Jiu, Yuguo Tang, Hui Li
- 期刊：*Light: Science & Applications*，2021，10:70
- DOI：`10.1038/s41377-021-00513-w`
- 本地原文：`HiFI-SIM/High-fidelity structured illumination microscopy by point-spread-function engineering.pdf`

## 摘要

结构光照明显微镜（SIM）由于具有快速、适合长期成像和超分辨（SR）等特点，已经成为研究生物医学问题的重要工具。然而，SIM 图像中经常出现的伪影长期以来一直影响人们对其保真度的判断，并可能导致对生物结构的误读。

本文提出了一种通过设计有效点扩散函数（PSF）来实现高保真 SIM 重建的算法，称为 HiFi-SIM。HiFi-SIM 能够在不损失细微结构的情况下有效减少常见伪影，并改善具有强背景样品的轴向光学切片能力。尤其是，HiFi-SIM 对常用 PSF 和重建参数不敏感，因此降低了对专用 PSF 标定和复杂参数调节的要求，有助于推动 SIM 成为日常成像工具。

## 引言

超分辨结构光照明显微镜（SR-SIM）突破了光学衍射限制，为观察约 100 nm 尺度的生物结构提供了机会。与其他超分辨技术相比，SR-SIM 的空间分辨率提升相对适中，但由于光子效率高、光损伤和光漂白较小，并且兼容大多数荧光标记协议，它仍然是研究活细胞亚细胞结构动态的重要工具。

例如，Hessian-SIM 曾以 88 nm 的时空分辨率和 188 Hz 的速度成像内质网中的运动囊泡；GI-SIM 曾以 97 nm 分辨率和 266 Hz 的帧率观察基底细胞皮质附近的内质网网络，并持续数千个时间点；GPU 加速技术也实现了视频速率的多色即时 SR-SIM，采集与重建显示之间的延迟小于 250 ms。

尽管硬件和算法不断进步，SR-SIM 的保真度和定量能力仍然受到挑战。这是因为最终 SR 图像高度依赖后处理算法，而后处理容易产生重建伪影。为了得到伪影较少的 SIM 图像，研究者已经提出了仪器改进、数据采集和样品制备方面的实践指南，也提出了照明参数精确估计、迭代反卷积和重建参数优化等方法。

然而，限制 SIM 日常应用的伪影仍然经常出现。尤其是利用 SR-SIM 发现的新结构，需要谨慎解释，以避免把重建伪影误认为真实生物结构。近年来，深度学习显示出用于 SR-SIM 重建的潜力，但其结果往往依赖其他方法得到的 SR 图像作为训练目标，因此保真度仍然存在疑问。

在本研究中，作者提出了一种基于 PSF 工程的新型 SIM 算法，即高保真 SIM（HiFi-SIM）。该算法旨在从不同质量的原始数据中重建伪影最少、光学切片性能良好的 SR 图像。

## 结果

### HiFi-SIM 原理

目前，大多数商用 SIM 系统以及 SIMToolbox、fairSIM 和 OpenSIM 等成功的开源软件包，都基于 Heintzmann 和 Gustafsson 建立的 Wiener 反卷积流程。下文将这种方法称为 Wiener-SIM。TV-SIM 和 Hessian-SIM 等迭代反卷积算法，也通常以 Wiener-SIM 的结果为基础。

Wiener-SIM 在傅里叶域中重组不同的频谱分量。这一过程不可避免地会产生形状不平滑的等效光学传递函数（OTF）。对该 OTF 做逆傅里叶变换后，OTF 中向下的折点会转化为 PSF 中的旁瓣。OTF 的异常特征可以通过 Wiener 反卷积修正，但这要求所使用的 OTF、估计的重建参数和真实成像条件准确匹配；否则，最终 SR 图像中经常会出现旁瓣等重建伪影。

此外，残余背景信号通常集中在理论 OTF 的凸起峰值处，产生周期性蜂窝伪影，并限制光学切片能力。通常可以通过 OTF 衰减来缓解这一问题，但这种做法很难同时兼顾背景抑制和细微弱结构保护。

理想的 SR-SIM OTF 应该与宽场 OTF 具有相似的形状，但拥有更高的截止频率。令理论 OTF 为 $\widetilde H_{\mathrm{theoretical}}(\mathbf k)$，理想 OTF 为 $\widetilde H_{\mathrm{ideal}}(\mathbf k)$，则目标是设计一个优化函数 $\widetilde W(\mathbf k)$，使：

$$
\widetilde H_{\mathrm{theoretical}}(\mathbf k)\widetilde W(\mathbf k)
\approx
\widetilde H_{\mathrm{ideal}}(\mathbf k).
$$

在论文的表达中，$k_c$ 表示宽场成像的截止频率，$k_{ex}$ 表示激发结构光的空间频率。理想 OTF 可近似写为：

$$
\widetilde H_{\mathrm{ideal}}(\mathbf k)
\approx
\widetilde H_{\mathrm{det}}\left(
\frac{k_c}{k_c+k_{ex}}\mathbf k
\right),
$$

其中 $\widetilde H_{\mathrm{det}}$ 是宽场检测 OTF。该式表达的思想是：把检测 OTF 的形状平滑地延伸到约 $k_c+k_{ex}$ 的频率范围，而不是保留频带拼接产生的异常峰和折点。

基于这一思想，作者通过 PSF 工程把 SR-SIM 的等效 PSF 设计成理想形式，形成 HiFi-SIM 算法。

### HiFi-SIM 的三个主要步骤

HiFi-SIM 的流程包括以下三个主要阶段。

1. **预处理**：使用理论 OTF 对原始数据进行去卷积。
2. **重建参数估计**：采用改进的归一化互相关方法估计结构光图案的波矢。在归一化互相关计算中加入陷波滤波器，可以抑制低频信号和样品本身的局部周期结构，使代表照明波矢的峰值更加突出。因此，面对多数原始数据时，不再需要预设掩膜或人工修正；这一点对低 SNR 数据和 TIRF-SIM 数据尤其重要。
3. **频谱组合与优化**：首先分离、平移并组合 0 级和 $\pm1$ 级频谱，得到直接组合频谱；随后执行两步频谱优化。

### 两步频谱优化

第一步是构造初始优化函数 $\widetilde W_1(\mathbf k)$，将理论等效 OTF 修正为接近理想 OTF 的形式。论文使用权重函数 $\widetilde g_1(\mathbf k)$，把原本凸起的峰调制成向下的峰，从而去除残余背景信号。经过第一步优化后，直接组合频谱中的异常特征得到校正，典型伪影和残余背景可以有效减弱。

第二步是基于理论 OTF 构造去卷积函数 $\widetilde W_2(\mathbf k)$，用于恢复在第一步优化中被压低的高频信号。第一步中的 $\widetilde g_1$ 虽然可以抑制伪影，但可能使部分细微弱信号损失；因此第二个权重函数 $\widetilde g_2(\mathbf k)$ 被用于主动补偿这些频谱区域。

抽象地写，两步优化可表示为：

$$
\widetilde S_1(\mathbf k)
=\widetilde W_1(\mathbf k)
\widetilde S_{\mathrm{direct}}(\mathbf k),
$$

$$
\widetilde S_{\mathrm{HiFi}}(\mathbf k)
=\widetilde W_2(\mathbf k)\widetilde S_1(\mathbf k).
$$

经过两步优化后，等效 OTF 在各个方向上具有更平滑的轴向分布，沿圆周方向更加均匀，并且中心位置向下塌陷。因此，重建得到的 SR 图像可以在有效抑制伪影的同时，更完整地保留细微结构。

这种两步优化还减弱了 Wiener-SIM 长期存在的 OTF 不匹配问题。作者因此将理论 OTF 作为 HiFi-SIM 的默认 OTF，而不要求用户必须获得精确标定的实验 OTF。

## 标准样品上的保真度验证

作者使用三类代表性结构定量评价 HiFi-SIM 的保真度：荧光微球、线结构和环结构。

### 100 nm 荧光微球

作者使用自建激光干涉 SIM 系统采集 100 nm 荧光微球，并分别用自实现的传统 Wiener-SIM、fairSIM 和 HiFi-SIM 进行重建。

使用理论 OTF 时，传统 Wiener-SIM 重建频谱中出现明显的斑块状特征，并在微球周围产生清晰的旁瓣伪影，旁瓣强度约为真实微球强度的 10%。fairSIM 使用 OTF 衰减后，斑块状频谱特征有所减弱，但仍然存在，因此仍能观察到类似的旁瓣。HiFi-SIM 在使用相同 OTF 的情况下得到更加均匀的频谱，微球图像更干净。

旁瓣可能叠加到相邻真实微球上，使其强度增加约 8.8%。HiFi-SIM 的 PSF 能量主要集中在主瓣中，因此单个微球的平均 FWHM 略有增加，约增加 6 nm，但由于旁瓣更少，细节更容易识别。

论文报告的平均 FWHM 为：

| 方法 | 平均 FWHM |
|---|---:|
| 传统 Wiener-SIM | $86.2\pm4.6$ nm |
| fairSIM | $82.0\pm4.0$ nm |
| HiFi-SIM | $88.0\pm3.3$ nm |

该结果说明，最小 FWHM 不等同于最高保真度。HiFi-SIM 的优势主要体现在旁瓣抑制和结构可信度，而不是单纯把主瓣压到最窄。

### 线结构和环结构

作者使用 DeltaVision OMX 对 Argolight 标准样品中的线结构和环结构进行成像。GE SoftWoRx 和 fairSIM 的 SR 图像中出现了与真实结构平行的人工线条，其强度约为真实结构的 10%-30%。TV-SIM 和 Hessian-SIM 的结果中也出现了类似旁瓣结构。

HiFi-SIM 能够有效消除这些旁瓣结构。相对于 fairSIM，HiFi-SIM 的误差图 RMSE 约降低四倍。论文给出的一组结果中，fairSIM 的 RMSE 为 10.8051、SSIM 为 0.7941，而 HiFi-SIM 的 RMSE 为 2.6033、SSIM 为 0.9612。

对于环结构，中心内部的伪影通常比外部更明显，因为内部的旁瓣会互相重叠。HiFi-SIM 能有效消除这些伪影，得到更干净的中空环。即使改变两个重建参数 $w_1$ 和 $w_2$，计算得到的结构相似性仍保持在 91.3% 以上，说明 HiFi-SIM 对重建参数不敏感，通常不需要像传统方法那样进行频繁调参。

## 高质量原始数据

成功的 SIM 成像通常需要较高的结构光调制度；在 TIRF-SIM 模式下，调制度往往更容易达到较高水平。作者使用 TIRF-SIM 对活 COS-7 细胞中的微管进行成像，并比较 fairSIM 与 HiFi-SIM。

在调制度大于 0.5 的高质量数据中，两种方法都可以重建出较高质量的 SR 图像。但是 fairSIM 的部分区域存在旁瓣伪影，且两个相邻微管的旁瓣叠加后可能产生约两倍的强度，从而很容易被误判为真实结构。HiFi-SIM 能修正异常频谱，因此没有明显可见的旁瓣伪影。

作者还使用常规 2D-SIM 模式对固定 COS-7 细胞中的微管成像。原始数据的三个方向调制度分别为 0.62、0.76 和 0.82，但右上角存在强背景，使数据具有很大的动态范围。SoftWoRx、RL-SIM、TV-SIM 和 Hessian-SIM 的结果中都可观察到残余背景和旁瓣伪影，尤其是在强背景区域。

HiFi-SIM 可以有效去除残余背景和典型伪影，得到对比度更高、保真度更好的 SR 图像。

## 低调制度和强背景数据

通常认为，调制度低于 0.5 的原始 SIM 数据需要谨慎处理，甚至可能应当舍弃，因为其伪影风险更高。作者通过控制光束偏振，故意将三个方向的调制度设置为 0.43、0.36 和 0.21，以模拟次优数据。

为了用 fairSIM 得到可接受图像，需要提高 OTF 衰减强度，以减少伪影和残余离焦背景。但这会损失部分微小弱结构，同时仍不能完全消除蜂窝伪影和旁瓣伪影。

相比之下，HiFi-SIM 得到的图像几乎没有明显蜂窝和旁瓣伪影，同时保留了微小结构。这说明它在抑制离焦信号和保护细微弱结构之间具有更好的平衡。

具有强背景的原始数据还可能出现由非调制背景或高频噪声引起的“锤击纹”伪影。Hessian 去噪能够抑制锤击纹，但也可能把真实结构周围不连续的片段增强成连续的旁瓣，从而增加伪影被误判为真实结构的风险。HiFi-SIM 可以减少锤击纹和旁瓣。

## 低 SNR 数据

低 SNR 原始数据很难重建出可接受的 SR 图像。传统 Wiener-SIM 中的 Wiener 去卷积会放大不希望出现的高频噪声，因此经常产生随机且不连续的伪影。

在 HiFi-SIM 中，适当减小 `ApoFWHN` 可以抑制与高频噪声有关的随机不连续伪影；适当增大 $\beta$ 可以有意增强低频和中频信号，从而改善低 SNR 数据的重建质量。

TV-SIM 和 Hessian-SIM 也能有效抑制随机不连续伪影，但不能消除旁瓣和残余背景。在某些情况下，Hessian 去噪甚至可能把不连续片段增强为连续旁瓣。对于极低 SNR 或具有强背景的厚样品，Hessian-SIM 可能在锤击纹抑制方面更有优势；此时可以进一步对 HiFi-SIM 结果进行 Hessian 去噪。

## HiFi-SIM 的光学切片能力

传统观点认为，2D-SIM 由于 3D OTF 存在 missing cone，因此缺少真正的光学切片能力。HiFi-SIM 通过两步频谱优化，把等效 OTF 的中心设计成向下凹的形状，使对应的 3D OTF 中 missing cone 得到部分填补，从而可以获得一定的光学切片能力。

作者使用固定 U2OS 细胞中的微丝进行验证。HiFi-SIM 重建结果相对于 GE SoftWoRx 具有更高对比度和更少伪影。

作者还使用常规 2D-SIM 对活 U2OS 细胞中的运动囊泡成像。膜蛋白用 CD63-EGFP 标记，每个囊泡根据其大小，在 2D-SIM 图像中表现为微球或中空环。fairSIM 和 Hessian-SIM 的许多中空囊泡图像在中心和外部都含有明显伪影及残余离焦背景；HiFi-SIM 则能够以较少伪影重建不同大小的微球和中空环，这与完整 3D-SIM 的结果一致。

需要特别注意：HiFi-SIM 的 2D 光学切片改善不等于完整 3D-SIM 的轴向分辨率提升。它能够提高对比度和减少离焦背景，但不能据此宣称获得完整 3D-SIM 的约两倍轴向分辨率。

## 讨论

作者提出了一种用于高质量 SR 图像重建的高保真 SIM 算法。此前，为了获得伪影较少的 SR-SIM 图像，通常需要精心设计实验、对系统 OTF 进行专门标定，并对多个用户参数进行细致调节。这些要求提高了普通用户使用 SIM 的门槛。

HiFi-SIM 对 OTF 不匹配引起的重建伪影更不敏感，因此默认使用理论 OTF，避免复杂的 OTF 标定。对于调制度大于 0.5 的高质量数据，通常只需调节一个参数 `attStrength` 便可获得较好的光学切片性能。对于调制度在 0.1-0.5 之间或具有强背景的数据，通常还需要相应调节 `ApoFWHN` 或 $\beta$。

对于低 SNR 数据，适当减小 `ApoFWHN` 可以抑制与高频噪声相关的随机不连续伪影，适当增大 $\beta$ 可以增强低频和中频信号。TV-SIM 和 Hessian-SIM 在随机伪影抑制方面也很有效，但不能完全消除旁瓣和残余背景；在某些情况下，Hessian 去噪还可能增强连续旁瓣。

作者还讨论了 Tiled-SIM。Tiled-SIM 将原始数据分成重叠的小块，并对每个小块使用独立参数重建。由于 HiFi-SIM 对重建参数不敏感，大多数情况下不必使用这种分块方法；但当整个视野存在较大像差或高动态范围时，将 HiFi-SIM 应用于每个小块仍可能进一步改善结果。

HiFi-SIM 的结果可以作为深度学习方法的训练输入，以提高学习型重建的保真度。其频谱优化原则也可能推广到非线性 SIM 和晶格光片显微镜等同样容易出现异常频谱和伪影的成像方式。未来还可以使用 GPU 加速 HiFi-SIM。

总的来说，HiFi-SIM 是一种基于 PSF 工程、易于使用的 SIM 重建方法。它能够从不同质量的原始数据中获得高保真 SR 图像，降低对实验实现和后处理重建的要求，从而提高 SR-SIM 对普通用户的可访问性。

## 材料与方法要点

### 标准荧光样品

作者使用直径 100 nm 的荧光微球和商业 Argo-SIM 标准片评价重建保真度。微球为羧酸修饰、黄绿色荧光的 0.1 μm 微球，使用前稀释 100 倍。Argo-SIM 中的 “Star” 和 “2D matrix of rings” 图案分别作为典型线结构和环结构。

### 细胞培养与标记

COS-7 和 U2OS 细胞在 37 °C、5% CO₂ 培养箱中培养。COS-7 细胞使用 DMEM 培养基，U2OS 细胞使用 McCoy's 5A 培养基，培养基均补充 10% 胎牛血清和 1% 青霉素/链霉素。作者使用 mEmerald-Tubulin、mEGFP-Lifeact、mEmerald-Caveolin、mEmerald-ER-3 等载体分别标记微管、微丝、洞样小窝和内质网；囊泡使用 CD63-EGFP 标记。

### SIM 成像系统

实验使用 DeltaVision OMX SR、Nikon N-SIM S 和自建双光束干涉 SIM 系统。自建系统基于倒置荧光显微镜，使用 NA=1.49 的 TIRF 油浸物镜、488 nm 激光和 sCMOS 相机；通过铁电液晶空间光调制器生成不同周期的照明图案。

微球、活 COS-7 细胞中的微管和微丝使用 TIRF-SIM 模式成像；活 U2OS 细胞中的微管和囊泡，以及固定 U2OS 细胞中的内质网，使用入射角小于 TIRF 临界角的常规 SIM 模式成像。自建系统的探测器像素尺寸标定为 65 nm/pixel；OMX 系统为 78.6 nm/pixel；N-SIM S 系统为 60 nm/pixel。

### 图像重建比较

比较方法包括 GE SoftWoRx、Nikon NIS-Elements、fairSIM、SIMToolbox，以及文献中的迭代反卷积方法。fairSIM 和传统 Wiener-SIM 使用的 OTF 包含理论近似 OTF；文中部分比较使用 OTF 衰减因子 0.3。作者自己实现的传统 Wiener-SIM 与 HiFi-SIM 使用相同的原始数据预处理和重建参数估计方法，差别主要在于频谱分量的重组方式。

### 保真度定量

作者利用已知真实结构的 Argo-SIM 线和环图案进行定量评价。先用高调制度、高 SNR 的 50 ms 数据重建低伪影 SR 图像，再去除残余噪声，作为 GT 模型。通过 SR 图像与 GT 之间的误差图、RMSE 和 SSIM 评价重建保真度。

SSIM 定义为：

$$
\mathrm{SSIM}(I_{SR},I_{GT})
=
\frac{(2\mu_{SR}\mu_{GT}+C_1)(2\sigma_{SR,GT}+C_2)}
{(\mu_{SR}^2+\mu_{GT}^2+C_1)(\sigma_{SR}^2+\sigma_{GT}^2+C_2)}.
$$

其中，$\mu_{SR}$ 和 $\mu_{GT}$ 是两幅图像的均值，$\sigma_{SR}$ 和 $\sigma_{GT}$ 是标准差，$\sigma_{SR,GT}$ 是协方差，$C_1$ 和 $C_2$ 用于避免分母过小。文中设置 $C_1=C_2=0.05$。

## 译文与本课题的对应关系

这篇论文对 SIM+深度学习课题的直接启发是：

1. 先建立高保真物理重建基线，再训练网络学习剩余噪声、参数误差或像差残差。
2. 训练数据不应只保存最终图像，还应保存原始相移帧、频谱分量、OTF、波矢、相位和调制度。
3. 评价网络时应重点检查旁瓣、蜂窝、锤击纹、残余背景和数据一致性，而不是只看图像是否更锐利。
4. HiFi-SIM 可以作为 Wiener-SIM 之外的物理基线，用于比较网络是否真正提高了保真度。
5. 2D-SIM 的光学切片增强不能直接当作 3D 轴向超分辨；对 3D-MP-SIM 仍应使用真实的多层 OTF 和轴向模型。

## 原文来源

Wen G, Li S, Wang L, et al. *High-fidelity structured illumination microscopy by point-spread-function engineering*. Light: Science & Applications, 2021, 10:70. DOI: `10.1038/s41377-021-00513-w`.
