/* Scene unit: Wiener 滤波. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "Wiener 滤波",
    title: "补偿衰减，同时限制反演增益。",
    copy: "前一步留下了 OTF 模平方的累计系数，因此需要归一化。本页按 fairSIM 的计数约定累计分母，记作 R；再加 w²，避免传递很弱时产生过大的反演增益。",
    equation: String.raw`$$\begin{gathered}R(\mathbf q)\coloneqq\sum_d\left(2|H_{d,0}|^2+|H_{d,+1}|^2+|H_{d,-1}|^2\right)\\\widehat S_{\mathrm W}(\mathbf q)=\frac{U(\mathbf q)}{R(\mathbf q)+w^2},\qquad w=0.05\end{gathered}$$`,
    note: "等权基础推导各频带计一次；本页固定 fairSIM 分母额外计入各方向的 0 级模平方。中图显示实际的 1 / (R + w²)。",
    stageIndex: 18,
    id: "wiener",
    theoryTopic: "weights",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 覆盖与融合",
    chapterIndex: 6,
    chapter: "07 / Wiener 融合",
    duration: 2300
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
