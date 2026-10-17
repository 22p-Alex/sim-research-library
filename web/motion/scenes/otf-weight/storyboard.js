/* Scene unit: OTF 加权. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "OTF 加权",
    title: "已有一个 H，再乘共轭 H*。",
    copy: "对同一 q 的各条复数观测，分别乘各自的共轭 OTF。此步形成加权贡献，接着求和、除以累计传递系数，才得到融合结果。",
    equation: String.raw`$$B_{d,\ell}=H_{d,\ell}^{*}C_{d,\ell}=H_{d,\ell}^{*}H_{d,\ell}S=|H_{d,\ell}|^2S$$`,
    note: "H* 是本步的乘数；连同后续归一化，实际融合权重为 g = H* / (R + w²)，随频率变化。它与前面从三帧提取级次的解混权重 u 不同。",
    stageIndex: 16,
    id: "otf-weight",
    theoryTopic: "weights",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 覆盖与融合",
    chapterIndex: 6,
    chapter: "07 / Wiener 融合",
    duration: 6300
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
