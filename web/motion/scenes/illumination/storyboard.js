/* Scene unit: 条纹照明. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "条纹照明",
    title: "三次曝光，分别固定三个相位。",
    copy: "每次曝光中条纹保持固定，帧间切换到 0、2π/3、4π/3。选择下方相位，对照同一点 P 的激发光强与荧光变化。",
    equation: String.raw`$$e_j(x)=s(x)\left[1+m\cos\!\left(\frac{2\pi x}{p}+\phi_j\right)\right]$$`,
    note: "m 表示调制度，p 表示条纹间距。图像按模拟照明生成；重建所用的实际照明参数稍后从观测中估计。",
    stageIndex: 2,
    id: "illumination",
    theoryTopic: "parameters",
    encodingFormula: true,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "空域 · 荧光激发",
    chapterIndex: 1,
    chapter: "02 / 编码与检测",
    duration: 1600
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
