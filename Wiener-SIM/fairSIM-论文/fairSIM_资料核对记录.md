# fairSIM 原文与讲解文档核对记录

日期：2026-10-12。

对应文档：[fairSIM 原文公式与代码逐步精读](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM_原文公式与代码逐步精读.md)。

## 1. 本地资料清点

重新检查了项目中的 PDF、fairSIM 文献目录，以及 `归档/知识库整理前-2026-09-24.zip`、`归档/知识库整理前-2026-09-26.zip` 的文件名列表。检查时可找到 SIM 综述等原文，但未找到 fairSIM 主文或 SI 的既有 PDF；fairSIM 目录原先保存题录、笔记与源码。归档内也未找到包含 fairSIM、Wiener、10980 或 4802170 标识的条目。

本次补齐主文、SI 与主文 XML，并保存 PDF 文字提取。旧资料中“本地无 PDF”“SI 未获取”的状态已在 fairSIM 条目和元数据中更新，旧理解笔记增加了新文档入口。

## 2. 原件来源与完整性

### 主文

- 本地文件：[fairSIM-2016.pdf](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016.pdf)。
- 来源：[Nature 主文 PDF](https://www.nature.com/articles/ncomms10980.pdf)。
- 6 页，1,376,344 字节；具有有效 PDF 头，pypdf 可以解析所有页面并提取文字。
- SHA-256：`7875f00bb315ddeffcdd88b17ca95b682dfc19f40b473b8297a3feea0b707d5f`。

### 补充材料

- 本地文件：[fairSIM-2016-SI.pdf](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016-SI.pdf)。
- 来源：[出版方实际 PDF 地址](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fncomms10980/MediaObjects/41467_2016_BFncomms10980_MOESM1684_ESM.pdf)，由出版方文章 HTML 的 Supplementary Information 链接取得。
- 12 页，2,132,056 字节；具有有效 PDF 头，pypdf 可以解析所有页面并提取文字。
- SHA-256：`449eb6c90eae4cf8dc95104ffaaf4002a3ebc7824a48cbbd935b23b33c8fe1f7`。
- 第 1—8 页为 Supplementary Figures 1—8，第 9—11 页为 Supplementary Note 1，第 12 页为补充参考文献。

### 主文结构化文本

- 本地文件：[fairSIM-2016.xml](/Users/22p/Documents/ChatGPT/毕业设计/Wiener-SIM/fairSIM-论文/fairSIM-2016.xml)。
- 来源：[Europe PMC fullTextXML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4802170/fullTextXML)。
- 81,187 字节。
- SHA-256：`b1f698ac5126b0b30699a67f2bab740cd797b3a94cb995cbe6a3092241593490`。

PDF 文字提取只作辅助定位，复杂公式的线性提取顺序可能失真。新文档结合相关页文字、公式结构、前后定义及 fairSIM 代码核对；没有将提取文本中的失序字符直接当作新公式。

## 3. 原文公式定位

Supplementary Note 1 没有印刷公式号。F1—F8 是讲解文档的内部标签：

| 标签 | SI PDF 页码 | 内容 |
|---|---:|---|
| F1 | 9 | 空间域谐波照明与成像 |
| F2 | 9 | 频域混合 |
| F3 | 9 | 混合矩阵与系数 |
| F4 | 9 | 矩阵求逆与频带分离 |
| F5 | 10 | 归位、Wiener 组合与切趾 |
| F6 | 10 | 公共区域的复数比例关系 |
| F7 | 11 | 互相关 |
| F8 | 11 | 以零级能量归一化相关量 |

文档单独说明了原文中相位数条件、C 的平移简写，以及 F6—F8 共轭方向的一致性问题。完整的 2M+1 计数、显式检测 OTF 坐标与代码方向的相关比例都有独立推导或源码依据。

## 4. 源码范围

仅对照本地 fairSIM，提交：`711afd12cb8c4fd4207bbca7ee7610c5aed4f732`。相关文件为 `StepByStep`、`BandSeparation`、`SimAlgorithm`、`Correlation`、`SimUtils`、`WienerFilter`、`OtfProvider`、`SimParam` 和 `Vec` 的接口定义。

当前代码的零级分母计数、相位与调制度写回、调制度回退、OTF attenuation 次数、切趾形状等均标为固定提交的实现行为，不将它们全部倒推为 2016 年的代码状态。没有使用其他项目的重建实现来解释这些步骤。

## 5. 文档中的数值核对

使用独立的短计算检查文档等式，目的限于验证代数、符号和小数，不替代或冒充 fairSIM 的整图运行。输入和结果如下：

| 检查 | 输入/方法 | 结果 |
|---|---|---|
| 三帧解混 | μ=0.8，三个等间隔相位，分量 1、2、3；先混合再求解 | 最大误差 9.16×10⁻¹⁶ |
| F1→F2 的平移符号 | 64 点周期信号，样品含第 6、14 格余弦，照明第 8 格、相位 0.4；空间相乘 FFT 对照频谱移位相加 | 最大误差 4.67×10⁻¹⁴ |
| 临时分离的剩余系数 | 真实相位相对暂定相位偏移 0.4；真实 μ=0.8，临时分离假定旁带系数 0.5 | 与 0.8·exp(0.4i) 的差 4.58×10⁻¹⁶ |
| 代码方向的归一化相关 | V=αU，比较 ΣVU* / Σ|U|² 与 α | 差 2.29×10⁻¹⁶ |
| 原文方向的相关 | 同样数据，比较 ΣV*U / Σ|U|² 与 α* | 差 2.29×10⁻¹⁶ |
| 切趾窗 | 归一化半径 14/19，指数 0.8 | 0.22562130162536315 |
| 切趾窗 | 归一化半径 0.5，指数 0.8 | 0.4717841840482255 |

讲解文档的 64 个 LaTeX 数学块已用本地 KaTeX 做语法渲染检查，无错误。所有数学块使用双美元符号包裹。源码文件路径、行号范围以及文内锚点另作链接检查。

## 6. 本次校验的边界

核对重点是主文的算法相关段落、SI 第 9—11 页、相关图注与当前源代码。保存 PDF 原件并不意味着重新完成论文实验。遵照项目约定，本次没有启动浏览器、截图或进行视觉验收，也没有将独立的等式验算描述为整套 Java 重建复现。
