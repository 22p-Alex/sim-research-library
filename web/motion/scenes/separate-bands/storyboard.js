/* Scene unit: 逐点解混. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    chapter: "04 / 矩阵解混",
    label: "逐点解混",
    title: "同一行权重，作用于每一个检测频率。",
    copy: "三份观测 Dⱼ(f) 分别乘对应权重，再相加。对每个频率重复这一运算，并分别使用逆矩阵的三行，就得到三份频带。",
    equation: String.raw`$$A_\ell(\mathbf f)=\sum_{j=0}^{2}u_{\ell,j}D_j(\mathbf f),\qquad\ell\in\{0,+1,-1\}$$`,
    note: "使用刚才估计出的相位与调制度计算权重；频带图来自同一批观测的正式解混，仍含 OTF，也尚未归位。",
    stageIndex: 10,
    id: "separate-bands",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: true,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 矩阵解混",
    chapterIndex: 3,
    duration: 9500
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
