/* Scene-owned progress state. Data come through the observation adapter. */
(function(root) {
  'use strict';
  function create({ M, E, A, dataFor }) {
    const { clamp, ramp } = M;
  function matchingState(lesson, id, progress) {
    const p=Math.round(clamp(progress)*1e12)/1e12,data=dataFor(lesson);
    const initial=data.examples.filter((c,i,a)=>a.findIndex(t=>t.kx===c.kx&&t.ky===c.ky)===i);
    const remaining=data.valid.filter(c=>!initial.some(t=>t.kx===c.kx&&t.ky===c.ky));
    if(id==='coarse' || p>=.82)return {candidate:lesson.estimate.coarseBest,committed:data.valid,local:1,done:true};
    if(p<.12)return {candidate:data.best,committed:[],local:0,done:false};
    const slow=p<.48, pool=slow?initial:remaining;
    const travel=Math.round((slow?(p-.12)/.36:(p-.48)/.34)*pool.length*1e10)/1e10;
    const i=Math.min(pool.length-1,Math.floor(travel)),local=travel-i;
    const committed=(slow?[]:initial).concat(pool.slice(0,i+(local>=.94?1:0)));
    return {candidate:pool[i],committed,local,done:false};
  }
  function scanState(lesson,progress) {
    const state=matchingState(lesson,'match',progress),data=dataFor(lesson);
    const candidate=data.compare(state.candidate.kx,state.candidate.ky);
    const count=state.done?candidate.count:Math.floor(ramp(state.local,.10,.70)*candidate.count);
    const sum=candidate.points.slice(0,count).reduce((a,p)=>({re:a.re+p.cross.re,im:a.im+p.cross.im}),{re:0,im:0});
    return {...state,candidate,count,sum,transfer:state.done?1:ramp(state.local,.74,.93),
      cost:ramp(progress,.84,.92),total:data.valid.length,
      operations:state.committed.reduce((n,c)=>n+c.count,0)+(state.committed.some(c=>c.kx===candidate.kx&&c.ky===candidate.ky)?0:count)};
  }
    return { matchingState, scanState };
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=create;
  else(root.SIMParameterStateFactories ||= {})['match']=create;
})(typeof globalThis!=='undefined'?globalThis:this);
