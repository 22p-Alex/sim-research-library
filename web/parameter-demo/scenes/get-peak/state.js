/* Pure presentation state. Calculations are read from finalPeak, never rerun here. */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const Story = node ? require('./storyboard.js') : root.SIMGetPeak;
  const A = node ? require('../../../atlas/sim-atlas-core.js') : root.SIMAtlas;
  const Clock = node ? require('../../../shared/animation/beat-clock.js') : root.SIMBeatClock;
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
    const formula = { equation:'$$'+f.parts.map(p=>p.tex).join(f.join)+'$$',parts:f.parts,
      emphasis:f.emphasis.filter(e=>e.at<=t.local+1e-10).at(-1).parts,
      motion:f.motion ? alphaFormulaState(c,step.key) : null };
    // Independently replayable stops hold their result. On entry only the
    // immediately preceding panel exits; earlier explanations cannot linger.
    const enter = t.beat ? t.panels[t.beat] : 1;
    const panels = t.panels.map((alpha,i) => t.beat===0 ? (i===0 ? c.nativeLayout : 0)
      : i===t.beat ? enter : i===t.beat-1 ? 1-enter : 0);
    return { mode: b.key, start: b.start, end: b.end, action: b.action, title: current.title, copy: current.copy, note: current.note, footer: b.footer,
      beat: t.beat, beatCount: timeline.beats.length, local: t.local, progress: t.progress, panels, cues: c,
      textAlpha: 1, overview: 1-c.nativeLayout, body:c.nativeLayout,
      substep:step?.key || b.key, boundary:b.start+(b.end-b.start)*(step?.at||0),
      handoff, formula: { ...formula, mode: step ? b.key+'-'+step.key : b.key, opacity:1 },
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
  Object.assign(Story, { dataFor, presentation, narrative, state,displayColor,alphaGeometry,alphaFormulaState,shiftPoint,extraAngleGeometry });
  if (node) module.exports = Story;
})(typeof globalThis !== 'undefined' ? globalThis : this);
