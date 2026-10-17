/* Scene unit: 图像对照. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "图像对照",
    title: "沿同一条线，比较找回的结构。",
    copy: "剖面只看 y=80 一行，RMSE 比较整幅图。本例 SIM 的 RMSE 反而更大：额外零级分母、正则化和切趾共同抑制幅度；恢复部分高频不等于全图强度更准确。",
    equation: String.raw`$$\mathrm{RMSE}=\sqrt{\frac1{128^2}\sum_{x,y}\big[\widehat s(2x,2y)-s(x,y)\big]^2}$$`,
    note: "误差平方 → 全图平均 → 开方。输出在 (2x,2y) 与 128² 真值对齐；使用未截断强度，不另行拉伸亮度。RMSE 不是分辨率指标，真值只在重建结束后用于评价。",
    stageIndex: 21,
    id: "image-comparison",
    theoryTopic: "rmse",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "空域 · 图像评价",
    chapterIndex: 7,
    chapter: "08 / 图像与验证",
    duration: 1700
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
