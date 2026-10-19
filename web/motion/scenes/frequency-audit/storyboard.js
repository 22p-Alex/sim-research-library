/* Scene unit: 核对高频. Narration, formula and duration are edited here. */
(function(root) {
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Clock=node?require('../../../shared/animation/beat-clock.js'):root.SIMBeatClock;
  const scene = {
    label: "高频与全图误差",
    title: "宽场没有的这一频率，现在有了。",
    copy: "回到最初的 q=(14,0)：宽场传递为零，重建保留了部分非零幅度。把信息找回与幅度损失分开看，再进入最后的全图误差评价。",
    equation: String.raw`$$\eta=\frac{|\widehat S(\mathbf q)|}{|S(\mathbf q)|},\qquad\Delta\theta=\arg\!\left[\widehat S(\mathbf q)S^*(\mathbf q)\right]$$`,
    note: "真值只用于评价，不参与解混或融合。恢复了部分高频信息，不等于精确恢复全部样品幅度；单点不能代替整幅图的分辨率评价。",
    stageIndex: 22,
    id: "frequency-audit",
    theoryTopic: "rmse",
    encodingFormula: false,
    demixFormula: false,
    detectionFormula: false,
    acquisitionFormula: false,
    domainPair: null,
    formulaDomain: "频域 · 高频评价",
    chapterIndex: 7,
    chapter: "08 / 图像与验证",
    duration: 16000
  };
  const timeline=Clock.define([
    {...scene,key:'highFrequency',duration:8000,action:'核对高频从零到非零'},
    {key:'globalError',duration:8000,action:'最后报告全图 RMSE',
      title:'最后看全图误差：恢复高频，不等于强度处处准确。',
      copy:'RMSE 把全图与真值逐像素比较。本例重建的 RMSE 更大：额外零级分母、正则化与切趾改变了强度。它与刚才的局部结构、单点高频回答不同问题。',
      equation:String.raw`$$\mathrm{RMSE}=\sqrt{\frac1{128^2}\sum_{x,y}[\widehat s(2x,2y)-s(x,y)]^2}$$`,
      note:'同一强度标尺、未截断数据、相同位置对齐；不做真值拟合或亮度拉伸。RMSE 不是分辨率指标，真实实验无真值时不能直接计算这种 RMSE。'}
  ]);
  scene.timeline=timeline;scene.beats=timeline.beats;
  scene.present=p=>{const s=timeline.at(p);return {...s.definition,mode:s.mode,beat:s.beat,beatCount:timeline.beats.length};};
  if (typeof module !== 'undefined' && module.exports) module.exports = scene;
  else (root.SIMMotionUnits ||= {})[scene.id] = scene;
})(typeof globalThis !== 'undefined' ? globalThis : this);
