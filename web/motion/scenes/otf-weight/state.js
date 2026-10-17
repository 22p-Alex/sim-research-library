/* Multiplication and the explanation sample the same scene-local beat. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const scene = node ? require('./storyboard.js') : root.SIMMotionUnits['otf-weight'];
  function create({clamp}) {
    return function frame(lesson, progress, timeline = scene.timeline) {
      const s = scene.present(progress, timeline), band = lesson.pipeline.bands[2];
      return { ...s, phase:'match', index:2, inverseProgress:0,
        views:[{kind:'complex',from:band.shifted,to:band.shifted,mix:0},
          {kind:'scalar',values:band.h},
          {kind:'complex',from:band.shifted,to:band.matched,mix:clamp(s.cues.weight)}],
        titles:['归位频带 C₁,₋₁','共轭 OTF H*₁,₋₁',s.mode==='normalEquation'?'待加权 · 保留输入':'加权贡献 H*C'],
        detail:s.action, foot:s.mode === 'normalEquation' ? '基础正规方程解释 H* 的来源；当前实现的额外零级计数随后单独说明。' : '原频带已有 H · 再乘 H* · 理想情况下留下 |H|²S' };
    };
  }
  if(node)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['otf-weight']=create;
})(typeof globalThis !== 'undefined' ? globalThis : this);
