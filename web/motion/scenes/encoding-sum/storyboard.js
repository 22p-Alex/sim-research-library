/* Scene unit: 编码叠加. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "编码叠加",
    title: "高频带进来了，三个来源也混在了一起。",
    copy: "三份移频频谱按照明权重逐点相加。在标记的同一个 f，三个复数贡献合成一个值；接下来相机只能记录它们经过物镜后的总和。",
    equation: String.raw`$$E_j(\mathbf f)=S(\mathbf f)+\frac m2e^{i\phi_j}S(\mathbf f-\mathbf k)+\frac m2e^{-i\phi_j}S(\mathbf f+\mathbf k)$$`,
    note: "零级权重为 1，旁带权重为 (m/2)e^{±iφⱼ}。图像用固定相位演示，公式保留待估参数；下一步经过检测，再设法解开混合。",
    stageIndex: null,
    encodingSum: true,
    id: "encoding-sum",
    theoryTopic: null,
    encodingFormula: true,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 编码与叠加",
    chapterIndex: 1,
    chapter: "02 / 编码与检测",
    duration: 6500
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
