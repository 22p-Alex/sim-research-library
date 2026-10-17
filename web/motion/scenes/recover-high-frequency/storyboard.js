/* Scene unit: 找回高频. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    chapter: "05 / 频带归位",
    label: "找回高频",
    title: "高频找回来了，衰减还在。",
    copy: "橙色分量回到最初的样品高频 q，超出宽场截止。它仍带着检测位置 f 处的 OTF 衰减，后面才进入融合。",
    equation: String.raw`$$\mathbf q=\mathbf f+\mathbf k,\qquad C_{-1}(\mathbf q)=A_{-1}(\mathbf f)=H(\mathbf f)S(\mathbf q)$$`,
    note: "解混与归位完成。下一步加入其余方向，扩大覆盖，再对实际复数频带做融合。",
    stageIndex: 12,
    id: "recover-high-frequency",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 归位",
    chapterIndex: 4,
    duration: 1900
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
