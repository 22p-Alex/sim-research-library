/* Scene unit: 图像对照. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "图像对照",
    title: "沿同一条线，比较找回的结构。",
    copy: "下方剖面只看 y = 80 一行；图下的 RMSE（均方根误差）则把整幅重建与样品真值逐像素比较，是重建后算出的评价指标。",
    equation: String.raw`$$\mathrm{RMSE}=\sqrt{\frac1{128^2}\sum_{x,y}\big[\widehat s(2x,2y)-s(x,y)\big]^2}$$`,
    note: "128² 是比较的像素数；256² 输出取 (2x, 2y) 与真值对齐。误差平方 → 全图平均 → 开方；同一强度标尺下越小越接近真值，不能单独判定分辨率。",
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
