# fairSIM 文献条目（2D-SIM / Wiener-SIM 参考实现）

## 文献

Müller, Marcel, Viola Mönkemöller, Simon Hennig, Wolfgang Hübner, Thomas Huser. “Open-source image reconstruction of super-resolution structured illumination microscopy data in ImageJ.” *Nature Communications* 7, 10980 (2016). DOI: [10.1038/ncomms10980](https://doi.org/10.1038/ncomms10980). 开放获取（CC BY 4.0）。

配套原始方法文献：

- Gustafsson, M. G. L. “Surpassing the lateral resolution limit by a factor of two using structured illumination microscopy.” *Journal of Microscopy* 198(2), 82–87 (2000). DOI: [10.1046/j.1365-2818.2000.00710.x](https://doi.org/10.1046/j.1365-2818.2000.00710.x)。Wiener-SIM 频域重建与加权互相关参数估计的原始出处。
- Wicker, Kai, Ondrej Mandula, Gerrit Best, Reto Fiolka, Rainer Heintzmann. “Phase optimisation for structured illumination microscopy.” *Optics Express* 21(2), 2032–2049 (2013). DOI: [10.1364/OE.21.002032](https://doi.org/10.1364/OE.21.002032)。相位优化方法文献；与下面的非迭代自相关方法区分。
- Wicker, Kai. “Non-iterative determination of pattern phase in structured illumination microscopy using auto-correlations in Fourier space.” *Optics Express* 21(21), 24692–24701 (2013). DOI: [10.1364/OE.21.024692](https://doi.org/10.1364/OE.21.024692)。对应源码 `estimateAbsolutePhases` 的非迭代自相关路径。

## 文件说明

- [fairSIM_参数估计逐步推导与代码实操.md](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM_参数估计逐步推导与代码实操.md)：2026-10-13 的参数估计专门讲解；逐项展开三相位解混、样品/相机频率坐标、重叠区比例、FFT 相关和亚像素搜索，附数字例子、源码位置及可运行实操。
- `fairSIM_原文公式与代码逐步精读.md`：2026-10-12 根据主文和 Supplementary Note 1 重新核对的阅读文档，按原文公式顺序补充必要推导，代码仅对照 fairSIM。建议从这份开始。
- `fairSIM-2016.pdf`、`fairSIM-2016-SI.pdf`：本次补齐的主文与补充材料原件，分别 6 页、12 页。
- `fairSIM-2016.xml` 与两份 `原文提取.txt`：主文原始 XML 和 PDF 文字提取，辅助定位；公式以 PDF 为准。
- `fairSIM_资料核对记录.md`：获取来源、文件哈希、原文位置与数值检查记录。
- `metadata.yaml`：题录、关键词、代码来源与阅读范围。
- `citation.bib`：BibTeX 引用条目（fairSIM 主文 + Gustafsson 2000 + Wicker 2013）。
- `理解笔记.md`：以 fairSIM v1.5.1 源码为主线，逐步拆解 2D-SIM 参数估计与 Wiener 重建，并对照本项目的 [`sim-core.js`](../../web/shared/sim-core.js) 与 [`MP-main/core`](../../3D-MP-SIM/MP-main/core/)。
- 本地代码：[`fairSIM-src/fairSIM`](../fairSIM-src/fairSIM/)（git 克隆，`develop` 分支，pom 版本 1.5.1）。

## 原文获取状态

2026-10-12 已补齐本地主文 PDF 和补充 PDF，重新核对主文算法相关段落、Supplementary Note 1（补充 PDF 第 9—11 页）及相关补充图注。Note 1 的公式没有印刷编号；新精读文档用 F1—F8 作本稿定位标签，并单独说明原文记号与固定源码的差别。遵照项目约定，没有进行截图或图像视觉检查。下载入口：

- 主文 PDF：<https://www.nature.com/articles/ncomms10980.pdf>
- 补充材料：[出版方原始 PDF](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fncomms10980/MediaObjects/41467_2016_BFncomms10980_MOESM1684_ESM.pdf)

旧 `理解笔记.md` 保留此前的研究记录和跨实现比较，其“SI 未获取”等状态已过时；当前这次只对照 fairSIM 的讲解以新精读文档及核对记录为准。

## 与课题的关系

fairSIM 是 2D-SIM（单层 Wiener-SIM）最完整的开源参考实现，同时支持两束干涉（2 频带）与三束干涉（3 频带）。HiFi-SIM（S3）论文将其作为主要对照方法。对本课题的作用：

1. 提供可逐行核对的参数估计与重建流程，用于校验 [`sim-core.js`](../../web/shared/sim-core.js) 的教学模型是否漏掉工程步骤；
2. 提供 2D 高保真基线的对照实现，与 3D-MP-SIM 的 7 级频谱重建（S10）区分职责；
3. 其 `Correlation` / `WienerFilter` / `SimUtils` 的模块划分可作为“物理初值 + 残差网络”课题中前向模型的接口参考。
