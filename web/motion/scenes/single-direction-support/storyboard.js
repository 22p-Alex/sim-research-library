/* Scene unit: 一个方向. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "一个方向",
    title: "从九帧回到频域，先摆出方向 1 的覆盖。",
    copy: "三组观测都按同一流程处理。现在先把方向 1 的三个归位 OTF 放在样品频率坐标中：0 级居中，+1、−1 级扩展两侧；下一幕再叠加另外两个方向。",
    equation: String.raw`$$H_{d,\ell}(\mathbf q)=H(\mathbf q+\ell\mathbf k_d)$$`,
    note: "圆的位置表示可传递的几何范围。圈内信号仍受 OTF 衰减，边界不等于稳定恢复质量。",
    stageIndex: 14,
    id: "single-direction-support",
    theoryTopic: "weights",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 覆盖与融合",
    chapterIndex: 5,
    chapter: "06 / 多方向覆盖",
    duration: 2400
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
