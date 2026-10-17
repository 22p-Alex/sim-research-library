/* Scene unit: 九项相加. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "九项相加",
    title: "相加之后，还留下一个传递系数。",
    copy: "将九条加权频带相加，记作累计频谱 U。同一频率处的 S 相同，可以从和式中提出；它前面仍乘着各频带 OTF 模平方的总和。",
    equation: String.raw`$$U(\mathbf q)=\sum_{d,\ell}H_{d,\ell}^{*}C_{d,\ell}=\underbrace{\left(\sum_{d,\ell}|H_{d,\ell}|^2\right)}_{\text{仍需补偿的传递系数}}S(\mathbf q)$$`,
    note: "这里 U 表示加权后的累计频谱。要恢复 S，需要对留下的传递系数作归一化；下一步才引入分母。",
    stageIndex: 17,
    id: "sum-contributions",
    theoryTopic: "weights",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 覆盖与融合",
    chapterIndex: 6,
    chapter: "07 / Wiener 融合",
    duration: 2300
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
