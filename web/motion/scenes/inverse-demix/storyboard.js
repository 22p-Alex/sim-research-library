/* Scene unit: 求逆与权重. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    chapter: "04 / 矩阵解混",
    label: "求逆与权重",
    title: "先求出解法，权重中的参数还待确定。",
    copy: "两边左乘 M⁻¹，得到 A = UD，再按行逐项展开 U；每一行与同一组三帧相乘求和，取出一个来源。",
    equation: String.raw`$$\mathbf A(\mathbf f)=U\mathbf D(\mathbf f),\qquad U=M^{-1}$$`,
    weightEquation: String.raw`$$A_{-1}(\mathbf f)=\sum_{j=0}^{2}u_{-1,j}D_j(\mathbf f)$$`,
    note: "闭式结果要求等间隔三相位且 m ≠ 0。先逐项写出系数，下一步再检查哪些量已知、哪些量还待确定。",
    stageIndex: 8,
    id: "inverse-demix",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: true,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 矩阵解混",
    chapterIndex: 3,
    duration: 24000
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
