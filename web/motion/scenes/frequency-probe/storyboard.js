/* Scene unit: 固定频率 f. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    chapter: "03 / 三相位观测",
    label: "固定频率 f",
    title: "固定同一个 f，读出三个方程的观测值。",
    copy: "三帧分别做 FFT，在同一个检测频率 f 读取 D₀、D₁、D₂。三个复数读数对应同三个来源；接下来回看这些来源从哪里来。",
    equation: String.raw`$$D_0(\mathbf f),\qquad D_1(\mathbf f),\qquad D_2(\mathbf f)$$`,
    note: "f 表示任一选定的检测频率；三帧必须取同一位置。图像亮度表示 log(1 + 幅度)，实际解混使用完整复数。",
    stageIndex: 6,
    id: "frequency-probe",
    theoryTopic: "parameters",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 观测",
    chapterIndex: 2,
    duration: 2400
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
