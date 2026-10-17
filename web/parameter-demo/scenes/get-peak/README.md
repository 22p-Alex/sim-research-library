# getPeak 分镜单元

主线第 19 幕、独立参数页第 10 幕共用此单元。规范名称 `get-peak`；宿主兼容 ID 是 `least-squares-fit`。按本地 fairSIM 最终幅相路径，从锁定位置的临时频带得到一个共同复系数，再交给矩阵回填。

| 文件 | 职责 |
|---|---|
| `storyboard.js` | 七拍时长、动作、标题、说明、公式拆项、强调顺序、拍内 cues 和可见性 |
| `state.js` | 纯展示状态，读取最终数组、示例位置和完整前缀和；不重新计算估计 |
| `layout.js` | 固定桌面 SVG 槽位 |
| `view.js` | 持久画面演员及更新 |
| `formula-view.js` | 按本拍定义构建和强调公式节点 |

## 七拍与交接

| key | 时长 | 运算 |
|---|---|---|
| `finalPrepare` | 9.6 秒 | 从原始临时频带准备最终工作副本 |
| `finalInverse` | 12.8 秒 | 两路逆 FFT |
| `finalShift` | 11.2 秒 | 锁定波矢对应的空间相位斜坡 |
| `finalProduct` | 12.8 秒 | 同点共轭乘积与参考能量 |
| `finalSum` | 17.6 秒 | 全部 N² 位置累计 |
| `finalDivide` | 8 秒 | 复数和除以参考能量 |
| `finalRead` | 8 秒 | 读取模长、相角及参数卡片 |

总时长由拍定义求和，当前 80 秒。修改本拍 `duration` 即可改变节奏；动作区间使用本拍 0—1 进度，自动测试核对改时长后公式、动作及揭示顺序不变。新增公式 token 时，同时给出强调节点名称；布局修改集中在 `layout.js`。

入口声明为 `locked-spectrum`，来自 `refine(1)`；共享视图通过 `legacyBody` 父容器退场。输出为 `estimated-parameter-cards`，交给 `adopted-weights`。整个场景读取宿主进度，不维护播放器。

## 数据与来源

共同复比例的因果链与七拍同步：斜坡拍引入 vₖ≈αu，逐点拍说明 u*vₖ≈α|u|²，除法拍先说明 C≈αE₀，再读取 α̂。精确比例限于匹配的理想模型；最小二乘推导继续留在理论区。

唯一最终计算入口是 `lesson.estimate.finalPeak`。`prepared`、`spatial`、`shifted`、`product`、`energy` 和 `sums` 分别对应各拍。`sums` 包含 N²+1 项，首项为零；屏幕累计计数指完整空域位置。`supportCounts` 仅说明最终频域掩膜保留点数，不能作为空域累计次数。

$$
\widehat\alpha=
\frac{\sum_{\mathbf r}u^*(\mathbf r)v_{\widehat{\mathbf k}}(\mathbf r)}
{\sum_{\mathbf r}|u(\mathbf r)|^2},\qquad
\widehat m=|\widehat\alpha|,\qquad
\widehat\phi_\Delta=\arg\widehat\alpha.
$$

来源：[本地 Correlation.java](../../../../Wiener-SIM/fairSIM-src/fairSIM/src/main/java/org/fairsim/sim_algorithm/Correlation.java) 的 `commonRegion/getPeak`，固定提交 `711afd12cb8c4fd4207bbca7ee7610c5aed4f732`。完整符号约定、归一化与本地 Java 对照见[源码七拍说明](../../../motion/plans/2026-10-17-fairsim-getpeak-storyboard.md)。前面位置搜索的 `estimate.fit` 不参与本幕累计。

修改后执行 `npm run check`；使用两页的“分镜排练”定位拍内状态。数值和公式状态通过不代表实际字体及布局已验收。通用规则见[治理约定](../../../motion/GOVERNANCE.md)。
