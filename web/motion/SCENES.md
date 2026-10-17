# 完整动画的分镜目录

此文件由 `npm run scenes:sync` 生成。内容修改从每幕的分镜文件开始；目录顺序由场景组合决定，排练界面读取同一份注册表。查看[治理约定](GOVERNANCE.md)。

| 幕 | 稳定 ID | 教学单元 | 时长 | 可定位分镜 | 编辑入口 |
|---|---|---|---|---|---|
| 1 | `sample` | 样品与频谱 | 静态起点 | 1 | [分镜](scenes/sample/storyboard.js) · [view](scenes/sample/view.js) |
| 2 | `widefield` | 宽场的边界 | 1.5 秒 | 1 | [分镜](scenes/widefield/storyboard.js) · [共用 view](scenes/sample/view.js) |
| 3 | `illumination` | 条纹照明 | 1.6 秒 | 1 | [分镜](scenes/illumination/storyboard.js) · [共用 view](scenes/sample/view.js) |
| 4 | `frequency-encoding` | 频率编码 | 111.9 秒 | 14 | [分镜](scenes/frequency-encoding/storyboard.js) · [state](scenes/frequency-encoding/state.js) · [view](scenes/frequency-encoding/view.js) · [共用 view](scenes/sample/view.js) |
| 5 | `encoding-sum` | 编码叠加 | 6.5 秒 | 1 | [分镜](scenes/encoding-sum/storyboard.js) · [state](scenes/encoding-sum/state.js) · [view](scenes/encoding-sum/view.js) |
| 6 | `detection` | 物镜检测 | 5.2 秒 | 1 | [分镜](scenes/detection/storyboard.js) · [state](scenes/detection/state.js) · [view](scenes/detection/view.js) |
| 7 | `phase-acquisition` | 三帧观测 | 7 秒 | 1 | [分镜](scenes/phase-acquisition/storyboard.js) · [state](scenes/phase-acquisition/state.js) · [view](scenes/phase-acquisition/view.js) |
| 8 | `frequency-probe` | 固定频率 f | 2.4 秒 | 1 | [分镜](scenes/frequency-probe/storyboard.js) · [共用 view](scenes/phase-acquisition/view.js) |
| 9 | `mixed-sources` | 来源与矩阵 | 40 秒 | 1 | [分镜](scenes/mixed-sources/storyboard.js) · [state](scenes/mixed-sources/state.js) · [view](scenes/mixed-sources/view.js) |
| 10 | `inverse-demix` | 求逆与权重 | 24 秒 | 1 | [分镜](scenes/inverse-demix/storyboard.js) · [state](scenes/inverse-demix/state.js) · [共用 view](scenes/mixed-sources/view.js) |
| 11 | `provisional-split` | 检查预设值 | 132 秒 | 32 | [分镜](scenes/provisional-split/storyboard.js) · [共用 sim-motion-parameter-view](sim-motion-parameter-view.js) |
| 12 | `parameters.shared` | 找公共区 | 40 秒 | 1 | [分镜](../parameter-demo/scenes/shared/storyboard.js) · [state](../parameter-demo/scenes/shared/state.js) · [共用 sim-parameter-two-stage-view](../parameter-demo/sim-parameter-two-stage-view.js) · [共用 entry](../parameter-demo/scenes/shared/entry.js) |
| 13 | `parameters.line-shift` | 沿一行对齐 | 26 秒 | 1 | [分镜](../parameter-demo/scenes/line-shift/storyboard.js) · [state](../parameter-demo/scenes/line-shift/state.js) · [view](../parameter-demo/scenes/line-shift/view.js) · [共用 sim-parameter-two-stage-view](../parameter-demo/sim-parameter-two-stage-view.js) |
| 14 | `parameters.shift` | 回到二维 | 16 秒 | 1 | [分镜](../parameter-demo/scenes/shift/storyboard.js) · [state](../parameter-demo/scenes/shift/state.js) · [共用 sim-parameter-two-stage-view](../parameter-demo/sim-parameter-two-stage-view.js) |
| 15 | `parameters.otf` | 共轭与归一 | 32 秒 | 1 | [分镜](../parameter-demo/scenes/otf/storyboard.js) · [state](../parameter-demo/scenes/otf/state.js) · [共用 sim-parameter-two-stage-view](../parameter-demo/sim-parameter-two-stage-view.js) |
| 16 | `parameters.match` | 逐格填分数 | 36 秒 | 3 | [分镜](../parameter-demo/scenes/match/storyboard.js) · [state](../parameter-demo/scenes/match/state.js) · [共用 sim-parameter-two-stage-view](../parameter-demo/sim-parameter-two-stage-view.js) |
| 17 | `parameters.coarse` | FFT 一次成图 | 44 秒 | 6 | [分镜](../parameter-demo/scenes/coarse/storyboard.js) · [state](../parameter-demo/scenes/coarse/state.js) · [共用 sim-parameter-two-stage-view](../parameter-demo/sim-parameter-two-stage-view.js) |
| 18 | `parameters.refine` | 细化位移 | 68 秒 | 4 | [分镜](../parameter-demo/scenes/refine/storyboard.js) · [state](../parameter-demo/scenes/refine/state.js) · [view](../parameter-demo/scenes/refine/view.js) · [共用 sim-parameter-two-stage-view](../parameter-demo/sim-parameter-two-stage-view.js) |
| 19 | `parameters.least-squares-fit` | 共同幅相估计 | 80 秒 | 7 | [分镜](../parameter-demo/scenes/get-peak/storyboard.js) · [formula-view](../parameter-demo/scenes/get-peak/formula-view.js) · [layout](../parameter-demo/scenes/get-peak/layout.js) · [state](../parameter-demo/scenes/get-peak/state.js) · [view](../parameter-demo/scenes/get-peak/view.js) · [共用 sim-parameter-two-stage-view](../parameter-demo/sim-parameter-two-stage-view.js) |
| 20 | `adopted-weights` | 填回参数 | 28 秒 | 1 | [分镜](scenes/adopted-weights/storyboard.js) · [共用 sim-motion-parameter-view](sim-motion-parameter-view.js) |
| 21 | `separate-bands` | 逐点解混 | 9.5 秒 | 1 | [分镜](scenes/separate-bands/storyboard.js) · [state](scenes/separate-bands/state.js) · [共用 view](scenes/mixed-sources/view.js) |
| 22 | `relocate-bands` | 搬回原处 | 1.65 秒 | 1 | [分镜](scenes/relocate-bands/storyboard.js) · [view](scenes/relocate-bands/view.js) |
| 23 | `recover-high-frequency` | 找回高频 | 1.9 秒 | 1 | [分镜](scenes/recover-high-frequency/storyboard.js) · [共用 view](scenes/relocate-bands/view.js) |
| 24 | `directions` | 三个方向 | 1.8 秒 | 1 | [分镜](scenes/directions/storyboard.js) · [view](scenes/directions/view.js) |
| 25 | `single-direction-support` | 一个方向 | 2.4 秒 | 1 | [分镜](scenes/single-direction-support/storyboard.js) · [共用 view](scenes/directions/view.js) |
| 26 | `combined-support` | 多方向覆盖 | 1.7 秒 | 1 | [分镜](scenes/combined-support/storyboard.js) · [共用 view](scenes/directions/view.js) |
| 27 | `otf-weight` | OTF 加权 | 6.3 秒 | 1 | [分镜](scenes/otf-weight/storyboard.js) · [state](scenes/otf-weight/state.js) · [view](scenes/otf-weight/view.js) |
| 28 | `sum-contributions` | 九项相加 | 2.3 秒 | 1 | [分镜](scenes/sum-contributions/storyboard.js) · [state](scenes/sum-contributions/state.js) · [共用 view](scenes/otf-weight/view.js) |
| 29 | `wiener` | Wiener 滤波 | 2.3 秒 | 1 | [分镜](scenes/wiener/storyboard.js) · [state](scenes/wiener/state.js) · [共用 view](scenes/otf-weight/view.js) |
| 30 | `apodization` | 乘切趾窗 | 2.1 秒 | 1 | [分镜](scenes/apodization/storyboard.js) · [state](scenes/apodization/state.js) · [共用 view](scenes/otf-weight/view.js) |
| 31 | `inverse-fft` | 逆 FFT | 1.7 秒 | 1 | [分镜](scenes/inverse-fft/storyboard.js) · [state](scenes/inverse-fft/state.js) · [共用 view](scenes/otf-weight/view.js) |
| 32 | `image-comparison` | 图像对照 | 1.7 秒 | 1 | [分镜](scenes/image-comparison/storyboard.js) · [view](scenes/image-comparison/view.js) |
| 33 | `frequency-audit` | 核对高频 | 1.7 秒 | 1 | [分镜](scenes/frequency-audit/storyboard.js) · [共用 view](scenes/image-comparison/view.js) |

当前完整页 33 幕；独立参数页 13 幕。仅在独立测试保留的 verify-demix 不进入主线。简单过渡以一个完整分镜为单位；频率编码、临时分离、评分、FFT、细化与 getPeak 提供内部拍定位。

标注“共用”的链接来自 animation-assets.json 的 sceneTemplates；修改前查看该模板的全部使用者。模板共享画面对象，各幕单独拥有内容定义。参数前半段共用持续存在的频谱几何模板 sim-parameter-two-stage-view.js；各幕状态和公式定义已独立。getPeak 已采用拍内时序，其余旧场景仍保留原有内部时序，详见治理约定。

验证状态：数值、公式状态和可逆转场纳入自动检查；实际视觉与字体基线由用户验收，尚未登记通过。
