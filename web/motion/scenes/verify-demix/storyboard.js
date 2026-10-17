/* Scene unit: 验证抵消. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    chapter: "04 / 矩阵解混",
    label: "验证抵消",
    title: "按来源合并，两个抵消，一个保留。",
    copy: "沿用刚才算出的 u，将三帧观测式代入加权和，按来源提出相同的 A。三个括号对应已经核对的三列系数和，依次为 0、0、1。",
    equation: String.raw`$$A_{-1}(\mathbf f)=\left(\sum_j u_{-1,j}\right)A_0(\mathbf f)+\left(\frac m2\sum_j u_{-1,j}e^{i\phi_j}\right)A_{+1}(\mathbf f)+\left(\frac m2\sum_j u_{-1,j}e^{-i\phi_j}\right)A_{-1}(\mathbf f)$$`,
    weightEquation: String.raw`$$A_{-1}(\mathbf f)=\sum_{j=0}^{2}u_{-1,j}D_j(\mathbf f)$$`,
    note: "依据 M⁻¹M = I；只要 M 可逆，这个结论就成立。系数和为 0 不表示样品分量为 0，保留下来的 A₋₁(f) 仍带 H(f)。",
    stageIndex: 8,
    id: "verify-demix",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: true,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 矩阵解混",
    chapterIndex: 3,
    duration: 11000
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
