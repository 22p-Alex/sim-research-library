/* Scene unit: 搬回原处. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    chapter: "05 / 频带归位",
    label: "搬回原处",
    title: "带着 OTF，一起回到原处。",
    copy: "+1 级向左 8 格，−1 级向右 8 格。每个频带、OTF 轮廓和选中分量同步移动。",
    equation: String.raw`$$\mathbf q=\mathbf f-\ell\mathbf k,\qquad C_\ell(\mathbf q)=A_\ell(\mathbf q+\ell\mathbf k)$$`,
    note: "虚线是原检测支撑，彩色轮廓是归位后的 OTF 支撑。坐标改变，同一分量的复数值不变。",
    stageIndex: 11,
    id: "relocate-bands",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 归位",
    chapterIndex: 4,
    duration: 1650
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
