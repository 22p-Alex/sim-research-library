/* Scene unit: 核对高频. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "核对高频",
    title: "回到最初那一点，检查恢复了多少。",
    copy: "同一个 q = (14, 0)：宽场完全无法传递，SIM 得到非零信号。幅度保留比例由实际重建和真值计算。",
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
