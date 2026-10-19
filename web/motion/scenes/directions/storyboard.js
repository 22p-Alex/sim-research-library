/* Scene unit: 三个方向. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "三个方向",
    title: "一个方向已经走完，现在回看其余两组采集。",
    copy: "回看同一批九帧：另外两个方向分别重复刚才的临时分离、参数估计、正式解混与归位。九帧并非重新拍摄；接下来比较三个方向合起来能覆盖哪些样品频率。",
    equation: String.raw`$$\theta_d=\operatorname{atan2}(k_{y,d},k_{x,d}),\qquad\theta_2=\operatorname{atan2}(7,4)\approx60.3^\circ$$`,
    note: "方向标签读取各自估计结果；方向 2 的 60.3° 由估计波矢 (4,7) 换算。θ 表示波矢方向，即条纹法线。下一幕先摆出方向 1 的支撑，再叠加其余方向。",
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
    duration: 7200
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
