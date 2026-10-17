/* Scene unit: 三帧观测. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    chapter: "03 / 三相位观测",
    label: "三帧观测",
    title: "一个方程不够，让同三个来源换权重再相加。",
    copy: "保留刚才的第一帧。样品与成像系统固定，只将条纹相位依次增加 2π/3，再拍两帧；三个来源不变，混合权重随相位改变。",
    equation: String.raw`$$d_j=\bigl\{s[1+m\cos(2\pi x/p+\phi_j)]\bigr\}*h$$`,
    note: "相移给同三个未知来源增加独立方程；重复同一相位不会改变混合关系。实际调制度与共同相位稍后由观测估计。",
    stageIndex: 5,
    id: "phase-acquisition",
    theoryTopic: "parameters",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: true,
    domainPair: null,
    formulaDomain: "空域 · 相移采集",
    chapterIndex: 2,
    duration: 7000
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
