/* Scene unit: 乘切趾窗. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "乘切趾窗",
    title: "把频谱边缘，平缓收尾。",
    copy: "平滑切趾窗让有限频谱支撑的边缘缓慢收尾，减少截断造成的振铃；代价是边缘信号和高频锐度也被削弱。继续跟踪同一个 q=(14,0)。",
    equation: String.raw`$$\widehat S(\mathbf q)=P_{\mathrm{apo}}(\mathbf q)\,\widehat S_{\mathrm W}(\mathbf q)$$`,
    note: "本例使用截止倍数 1.9、指数 β=0.8，它们不是普适常数。中图是 0—1 实数窗；右图实际乘该窗。平滑边缘与高频幅度保留需要取舍。",
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
