# 3D-MP-SIM 核心文献

## 文献

Chen, Qian et al. “Fast, three-dimensional, live-cell super-resolution imaging with multiplane structured illumination microscopy.” *Nature Photonics* (2025). DOI: [10.1038/s41566-025-01638-9](https://doi.org/10.1038/s41566-025-01638-9).

## 文件说明

- `3D-MP-SIM.pdf`：主论文 PDF。
- `3D-MP-SIM-SI.pdf`：Supplementary Information，包含前向模型、7 级/两步频谱分离、条件数分析、厚样品拼接和补充实验。
- `metadata.yaml`：题录、实验参数、代码和数据来源。
- `citation.bib`：BibTeX 引用条目。
- `中文译文.md`：主文与补充材料关键理论的完整工作译稿。
- `理解笔记.md`：面向当前 `MP-main` 代码和 SIM+深度学习课题的理论推导、实现映射与复现路线。

## 代码与数据

- 作者重建代码：<https://github.com/Huanglab-902/MP>。
- 示例数据：<https://doi.org/10.6084/m9.figshare.28280615.v1>。
- 当前项目代码：`../MP-main/`，包含 `Para_Estimate.py`、`Seperate_CK.py`、`Wiener_Reconstruction.py` 和 `Main_recon_MP.py`。

这篇论文是当前毕业课题的核心物理来源。译文和笔记以主文、SI 和本地代码为依据；严格复现时仍应以论文原文、SI、代码版本和实际 OTF 为准。
