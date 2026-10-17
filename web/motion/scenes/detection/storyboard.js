/* Scene unit: 物镜检测. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "物镜检测",
    title: "同一次检测，空域变模糊，频域受衰减。",
    copy: "上排保留刚才混合的发射频谱，下排演示 PSF 卷积与 OTF 衰减。物镜改变传递强弱；在同一个 f，三个来源仍混在一个观测值里。",
    equation: String.raw`$$d_0=e_0*h,\qquad D_0(\mathbf f)=H(\mathbf f)E_0(\mathbf f)$$`,
    note: "一帧在每个 f 只给出一个复数方程，三个来源仍未知。下一步改变相位，让同三个来源以不同权重再次成像。",
    stageIndex: 4,
    id: "detection",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: true,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "空域 ↔ 频域",
    chapterIndex: 1,
    chapter: "02 / 编码与检测",
    duration: 5200
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
