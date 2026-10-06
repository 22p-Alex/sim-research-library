# fairSIM 本地代码说明

2D-SIM / Wiener-SIM 的开源参考实现，配套文献条目见 [`../fairSIM-论文/`](../fairSIM-论文/README.md)。

## 获取方式与版本

```sh
git clone https://github.com/fairSIM/fairSIM.git
```

| 项 | 值 |
|---|---|
| 本地路径 | `Wiener-SIM/fairSIM-src/fairSIM` |
| 分支 | `develop`（默认克隆分支，当前活跃开发线） |
| 提交 | `711afd12cb8c4fd4207bbca7ee7610c5aed4f732`（2026-09-15） |
| `pom.xml` 版本 | 1.5.1 |
| 许可 | GPLv2（含 JTransforms 的 BSD 2-clause 部分） |
| 克隆方式 | `--depth 1` 浅克隆，保留 `.git` 以记录提交号 |

`master` 分支停留在 2016 年（提交 `f69908170`，对应 Nat Commun 论文时期，目录结构为 `org/fairsim/...` 而非 `src/main/java/...`）。若需复现论文当年的行为，单独浅克隆 `master`：

```sh
git clone --depth 1 --branch master https://github.com/fairSIM/fairSIM.git fairSIM-master-2016
```

## 与本课题相关的源码入口

| 模块 | 文件 | 职责 |
|---|---|---|
| 端到端示例 | `src/main/java/org/fairsim/fiji/StepByStep.java` | 从 OTF 估计到重建输出的最小完整脚本，是阅读起点 |
| 高层编排 | `src/main/java/org/fairsim/sim_algorithm/SimAlgorithm.java` | `estimateParameters`、`estimateAbsolutePhases`、`runReconstruction` |
| 频带分离 | `src/main/java/org/fairsim/sim_algorithm/BandSeparation.java` | 相移矩阵构造与伪逆解混 |
| 参数估计核 | `src/main/java/org/fairsim/sim_algorithm/Correlation.java` | `locatePeak`、`fitPeak`、`getPeak`、`commonRegion`、`autoCorrelation` |
| Wiener 融合 | `src/main/java/org/fairsim/sim_algorithm/WienerFilter.java` | 分母缓存、切趾/衰减、宽场分母 |
| OTF | `src/main/java/org/fairsim/sim_algorithm/OtfProvider.java` | 理论 OTF 估计、衰减、切趾窗、掩膜 |
| 工具 | `src/main/java/org/fairsim/sim_algorithm/SimUtils.java` | 背景扣除、余弦窗、傅里叶平移、功率谱 |
| 参数容器 | `src/main/java/org/fairsim/sim_algorithm/SimParam.java` | 方向/相位/波矢/调制度/Wiener/切趾参数 |
| GUI 流程 | `src/main/java/org/fairsim/sim_gui/ReconstructionControl.java` | 界面上的分步执行顺序 |

逐步拆解与本项目 `sim-core.js`、`MP-main/core` 的对照见 [理解笔记](../fairSIM-论文/理解笔记.md) 与[知识库专题 03 第 3 节](../../知识库/03-传统重建与参数估计.md#s3)。

## 构建与运行

需要 JDK 与 Maven；ImageJ 依赖 `ij:1.48v`，FFT 依赖 `JTransforms:3.1`（见 `pom.xml`）。本资料库只做源码阅读，未在此机器上构建或运行 fairSIM，也未记录任何本地复现结果。

```sh
cd fairSIM && mvn -q package
```
