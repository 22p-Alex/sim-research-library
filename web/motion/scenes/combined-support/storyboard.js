/* Scene unit: 多方向覆盖. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "多方向覆盖",
    title: "加入其余方向，补齐频率覆盖。",
    copy: "同一个样品频率 q，经不同频带到达不同检测位置 f。物镜在这些位置的传递强弱不同；搬回 q 只改坐标，原来乘上的 H 仍留在数据里。",
    equation: String.raw`$$C_{d,\ell}(\mathbf q)=H_{d,\ell}(\mathbf q)S(\mathbf q)$$`,
    note: "C=HS 是参数准确、匹配 OTF、无噪声的理想模型。青色 q 为多带重叠例，橙色高频仅由方向 1 的 −1 级传递；支撑圆不表示圈内 H=1。",
    stageIndex: 15,
    id: "combined-support",
    theoryTopic: "weights",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 覆盖与融合",
    chapterIndex: 5,
    chapter: "06 / 多方向覆盖",
    duration: 1700
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
