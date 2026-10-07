# fairSIM 文献条目（2D-SIM / Wiener-SIM 参考实现）

## 文献

Müller, Marcel, Viola Mönkemöller, Simon Hennig, Wolfgang Hübner, Thomas Huser. “Open-source image reconstruction of super-resolution structured illumination microscopy data in ImageJ.” *Nature Communications* 7, 10980 (2016). DOI: [10.1038/ncomms10980](https://doi.org/10.1038/ncomms10980). 开放获取（CC BY 4.0）。

配套原始方法文献：

- Gustafsson, M. G. L. “Surpassing the lateral resolution limit by a factor of two using structured illumination microscopy.” *Journal of Microscopy* 198(2), 82–87 (2000). DOI: [10.1046/j.1365-2818.2000.00710.x](https://doi.org/10.1046/j.1365-2818.2000.00710.x)。Wiener-SIM 频域重建与加权互相关参数估计的原始出处。
- Wicker, Kai, Ondrej Mandula, Gerrit Best, Reto Fiolka, Rainer Heintzmann. “Phase optimisation for structured illumination microscopy.” *Optics Express* 21(2), 2032–2049 (2013). DOI: [10.1364/OE.21.002032](https://doi.org/10.1364/OE.21.002032)。fairSIM 的绝对相位估计实现依据（自相关法，非迭代）。

## 文件说明

- `metadata.yaml`：题录、关键词、代码来源与阅读范围。
- `citation.bib`：BibTeX 引用条目（fairSIM 主文 + Gustafsson 2000 + Wicker 2013）。
- `理解笔记.md`：以 fairSIM v1.5.1 源码为主线，逐步拆解 2D-SIM 参数估计与 Wiener 重建，并对照本项目的 [`sim-core.js`](../../web/shared/sim-core.js) 与 [`MP-main/core`](../../3D-MP-SIM/MP-main/core/)。
- 本地代码：[`fairSIM-src/fairSIM`](../fairSIM-src/fairSIM/)（git 克隆，`develop` 分支，pom 版本 1.5.1）。

## 原文获取状态

主文为开放获取，正文（Introduction / Results / Methods / References）已通过出版方页面阅读并整理进笔记；**本目录未保存 PDF 副本**，Supplementary Note 1（参数估计细节）与 SI 图未获取。下载入口：

- 主文 PDF：<https://www.nature.com/articles/ncomms10980.pdf>
- 补充材料：<https://www.nature.com/articles/ncomms10980#Sec-articles>

引用定量结论前，请回到原文与 SI 核对；未读到的 SI 内容不作为本知识库结论。

## 与课题的关系

fairSIM 是 2D-SIM（单层 Wiener-SIM）最完整的开源参考实现，同时支持两束干涉（2 频带）与三束干涉（3 频带）。HiFi-SIM（S3）论文将其作为主要对照方法。对本课题的作用：

1. 提供可逐行核对的参数估计与重建流程，用于校验 [`sim-core.js`](../../web/shared/sim-core.js) 的教学模型是否漏掉工程步骤；
2. 提供 2D 高保真基线的对照实现，与 3D-MP-SIM 的 7 级频谱重建（S10）区分职责；
3. 其 `Correlation` / `WienerFilter` / `SimUtils` 的模块划分可作为“物理初值 + 残差网络”课题中前向模型的接口参考。
