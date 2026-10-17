/* Scene unit: 核对高频. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "核对高频",
    title: "回到最初那一点，检查恢复了多少。",
    copy: "同一个 q=(14,0)：宽场传递为零；依次核对 Wiener 后的幅度保留率、切趾窗值和最终保留率。三者来自实际数组，最终保留率等于前两者相乘。",
    equation: String.raw`$$\eta=\frac{|\widehat S(\mathbf q)|}{|S(\mathbf q)|},\qquad\Delta\theta=\arg\!\left[\widehat S(\mathbf q)S^*(\mathbf q)\right]$$`,
    note: "真值只用于评价，不参与解混或融合。恢复了部分高频信息，不等于精确恢复全部样品幅度；单点不能代替整幅图的分辨率评价。",
    stageIndex: 22,
    id: "frequency-audit",
    theoryTopic: "rmse",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 高频评价",
    chapterIndex: 7,
    chapter: "08 / 图像与验证",
    duration: 1700
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
