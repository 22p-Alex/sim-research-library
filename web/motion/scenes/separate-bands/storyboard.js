/* Scene unit: 逐点解混. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Clock=node?require('../../../shared/animation/beat-clock.js'):root.SIMBeatClock;
  const scene = {
    chapter: "04 / 矩阵解混",
    label: "逐点解混",
    title: "沿用 +1 行权重，对完整三帧逐点解混。",
    copy: "把刚补齐的 +1 行展开：三份完整观测 Dⱼ(f) 分别乘对应权重，再相加得到 A₊₁(f)。对每个频率重复；其余两行同理。",
    equation: String.raw`$$A_\ell(\mathbf f)=\sum_{j=0}^{2}u_{\ell,j}D_j(\mathbf f),\qquad\ell\in\{0,+1,-1\}$$`,
    note: "使用刚才估计出的相位与调制度计算权重；频带图来自同一批观测的正式解混，仍含 OTF，也尚未归位。",
    stageIndex: 10,
    id: "separate-bands",
    theoryTopic: null,
    encodingFormula: false,
    demixFormula: true,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 矩阵解混",
    chapterIndex: 3,
    duration: 19500
  };
  const timeline=Clock.define([
    {...scene,key:'applyWeights',duration:14500,action:'用完整三帧正式解混'},
    {key:'separatedStatus',duration:5000,action:'分开了，还没有归位',
      title:'三个来源已分开，位置与传递衰减还没有补偿。',
      copy:'现在得到 0、+1、−1 三条频带，但它们仍按检测频率 f 排列，也仍带着 H(f)。接下来先按波矢归位，再处理多带覆盖与传递强弱。',
      equation:String.raw`$$A_\ell(\mathbf f)\approx H(\mathbf f)S(\mathbf f-\ell\widehat{\mathbf k})$$`,
      note:'仍在同一检测频率读取三个来源；最初的 q=(14,0) 位于 −1 级。下步频带与 OTF 同移，幅度衰减不会因归位自动消失。'}
  ]);
  scene.timeline=timeline;scene.beats=timeline.beats;
  scene.applicationProgress=p=>{const state=timeline.at(p);return state.mode==='applyWeights'?state.local:1;};
  scene.present=p=>{const s=timeline.at(p);return {...s.definition,mode:s.mode,beat:s.beat,beatCount:timeline.beats.length};};
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
