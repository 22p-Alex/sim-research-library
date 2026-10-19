/* Scene unit: 图像对照. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Clock=node?require('../../../shared/animation/beat-clock.js'):root.SIMBeatClock;
  const scene = {
    label: "图像对照",
    title: "先找结构：对照同一处细纹。",
    copy: "三幅图保持同一视野与强度标尺，框出同一片细纹，再看下方局部放大。先观察哪些结构有所恢复、哪些细节仍损失，随后用同位置剖面核对。",
    equation: String.raw`$$\widehat s(2x,2y)\ \longleftrightarrow\ s(x,y)$$`,
    note: "框选的是同一实际区域，没有独立拉伸局部亮度。样品真值仅在最终评价使用；局部结构对照不能代替全图评价。",
    stageIndex: 21,
    id: "image-comparison",
    theoryTopic: "rmse",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "空域 · 图像评价",
    chapterIndex: 7,
    chapter: "08 / 图像与验证",
    duration: 15000
  };
  const timeline=Clock.define([
    {...scene,key:'structure',duration:7000,action:'同位置细纹与局部放大'},
    {key:'profile',duration:8000,action:'同位置强度剖面',title:'沿同一条线，核对结构与幅度。',
      copy:'保留三幅图与同一行 y=80，收起局部放大，再展开三条实际强度剖面。观察峰谷位置、对比度与仍存在的幅度损失；下一步回到最初跟踪的高频。',
      equation:String.raw`$$y=80:\quad s(x,80),\quad d_{\mathrm{WF}}(x,80),\quad\widehat s(2x,160)$$`,
      note:'剖面使用未截断数据与共同坐标；它只比较同一行，不代表全图误差。全图 RMSE 留到高频核对之后报告。'}
  ]);
  scene.timeline=timeline;scene.beats=timeline.beats;
  scene.present=p=>{const s=timeline.at(p);return {...s.definition,mode:s.mode,beat:s.beat,beatCount:timeline.beats.length};};
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
