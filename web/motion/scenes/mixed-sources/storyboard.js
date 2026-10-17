/* Scene unit: 来源与矩阵. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    chapter: "04 / 矩阵解混",
    label: "来源与矩阵",
    title: "回到叠加前的三份来源，再建立方程组。",
    copy: "沿用 05 的三份未加权移频频谱，经检测后记作 A₀、A₊₁、A₋₁。读取同一个 f，再让三幅图缩到各自的来源项旁，随方程整理进入 A 向量的对应行。",
    equation: String.raw`$$D_j(\mathbf f)=A_0(\mathbf f)+\frac m2e^{i\phi_j}A_{+1}(\mathbf f)+\frac m2e^{-i\phi_j}A_{-1}(\mathbf f)$$`,
    note: "A 包含检测 OTF，照明系数 m/2 与相位因子留在 M 中。此处只建立符号关系；相位和调制度确定后，才能算出具体权重。",
    stageIndex: 7,
    id: "mixed-sources",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: true,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 矩阵解混",
    chapterIndex: 3,
    duration: 40000
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
