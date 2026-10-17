/* Scene unit: 三个方向. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "三个方向",
    title: "汇合三个方向，各自使用估计参数。",
    copy: "回看同一批九帧：每个方向均独立完成临时分离、参数估计与正式解混。60.3° 来自方向 2 的估计波矢换算；三个方向都用各自估计结果归位。",
    equation: String.raw`$$\theta_d=\operatorname{atan2}(k_{y,d},k_{x,d}),\qquad\theta_2=\operatorname{atan2}(7,4)\approx60.3^\circ$$`,
    note: "方向标签读取估计结果，θ = atan2(kᵧ, kₓ) 表示波矢方向（条纹法线）。采集使用整数频率格，当前无噪声估计可回到这些位置。",
    stageIndex: 13,
    id: "directions",
    theoryTopic: "parameters",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "采集 → 频域重建",
    chapterIndex: 5,
    chapter: "06 / 多方向覆盖",
    duration: 1800
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
