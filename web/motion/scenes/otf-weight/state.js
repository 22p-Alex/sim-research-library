/* Multiplication and the explanation sample the same scene-local beat. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const scene = node ? require('./storyboard.js') : root.SIMMotionUnits['otf-weight'];
  function create({clamp}) {
    return function frame(lesson, progress, timeline = scene.timeline) {
      const s = scene.present(progress, timeline), band = lesson.pipeline.bands[0], other=lesson.pipeline.bands[2];
      const explaining = ['fitObjective','normalEquation'].includes(s.mode);
      return { ...s, phase:'match', index:2, inverseProgress:0,
        showOperators:!explaining,
        focus:[6,0],
        views:[{kind:'complex',from:band.shifted,to:band.shifted,mix:0},
          explaining?{kind:'complex',from:other.shifted,to:other.shifted,mix:0}:{kind:'scalar',values:band.h},
          {kind:'complex',from:band.shifted,to:band.matched,mix:clamp(s.cues.weight)}],
        titles:['归位频带 C₁,₀',explaining?'同一信息：C₁,₋₁':'共轭 OTF H*₁,₀',explaining?'零级 · 保留输入':'加权贡献 H*C'],
        detail:s.action, foot:explaining ? '同一个样品值 → 多带共同拟合 → 正规方程；乘法尚未开始。' : '原频带已有 H · 再乘 H* · 理想情况下留下 |H|²S' };
    };
  }
  if(node)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['otf-weight']=create;
})(typeof globalThis !== 'undefined' ? globalThis : this);
