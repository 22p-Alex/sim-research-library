/* Display the same final working arrays in frequency space. The FFT below is
 * a change of representation of finalPeak.shifted, not another estimator. */
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Story=node?require('./mainline-story.js'):root.SIMCoefficientMainline;
  const A=node?require('../../../atlas/sim-atlas-core.js'):root.SIMAtlas;
  const Clock=node?require('../../../shared/animation/beat-clock.js'):root.SIMBeatClock;
  const cache=new WeakMap(),value=(z,i)=>({re:z.re[i],im:z.im[i]}),energy=z=>z.re*z.re+z.im*z.im;
  const product=(u,v)=>({re:u.re*v.re+u.im*v.im,im:u.re*v.im-u.im*v.re});
  function dataFor(lesson){
    if(cache.has(lesson))return cache.get(lesson);
    const peak=lesson.estimate.finalPeak,n=peak.n,U=peak.prepared[0];
    // F{v exp(-i delta)} evaluates B1(q+k), also for fractional k. This keeps
    // fairSIM's own two masks and normalization instead of reusing search data.
    const V=A.spectrum(peak.shifted.re,n,peak.shifted.im),points=[],sums=[{re:0,im:0,energy:0}];
    for(let i=0;i<n*n;i++){
      const u=value(U,i),e=energy(u);if(e===0)continue;
      const v=value(V,i),z=product(u,v),last=sums.at(-1),q=[A.bin(i%n,n),A.bin(Math.floor(i/n),n)];
      points.push({i,q,u,v,energy:e,product:z,h0:A.otf(...q,lesson.capture.config.cutoff),h1:A.otf(q[0]+peak.kx,q[1]+peak.ky,lesson.capture.config.cutoff)});
      sums.push({re:last.re+z.re,im:last.im+z.im,energy:last.energy+e});
    }
    if(!points.length)throw new Error('幅相主线需要非零参考能量。');
    const sorted=[...points].sort((a,b)=>a.energy-b.energy);
    const sample=[...points].sort((a,b)=>Math.abs(b.h0-b.h1)*Math.sqrt(b.energy)-Math.abs(a.h0-a.h1)*Math.sqrt(a.energy))[0];
    const examples=[sorted[Math.floor(sorted.length*.15)],sorted[Math.floor(sorted.length*.55)],sorted.at(-1)];
    const last=sums.at(-1),alpha={re:last.re/last.energy,im:last.im/last.energy};
    const result={peak,n,U,V,points,sums,sample,examples,alpha,total:points.length};cache.set(lesson,result);return result;
  }
  function state(lesson,progress,clock=Story.timeline){
    const p=Story.presentation(progress,clock),d=dataFor(lesson),r=Clock.ramp,t=p.local;
    const pooled=p.mode==='pooledRatio',read=p.mode==='readParameters',sub=p.subProgress;
    const count=read?d.total:pooled?Math.min(d.total,Math.floor(r(t,.34,.80)*d.total+1e-8)):0;
    return {...p,count,total:d.total,sum:d.sums[count],alpha:read||pooled&&t>=.80?d.alpha:null,
      overview:p.mode==='correspondence'?1:p.mode==='singleRatio'?1-r(sub,0,.07):0,
      handoff:p.mode==='correspondence'?0:r(sub,0,.07),
      recall:p.mode==='correspondence'?r(t,0,.12):p.mode==='singleRatio'?1-r(sub,0,.07):0,
      reliableCaption:p.mode==='correspondence'?r(t,.12,.20):0,
      correction:1,expand:r(sub,.18,.25),sigma:r(sub,.50,.565),
      result:read?1:pooled?r(t,.80,.88):0,
      magnitude:read?r(t,.20,.42):0,phase:read?r(t,.44,.66):0,cards:read?r(t,.08,.22):0};
  }

  function wavevectorLock(local){
    const r=Clock.ramp,rise=r(local,.22,.27),settle=r(local,.27,.33);
    return {lift:.42*rise*(1-settle),prime:1-r(local,.252,.27),hat:r(local,.27,.288),
      emphasis:rise*(1-settle),locked:local>=.27};
  }
  function correspondenceBridge(local){
    return {aligned:Clock.ramp(local,.35,.39),quotient:Clock.ramp(local,.40,.445),handoff:Clock.ramp(local,.46,.51)};
  }
  function correspondenceMotion(local){
    const r=Clock.ramp;
    const firstGrowth=r(local,.475,.493),rename=r(local,.59,.63),lastGrowth=r(local,.82,.86);
    return {alpha:local<.59?1-r(local,.46,.475):r(local,.64,.675)*(1-lastGrowth),
      factor:r(local,.493,.51)*(1-rename)+r(local,.87,.92),
      growth:local<.59?firstGrowth:local<.82?1-rename:lastGrowth,
      substitute:r(local,.69,.78),final:local>=.82};
  }
  Object.assign(Story,{dataFor,state,product,wavevectorLock,correspondenceBridge,correspondenceMotion});if(node)module.exports=Story;
})(typeof globalThis!=='undefined'?globalThis:this);
