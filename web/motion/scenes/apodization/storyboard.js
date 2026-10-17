/* Scene unit: 乘切趾窗. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "乘切趾窗",
    title: "把频谱边缘，平缓收尾。",
    copy: "最后乘上平滑切趾窗，压低频谱边缘。窗外的频率置零，边缘的信号也会被进一步削弱。",
    equation: String.raw`$$\widehat S(\mathbf q)=P_{\mathrm{apo}}(\mathbf q)\,\widehat S_{\mathrm W}(\mathbf q)$$`,
    note: "切趾截止为检测截止的 1.9 倍，指数 β = 0.8。频谱共用亮度标尺；中图是 0—1 的实数窗。",
    stageIndex: 19,
    id: "apodization",
    theoryTopic: "weights",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 覆盖与融合",
    chapterIndex: 6,
    chapter: "07 / Wiener 融合",
    duration: 2100
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
