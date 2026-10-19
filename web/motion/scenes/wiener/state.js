/* R0, the source's R, then the reciprocal: three distinct operations. */
(function(root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const scene = node ? require('./storyboard.js') : root.SIMMotionUnits['wiener'];
  function create({clamp}) {
    const complex=(from,to=from,mix=0)=>({kind:'complex',from,to,mix:clamp(mix)});
    return function frame(lesson,progress,timeline=scene.timeline) {
      const s=scene.present(progress,timeline),p=lesson.pipeline,apply=s.mode==='normalize';
      const middle=apply?{kind:'scalar',values:lesson.reciprocal,log:true}:
        {kind:'scalar',values:p.signalResponse,to:p.denominator,mix:s.cues.extraZero,log:true};
      return {...s,phase:'wiener',focus:[6,0],index:-1,inverseProgress:0,
        views:[complex(p.numerator),middle,complex(p.numerator,p.preApoSpectrum,s.cues.normalize)],
        titles:['累计频谱 F_sum',apply?'归一化系数 1/(R+w²)':s.mode==='sourceDenominator'?'R₀ + 额外零级 → R':'基础传递系数 R₀',apply?'滤波频谱 ŜW':'F_sum · 尚未归一化'],
        detail:s.action,
        foot:apply?'理想模型总传递为 R₀/(R+w²) · 不等于处处恢复单位幅度':'分子保持不动 · 零级在分子计一次，实际分母计两次',
        operator:apply?'×':'保持'};
    };
  }
  if(node)module.exports=create;
  else(root.SIMMotionStateFactories ||= {})['wiener']=create;
})(typeof globalThis !== 'undefined' ? globalThis : this);
