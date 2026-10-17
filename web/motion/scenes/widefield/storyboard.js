/* Scene unit: 宽场的边界. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const scene = {
    label: "宽场的边界",
    title: "物镜，挡住了一部分细节。",
    copy: "同一次物镜成像：空域与 PSF 卷积，频域乘 OTF。超出截止 10 格的频率无法传递，橙色的 (14, 0) 就在圈外。",
    equation: String.raw`$$D_{\mathrm{WF}}(\mathbf q)=H(\mathbf q)S(\mathbf q),\qquad H(14,0)=0$$`,
    note: "",
    stageIndex: 1,
    id: "widefield",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: {"leftLabel":"空域 · 与 PSF 卷积","left":"$$d_{\\mathrm{WF}}(\\mathbf r)=(s*\\color{#7ad5cd}{h})(\\mathbf r)$$","bridgeLabel":"PSF → OTF · 傅里叶变换","bridge":"$$\\color{#7ad5cd}{H(\\mathbf q)}=\\mathcal F\\{\\color{#7ad5cd}{h(\\mathbf r)}\\}$$","rightLabel":"频域 · 乘 OTF","right":"$$D_{\\mathrm{WF}}(\\mathbf q)=\\color{#7ad5cd}{H(\\mathbf q)}S(\\mathbf q)$$","rightDetail":"$$H(14,0)=0$$","guide":"h 是点扩散函数（PSF），描述一个点怎样成像；H 就是光学传递函数（OTF）。* 表示卷积。两式是同一成像过程的两种表示。"},
    formulaDomain: "空域 ↔ 频域",
    chapterIndex: 0,
    chapter: "01 / 样品与边界",
    duration: 1500
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
