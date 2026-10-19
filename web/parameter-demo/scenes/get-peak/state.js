/* Pure presentation state. Calculations are read from finalPeak, never rerun here. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Story = node ? require('./storyboard.js') : root.SIMGetPeak;
  const A = node ? require('../../../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
  const Tail = node ? require('./tail-story.js') : root.SIMParameterTail;
  const cache = new WeakMap();
  const fieldMaximum = z => z.re.reduce((m,re,i)=>Math.max(m,Math.hypot(re,z.im[i])),1e-30);
  // This is a display convention, shared by the key and the actual rasters.
  function displayColor(re,im,scale,phaseColor=true) {
    const amplitude=Math.hypot(re,im),rho=Math.min(1,amplitude/scale);
    const hue=amplitude?((Math.atan2(im,re)/(2*Math.PI)+1)%1):0;
    const brightness=Math.log1p(1000*rho)/Math.log1p(1000),sector=hue*6;
    const chroma=(phaseColor ? .78 : 0)*brightness,secondary=chroma*(1-Math.abs(sector%2-1)),base=(phaseColor ? .22 : 1)*brightness;
    const channels=sector<1?[chroma,secondary,0]:sector<2?[secondary,chroma,0]:sector<3?[0,chroma,secondary]
      :sector<4?[0,secondary,chroma]:sector<5?[secondary,0,chroma]:[chroma,0,secondary];
    return {amplitude,rho,hue,brightness,rgb:channels.map(c=>Math.round(255*(c+base)))};
  }
  // Explicit geometry example: it illustrates complex multiplication only.
  // Neither its scale nor its angle is substituted into observed data.
  function alphaGeometry(c) {
    const psi=.20+1.10*c.alphaShared,m=.68,phase=Math.PI/3,scale=1+(m-1)*c.alphaStretch,angle=phase*c.alphaRotate;
    const source={re:Math.cos(psi),im:Math.sin(psi)};
    return {source,scaled:{re:source.re*scale,im:source.im*scale},target:{re:scale*Math.cos(psi+angle),im:scale*Math.sin(psi+angle)},m,phase,scale,angle,psi};
  }
  function alphaFormulaState(c,substep,reduced=false) {
    const scale=reduced?1:c.alphaStretch;
    const expand=reduced?Number(substep!=='alphaStretch'):c.alphaFormulaExpand;
    const rotation=reduced?Number(substep!=='alphaStretch'):c.alphaRotate;
    const merge=reduced?Number(substep==='commonAcross'):c.alphaFormulaMerge;
    return {key:'alphaProduct',scale,expand,rotation,merge,
      details:{magnitude:Clock.ramp(scale,.72,1)*(1-Clock.ramp(expand,0,.4)),
        phase:Clock.ramp(expand,.6,1)*(1-Clock.ramp(merge,0,.4)),relation:Clock.ramp(merge,.6,1)}};
  }
  function shiftPoint(peak,index,progress=1) {
    const r=[index%peak.n,Math.floor(index/peak.n)],theta=-2*Math.PI*(peak.kx*r[0]+peak.ky*r[1])/peak.n;
    const factor={re:Math.cos(theta),im:Math.sin(theta)},turnAngle=Math.atan2(factor.im,factor.re),angle=turnAngle*progress;
    const input={re:peak.spatial[1].re[index],im:peak.spatial[1].im[index]};
    return {index,r,theta,turnAngle,factor,angle,input,
      output:{re:input.re*Math.cos(angle)-input.im*Math.sin(angle),im:input.re*Math.sin(angle)+input.im*Math.cos(angle)}};
  }
  // A unit-vector illustration, with an angle from the locked k and an integer
  // coordinate. No fitted alpha or invented observation enters this geometry.
  function extraAngleGeometry(k,n,r,progress) {
    const delta=2*Math.PI*(k[0]*r[0]+k[1]*r[1])/n;
    const turn=Math.atan2(Math.sin(delta),Math.cos(delta)),angle=turn*progress,psi=.32;
    return {r,delta,turn,angle,psi,source:{re:Math.cos(psi),im:Math.sin(psi)},
      target:{re:Math.cos(psi+angle),im:Math.sin(psi+angle)}};
  }
  // Semantic equations and continuous motion use the same local cue. The
  // renderer interpolates positions throughout each operation, not just opacity.
  function inverseProof(p) {
    const stages=Story.inverseStages,c=p.cues;
    let index=0,transition=null;
    for(let i=1;i<stages.length;i++) {
      const amount=c[stages[i].cue];
      if(amount===1)index=i;
      else if(amount>0){transition={amount,from:i-1,to:i,kind:stages[i].key,fade:stages[i].fade};index=amount<.5?i-1:i;break;}
      else break;
    }
    const current=stages[index],active=new Set(current.tokens);
    const fade=transition?(transition.amount<.5?1-Clock.ramp(transition.amount,0,.45):Clock.ramp(transition.amount,.55,1)):1;
    const tokenAlpha=Object.fromEntries(Object.keys(Story.inverseTokens).map(key=>[key,
      active.has(key)?transition?.fade.includes(key)?fade:1:0]));
    let emphasis=[],auxiliary=null;
    if(p.substep==='substituteAddress') {
      auxiliary='address';
      // The focus belongs to the f slots, not to the complete B1 or kernel.
      emphasis=[];
    } else if(p.substep==='substituteBand'){auxiliary='band';emphasis=['alphaInside','bandZero','bandShifted'];}
    else if(p.substep==='factorAlpha')emphasis=['alpha','alphaInside'];
    else if(p.substep==='splitKernel'){auxiliary='split';emphasis=['kernelCombined','kernelReference','kernelExtra'];}
    else if(p.substep==='factorOut'){auxiliary='factor';emphasis=['kernelExtra','extraOutside'];}
    const match=c.factorOutside===1&&c.deltaDefinition===0;
    if(p.substep==='recognizeU')emphasis=['matchedU','u'];
    if(p.substep==='nameAngle'||p.substep==='extraAngle'||p.substep==='holdAngle')emphasis=['extraOutside','kernelDelta'];
    return {stage:current.key,index,active:current.tokens,tokenAlpha,emphasis,auxiliary,match,motion:transition,
      transition:transition?.amount||0,equation:current.tokens.map(key=>Story.inverseTokens[key]).join(' ')};
  }
  // All positions are local SVG units. Widths are measured once from native
  // MathML (or supplied by a non-browser test); seeking needs no layout reads.
  function inverseMotion(proof,widths,em=34,room=1130) {
    const gap=.12*em,stages=Story.inverseStages,{ramp}=Clock;
    const advance=key=>widths[key]||em;
    function arrange(stage,left=0){
      let x=left;const result={};
      for(const key of stage.tokens){result[key]=x;x+=advance(key)+gap;}
      return {positions:result,width:x-left-gap};
    }
    const definitionWidth=arrange(stages[0]).width,maxWidth=Math.max(...stages.map(stage=>arrange(stage).width));
    // Center the original v equation itself, leaving space on its right for
    // the address to grow. The left-hand side then remains a stable anchor.
    const left=Math.max(0,Math.min((room-definitionWidth)/2,room-maxWidth));
    const stable=arrange(stages[proof.index],left).positions,actors={};
    for(const key of Object.keys(Story.inverseTokens))actors[key]={x:stable[key]??left,y:0,scale:1,opacity:key in stable?1:0};
    const m=proof.motion;
    if(!m)return {actors,left,em,definitionWidth,maxWidth};
    const t=m.amount,from=arrange(stages[m.from],left).positions,to=arrange(stages[m.to],left).positions;
    const lerp=(a,b)=>a+(b-a)*t;
    for(const key of Object.keys(actors)){
      const before=key in from,after=key in to;
      actors[key]={x:lerp(from[key]??to[key]??left,to[key]??from[key]??left),y:0,scale:1,
        opacity:before&&after?1:before?1-ramp(t,.05,.45):after?ramp(t,.55,.95):0};
    }
    const replace=(old,next)=>{
      const start=from[old],end=to[next];
      actors[old].x=lerp(start,end);actors[old].y=-.42*em*t;
      actors[next].x=lerp(start,end);actors[next].y=.42*em*(1-t);
    };
    if(m.kind==='address'){
      const growth=ramp(t,.18,.95),mix=(a,b)=>a+(b-a)*growth;
      for(const key of Object.keys(actors))actors[key].x=mix(from[key]??to[key]??left,to[key]??from[key]??left);
      for(const [old,next] of [['sumF','sumQ'],['bandF','bandShifted'],['kernelF','kernelCombined']]){
        actors[old].x=actors[next].x=mix(from[old],to[next]);
        actors[old].y=actors[next].y=0;
      }
    }
    if(m.kind==='band'){
      replace('equal','approx');replace('bandShifted','bandZero');
      actors.alphaInside.x=lerp(from.bandShifted,to.alphaInside);actors.alphaInside.y=-.6*em*(1-t);
    }
    const carry=(old,next,lift)=>{
      actors[old].opacity=0;
      actors[next]={x:lerp(from[old],to[next]),y:-lift*Math.sin(Math.PI*t),scale:1,opacity:1};
    };
    if(m.kind==='alpha')carry('alphaInside','alpha',.9*em);
    if(m.kind==='split'){
      actors.kernelCombined.opacity=1-ramp(t,.08,.43);
      actors.kernelReference={x:lerp(from.kernelCombined,to.kernelReference),y:0,scale:1,opacity:ramp(t,.43,.72)};
      actors.kernelExtra={x:lerp(from.kernelCombined+.55*advance('kernelCombined'),to.kernelExtra),
        y:-.65*em*(1-t),scale:.65+.35*t,opacity:ramp(t,.30,.65)};
    }
    if(m.kind==='factor')carry('kernelExtra','extraOutside',1.45*em);
    if(m.kind==='recognize'){
      const names=['norm','sumQ','bandZero','kernelReference'];
      const start=from.norm,end=from.kernelReference+advance('kernelReference'),center=(start+end)/2;
      const target=to.u+advance('u')/2,scale=1-.82*t,mid=lerp(center,target);
      for(const key of names)actors[key]={x:mid+(from[key]-center)*scale,y:0,scale,opacity:1-ramp(t,.35,.78)};
      actors.u={x:lerp(center-advance('u')/2,to.u),y:2.5*em*(1-t),scale:.7+.3*t,opacity:ramp(t,.30,.76)};
    }
    if(m.kind==='named'){
      actors.extraOutside.x=lerp(from.extraOutside,to.kernelDelta);actors.extraOutside.scale=1-.35*t;
      actors.kernelDelta={x:to.kernelDelta,y:0,scale:.8+.2*t,opacity:ramp(t,.55,.95)};
    }
    return {actors,left,em,definitionWidth,maxWidth};
  }
  function inverseAddressExpansion(amount,parts,widths,em=36){
    const {ramp}=Clock,growth=ramp(amount,.18,.95),qMix=ramp(amount,.05,.30);
    const oldAlpha=1-qMix,qAlpha=qMix;
    const mix=(a,b)=>a+(b-a)*growth;
    function compose(kind){
      const band=kind==='band',prefix=band?parts.bandPrefix:parts.baseE+parts.phasePrefix;
      const tail=band?parts.bandClose:parts.phaseTail,wf=band?parts.f:parts.supF,wq=band?parts.q:parts.supQ;
      const wk=band?parts.plusK:parts.supPlus,open=band?0:parts.supOpen,close=band?0:parts.supClose;
      const base=wf+(wq-wf)*qMix,variable=base+(open+wk+close)*growth;
      const width=mix(widths[band?'bandF':'kernelF'],widths[band?'bandShifted':'kernelCombined']);
      const ratio=width/(prefix+variable+tail),out={};
      const add=(key,x,alpha=1,sx=1)=>{out[key]={x:x*ratio,y:0,sx:sx*ratio,opacity:alpha};};
      if(band)add('bandPrefix',0);else{add('baseE',0);add('phasePrefix',parts.baseE);add('supOpen',prefix,Number(growth>0),growth);}
      const start=prefix+open*growth;
      add(band?'f':'supF',start,oldAlpha);add(band?'q':'supQ',start,qAlpha);
      add(band?'plusK':'supPlus',start+base,Number(growth>0),growth);
      if(!band)add('supClose',start+base+wk*growth,Number(growth>0),growth);
      add(band?'bandClose':'phaseTail',prefix+variable);
      return {parts:out,width,box:{x:prefix*ratio-.12*em,y:band?.65*em:.16*em,
        width:variable*ratio+.24*em,height:band?1.15*em:1.02*em}};
    }
    return {growth,qMix,band:compose('band'),kernel:compose('kernel')};
  }
  function dataFor(lesson) {
    if (cache.has(lesson)) return cache.get(lesson);
    const peak = lesson.estimate.finalPeak;
    if (!peak || !peak.valid) throw new Error('共同幅相动画需要有效的 fairSIM finalPeak。');
    let sampleIndex = 0, maximum = -1;
    for (let i = 0; i < peak.count; i++) {
      const angle = -2 * Math.PI * (peak.kx * (i % peak.n) + peak.ky * Math.floor(i / peak.n)) / peak.n;
      const weight = peak.energy[i] * (.05 + Math.abs(Math.sin(angle / 2)));
      if (weight > maximum) { maximum = weight; sampleIndex = i; }
    }
    const integer = Number.isInteger(peak.kx) && Number.isInteger(peak.ky);
    // Reuse evaluated observations; never interpolate display pixels or read truth.
    const points = lesson.estimate.fit.points.filter(p => peak.masks[0][A.idx(...p.q, peak.n)] && p.energy > 1e-12
      && (!integer || peak.masks[1][A.idx(p.q[0]+peak.kx,p.q[1]+peak.ky,peak.n)]));
    const frequencyPoint = [...points].sort((a,b) => Math.abs(b.h0-b.h1)*Math.sqrt(b.energy)-Math.abs(a.h0-a.h1)*Math.sqrt(a.energy))[0];
    if (!frequencyPoint) throw new Error('共同幅相入口需要有信号的可靠对应频点。');
    const samples = [sampleIndex], phase = i => Math.atan2(peak.spatial[0].im[i],peak.spatial[0].re[i]);
    const candidates = Array.from({length:peak.count},(_,i)=>i).filter(i=>peak.energy[i]>1e-12).sort((a,b)=>peak.energy[b]-peak.energy[a]);
    for(const i of candidates) {
      if(samples.length===3)break;
      if(samples.every(j=>Math.abs(Math.atan2(Math.sin(phase(i)-phase(j)),Math.cos(phase(i)-phase(j))))>.5))samples.push(i);
    }
    while(samples.length<3)samples.push(sampleIndex);
    const magnitude = (z,i) => Math.hypot(z.re[i],z.im[i]);
    const comparisonMaximum = Math.max(1e-30,...samples.flatMap(i=>[magnitude(peak.spatial[0],i),magnitude(peak.shifted,i)]));
    const displayScales={prepared:peak.prepared.map(fieldMaximum),spatial:peak.spatial.map(fieldMaximum),shifted:fieldMaximum(peak.spatial[1])};
    const displayIndex=A.idx(...frequencyPoint.q,peak.n),displaySample={re:peak.prepared[0].re[displayIndex],im:peak.prepared[0].im[displayIndex]};
    // The multiplier is determined only by locked k and array coordinates.
    const phaseField={re:new Float64Array(peak.count),im:new Float64Array(peak.count)};
    for(let i=0;i<peak.count;i++){
      const theta=-2*Math.PI*(peak.kx*(i%peak.n)+peak.ky*Math.floor(i/peak.n))/peak.n;
      phaseField.re[i]=Math.cos(theta);phaseField.im[i]=Math.sin(theta);
    }
    let anglePosition=[0,0],angleScore=Infinity;
    for(let y=0;y<Math.min(peak.n,16);y++)for(let x=0;x<Math.min(peak.n,16);x++) {
      const delta=2*Math.PI*(peak.kx*x+peak.ky*y)/peak.n;
      const score=Math.abs(delta-Math.PI/2)+.0001*(x*x+y*y);
      if(score<angleScore){anglePosition=[x,y];angleScore=score;}
    }
    const data = { peak, sampleIndex, samples, comparisonMaximum, frequencyPoint, frequencyPoints:points.slice(0,8),displayScales,displaySample,phaseField,anglePosition };
    cache.set(lesson, data); return data;
  }
  function presentation(progress, timeline = Story.timeline) {
    const t = timeline.at(progress), b = t.definition, c = t.cues;
    const step = b.steps?.filter(s=>s.at<=t.local+1e-10).at(-1), current = {...b,...step}, f=current.formula;
    const handoff = t.beat===0 && c.handoffEnd===0;
    let formula = { equation:'$$'+f.parts.map(p=>p.tex).join(f.join)+'$$',parts:f.parts,
      emphasis:f.emphasis.filter(e=>e.at<=t.local+1e-10).at(-1).parts,
      motion:f.motion ? alphaFormulaState(c,step.key) : null };
    const proof=inverseProof({cues:c,substep:step?.key});
    if(b.key==='finalInverse'&&t.local>=8/60)formula={...formula,equation:'$$'+proof.equation+'$$',
      parts:proof.active.map(key=>({key,tex:Story.inverseTokens[key]})),emphasis:proof.emphasis};
    // Independently replayable stops hold their result. On entry only the
    // immediately preceding panel exits; earlier explanations cannot linger.
    const enter = t.beat ? t.panels[t.beat] : 1;
    const panels = t.panels.map((alpha,i) => t.beat===0 ? (i===0 ? c.nativeLayout : 0)
      : i===t.beat ? enter : i===t.beat-1 ? 1-enter : 0);
    const tail=Tail.state(b.key,t.local);
    return { tail, mode: b.key, start: b.start, end: b.end, action: b.action, title: current.title, copy: current.copy, note: current.note, footer: b.footer,
      beat: t.beat, beatCount: timeline.beats.length, local: t.local, progress: t.progress, panels, cues: c,proof,
      textAlpha: 1, overview: 1-c.nativeLayout, body:c.nativeLayout,
      substep:step?.key || b.key, boundary:b.start+(b.end-b.start)*(step?.at||0),
      handoff, formula: { ...formula, mode: (step ? b.key+'-'+step.key : b.key)+(tail&&tail.seconds>=2?'-stage':''), opacity:1 },
      domain: b.domain, layout: b.layout,
      cue: current.title, chromeAlpha:1 };
  }
  function narrative(progress) { return presentation(progress); }
  function state(lesson, progress, timeline = Story.timeline) {
    const p = presentation(progress, timeline), { peak, samples,sampleIndex,displayScales,displaySample,anglePosition } = dataFor(lesson), c = p.cues;
    const count = !c.sumFirst ? 0 : Math.min(peak.count, 1 + Math.floor((c.sumSweep + 1e-12) * (peak.count - 1)));
    const solved = c.divide === 1, read = c.readReady === 1;
    const selection=p.mode==='finalCompare'&&p.local>=.76 ? p.local<.82?1:p.local<.88?2:0 : 0;
    const sample = p.mode === 'finalSum' ? Math.max(0, count - 1) : samples[selection];
    const actualColor=displayColor(displaySample.re,displaySample.im,displayScales.prepared[0]);
    const rho=(.02+.98*c.colorAmplitude)*(1-c.colorPaint)+actualColor.rho*c.colorPaint;
    const angle=2*Math.PI*c.colorPhase+Math.atan2(displaySample.im,displaySample.re)*c.colorPaint;
    const colorValue={re:rho*Math.cos(angle),im:rho*Math.sin(angle)};
    const displayKey={...displayColor(colorValue.re,colorValue.im,1),...colorValue,angle,actual:c.colorPaint===1,alpha:c.colorEnter*(1-c.colorExit)};
    const scanCount=Math.min(peak.count,Math.floor((c.shiftScan+1e-12)*peak.count));
    const scanIndex=c.shiftScan>0?Math.max(0,scanCount-1):sampleIndex;
    const pointwise={...shiftPoint(peak,scanIndex,c.shift),count:scanCount,
      alpha:c.scanGuide*(1-c.scanRelease),arrange:c.scanArrange*(1-c.scanRelease),
      referenceAlpha:1-Math.max(c.pointLayout,c.scanReferenceHide)*(1-c.scanRelease),
      write:c.shiftOutput*(1-c.scanPointClear)};
    return { ...p, inverse: c.inverse, shift: c.shift, shiftOutput: c.shiftOutput, shiftScan: c.shiftScan, compare:c.compare,
      conjugate: c.conjugate, multiply: c.multiply, divide: c.divide, solved, read: Number(read),
      count, total: peak.count, sum: peak.sums[count], sample, r: [sample % peak.n, Math.floor(sample / peak.n)],
      alpha: solved ? { ...peak.alpha } : null, m: read ? peak.m : null, phase: read ? peak.phase : null,
      phaseRead: c.phaseRead, lengthRead: c.lengthRead, cards: c.cards, k: [peak.kx, peak.ky],
      lockedAlpha:1-c.lockRetire, frequencyPointAlpha:c.addressPoint*(1-c.frequencyPointExit),
      geometry:alphaGeometry(c),extraAngle:extraAngleGeometry([peak.kx,peak.ky],peak.n,anglePosition,c.positiveTurn),
      illustrationAlpha:Clock.ramp(c.alphaDemo,.55,1)*(1-Clock.ramp(c.alphaRetire,0,.45)),
      comparisonAlpha:c.compare*(1-Clock.ramp(c.alphaDemo,0,.45)+Clock.ramp(c.alphaRetire,.55,1)),displayKey,pointwise,
      resultAlpha: c.resultEnter, divisionAlpha: 1 - c.readEnter, readAlpha: c.readEnter,
      contributionTravel: c.sumScan ? (count % peak.n) / peak.n : c.contribution };
  }
  Object.assign(Story, { dataFor, presentation, narrative, state,displayColor,alphaGeometry,alphaFormulaState,shiftPoint,extraAngleGeometry,inverseMotion,inverseAddressExpansion });
  if (node) module.exports = Story;
})(typeof globalThis !== 'undefined' ? globalThis : this);
