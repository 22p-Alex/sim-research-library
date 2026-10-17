/* Scene unit: 样品与频谱. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "样品与频谱",
    title: "细节，藏在高频里。",
    copy: "从同一张西门子星与点对出发。样品 Sample 经二维傅里叶变换得到频谱 Spectrum；橙色标记选中样品频率 q = (14, 0)。",
    equation: String.raw`$$S(\mathbf q)=\mathcal F\{s(\mathbf r)\},\qquad\mathbf q=(14,0)$$`,
    note: "模拟采集使用给定照明；重建从九帧观测估计波矢、相位与调制度。OTF 由已知成像模型提供。",
    stageIndex: 0,
    id: "sample",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: {"leftLabel":"样品 Sample · 空域","left":"$$s(\\mathbf r),\\qquad\\mathbf r=(x,y)$$","bridgeLabel":"二维傅里叶变换 · Fourier Transform","bridge":"$$S=\\mathcal F_N\\{s\\}$$","rightLabel":"样品频谱 Spectrum · 频域","right":"$$S(\\mathbf q),\\qquad\\mathbf q=(q_x,q_y)$$","guide":""},
    formulaDomain: "空域 → 频域",
    chapterIndex: 0,
    chapter: "01 / 样品与边界",
    duration: 1
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
