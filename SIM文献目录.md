# SIM 文献与代码目录

[资料库首页](README.md) · [知识库目录](SIM知识库.md) · [项目总览](SIM项目总览.md)

> 目录核对：2026-09-26，2026-09-28 完成重复 PDF 去重，2026-09-29 新增 S11（fairSIM，含本地源码）与 S12（仅题录）。阅读状态沿用既有记录。来源编号与详细书目见[专题 08](知识库/08-术语与参考来源.md#s3)。

## 已阅读文献

先点“知识专题”查提炼后的原理；需要追溯公式、实验条件和数字时打开原文、SI 或详细笔记。

| 编号 | 文献与条目说明 | 原始材料 | 中文阅读 | 知识专题 | 阅读状态 |
|---|---|---|---|---|---|
| S1 | [SIM 重建算法综述（2023）](SIM综述/README.md) | [PDF](<SIM综述/Superresolution structured illumination microscopy reconstruction algorithms.pdf>) | 已吸收进专题 | [对应章节](知识库/01-SIM基础与频谱直觉.md#s1) | 已阅读；知识库已吸收 |
| S3 | [HiFi-SIM（2021）](HiFI-SIM/README.md) | [PDF](<HiFI-SIM/High-fidelity structured illumination microscopy by point-spread-function engineering.pdf>) | [译文](<HiFI-SIM/High-fidelity structured illumination microscopy by point-spread-function engineering-译文.md>) | [对应章节](知识库/03-传统重建与参数估计.md#s1-2) | 已阅读；有译文 |
| S5 | [BayesDL-SIM（2025）](BayesDL-SIM/README.md) | [PDF](<BayesDL-SIM/Bayesian deep-learning structured illumination microscopy enables reliable super-resolution imaging with uncertainty quantification.pdf>) · [SI](BayesDL-SIM/BayesDL-SIM-SI.pdf) | [译文](BayesDL-SIM/中文译文.md) · [笔记](BayesDL-SIM/理解笔记.md) | [对应章节](知识库/06-深度学习与可信重建.md#s1-5) | 已阅读；含 SI |
| S6 | [DeAbe（2025）](DeAbe/README.md) | [PDF](<DeAbe/Deep learning-based aberration compensation improves contrast and resolution in fluorescence microscopy.pdf>) | [译文](DeAbe/中文译文.md) · [笔记](DeAbe/理解笔记.md) | [对应章节](知识库/06-深度学习与可信重建.md#s1-6) | 已阅读 |
| S7 | [RL-SIM（2026）](参数自适应/RL-SIM/README.md) | [PDF](<参数自适应/RL-SIM/Physics-guided reinforcement learning for structured illumination microscopy.pdf>) | [译文](参数自适应/RL-SIM/中文译文.md) · [笔记](参数自适应/RL-SIM/理解笔记.md) | [对应章节](知识库/06-深度学习与可信重建.md#s1-7) | 已阅读 |
| S8 | [SSR-SIM（2025）](SSR-SIM/README.md) | [PDF](<SSR-SIM/Bio-friendly and high-precision super-resolution imaging through self-supervised reconstruction structured illumination microscopy.pdf>) | [译文](SSR-SIM/中文译文.md) · [笔记](SSR-SIM/理解笔记.md) | [对应章节](知识库/06-深度学习与可信重建.md#s1-8) | 已阅读 |
| S9 | [Open-3DSIM（2023）](3D-MP-SIM/3D-SIM/Open-3DSIM/README.md) | [PDF](<3D-MP-SIM/3D-SIM/Open-3DSIM/Open-3DSIM.pdf>) | [译文](3D-MP-SIM/3D-SIM/Open-3DSIM/中文译文.md) · [笔记](3D-MP-SIM/3D-SIM/Open-3DSIM/理解笔记.md) | [对应章节](知识库/04-三维SIM与多平面成像.md#s2) | 已阅读；另有作者修正 |
| S10 | [3D-MP-SIM（2025）](3D-MP-SIM/3D-MP-SIM-论文/README.md) | [PDF](<3D-MP-SIM/3D-MP-SIM-论文/3D-MP-SIM.pdf>) · [SI](3D-MP-SIM/3D-MP-SIM-论文/3D-MP-SIM-SI.pdf) | [译文](3D-MP-SIM/3D-MP-SIM-论文/中文译文.md) · [笔记](3D-MP-SIM/3D-MP-SIM-论文/理解笔记.md) | [对应章节](知识库/04-三维SIM与多平面成像.md#s3) | 核心论文；主文与 SI 已阅读 |
| S11 | [fairSIM（2016）](Wiener-SIM/fairSIM-论文/README.md) | [开放获取原文](https://www.nature.com/articles/ncomms10980.pdf)（本地未存 PDF） | [笔记](Wiener-SIM/fairSIM-论文/理解笔记.md) | [对应章节](知识库/03-传统重建与参数估计.md#s3) | 正文已阅读；SI 未获取 |

S4 为旧版占位编号，不新增引用。原文、元数据与 BibTeX 保存在各文献目录；译文和笔记用于学习，定量结论回到原论文核对。

## 代码与复现入口

| 标记 | 实现 | 本地入口 | 状态 |
|---|---|---|---|
| S2 | 当前 3D-MP-SIM 代码 | [MP-main 运行说明](3D-MP-SIM/MP-main/README.md) · [理论与代码映射](知识库/07-课题路线与代码映射.md#s2) | 已保存；最小实例与完整复现仍在待办 |
| S9 配套 | Open-3DSIM 作者代码 | [本地代码说明](3D-MP-SIM/3D-SIM/Open3DSIM-src/Open3DSIM-master/README.md) | 已保存；未记录本地复现完成 |
| S11 配套 | fairSIM v1.5.1（2D-SIM/Wiener-SIM 参考实现） | [本地代码说明](Wiener-SIM/fairSIM-src/README.md) | 已克隆（`develop`，提交 `711afd1`）；未在本机构建或复现 |

其他方法的作者代码和数据链接见各自条目说明与 `metadata.yaml`；实验任务统一维护于[专题 07](知识库/07-课题路线与代码映射.md#s4)。

## 待阅读与修正材料

| 条目 | 入口 | 处理方式 |
|---|---|---|
| P1 · DMF-SIM（2025，accepted manuscript） | [原文 PDF](2025.06/1-s2.0-S0031320325005254-main.pdf) | 待阅读；当前不作为已验证知识依据 |
| S12 · Gustafsson 2000（Wiener-SIM 原始方法） | [DOI 10.1046/j.1365-2818.2000.00710.x](https://doi.org/10.1046/j.1365-2818.2000.00710.x) | 仅登记题录，本地无原文；推导细节以 S11 源码与 S1 综述为可核对依据 |
| S9 · Open-3DSIM 作者修正 | [修正 PDF](3D-MP-SIM/3D-SIM/s41592-023-01996-8.pdf) | 已识别：补充作者、Fig. 2e 标签和表述修正；与主文一起查阅 |

## 重复文件与历史收集

以下 7 组资料此前在工作目录中存在逐字节一致的旧副本。2026-09-28 用 SHA-256 逐一复核确认与规范位置一致后删除旧副本，每组只保留一处原件；原始下载文件名保留在各论文目录的 `metadata.yaml` 中。

| 资料 | 已删除的旧副本 | 规范位置 |
|---|---|---|
| BayesDL-SIM 主文 | `2025.06/` 中同名 PDF | [BayesDL-SIM 条目](BayesDL-SIM/README.md) |
| BayesDL-SIM SI | `2025.06/41467_2025_60093_MOESM1_ESM.pdf` | [规范 SI](BayesDL-SIM/BayesDL-SIM-SI.pdf) |
| DeAbe 主文 | `2025.06/s41467-024-55267-x.pdf` | [DeAbe 条目](DeAbe/README.md) |
| RL-SIM 主文 | `参数自适应/s42005-026-02692-7.pdf` | [RL-SIM 条目](参数自适应/RL-SIM/README.md) |
| Open-3DSIM 主文 | `3D-MP-SIM/3D-SIM/s41592-023-01958-0.pdf` | [规范主文](3D-MP-SIM/3D-SIM/Open-3DSIM/Open-3DSIM.pdf) |
| 3D-MP-SIM 主文 | `3D-MP-SIM/` 中英文长文件名 PDF | [规范主文](3D-MP-SIM/3D-MP-SIM-论文/3D-MP-SIM.pdf) |
| 3D-MP-SIM SI | `3D-MP-SIM/` 中英文长文件名 SI PDF | [规范 SI](3D-MP-SIM/3D-MP-SIM-论文/3D-MP-SIM-SI.pdf) |

`2025.06/` 去重后仅保留待阅读的 DMF-SIM 原文和一份个人简历；简历属于非课题资料，保留原位，不纳入文献索引和知识结论。

## 推荐阅读顺序

1. S1 → S11 → S3：建立物理模型、代码级 Wiener-SIM 流程与传统高保真重建基础。
2. S9 → S10 → S2：理解三维、多平面模型，并对照当前实现。
3. S8 → S5：补充自监督与可靠性评价。
4. S6 / S7：按像差补偿或参数自适应的研究需要选读。
5. P1：待阅读的双模型重建与去噪方法。

## 文件维护约定

每篇论文集中维护原文 PDF、SI（如有）、`README.md`、`metadata.yaml`、`citation.bib`、译文和笔记。S11 为开放获取文献，本地只保存条目说明、理解笔记与作者代码，未存 PDF；下载入口与阅读范围记在其 `metadata.yaml`。Markdown 为正文源文件，公式阅读页统一生成；命令和职责见[维护说明](知识库/维护说明.md)。
